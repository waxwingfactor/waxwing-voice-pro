import type { PropertyMatch, PropertyRecord } from "./types.js";

const STREET_SUFFIXES = new Set([
  "street",
  "st",
  "drive",
  "dr",
  "road",
  "rd",
  "avenue",
  "ave",
  "boulevard",
  "blvd",
  "lane",
  "ln",
  "court",
  "ct",
  "place",
  "pl",
  "terrace",
  "trail",
  "circle",
  "cir"
]);

function normalize(value: string | number | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((part) => !STREET_SUFFIXES.has(part))
    .join(" ");
}

function containsNeedle(haystack: string, needle: string): boolean {
  return needle.length > 0 && haystack.includes(needle);
}

function propertySearchText(property: PropertyRecord): string {
  return normalize(
    [
      property.name,
      property.streetNumber,
      property.streetName,
      property.city,
      property.state,
      property.stories ? `${property.stories} stories` : ""
    ].join(" ")
  );
}

export function fullAddress(property: PropertyRecord): string {
  return `${property.streetNumber} ${property.streetName}, ${property.city}, ${property.state}`;
}

export function matchProperty(
  rawInput: string,
  properties: PropertyRecord[]
): PropertyMatch {
  const input = normalize(rawInput);
  if (!input) {
    return {
      status: "not_found",
      candidates: [],
      nextBestQuestion: "street_number"
    };
  }

  const exact = properties.filter((property) => {
    const address = normalize(fullAddress(property));
    return address === input || propertySearchText(property) === input;
  });

  if (exact.length === 1) {
    return { status: "matched", property: exact[0], candidates: exact };
  }

  const inputParts = new Set(input.split(" "));
  const scored = properties
    .map((property) => {
      const searchText = propertySearchText(property);
      let score = 0;
      if (containsNeedle(input, normalize(property.streetNumber))) score += 5;
      if (containsNeedle(searchText, input)) score += 4;
      if (containsNeedle(input, normalize(property.city))) score += 2;
      for (const part of inputParts) {
        if (containsNeedle(searchText, part)) score += 1;
      }
      return { property, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      status: "not_found",
      candidates: [],
      nextBestQuestion: "street_number"
    };
  }

  const topScore = scored[0].score;
  const candidates = scored
    .filter(({ score }) => score >= Math.max(1, topScore - 1))
    .map(({ property }) => property);

  if (candidates.length === 1) {
    return {
      status: "matched",
      property: candidates[0],
      candidates
    };
  }

  return {
    status: "ambiguous",
    candidates,
    nextBestQuestion: chooseNextBestQuestion(rawInput, candidates)
  };
}

function chooseNextBestQuestion(
  rawInput: string,
  candidates: PropertyRecord[]
): PropertyMatch["nextBestQuestion"] {
  const input = normalize(rawInput);
  const hasStreetNumber = candidates.some((property) =>
    containsNeedle(input, normalize(property.streetNumber))
  );
  const hasStreetName = candidates.some((property) =>
    containsNeedle(input, normalize(property.streetName))
  );
  const hasCity = candidates.some((property) =>
    containsNeedle(input, normalize(property.city))
  );

  if (!hasStreetNumber && new Set(candidates.map((p) => p.streetNumber)).size > 1) {
    return "street_number";
  }
  if (!hasStreetName && new Set(candidates.map((p) => normalize(p.streetName))).size > 1) {
    return "street_name";
  }
  if (!hasCity && new Set(candidates.map((p) => normalize(p.city))).size > 1) {
    return "city";
  }
  if (new Set(candidates.map((p) => p.stories ?? "unknown")).size > 1) {
    return "stories";
  }
  return "street_number";
}
