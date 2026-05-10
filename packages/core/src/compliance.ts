import type { ComplianceEvent, ProtectedClass } from "./types.js";

const CLASS_KEYWORDS: Record<ProtectedClass, RegExp[]> = {
  race: [/\brace\b/i, /\bethnicity\b/i, /\bblack\b/i, /\bwhite\b/i, /\basian\b/i],
  color: [/\bskin color\b/i, /\bcolor\b/i],
  religion: [/\breligion\b/i, /\bchurch\b/i, /\bmosque\b/i, /\bsynagogue\b/i],
  sex: [/\bmen only\b/i, /\bwomen only\b/i, /\bgender\b/i, /\bsex\b/i],
  national_origin: [/\bnationality\b/i, /\bimmigrant\b/i, /\bcountry are they from\b/i],
  familial_status: [/\bchildren\b/i, /\bkids\b/i, /\bfamilies\b/i, /\bpregnant\b/i],
  disability: [/\bdisabled\b/i, /\bdisability\b/i, /\bwheelchair\b/i, /\bservice animal\b/i],
  other_local_protected_class: [
    /\bsection 8\b/i,
    /\bvoucher\b/i,
    /\bsource of income\b/i,
    /\bsexual orientation\b/i,
    /\bmarital status\b/i
  ]
};

export const FAIR_HOUSING_REFUSAL =
  "I cannot answer in a way that treats people differently based on protected characteristics. I can help with objective property details, availability, application steps, and the same qualification criteria for everyone.";

export function detectProtectedClasses(text: string): ProtectedClass[] {
  const found = new Set<ProtectedClass>();
  for (const [protectedClass, patterns] of Object.entries(CLASS_KEYWORDS) as Array<
    [ProtectedClass, RegExp[]]
  >) {
    if (patterns.some((pattern) => pattern.test(text))) {
      found.add(protectedClass);
    }
  }
  return [...found];
}

export function shouldRefuseForFairHousing(text: string): boolean {
  const protectedClasses = detectProtectedClasses(text);
  const steeringPatterns = [
    /\bwho lives\b/i,
    /\bwhat kind of people\b/i,
    /\bneighborhood like\b/i,
    /\bavoid\b/i
  ];

  if (steeringPatterns.some((pattern) => pattern.test(text))) {
    return true;
  }

  if (protectedClasses.length === 0) return false;

  const unsafePatterns = [
    /\bsafe for\b/i,
    /\bgood for families\b/i,
    /\bonly rent\b/i,
    /\bdo you accept\b/i
  ];

  return unsafePatterns.some((pattern) => pattern.test(text));
}

export function buildComplianceEvent(text: string, now = new Date()): ComplianceEvent {
  return {
    kind: shouldRefuseForFairHousing(text)
      ? "protected_class_question_refused"
      : "protected_class_detected",
    protectedClasses: detectProtectedClasses(text),
    safeSummary: "Caller statement referenced protected-class-sensitive housing criteria.",
    createdAt: now.toISOString()
  };
}
