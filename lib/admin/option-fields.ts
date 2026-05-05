export const KNOWN_FIELD_KEYS = [
  "flight_domestic_portals",
  "flight_international_portals",
  "flight_issue_complaint",
  "hotel_primary_platform",
  "dmc_destination_discussed",
  "dmc_objection",
  "visit_commitment",
  "visit_escalation",
] as const

export type FieldKey = (typeof KNOWN_FIELD_KEYS)[number]

export const FIELD_KEY_TITLES: Record<FieldKey, string> = {
  flight_domestic_portals: "Flight — domestic portals",
  flight_international_portals: "Flight — international portals",
  flight_issue_complaint: "Flight — issue / complaint",
  hotel_primary_platform: "Hotel — primary platforms",
  dmc_destination_discussed: "DMC — destinations discussed",
  dmc_objection: "DMC — objections",
  visit_commitment: "Visit — commitments",
  visit_escalation: "Visit — escalation routing",
}
