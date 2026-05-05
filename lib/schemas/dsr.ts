import { z } from "zod"

// ---------------------------------------------------------------------------
// Static enums (mirrored in the dsr_submissions check constraints)
// ---------------------------------------------------------------------------

export const FLIGHT_AGENT_MODES   = ["Offline", "Online", "Both"] as const
export const FLIGHT_DEALING_TYPES = ["Direct", "Distributor"] as const
export const FLIGHT_CLIENT_TYPES  = ["Corporate", "Direct customer"] as const
export const FLIGHT_PAYMENT_MODES = ["Cash", "Credit", "Bank transfer"] as const
export const FLIGHT_CREDIT_TYPES  = ["3 days", "Weekly", "BSP"] as const
export const VISIT_OUTCOMES       = ["Positive", "Neutral", "Negative"] as const
export const HOTEL_CATEGORIES     = ["3*", "4*", "5*"] as const

export const STEPS = ["header", "flight", "hotel", "dmc", "close"] as const
export type StepKey = (typeof STEPS)[number]

// ---------------------------------------------------------------------------
// Master form schema — used by both client (RHF resolver) and server (re-validation).
// ---------------------------------------------------------------------------

export const dsrFormSchema = z
  .object({
    // HEADER
    agent_type:   z.enum(["registered", "new"]),
    agency_code:  z.string().trim().max(30),
    agency_name:  z.string().trim().max(100),

    // FLIGHT
    flight_escalation_has_ref:    z.boolean(),
    flight_escalation_booking_id: z.string().trim().max(100),
    flight_monthly_txn_lakhs:     z.number().min(0, "Must be 0 or more"),
    flight_domestic_portals:      z.array(z.string()).min(1, "Pick at least one"),
    flight_international_portals: z.array(z.string()).min(1, "Pick at least one"),
    flight_issue_complaint:       z.array(z.string()),
    flight_agent_mode:    z.enum(FLIGHT_AGENT_MODES),
    flight_dealing_type:  z.enum(FLIGHT_DEALING_TYPES),
    flight_client_type:   z.enum(FLIGHT_CLIENT_TYPES),
    flight_payment_mode:  z.enum(FLIGHT_PAYMENT_MODES),
    flight_credit_type:   z.enum(FLIGHT_CREDIT_TYPES).optional(),

    // HOTEL
    hotel_escalation_has_ref:        z.boolean(),
    hotel_escalation_booking_id:     z.string().trim().max(100),
    hotel_monthly_room_nights_other: z.number().int("Whole number").min(0),
    hotel_current_room_nights_etrav: z.number().int("Whole number").min(0),
    hotel_primary_platform:          z.array(z.string()).min(1, "Pick at least one"),
    hotel_committed_room_nights:     z.number().int("Whole number").min(0),
    hotel_category_preference:       z.array(z.enum(HOTEL_CATEGORIES)).min(1, "Pick at least one"),
    hotel_issue_complaint:           z.string().trim().max(500),

    // DMC
    dmc_escalation_has_ref:    z.boolean(),
    dmc_escalation_booking_id: z.string().trim().max(100),
    dmc_destination_discussed: z.array(z.string()).min(1, "Pick at least one"),
    dmc_agent_active:          z.boolean(),
    dmc_current_vendor:        z.string().trim().min(1, "Required").max(100),
    dmc_current_vendor_pax:    z.number().int("Whole number").min(0),
    dmc_lead_interest:         z.boolean(),
    dmc_committed_pax:         z.number().int("Whole number").min(0),
    dmc_objection:             z.array(z.string()),

    // VISIT CLOSE
    visit_outcome:    z.enum(VISIT_OUTCOMES),
    visit_commitment: z.string().trim().min(1, "Required"),
  })
  .superRefine((data, ctx) => {
    // Agency XOR
    if (data.agent_type === "registered") {
      if (!data.agency_code) {
        ctx.addIssue({
          code: "custom",
          path: ["agency_code"],
          message: "Required",
        })
      }
    } else {
      if (!data.agency_name) {
        ctx.addIssue({
          code: "custom",
          path: ["agency_name"],
          message: "Required",
        })
      }
    }

    // Flight credit-type conditional
    if (data.flight_payment_mode === "Credit" && !data.flight_credit_type) {
      ctx.addIssue({
        code: "custom",
        path: ["flight_credit_type"],
        message: "Required when payment mode is Credit",
      })
    }

    // Escalation booking-id conditionals (×3)
    if (data.flight_escalation_has_ref && !data.flight_escalation_booking_id) {
      ctx.addIssue({
        code: "custom",
        path: ["flight_escalation_booking_id"],
        message: "Required",
      })
    }
    if (data.hotel_escalation_has_ref && !data.hotel_escalation_booking_id) {
      ctx.addIssue({
        code: "custom",
        path: ["hotel_escalation_booking_id"],
        message: "Required",
      })
    }
    if (data.dmc_escalation_has_ref && !data.dmc_escalation_booking_id) {
      ctx.addIssue({
        code: "custom",
        path: ["dmc_escalation_booking_id"],
        message: "Required",
      })
    }
  })

