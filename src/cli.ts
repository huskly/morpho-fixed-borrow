#!/usr/bin/env node
import { parseArgs } from "node:util";
import {
  createPublicClient,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  http,
  maxUint256,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { blueAbi, callbackAbi, erc20Abi, midnightAbi } from "./abi.ts";
import { CALLBACK, CHAIN_ID, DEFAULT_RPC, LOANS, MIDNIGHT, MORPHO_BLUE, RENEWAL_CALLBACK, USDC, type LoanConfig } from "./config.ts";
import {
  formatUnits,
  maxDebt,
  parseUnits,
  priceToApr,
  sellerAssetsForUnits,
  tickToPrice,
  unitsForAssets,
  unitsForExactAssets,
} from "./math.ts";
import {
  findMirrorMarkets,
  marketAbiParams,
  oraclePrice,
  quoteBorrow,
  readBlue,
  readMidnightPosition,
  sellerPrice,
  type Candidate,
  type TakeableOffer,
} from "./morpho.ts";
import { checkSigner, confirm, send, type Sender } from "./send.ts";

const USAGE = `Usage: morpho-fixed-borrow <command> [options]

Commands:
  status                       Blue loans, Midnight positions and callback authorizations
  quote    --loan L            Fixed borrow rates for every maturity mirroring the Blue market
  migrate  --loan L --maturity YYYY-MM-DD --max-rate PCT [--amount USDC] [--buffer USDC]
                               Move the Blue loan into the fixed-rate market in one take()
  cleanup  --loan L --maturity YYYY-MM-DD
                               Repay leftover Blue debt from your USDC and move leftover collateral
  roll     --loan L --from-maturity YYYY-MM-DD --maturity YYYY-MM-DD --max-rate PCT [--amount USDC]
                               Roll the Midnight loan into a later maturity in one take()
  revoke                       Remove the callbacks' authorizations on Blue and Midnight

Options:
  --loan          ${Object.keys(LOANS).join(" | ")}
  --from          Your address (default: $ETH_FROM)
  --rpc-url       Ethereum RPC (default: $ETH_RPC_URL or ${DEFAULT_RPC})
  --signer        trezor (default) | unlocked (local anvil fork only)
  --hd-path       Trezor derivation path (default: cast's default, m/44'/60'/0'/0/0)
  --yes           Do not ask for confirmation before each transaction
`;

const { positionals, values: opts } = parseArgs({
  allowPositionals: true,
  options: {
    loan: { type: "string" },
    maturity: { type: "string" },
    "from-maturity": { type: "string" },
    "max-rate": { type: "string" },
    amount: { type: "string" },
    buffer: { type: "string", default: "1" },
    from: { type: "string" },
    "rpc-url": { type: "string" },
    signer: { type: "string", default: "trezor" },
    "hd-path": { type: "string" },
    yes: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

const USDC_DECIMALS = 6;
const usd = (x: bigint) => formatUnits(x, USDC_DECIMALS);
const isoDate = (ts: bigint) => new Date(Number(ts) * 1000).toISOString().slice(0, 10);
const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
const daysLeft = (maturity: bigint, now: bigint) =>
  maturity > now ? `${(Number(maturity - now) / 86400).toFixed(1)} days left` : "MATURED: liquidatable, roll or repay now";

function required(name: keyof typeof opts): string {
  const v = opts[name];
  if (typeof v !== "string" || !v) throw new Error(`--${name} is required\n\n${USAGE}`);
  return v;
}

function loanArg(): LoanConfig {
  const key = required("loan").toLowerCase();
  const loan = LOANS[key];
  if (!loan) throw new Error(`unknown --loan ${key}; expected one of ${Object.keys(LOANS).join(", ")}`);
  return loan;
}

async function verifyDeployment(client: PublicClient) {
  const chainId = await client.getChainId();
  if (BigInt(chainId) !== CHAIN_ID) throw new Error(`RPC is on chain ${chainId}, expected ${CHAIN_ID}`);
  const [midnight, blue] = await Promise.all([
    client.readContract({ address: CALLBACK, abi: callbackAbi, functionName: "MORPHO_MIDNIGHT" }),
    client.readContract({ address: CALLBACK, abi: callbackAbi, functionName: "MORPHO_BLUE" }),
  ]);
  if (getAddress(midnight) !== getAddress(MIDNIGHT) || getAddress(blue) !== getAddress(MORPHO_BLUE)) {
    throw new Error(`callback ${CALLBACK} is wired to ${midnight}/${blue}, not Midnight/Blue`);
  }
  const renewalMidnight = await client.readContract({ address: RENEWAL_CALLBACK, abi: callbackAbi, functionName: "MORPHO_MIDNIGHT" });
  if (getAddress(renewalMidnight) !== getAddress(MIDNIGHT)) {
    throw new Error(`renewal callback ${RENEWAL_CALLBACK} is wired to ${renewalMidnight}, not Midnight`);
  }
}

async function authorizations(client: PublicClient, user: Address) {
  const [blue, midnight, renewal] = await Promise.all([
    client.readContract({ address: MORPHO_BLUE, abi: blueAbi, functionName: "isAuthorized", args: [user, CALLBACK] }),
    client.readContract({ address: MIDNIGHT, abi: midnightAbi, functionName: "isAuthorized", args: [user, CALLBACK] }),
    client.readContract({ address: MIDNIGHT, abi: midnightAbi, functionName: "isAuthorized", args: [user, RENEWAL_CALLBACK] }),
  ]);
  return { blue, midnight, renewal };
}

async function mirrorForMaturity(blueParams: Awaited<ReturnType<typeof readBlue>>["marketParams"], maturity: string) {
  const all = await findMirrorMarkets(blueParams);
  const matches = all.filter((c) => isoDate(c.market.maturity) === maturity);
  if (!matches.length) {
    const dates = [...new Set(all.map((c) => isoDate(c.market.maturity)))].join(", ");
    throw new Error(`no Midnight market mirrors this Blue market for ${maturity}. Available: ${dates || "none"}`);
  }
  // Higher tick = higher price = lower borrow rate.
  matches.sort((a, b) => Number((b.bestBidTick ?? -1n) - (a.bestBidTick ?? -1n)));
  return matches[0];
}

function healthFactor(collateral: bigint, price: bigint, lltv: bigint, debt: bigint): string {
  if (debt === 0n) return "-";
  return (Number(maxDebt(collateral, price, lltv)) / Number(debt)).toFixed(3);
}

// ---------- commands ----------

async function status(client: PublicClient, user: Address) {
  const auth = await authorizations(client, user);
  console.log(`Account ${user}`);
  console.log(`Callback ${CALLBACK} authorized on Blue: ${auth.blue}, on Midnight: ${auth.midnight}`);
  console.log(`Renewal callback ${RENEWAL_CALLBACK} authorized on Midnight: ${auth.renewal}`);
  const now = (await client.getBlock()).timestamp;
  for (const loan of Object.values(LOANS)) {
    const blue = await readBlue(client, loan.blueMarketId, user);
    const p = await oraclePrice(client, blue.marketParams.oracle);
    console.log(`\n${loan.symbol}/USDC`);
    console.log(
      `  Blue (variable):  debt ${usd(blue.debt)} USDC, collateral ${formatUnits(blue.collateral, loan.decimals, 8)} ${loan.symbol}, ` +
        `HF ${healthFactor(blue.collateral, p, blue.marketParams.lltv, blue.debt)}`,
    );
    for (const c of await findMirrorMarkets(blue.marketParams)) {
      const pos = await readMidnightPosition(client, c, user);
      if (pos.debt === 0n && pos.collateral === 0n && pos.credit === 0n) continue;
      const lltv = c.market.collateralParams[c.collateralIndex].lltv;
      console.log(
        `  Midnight ${isoDate(c.market.maturity)} (${daysLeft(c.market.maturity, now)}): owes ${usd(pos.debt)} USDC at maturity, collateral ` +
          `${formatUnits(pos.collateral, loan.decimals, 8)} ${loan.symbol}, HF ${healthFactor(pos.collateral, p, lltv, pos.debt)}  (${c.id})`,
      );
    }
  }
}

async function quote(client: PublicClient, user: Address) {
  const loan = loanArg();
  const blue = await readBlue(client, loan.blueMarketId, user);
  const size = blue.debt > 0n ? blue.debt : 10n ** 9n;
  console.log(`${loan.symbol}/USDC fixed borrow quotes for ${usd(size)} USDC (oracle/LLTV identical to the Blue market):`);
  for (const c of await findMirrorMarkets(blue.marketParams)) {
    const offers = c.bestBidTick === null ? [] : await quoteBorrow(c.id, size);
    if (!offers.length) {
      console.log(`  ${isoDate(c.market.maturity)}  no offers  (${c.id})`);
      continue;
    }
    const best = offers[0];
    const sp = await sellerPrice(client, c, tickToPrice(best.offer.tick));
    const fills = sellerAssetsForUnits(best.units, sp.price) >= size ? "fills in one offer" : `only ${usd(sellerAssetsForUnits(best.units, sp.price))} in best offer`;
    console.log(`  ${isoDate(c.market.maturity)}  ${pct(priceToApr(sp.price, sp.ttm))} APR  ${fills}  (${c.id})`);
  }
}

type Plan = Awaited<ReturnType<typeof planMigration>>;

async function planMigration(client: PublicClient, user: Address, loan: LoanConfig, c: Candidate) {
  const blue = await readBlue(client, loan.blueMarketId, user);
  if (blue.borrowShares === 0n) throw new Error(`no ${loan.symbol}/USDC debt on Blue`);
  const buffer = parseUnits(opts.buffer!, USDC_DECIMALS);
  const maxTarget = blue.debt - buffer;
  const target = opts.amount ? parseUnits(opts.amount, USDC_DECIMALS) : maxTarget;
  if (target <= 0n || target > maxTarget) {
    throw new Error(`--amount must be between 0 and ${usd(maxTarget)} (Blue debt minus --buffer)`);
  }

  const [best] = await quoteBorrow(c.id, target);
  if (!best) throw new Error("no lender offers on this market");
  const sp = await sellerPrice(client, c, tickToPrice(best.offer.tick));
  const units = unitsForAssets(target, sp.price);
  const proceeds = sellerAssetsForUnits(units, sp.price);
  if (units > best.units) {
    throw new Error(`best offer only covers ${usd(sellerAssetsForUnits(best.units, sp.price))} USDC; pass a smaller --amount`);
  }
  const apr = priceToApr(sp.price, sp.ttm);
  const maxRate = Number(required("max-rate")) / 100;
  if (!(apr <= maxRate)) throw new Error(`rate ${pct(apr)} is above --max-rate ${pct(maxRate)}`);

  const collateralMoved = proceeds === blue.debt ? blue.collateral : (blue.collateral * proceeds) / blue.debt;
  const existing = await readMidnightPosition(client, c, user);
  const params = c.market.collateralParams[c.collateralIndex];
  const price = await oraclePrice(client, params.oracle);
  return { blue, best, sp, units, proceeds, apr, collateralMoved, existing, params, price };
}

function printPlan(loan: LoanConfig, c: Candidate, p: Plan) {
  const leftDebt = p.blue.debt - p.proceeds;
  const leftColl = p.blue.collateral - p.collateralMoved;
  const newDebt = p.existing.debt + p.units;
  const newColl = p.existing.collateral + p.collateralMoved;
  console.log(`
Migration plan (${loan.symbol}/USDC)
  Fixed-rate market:  ${c.id}
  Maturity:           ${isoDate(c.market.maturity)} (${(Number(p.sp.ttm) / 86400).toFixed(1)} days)
  Fixed rate:         ${pct(p.apr)} APR (tick ${p.best.offer.tick}, settlement fee ${formatUnits(p.sp.settlementFee, 18, 6)} per unit)
  Lender:             ${p.best.offer.maker}
  USDC borrowed:      ${usd(p.proceeds)} -> repays Blue debt
  Owed at maturity:   ${usd(p.units)} USDC (interest ${usd(p.units - p.proceeds)})
  Collateral moved:   ${formatUnits(p.collateralMoved, loan.decimals, 8)} ${loan.symbol}
  Callback fee:       0
  Midnight after:     debt ${usd(newDebt)}, collateral ${formatUnits(newColl, loan.decimals, 8)}, HF ${healthFactor(newColl, p.price, p.params.lltv, newDebt)}
  Left on Blue:       ~${usd(leftDebt)} USDC debt + interest, ${formatUnits(leftColl, loan.decimals, 8)} ${loan.symbol} (run "cleanup" after)
`);
}

// Midnight.take of a lender's bid, selling `units` (= borrowing) with a Tenor callback that receives the proceeds.
function takeCalldata(user: Address, best: TakeableOffer, units: bigint, callback: Address, callbackData: Hex) {
  return encodeFunctionData({
    abi: midnightAbi,
    functionName: "take",
    args: [best.offer, best.ratifierData, units, user, callback, callback, callbackData],
  });
}

function migrationCallbackData(p: Plan): Hex {
  return encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          {
            name: "sourceMarketParams",
            type: "tuple",
            components: [
              { name: "loanToken", type: "address" },
              { name: "collateralToken", type: "address" },
              { name: "oracle", type: "address" },
              { name: "irm", type: "address" },
              { name: "lltv", type: "uint256" },
            ],
          },
          { name: "feeRate", type: "uint256" },
          { name: "feeRecipient", type: "address" },
          { name: "tick", type: "uint256" },
        ],
      },
    ],
    [{ sourceMarketParams: p.blue.marketParams, feeRate: 0n, feeRecipient: zeroAddress, tick: p.best.offer.tick }],
  );
}

