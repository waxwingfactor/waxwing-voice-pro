import { describe, expect, it } from "vitest";
import { detectProtectedClasses, shouldRefuseForFairHousing } from "./compliance.js";

describe("fair housing compliance", () => {
  it("detects protected-class-sensitive language", () => {
    expect(detectProtectedClasses("Is this good for families with kids?")).toContain(
      "familial_status"
    );
  });

  it("flags unsafe housing questions for refusal", () => {
    expect(shouldRefuseForFairHousing("What kind of people live there?")).toBe(true);
    expect(shouldRefuseForFairHousing("Is it safe for families with kids?")).toBe(true);
  });
});