export type DsrFormValues = z.infer<typeof dsrFormSchema>

// ---------------------------------------------------------------------------
// Field name lists per step — used by RHF's `trigger(fields)` for partial
// validation when clicking Next. The cross-field refinements run regardless
// over the whole object, but errors only surface against listed fields.
// ---------------------------------------------------------------------------

export const STEP_FIELDS = {
  header: ["agent_type", "agency_code", "agency_name"],
  flight: [
    "flight_escalation_has_ref",
    "flight_escalation_booking_id",
    "flight_monthly_txn_lakhs",
    "flight_domestic_portals",
    "flight_international_portals",
    "flight_issue_complaint",
    "flight_agent_mode",
    "flight_dealing_type",
    "flight_client_type",
    "flight_payment_mode",
    "flight_credit_type",
  ],
  hotel: [
    "hotel_escalation_has_ref",
    "hotel_escalation_booking_id",
    "hotel_monthly_room_nights_other",
    "hotel_current_room_nights_etrav",
    "hotel_primary_platform",
    "hotel_committed_room_nights",
    "hotel_category_preference",
    "hotel_issue_complaint",
  ],
  dmc: [
    "dmc_escalation_has_ref",
    "dmc_escalation_booking_id",
    "dmc_destination_discussed",
    "dmc_agent_active",
    "dmc_current_vendor",
    "dmc_current_vendor_pax",
    "dmc_lead_interest",
    "dmc_committed_pax",
    "dmc_objection",
  ],
  close: ["visit_outcome", "visit_commitment"],
} as const satisfies Record<StepKey, ReadonlyArray<keyof DsrFormValues>>

// ---------------------------------------------------------------------------
// Defaults — pragmatic preselects so the form is reachable without typing
// every radio. The user is expected to confirm or change them as they go.
// ---------------------------------------------------------------------------

export const dsrFormDefaults: DsrFormValues = {
  agent_type: "registered",
  agency_code: "",
  agency_name: "",

  flight_escalation_has_ref: false,
  flight_escalation_booking_id: "",
  flight_monthly_txn_lakhs: 0,
  flight_domestic_portals: [],
  flight_international_portals: [],
  flight_issue_complaint: [],
  flight_agent_mode: "Both",
  flight_dealing_type: "Direct",
  flight_client_type: "Direct customer",
  flight_payment_mode: "Cash",
  flight_credit_type: undefined,

  hotel_escalation_has_ref: false,
  hotel_escalation_booking_id: "",
  hotel_monthly_room_nights_other: 0,
  hotel_current_room_nights_etrav: 0,
  hotel_primary_platform: [],
  hotel_committed_room_nights: 0,
  hotel_category_preference: [],
  hotel_issue_complaint: "",

  dmc_escalation_has_ref: false,
  dmc_escalation_booking_id: "",
  dmc_destination_discussed: [],
  dmc_agent_active: false,
  dmc_current_vendor: "",
  dmc_current_vendor_pax: 0,
  dmc_lead_interest: false,
  dmc_committed_pax: 0,
  dmc_objection: [],

  visit_outcome: "Positive",
  visit_commitment: "",
}

export const STEP_TITLES: Record<StepKey, string> = {
  header: "Header",
  flight: "Flight",
  hotel: "Hotel",
  dmc: "DMC",
  close: "Visit close",
}
