import { describe, expect, it } from "vitest";
import type { PropertyRecord } from "./types.js";
import { matchProperty } from "./property-matching.js";

const properties: PropertyRecord[] = [
  {
    id: "1",
    clientId: "client",
    streetNumber: "109",
    streetName: "Clear Water",
    city: "Boerne",
    state: "TX",
    monthlyRentCents: 279500,
    petPolicy: "dogs_only",
    active: true,
    accessInformationAllowed: false
  },
  {
    id: "2",
    clientId: "client",
    streetNumber: "605",
    streetName: "Burleson",
    city: "San Marcos",
    state: "TX",
    monthlyRentCents: 197000,
    petPolicy: "not_allowed",
    active: true,
    accessInformationAllowed: false
  }
];

describe("matchProperty", () => {
  it("matches a full address", () => {
    const result = matchProperty("109 Clear Water, Boerne Texas", properties);
    expect(result.status).toBe("matched");
    expect(result.property?.id).toBe("1");
  });

  it("returns no match for unknown properties", () => {
    const result = matchProperty("999 Not Real", properties);
    expect(result.status).toBe("not_found");
  });
});
