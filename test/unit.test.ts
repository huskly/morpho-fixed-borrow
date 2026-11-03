import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatUnits,
  parseUnits,
  priceToApr,
  sellerAssetsForUnits,
  tickToPrice,
  unitsForAssets,
  unitsForExactAssets,
} from "../src/math.ts";
import { marketFromApi, midnightMarketId } from "../src/morpho.ts";

// (tick, price) pairs taken from live Morpho API order books on 2026-11-03.
const TICK_PRICES: [bigint, bigint][] = [
  [3796n, 892325400000000000n],
  [3964n, 950385600000000000n],
  [4020n, 962012700000000000n],
  [4024n, 962736800000000000n],
  [4040n, 965499200000000000n],
  [4084n, 972108000000000000n],
  [4116n, 976121500000000000n],
  [4148n, 979567200000000000n],
  [4264n, 988440900000000000n],
  [4304n, 990513000000000000n],
  [4316n, 991059800000000000n],
  [4320n, 991234900000000000n],
  [4336n, 991901900000000000n],
  [4340n, 992060600000000000n],
  [4344n, 992216200000000000n],
  [4348n, 992368700000000000n],
  [4352n, 992518300000000000n],
  [4364n, 992949900000000000n],
  [4368n, 993088200000000000n],
  [4392n, 993862500000000000n],
  [4396n, 993982800000000000n],
  [4468n, 995791100000000000n],
  [4476n, 995955100000000000n],
  [4480n, 996034700000000000n],
  [4544n, 997114400000000000n],
  [4552n, 997226500000000000n],
];

test("tickToPrice matches Midnight's on-chain prices", () => {
  for (const [tick, price] of TICK_PRICES) assert.equal(tickToPrice(tick), price, `tick ${tick}`);
});

test("units sized from assets never sell for more than the target", () => {
  const price = tickToPrice(4396n);
  for (const target of [1n, 999_999n, 415_052_180_725n, 535_421_975_000n]) {
    const units = unitsForAssets(target, price);
    assert.ok(sellerAssetsForUnits(units, price) <= target);
    assert.ok(sellerAssetsForUnits(units + 1n, price) >= target - 1n);
  }
});

test("units sized for a roll sell for exactly the source debt", () => {
  for (const [tick] of TICK_PRICES) {
    const price = tickToPrice(tick);
    for (const debt of [1n, 999_999n, 417_566_500_000n, 538_666_050_123n]) {
      const units = unitsForExactAssets(debt, price);
      assert.equal(sellerAssetsForUnits(units, price), debt, `tick ${tick} debt ${debt}`);
      assert.ok(sellerAssetsForUnits(units - 1n, price) < debt);
    }
  }
});

test("priceToApr is a simple annual rate", () => {
  assert.ok(Math.abs(priceToApr(950_000_000_000_000_000n, 365n * 86400n) - 0.0526315789) < 1e-9);
});

test("midnightMarketId reproduces the API market id", () => {
  const market = marketFromApi({
    chain_id: 1,
    midnight: "0x471686c42792f93528b000bef54bc10e3aa2045f",
    loan_token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    collaterals: [
      { token: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", lltv: "860000000000000000", liquidation_cursor: "300000000000000000", oracle: "0xDddd770BADd886dF3864029e4B377B5F6a2B6b83" },
      { token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", lltv: "980000000000000000", liquidation_cursor: "300000000000000000", oracle: "0x8d1A84515B54C58bAc3b18315B6b1f17dA5cf6ca" },
    ],
    maturity: 1798210800,
    rcf_threshold: "300000000000",
    enter_gate: "0x0000000000000000000000000000000000000000",
    liquidator_gate: "0x0000000000000000000000000000000000000000",
  });
  assert.equal(midnightMarketId(market), "0x3323abf2d2a3ec804f46552db920d900bb9c7ffd3f48143ab879a918fd6c0977");
});

test("formatUnits / parseUnits", () => {
  assert.equal(formatUnits(415_053_180_725n, 6), "415,053.18");
  assert.equal(parseUnits("1,000.5", 6), 1_000_500_000n);
  assert.throws(() => parseUnits("1.1234567", 6));
});