// BorrowMidnightRenewalCallback.CallbackData{Market sourceMarket; uint256 feeRate; address feeRecipient; uint256 tick}
function renewalCallbackData(r: RollPlan): Hex {
  return encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { name: "sourceMarket", type: "tuple", components: marketAbiParams[0].components },
          { name: "feeRate", type: "uint256" },
          { name: "feeRecipient", type: "address" },
          { name: "tick", type: "uint256" },
        ],
      },
    ],
    [{ sourceMarket: r.source.market, feeRate: 0n, feeRecipient: zeroAddress, tick: r.best.offer.tick }],
  );
}

async function migrate(client: PublicClient, sender: Sender) {
  const user = sender.from;
  const loan = loanArg();
  const blue = await readBlue(client, loan.blueMarketId, user);
  const c = await mirrorForMaturity(blue.marketParams, required("maturity"));
  printPlan(loan, c, await planMigration(client, user, loan, c));
  await confirm(sender, "Proceed with this migration?");
  await checkSigner(sender);

  const auth = await authorizations(client, user);
  if (!auth.blue) {
    await send(client, sender, "Authorize callback on Morpho Blue", MORPHO_BLUE,
      encodeFunctionData({ abi: blueAbi, functionName: "setAuthorization", args: [CALLBACK, true] }));
  }
  if (!auth.midnight) {
    await send(client, sender, "Authorize callback on Morpho Midnight", MIDNIGHT,
      encodeFunctionData({ abi: midnightAbi, functionName: "setIsAuthorized", args: [CALLBACK, true, user] }));
  }

  // Re-quote right before the take: offers and the Blue debt may have moved while authorizations were confirmed.
  const fresh = await planMigration(client, user, loan, c);
  console.log(`\nFresh quote: ${pct(fresh.apr)} APR, borrow ${usd(fresh.proceeds)} USDC, owe ${usd(fresh.units)} USDC at ${isoDate(c.market.maturity)}`);
  await send(client, sender, "Take fixed-rate offer and migrate (Midnight.take)", MIDNIGHT,
    takeCalldata(user, fresh.best, fresh.units, CALLBACK, migrationCallbackData(fresh)));

  console.log("\nDone. Current state:");
  await status(client, user);
}

