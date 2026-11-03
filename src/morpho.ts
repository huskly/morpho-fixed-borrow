import {
  encodeAbiParameters,
  encodePacked,
  getAddress,
  keccak256,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { blueAbi, midnightAbi, oracleAbi } from "./abi.ts";
import { CHAIN_ID, MIDNIGHT, MORPHO_API, MORPHO_BLUE, USDC } from "./config.ts";
import { toAssetsUp } from "./math.ts";

// ---------- Morpho Blue ----------

export type BlueMarketParams = {
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: bigint;
};

export async function readBlue(client: PublicClient, marketId: Hex, user: Address) {
  const [params, position, market] = await Promise.all([
    client.readContract({ address: MORPHO_BLUE, abi: blueAbi, functionName: "idToMarketParams", args: [marketId] }),
    client.readContract({ address: MORPHO_BLUE, abi: blueAbi, functionName: "position", args: [marketId, user] }),
    client.readContract({ address: MORPHO_BLUE, abi: blueAbi, functionName: "market", args: [marketId] }),
  ]);
  const [loanToken, collateralToken, oracle, irm, lltv] = params;
  const [, borrowShares, collateral] = position;
  const [, , totalBorrowAssets, totalBorrowShares] = market;
  // Uses the last stored totals, so this slightly UNDER-estimates the live debt (interest accrues every block).
  // That is the safe direction for sizing a migration: the callback reverts if it would over-repay.
  const debt = toAssetsUp(borrowShares, totalBorrowAssets, totalBorrowShares);
  const marketParams: BlueMarketParams = { loanToken, collateralToken, oracle, irm, lltv };
  return { marketParams, borrowShares, collateral, debt };
}

// ---------- Midnight ----------

export type CollateralParams = { token: Address; lltv: bigint; liquidationCursor: bigint; oracle: Address };
export type MidnightMarket = {
  chainId: bigint;
  midnight: Address;
  loanToken: Address;
  collateralParams: CollateralParams[];
  maturity: bigint;
  rcfThreshold: bigint;
  enterGate: Address;
  liquidatorGate: Address;
};

export const marketAbiParams = [
  {
    type: "tuple",
    components: [
      { name: "chainId", type: "uint256" },
      { name: "midnight", type: "address" },
      { name: "loanToken", type: "address" },
      {
        name: "collateralParams",
        type: "tuple[]",
        components: [
          { name: "token", type: "address" },
          { name: "lltv", type: "uint256" },
          { name: "liquidationCursor", type: "uint256" },
          { name: "oracle", type: "address" },
        ],
      },
      { name: "maturity", type: "uint256" },
      { name: "rcfThreshold", type: "uint256" },
      { name: "enterGate", type: "address" },
      { name: "liquidatorGate", type: "address" },
    ],
  },
] as const;

const SSTORE2_PREFIX = "0x600b380380600b5f395ff3";

// IdLib.toId
export function midnightMarketId(market: MidnightMarket): Hex {
  const encoded = encodeAbiParameters(marketAbiParams, [market]);
  const codeHash = keccak256(encodePacked(["bytes", "bytes"], [SSTORE2_PREFIX, encoded]));
  return keccak256(encodePacked(["uint8", "address", "uint256", "bytes32"], [0xff, market.midnight, 0n, codeHash]));
}

type ApiMarket = {
  chain_id: number;
  midnight: string;
  loan_token: string;
  collaterals: { token: string; lltv: string; liquidation_cursor: string; oracle: string }[];
  maturity: number;
  rcf_threshold: string;
  enter_gate: string;
  liquidator_gate: string;
};

export function marketFromApi(m: ApiMarket): MidnightMarket {
  return {
    chainId: BigInt(m.chain_id),
    midnight: getAddress(m.midnight),
    loanToken: getAddress(m.loan_token),
    collateralParams: m.collaterals.map((c) => ({
      token: getAddress(c.token),
      lltv: BigInt(c.lltv),
      liquidationCursor: BigInt(c.liquidation_cursor),
      oracle: getAddress(c.oracle),
    })),
    maturity: BigInt(m.maturity),
    rcfThreshold: BigInt(m.rcf_threshold),
    enterGate: getAddress(m.enter_gate),
    liquidatorGate: getAddress(m.liquidator_gate),
  };
}

async function api<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = `${MORPHO_API}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url);
  const body = (await res.json()) as T & { error?: unknown };
  if (!res.ok) throw new Error(`Morpho API ${res.status} for ${url}: ${JSON.stringify(body.error ?? body)}`);
  return body;
}

type ApiBook = ApiMarket & { market_id: string; midnight: string; bids: { tick: number; price: string; assets: string }[] };

export type Candidate = { id: Hex; market: MidnightMarket; collateralIndex: number; bestBidTick: bigint | null };

// Midnight markets that mirror the given Blue market: same loan token, and a collateral slot with the same
// token, LLTV and oracle. Markets with a different oracle exist and are priced very differently; they are ignored.
export async function findMirrorMarkets(blue: BlueMarketParams): Promise<Candidate[]> {
  const books: ApiBook[] = [];
  let cursor: string | undefined;
  do {
    const params: Record<string, string> = { chain_ids: String(CHAIN_ID), loan_tokens: USDC, sort: "maturity", limit: "20" };
    if (cursor) params.cursor = cursor;
    const page = await api<{ data: ApiBook[]; cursor?: string }>("/v0/midnight/books", params);
    books.push(...page.data);
    cursor = page.data.length ? page.cursor : undefined;
  } while (cursor);

  const out: Candidate[] = [];
  for (const book of books) {
    const market = marketFromApi(book);
    const collateralIndex = market.collateralParams.findIndex(
      (c) => c.token === getAddress(blue.collateralToken) && c.lltv === blue.lltv && c.oracle === getAddress(blue.oracle),
    );
    if (collateralIndex < 0 || market.loanToken !== getAddress(blue.loanToken)) continue;
    const id = midnightMarketId(market);
    if (id.toLowerCase() !== book.market_id.toLowerCase()) {
      throw new Error(`market id mismatch for ${book.market_id}: API market struct hashes to ${id}`);
    }
    if (market.midnight !== getAddress(MIDNIGHT) || market.chainId !== CHAIN_ID) {
      throw new Error(`market ${id} is not on the expected Midnight deployment`);
    }
    out.push({ id, market, collateralIndex, bestBidTick: book.bids.length ? BigInt(book.bids[0].tick) : null });
  }
  return out;
}

export type Offer = {
  market: MidnightMarket;
  buy: boolean;
  maker: Address;
  start: bigint;
  expiry: bigint;
  tick: bigint;
  group: Hex;
  callback: Address;
  callbackData: Hex;
  receiverIfMakerIsSeller: Address;
  ratifier: Address;
  reduceOnly: boolean;
  maxUnits: bigint;
  maxAssets: bigint;
  continuousFeeCap: bigint;
};

export type TakeableOffer = { offer: Offer; ratifierData: Hex; units: bigint; validUntil: number };

type ApiTakeable = {
  units: string;
  ratifier_data: Hex;
  valid_until: number;
  market_id: string;
  offer: {
    market: ApiMarket;
    buy: boolean;
    maker: string;
    start: number;
    expiry: number;
    tick: number;
    group: Hex;
    callback: string;
    callback_data: Hex;
    receiver_if_maker_is_seller: string;
    ratifier: string;
    reduce_only: boolean;
    max_units: string;
    max_assets: string;
    continuous_fee_cap: string;
  };
};

// Best lender (bid) offers for borrowing `assets` of the loan token in market `id`.
export async function quoteBorrow(id: Hex, assets: bigint): Promise<TakeableOffer[]> {
  const res = await api<{ data: { takeable_offers: ApiTakeable[] } }>(`/v0/midnight/books/${id}/bids/quote`, {
    assets: assets.toString(),
    slippage: "0.1", // only affects how many fallback offers are returned; we take the best offer at its own tick
    limit: "5",
  });
  return res.data.takeable_offers.map((t) => {
    const o = t.offer;
    const offer: Offer = {
      market: marketFromApi(o.market),
      buy: o.buy,
      maker: getAddress(o.maker),
      start: BigInt(o.start),
      expiry: BigInt(o.expiry),
      tick: BigInt(o.tick),
      group: o.group,
      callback: getAddress(o.callback),
      callbackData: o.callback_data,
      receiverIfMakerIsSeller: getAddress(o.receiver_if_maker_is_seller),
      ratifier: getAddress(o.ratifier),
      reduceOnly: o.reduce_only,
      maxUnits: BigInt(o.max_units),
      maxAssets: BigInt(o.max_assets),
      continuousFeeCap: BigInt(o.continuous_fee_cap),
    };
    if (midnightMarketId(offer.market).toLowerCase() !== id.toLowerCase() || !offer.buy) {
      throw new Error(`API returned an offer that is not a bid on market ${id}`);
    }
    return { offer, ratifierData: t.ratifier_data, units: BigInt(t.units), validUntil: t.valid_until };
  });
}

export async function readMidnightPosition(client: PublicClient, c: Candidate, user: Address) {
  const [position, collateral] = await Promise.all([
    client.readContract({ address: MIDNIGHT, abi: midnightAbi, functionName: "position", args: [c.id, user] }),
    client.readContract({
      address: MIDNIGHT,
      abi: midnightAbi,
      functionName: "collateral",
      args: [c.id, user, BigInt(c.collateralIndex)],
    }),
  ]);
  const [credit, , , , debt] = position;
  return { credit, debt, collateral };
}

export async function oraclePrice(client: PublicClient, oracle: Address): Promise<bigint> {
  return client.readContract({ address: oracle, abi: oracleAbi, functionName: "price" });
}

// Price per unit the borrower receives, as computed in Midnight.take for a bid: tick price minus settlement fee.
export async function sellerPrice(client: PublicClient, c: Candidate, tickPrice: bigint) {
  const block = await client.getBlock();
  const ttm = c.market.maturity > block.timestamp ? c.market.maturity - block.timestamp : 0n;
  const fee = await client.readContract({ address: MIDNIGHT, abi: midnightAbi, functionName: "settlementFee", args: [c.id, ttm] });
  return { price: tickPrice - fee, settlementFee: fee, ttm };
}
