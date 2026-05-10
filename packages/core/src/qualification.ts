import type { QualificationInput, QualificationResult } from "./types.js";

export function calculateIncomeThresholdCents(monthlyRentCents: number): number {
  return monthlyRentCents * 3;
}

export function calculateCreditAverage(scores: number[]): number | undefined {
  if (scores.length === 0) return undefined;
  const total = scores.reduce((sum, score) => sum + score, 0);
  return Math.round(total / scores.length);
}

export function qualifyCaller(input: QualificationInput): QualificationResult {
  if (input.adultCount < 1) {
    throw new Error("adultCount must be at least 1");
  }

  const creditAverage =
    input.allCreditOver600 === false
      ? calculateCreditAverage(input.creditScores ?? [])
      : undefined;

  const creditOver600 =
    input.allCreditOver600 === true ||
    (typeof creditAverage === "number" && creditAverage >= 600);

  const fullyQualified = creditOver600 && input.incomeMeets3xRent;
  const workaroundPossible =
    !fullyQualified && Boolean(input.wantsCosigner || input.wantsIncreasedDeposit);

  return {
    incomeThresholdCents: calculateIncomeThresholdCents(input.monthlyRentCents),
    creditAverage,
    creditOver600,
    incomeMeets3xRent: input.incomeMeets3xRent,
    qualifiedToApply: fullyQualified ? "yes" : workaroundPossible ? "debatable" : "no",
    needsHumanFollowUp: !fullyQualified
  };
}