async function ensureAllowance(client: PublicClient, sender: Sender, token: Address, symbol: string, spender: Address, amount: bigint) {
  const allowance = await client.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [sender.from, spender] });
  if (allowance >= amount) return;
  await send(client, sender, `Approve ${symbol} for ${spender}`, token,
    encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, amount] }));
}

async function cleanup(client: PublicClient, sender: Sender) {
  const user = sender.from;
  const loan = loanArg();
  const blue = await readBlue(client, loan.blueMarketId, user);
  const c = await mirrorForMaturity(blue.marketParams, required("maturity"));
  const collateralToken = blue.marketParams.collateralToken;
  // Collateral already in the wallet (e.g. withdrawn by an interrupted cleanup) is moved to Midnight as well.
  const walletCollateral = await client.readContract({ address: collateralToken, abi: erc20Abi, functionName: "balanceOf", args: [user] });
  console.log(`Left on Blue: ${usd(blue.debt)} USDC debt, ${formatUnits(blue.collateral, loan.decimals, 8)} ${loan.symbol}`);
  console.log(`In wallet:    ${formatUnits(walletCollateral, loan.decimals, 8)} ${loan.symbol}`);
  if (blue.borrowShares === 0n && blue.collateral === 0n && walletCollateral === 0n) return console.log("Nothing to clean up.");
  const toSupply = blue.collateral + walletCollateral;
  await confirm(sender, `Repay the Blue remainder from your wallet and supply ${formatUnits(toSupply, loan.decimals, 8)} ${loan.symbol} to the ${isoDate(c.market.maturity)} market?`);
  await checkSigner(sender);

  if (blue.borrowShares > 0n) {
    // Repaying by shares closes the position exactly; allow for interest accrued since the last stored totals.
    const budget = blue.debt + blue.debt / 1000n + 1n;
    const balance = await client.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [user] });
    if (balance < budget) throw new Error(`need ~${usd(budget)} USDC in the wallet to repay the Blue remainder, have ${usd(balance)}`);
    await ensureAllowance(client, sender, USDC, "USDC", MORPHO_BLUE, budget);
    await send(client, sender, "Repay remaining Blue debt", MORPHO_BLUE,
      encodeFunctionData({ abi: blueAbi, functionName: "repay", args: [blue.marketParams, 0n, blue.borrowShares, user, "0x"] }));
  }
  if (blue.collateral > 0n) {
    await send(client, sender, "Withdraw remaining Blue collateral", MORPHO_BLUE,
      encodeFunctionData({ abi: blueAbi, functionName: "withdrawCollateral", args: [blue.marketParams, blue.collateral, user, user] }));
  }
  if (toSupply > 0n) {
    await ensureAllowance(client, sender, collateralToken, loan.symbol, MIDNIGHT, toSupply);
    await send(client, sender, "Supply collateral to Midnight", MIDNIGHT,
      encodeFunctionData({
        abi: midnightAbi,
        functionName: "supplyCollateral",
        args: [c.market, BigInt(c.collateralIndex), toSupply, user],
      }));
  }
  console.log("\nDone. Current state:");
  await status(client, user);
}

