import assert from "node:assert/strict";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { after, before, test } from "node:test";
import { promisify } from "node:util";
import {
  createTestClient,
  http,
  parseAbi,
  publicActions,
  walletActions,
  type Address,
} from "viem";
import { blueAbi, midnightAbi } from "../src/abi.ts";
import {
  CALLBACK,
  DEFAULT_RPC,
  LOANS,
  MIDNIGHT,
  MORPHO_BLUE,
  RENEWAL_CALLBACK,
  USDC,
} from "../src/config.ts";
import {
  findMirrorMarkets,
  readBlue,
  readMidnightPosition,
} from "../src/morpho.ts";

// Rehearses the full flow on a local fork of Ethereum mainnet, impersonating the real account.
// Env: FORK_URL (default: public RPC), FORK_ACCOUNT (default: $ETH_FROM; required), MATURITY (default: 2026-12-25),
// ROLL_MATURITY (default: 2027-03-26). Migration runs only for loans that still have Blue debt; the roll then moves
// each MATURITY position to ROLL_MATURITY.
const FORK_URL = process.env.FORK_URL ?? DEFAULT_RPC;
const account = process.env.FORK_ACCOUNT ?? process.env.ETH_FROM;
if (!account)
  throw new Error(
    "set FORK_ACCOUNT (or ETH_FROM) to the account to impersonate on the fork",
  );
const USER = account as Address;
const MATURITY = process.env.MATURITY ?? "2026-12-25";
const ROLL_MATURITY = process.env.ROLL_MATURITY ?? "2027-03-26";
const isoDate = (ts: bigint) =>
  new Date(Number(ts) * 1000).toISOString().slice(0, 10);
const PORT = 8547;
const transferAbi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
]);
const LOCAL = `http://127.0.0.1:${PORT}`;

const client = createTestClient({ mode: "anvil", transport: http(LOCAL) })
  .extend(publicActions)
  .extend(walletActions);
let anvil: ChildProcess;

async function cli(...args: string[]) {
  const { stdout } = await promisify(execFile)(
    "node",
    [
      "src/cli.ts",
      ...args,
      ...(process.env.MARKET ? ["--market", process.env.MARKET] : []),
      "--from",
      USER,
      "--rpc-url",
      LOCAL,
      "--signer",
      "unlocked",
      "--yes",
    ],
    { maxBuffer: 10 * 1024 * 1024 },
  ).catch((err) => {
    throw new Error(
      `cli ${args.join(" ")} failed:\n${err.stdout}\n${err.stderr}`,
    );
  });
  console.log(stdout);
  return stdout;
}

