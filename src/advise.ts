// Roll timing advice: pure decision logic, no I/O.
//
// Rolling d days before maturity repays the old debt at face value, so those d days are paid at the new rate on top
// of interest already in the old debt. Waiting saves that, at the risk of rates rising or liquidity disappearing.
// The Blue variable rate (a 7D or 1M average) stands in for the rate available if we wait.

export type Thresholds = {
  minDays: number;
  minCoverage: number;
  minLenders: number;
};
export const DEFAULT_THRESHOLDS: Thresholds = {
  minDays: 3,
  minCoverage: 1.5,
  minLenders: 2,
};

export type Target = {
  maturity: bigint;
  apr: number; // simple APR of borrowing now until this maturity
  termDays: number; // from now until this maturity
  coverage: number; // what the best single offer can fill, as a multiple of the debt
  lenders: number; // distinct makers among the quoted offers
  offerExpiryDays: number; // until the best offer expires
};

export type Evaluated = Target & {
  refApr: number; // Blue reference as a simple APR over the period a later roll would cover
  benefit: number; // interest saved by rolling now instead of at maturity at the reference rate, per unit of debt
  breakEvenRise: number; // rate rise by maturity at which waiting and rolling now cost the same
  liquidityIssues: string[];
  warnings: string[]; // shown, but do not trigger a roll
};

export type Advice = {
  action: "roll" | "wait" | "alert";
  reasons: string[];
  target?: Evaluated;
  evaluated: Evaluated[];
};

// Simple APR equivalent of a compounded APY over `years`.
export function apyToSimpleApr(apy: number, years: number): number {
  return years > 0 ? ((1 + apy) ** years - 1) / years : Math.log1p(apy);
}

export function evaluate(
  t: Target,
  daysLeft: number,
  refApy: number,
  th: Thresholds,
): Evaluated {
  const laterDays = t.termDays - daysLeft;
  const refApr = apyToSimpleApr(refApy, laterDays / 365);
  const liquidityIssues: string[] = [];
  const warnings: string[] = [];
  if (t.coverage < th.minCoverage)
    liquidityIssues.push(
      `best offer covers only ${t.coverage.toFixed(2)}x the debt`,
    );
  if (t.lenders < th.minLenders)
    warnings.push(`${t.lenders} lender${t.lenders === 1 ? "" : "s"} quoting`);
  if (t.offerExpiryDays < daysLeft)
    liquidityIssues.push(
      `best offer expires in ${t.offerExpiryDays.toFixed(1)} days, before maturity`,
    );
  return {
    ...t,
    refApr,
    benefit: (refApr * laterDays - t.apr * t.termDays) / 365,
    breakEvenRise: (t.apr * t.termDays) / laterDays - t.apr,
    liquidityIssues,
    warnings,
  };
}

const best = (xs: Evaluated[]) =>
  xs.reduce<Evaluated | undefined>(
    (a, x) => (!a || x.benefit > a.benefit ? x : a),
    undefined,
  );

export function advise(input: {
  daysLeft: number;
  refApy: number;
  targets: Target[];
  maxRate?: number;
  thresholds?: Thresholds;
}): Advice {
  const th = input.thresholds ?? DEFAULT_THRESHOLDS;
  const { daysLeft, maxRate } = input;
  const evaluated = input.targets
    .filter((t) => t.termDays > daysLeft)
    .map((t) => evaluate(t, daysLeft, input.refApy, th));
  if (daysLeft <= 0)
    return {
      action: "alert",
      reasons: ["loan has matured and can be liquidated: roll or repay now"],
      evaluated,
    };

  const fillable = evaluated.filter(
    (t) => t.coverage >= 1 && (maxRate === undefined || t.apr <= maxRate),
  );
  if (!fillable.length) {
    const why = `no offer can take the whole debt${maxRate === undefined ? "" : " under --max-rate"}`;
    const urgency =
      daysLeft <= th.minDays
        ? `; ${daysLeft.toFixed(1)} days left: roll part with --amount or repay`
        : "";
    return { action: "alert", reasons: [why + urgency], evaluated };
  }

  const target = best(fillable)!;
  if (daysLeft <= th.minDays) {
    return {
      action: "roll",
      reasons: [
        `${daysLeft.toFixed(1)} days left, within the ${th.minDays}-day deadline`,
      ],
      target,
      evaluated,
    };
  }

  // A fixed rate above the reference is only "acceptable" when the user set --max-rate explicitly.
  const acceptable = best(
    fillable.filter((t) => maxRate !== undefined || t.apr <= t.refApr),
  );
  if (acceptable?.liquidityIssues.length) {
    return {
      action: "roll",
      reasons: [`liquidity: ${acceptable.liquidityIssues.join("; ")}`],
      target: acceptable,
      evaluated,
    };
  }
  if (target.benefit > 0) {
    return {
      action: "roll",
      reasons: [
        "rate: locking now beats rolling at maturity at the Blue reference rate",
      ],
      target,
      evaluated,
    };
  }
  return {
    action: "wait",
    reasons: [
      "rolling now costs more than waiting, and liquidity looks sufficient",
    ],
    target,
    evaluated,
  };
}