type RollPlan = Awaited<ReturnType<typeof planRoll>>;

// Sizes the new loan so its proceeds repay the source debt exactly: the renewal callback then moves all collateral
// in the same transaction (it reverts with ExcessRepayment if the proceeds exceed the debt).
async function planRoll(client: PublicClient, user: Address, source: Candidate, target: Candidate) {
  const src = await readMidnightPosition(client, source, user);
  if (src.debt === 0n) throw new Error(`no debt on the ${isoDate(source.market.maturity)} market`);
  const amount = opts.amount ? parseUnits(opts.amount, USDC_DECIMALS) : src.debt;
  if (amount <= 0n || amount > src.debt) throw new Error(`--amount must be between 0 and ${usd(src.debt)} (the source debt)`);

  // The callback only moves collateral tokens the target market also lists; anything else would stay behind.
  const sourceCollateral = await Promise.all(
    source.market.collateralParams.map((_, i) =>
      client.readContract({ address: MIDNIGHT, abi: midnightAbi, functionName: "collateral", args: [source.id, user, BigInt(i)] }),
    ),
  );
  source.market.collateralParams.forEach((p, i) => {
    if (sourceCollateral[i] > 0n && !target.market.collateralParams.some((t) => t.token === p.token)) {
      throw new Error(`target market does not list collateral ${p.token}; it would stay on the source market`);
    }
  });

  const [best] = await quoteBorrow(target.id, amount);
  if (!best) throw new Error("no lender offers on the target market");
  const sp = await sellerPrice(client, target, tickToPrice(best.offer.tick));
  const units = unitsForExactAssets(amount, sp.price);
  if (sellerAssetsForUnits(units, sp.price) !== amount) throw new Error("could not size the take to repay the source exactly");
  if (units > best.units) {
    throw new Error(`best offer only covers ${usd(sellerAssetsForUnits(best.units, sp.price))} USDC; pass a smaller --amount`);
  }
  const apr = priceToApr(sp.price, sp.ttm);
  const maxRate = Number(required("max-rate")) / 100;
  if (!(apr <= maxRate)) throw new Error(`rate ${pct(apr)} is above --max-rate ${pct(maxRate)}`);

  const collateralMoved = amount === src.debt ? src.collateral : (src.collateral * amount) / src.debt;
  const existing = await readMidnightPosition(client, target, user);
  const params = target.market.collateralParams[target.collateralIndex];
  const price = await oraclePrice(client, params.oracle);
  const now = (await client.getBlock()).timestamp;
  return { source, target, src, amount, best, sp, units, apr, collateralMoved, existing, params, price, now };
}