before(async () => {
  anvil = spawn(
    "anvil",
    [
      "--fork-url",
      FORK_URL,
      "--port",
      String(PORT),
      "--auto-impersonate",
      "--silent",
    ],
    { stdio: "inherit" },
  );
  for (let i = 0; i < 100; i++) {
    try {
      await client.getBlockNumber();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error("anvil did not start");
});

after(() => anvil?.kill());

for (const [key, loan] of Object.entries(LOANS).filter(
  ([key]) => !process.env.LOAN || key === process.env.LOAN,
)) {
  test(`migrate + cleanup ${loan.symbol}`, async (t) => {
    const before = await readBlue(client, loan.blueMarketId, USER);
    if (before.borrowShares === 0n)
      return t.skip("no Blue debt left to migrate");
    const [target] = (
      await findMirrorMarkets(
        before.marketParams,
        process.env.MARKET as `0x${string}` | undefined,
      )
    ).filter((c) => isoDate(c.market.maturity) === MATURITY);

    await cli(
      "migrate",
      "--loan",
      key,
      "--maturity",
      MATURITY,
      "--max-rate",
      "8",
    );
    const mid = await readBlue(client, loan.blueMarketId, USER);
    const pos = await readMidnightPosition(client, target, USER);
    assert.ok(
      mid.debt < 10n * 10n ** 6n,
      `Blue dust debt too large: ${mid.debt}`,
    );
    assert.ok(
      pos.debt > before.debt,
      "Midnight debt (owed at maturity) should exceed the repaid Blue debt",
    );
    assert.ok(pos.collateral > 0n && pos.collateral <= before.collateral);

    // Fund the wallet with a little USDC for the dust repayment (taken from Morpho Blue's balance on the fork).
    await client.setBalance({ address: MORPHO_BLUE, value: 10n ** 18n });
    await client.impersonateAccount({ address: MORPHO_BLUE });
    await client.writeContract({
      account: MORPHO_BLUE,
      chain: null,
      address: USDC,
      abi: transferAbi,
      functionName: "transfer",
      args: [USER, 100n * 10n ** 6n],
    });
    await cli("cleanup", "--loan", key, "--maturity", MATURITY);
    const done = await readBlue(client, loan.blueMarketId, USER);
    const final = await readMidnightPosition(client, target, USER);
    assert.equal(done.borrowShares, 0n);
    assert.equal(done.collateral, 0n);
    assert.equal(
      final.collateral,
      before.collateral,
      "all collateral should end up on Midnight",
    );
    assert.equal(final.debt, pos.debt);
    const healthy = await client.readContract({
      address: MIDNIGHT,
      abi: midnightAbi,
      functionName: "isHealthy",
      args: [target.market, target.id, USER],
    });
    assert.ok(healthy);
  });

  test(`roll ${loan.symbol} ${MATURITY} -> ${ROLL_MATURITY}`, async (t) => {
    if (process.env.SKIP_ROLL === "1")
      return t.skip("migration-only rehearsal");
    const { marketParams } = await readBlue(client, loan.blueMarketId, USER);
    const mirrors = await findMirrorMarkets(marketParams);
    const withPositions = await Promise.all(
      mirrors.map(async (c) => ({
        c,
        pos: await readMidnightPosition(client, c, USER),
      })),
    );
    const source = withPositions.find(
      ({ c, pos }) => isoDate(c.market.maturity) === MATURITY && pos.debt > 0n,
    );
    if (!source) return t.skip(`no Midnight debt maturing ${MATURITY}`);
    const targets = withPositions.filter(
      ({ c }) => isoDate(c.market.maturity) === ROLL_MATURITY,
    );

    await cli(
      "roll",
      "--loan",
      key,
      "--from-maturity",
      MATURITY,
      "--maturity",
      ROLL_MATURITY,
      "--max-rate",
      "8",
    );
    const src = await readMidnightPosition(client, source.c, USER);
    assert.equal(src.debt, 0n, "source debt should be fully repaid");
    assert.equal(
      src.collateral,
      0n,
      "all collateral should leave the source market",
    );
    const after = await Promise.all(
      targets.map(async (x) => ({
        ...x,
        now: await readMidnightPosition(client, x.c, USER),
      })),
    );
    const moved = after.find((x) => x.now.debt > x.pos.debt);
    assert.ok(moved, "no target market received the debt");
    assert.equal(
      moved.now.collateral - moved.pos.collateral,
      source.pos.collateral,
    );
    assert.ok(
      moved.now.debt - moved.pos.debt > source.pos.debt,
      "new debt (owed at maturity) should exceed the repaid debt",
    );
    const healthy = await client.readContract({
      address: MIDNIGHT,
      abi: midnightAbi,
      functionName: "isHealthy",
      args: [moved.c.market, moved.c.id, USER],
    });
    assert.ok(healthy);
  });
}

test("revoke removes all authorizations", async () => {
  await cli("revoke");
  const blue = await client.readContract({
    address: MORPHO_BLUE,
    abi: blueAbi,
    functionName: "isAuthorized",
    args: [USER, CALLBACK],
  });
  const midnight = await client.readContract({
    address: MIDNIGHT,
    abi: midnightAbi,
    functionName: "isAuthorized",
    args: [USER, CALLBACK],
  });
  const renewal = await client.readContract({
    address: MIDNIGHT,
    abi: midnightAbi,
    functionName: "isAuthorized",
    args: [USER, RENEWAL_CALLBACK],
  });
  assert.equal(blue, false);
  assert.equal(midnight, false);
  assert.equal(renewal, false);
});
