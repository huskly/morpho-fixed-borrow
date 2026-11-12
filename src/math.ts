// Ports of the Midnight / Morpho Blue math the CLI needs off-chain.

export const WAD = 10n ** 18n;
export const ORACLE_PRICE_SCALE = 10n ** 36n;
const YEAR = 365n * 86400n;

// TickLib (Midnight): price of a tick, in WAD.
const LN_ONE_PLUS_DELTA = 4987541511039073n;
const MAX_TICK = 6744n;
const PRICE_ROUNDING_STEP = 10n ** 11n;

function divHalfDown(x: bigint, d: bigint): bigint {
  return (x + (d - 1n) / 2n) / d;
}

function wExp(x: bigint): bigint {
  if (x < 0n) return 10n ** 36n / wExp(-x);
  const ln2 = 693147180559945309n;
  const offset = 322611214989459870n;
  const q = (x + offset) / ln2;
  const r = x - q * ln2;
  const second = (r * r) / (2n * WAD);
  const third = (second * r) / (3n * WAD);
  return (WAD + r + second + third) << q;
}

export function tickToPrice(tick: bigint): bigint {
  if (tick < 0n || tick > MAX_TICK)
    throw new Error(`tick out of range: ${tick}`);
  const denom = WAD + wExp(LN_ONE_PLUS_DELTA * (MAX_TICK / 2n - tick));
  return (
    divHalfDown(divHalfDown(10n ** 36n, denom), PRICE_ROUNDING_STEP) *
    PRICE_ROUNDING_STEP
  );
}

// Simple annual rate (APR) implied by buying/selling a unit at `price` with `ttm` seconds to maturity.
export function priceToApr(price: bigint, ttm: bigint): number {
  return (Number(WAD) / Number(price) - 1) * (Number(YEAR) / Number(ttm));
}

// Largest number of units whose sale proceeds (rounded down, as in Midnight.take) do not exceed `assets`.
export function unitsForAssets(assets: bigint, sellerPrice: bigint): bigint {
  return (assets * WAD) / sellerPrice;
}

// Smallest number of units whose sale proceeds are exactly `assets`. Exists whenever sellerPrice <= 1 (WAD): each
// extra unit adds at most 1 to the rounded-down proceeds.
export function unitsForExactAssets(
  assets: bigint,
  sellerPrice: bigint,
): bigint {
  return (assets * WAD + sellerPrice - 1n) / sellerPrice;
}

export function sellerAssetsForUnits(
  units: bigint,
  sellerPrice: bigint,
): bigint {
  return (units * sellerPrice) / WAD;
}

// Morpho Blue SharesMathLib.toAssetsUp.
export function toAssetsUp(
  shares: bigint,
  totalAssets: bigint,
  totalShares: bigint,
): bigint {
  const num = shares * (totalAssets + 1n);
  const den = totalShares + 10n ** 6n;
  return (num + den - 1n) / den;
}

// Max borrowable against `collateral` at an oracle `price` (1e36 scale) and `lltv` (WAD).
export function maxDebt(
  collateral: bigint,
  price: bigint,
  lltv: bigint,
): bigint {
  return (((collateral * price) / ORACLE_PRICE_SCALE) * lltv) / WAD;
}

export function formatUnits(x: bigint, decimals: number, digits = 2): string {
  const neg = x < 0n;
  const abs = neg ? -x : x;
  const s = abs.toString().padStart(decimals + 1, "0");
  const int = s.slice(0, s.length - decimals);
  const frac = s.slice(s.length - decimals).slice(0, digits);
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${grouped}${digits > 0 ? "." + frac : ""}`;
}

export function parseUnits(s: string, decimals: number): bigint {
  const [int, frac = ""] = s.replaceAll(",", "").split(".");
  if (!/^\d+$/.test(int) || !/^\d*$/.test(frac) || frac.length > decimals)
    throw new Error(`bad amount: ${s}`);
  return BigInt(int + frac.padEnd(decimals, "0"));
}