function printRollPlan(loan: LoanConfig, r: RollPlan) {
  const early = r.source.market.maturity > r.now ? r.source.market.maturity - r.now : 0n;
  const newDebt = r.existing.debt + r.units;
  const newColl = r.existing.collateral + r.collateralMoved;
  console.log(`
Roll plan (${loan.symbol}/USDC)
  From:               ${isoDate(r.source.market.maturity)} (${daysLeft(r.source.market.maturity, r.now)})  ${r.source.id}
  To:                 ${isoDate(r.target.market.maturity)} (${(Number(r.sp.ttm) / 86400).toFixed(1)} days)  ${r.target.id}
  Fixed rate:         ${pct(r.apr)} APR (tick ${r.best.offer.tick}, settlement fee ${formatUnits(r.sp.settlementFee, 18, 6)} per unit)
  Lender:             ${r.best.offer.maker}
  USDC borrowed:      ${usd(r.amount)} -> repays ${r.amount === r.src.debt ? "all" : "part"} of the ${isoDate(r.source.market.maturity)} debt (${usd(r.src.debt)})
  Owed at new maturity: ${usd(r.units)} USDC (interest ${usd(r.units - r.amount)})
  Collateral moved:   ${formatUnits(r.collateralMoved, loan.decimals, 8)} ${loan.symbol}
  Callback fee:       0
  New position:       debt ${usd(newDebt)}, collateral ${formatUnits(newColl, loan.decimals, 8)}, HF ${healthFactor(newColl, r.price, r.params.lltv, newDebt)}${
    early > 0n
      ? `\n  Rolling early:      the old debt is repaid at face value ${(Number(early) / 86400).toFixed(1)} days before maturity; ` +
        `~${usd((r.amount * BigInt(Math.round(r.apr * 1e6)) * early) / (365n * 86400n * 1_000_000n))} USDC of extra interest`
      : ""
  }
`);
}

