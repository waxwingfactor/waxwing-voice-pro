import { describe, expect, it } from "vitest";
import { qualifyCaller } from "./qualification.js";

describe("qualifyCaller", () => {
  it("qualifies callers who meet credit and income requirements", () => {
    const result = qualifyCaller({
      monthlyRentCents: 200000,
      adultCount: 1,
      allCreditOver600: true,
      incomeMeets3xRent: true
    });

    expect(result.incomeThresholdCents).toBe(600000);
    expect(result.qualifiedToApply).toBe("yes");
  });

  it("uses average credit when not all applicants are over 600", () => {
    const result = qualifyCaller({
      monthlyRentCents: 150000,
      adultCount: 2,
      allCreditOver600: false,
      creditScores: [620, 560],
      incomeMeets3xRent: true,
      wantsCosigner: true
    });

    expect(result.creditAverage).toBe(590);
    expect(result.creditOver600).toBe(false);
    expect(result.qualifiedToApply).toBe("debatable");
  });
});
