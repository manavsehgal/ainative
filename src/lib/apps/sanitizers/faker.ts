import type { Sanitizer } from "./types";

// Lightweight built-in synthetic data (no @faker-js dependency)
const POOLS: Record<string, string[]> = {
  "person.firstName": ["Alex", "Jordan", "Morgan", "Taylor", "Riley", "Casey", "Quinn", "Avery", "Blake", "Drew"],
  "person.lastName": ["Smith", "Chen", "Patel", "Kim", "Garcia", "Müller", "Tanaka", "Santos", "Okafor", "Andersen"],
  "company.name": ["Acme Corp", "Initech", "Globex", "Soylent", "Aperture Science", "Cyberdyne", "Tyrell Corp", "Weyland", "Umbrella Corp", "Oscorp"],
  "internet.email": ["alex@example.com", "user1@test.com", "demo@sample.org", "contact@example.net", "info@test.io"],
  "address.city": ["Springfield", "Shelbyville", "Riverdale", "Greendale", "Pawnee", "Eagleton", "Scranton", "Hawkins"],
  "lorem.sentence": [
    "Sample data for demonstration purposes.",
    "This is placeholder text for the app.",
    "Replace with your actual data after install.",
    "Example entry generated during app packaging.",
  ],
};

export const fakerSanitizer: Sanitizer = {
  name: "faker",
  sanitize(_value, params, context) {
    const method = (params.fakerMethod as string) ?? "lorem.sentence";
    const pool = POOLS[method] ?? POOLS["lorem.sentence"];
    return pool[context.rowIndex % pool.length];
  },
};