async function roll(client: PublicClient, sender: Sender) {
  const user = sender.from;
  const loan = loanArg();
  const blue = await readBlue(client, loan.blueMarketId, user);
  const mirrors = await findMirrorMarkets(blue.marketParams);
  const fromMaturity = required("from-maturity");
  const sources = mirrors.filter((c) => isoDate(c.market.maturity) === fromMaturity);
  const positions = await Promise.all(sources.map((c) => readMidnightPosition(client, c, user)));
  const source = sources.find((_, i) => positions[i].debt > 0n);
  if (!source) throw new Error(`no ${loan.symbol}/USDC Midnight debt maturing ${fromMaturity}`);
  const target = await mirrorForMaturity(blue.marketParams, required("maturity"));
  if (target.market.maturity <= source.market.maturity) throw new Error("--maturity must be after --from-maturity");

  printRollPlan(loan, await planRoll(client, user, source, target));
  await confirm(sender, "Proceed with this roll?");
  await checkSigner(sender);

  const auth = await authorizations(client, user);
  if (!auth.renewal) {
    await send(client, sender, "Authorize renewal callback on Morpho Midnight", MIDNIGHT,
      encodeFunctionData({ abi: midnightAbi, functionName: "setIsAuthorized", args: [RENEWAL_CALLBACK, true, user] }));
  }

  const fresh = await planRoll(client, user, source, target);
  console.log(`\nFresh quote: ${pct(fresh.apr)} APR, borrow ${usd(fresh.amount)} USDC, owe ${usd(fresh.units)} USDC at ${isoDate(target.market.maturity)}`);
  await send(client, sender, "Take fixed-rate offer and roll (Midnight.take)", MIDNIGHT,
    takeCalldata(user, fresh.best, fresh.units, RENEWAL_CALLBACK, renewalCallbackData(fresh)));

  console.log("\nDone. Current state:");
  await status(client, user);
}

async function revoke(client: PublicClient, sender: Sender) {
  const user = sender.from;
  const auth = await authorizations(client, user);
  if (!auth.blue && !auth.midnight && !auth.renewal) return console.log("No callback is authorized. Nothing to revoke.");
  await checkSigner(sender);
  if (auth.blue) {
    await send(client, sender, "Revoke callback on Morpho Blue", MORPHO_BLUE,
      encodeFunctionData({ abi: blueAbi, functionName: "setAuthorization", args: [CALLBACK, false] }));
  }
  if (auth.midnight) {
    await send(client, sender, "Revoke callback on Morpho Midnight", MIDNIGHT,
      encodeFunctionData({ abi: midnightAbi, functionName: "setIsAuthorized", args: [CALLBACK, false, user] }));
  }
  if (auth.renewal) {
    await send(client, sender, "Revoke renewal callback on Morpho Midnight", MIDNIGHT,
      encodeFunctionData({ abi: midnightAbi, functionName: "setIsAuthorized", args: [RENEWAL_CALLBACK, false, user] }));
  }
  const usdcAllowance = await client.readContract({ address: USDC, abi: erc20Abi, functionName: "allowance", args: [user, MORPHO_BLUE] });
  if (usdcAllowance > 0n) {
    const shown = usdcAllowance === maxUint256 ? "unlimited" : usd(usdcAllowance);
    console.log(`Note: USDC allowance to Morpho Blue is ${shown} (left as is; it may predate this tool).`);
  }
  await status(client, user);
}

async function main() {
  const command = positionals[0];
  if (opts.help || !command) return console.log(USAGE);
  const from = opts.from ?? process.env.ETH_FROM;
  if (!from) throw new Error("--from (or $ETH_FROM) is required");
  const rpcUrl = opts["rpc-url"] ?? process.env.ETH_RPC_URL ?? DEFAULT_RPC;
  if (opts.signer !== "trezor" && opts.signer !== "unlocked") throw new Error("--signer must be trezor or unlocked");
  const sender: Sender = {
    from: getAddress(from),
    rpcUrl,
    signer: opts.signer === "trezor" ? { kind: "trezor", hdPath: opts["hd-path"] } : { kind: "unlocked" },
    yes: opts.yes!,
  };
  const client = createPublicClient({ transport: http(rpcUrl) }) as PublicClient;
  await verifyDeployment(client);

  switch (command) {
    case "status": return status(client, sender.from);
    case "quote": return quote(client, sender.from);
    case "migrate": return migrate(client, sender);
    case "cleanup": return cleanup(client, sender);
    case "roll": return roll(client, sender);
    case "revoke": return revoke(client, sender);
    default: throw new Error(`unknown command ${command}\n\n${USAGE}`);
  }
}

main().catch((err) => {
  console.error(`\nError: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
