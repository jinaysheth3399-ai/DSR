# DSR Visits API (v1)

A read-only HTTP API that returns the complete data for field-sales daily visit
reports (DSR submissions). It is intended for server-to-server consumption by an
external system (analytics, a data warehouse, a partner integration, and so on).

- Format: JSON over HTTPS
- Access: read-only (GET)
- Auth: static API key (bearer token)
- Version: v1 (path-prefixed, so future breaking changes ship under `/api/v2`)

---

## 1. Base URL

```
https://<your-deployment-host>/api/v1
```

Replace `<your-deployment-host>` with the host where the DSR app is deployed.
All paths in this document are relative to that base URL.

---

## 2. Authentication

Every request must include a valid API key. Two header forms are accepted; use
either one:

```
Authorization: Bearer <api-key>
```

or

```
x-api-key: <api-key>
```

Keys are issued and rotated by the DSR administrator. Treat the key as a secret:
do not embed it in browser code, mobile apps, or public repositories. Requests
without a valid key are rejected with `401`.

The API is designed for server-to-server use and does not send CORS headers, so
it cannot be called directly from a web browser on another origin.

---

## 3. Conventions

**Content type.** All responses are `application/json; charset=utf-8`.

**Timestamps.** `created_at` and `updated_at` are ISO 8601 timestamps in UTC
(for example `2026-06-30T09:15:42.512Z`). `visit_date` is a calendar date in the
form `YYYY-MM-DD`, recorded in India Standard Time (Asia/Kolkata).

**Booleans, numbers, arrays.** Booleans are real JSON booleans. Counts and
amounts are JSON numbers. Multi-select fields are JSON arrays of strings (empty
array when nothing was selected).

**Nullable fields.** Fields that can be absent are always present in the payload
with a value of `null` rather than being omitted.

**Success envelope.**

- List endpoint: `{ "data": [ ... ], "pagination": { ... } }`
- Single endpoint: `{ "data": { ... } }`

**Error envelope.** Every non-2xx response has this shape:

```json
{
  "error": {
    "code": "invalid_query",
    "message": "One or more query parameters are invalid.",
    "details": [{ "field": "page_size", "message": "..." }]
  }
}
```

`details` is optional and only present for validation errors.

---

## 4. Endpoints

### 4.1 List visits

```
GET /api/v1/visits
```

Returns a filtered, paginated list of visits, newest first by default.

#### Query parameters

All parameters are optional.

| Parameter       | Type    | Default      | Description |
|-----------------|---------|--------------|-------------|
| `date_from`     | date    | none         | Include visits with `visit_date` on or after this date (`YYYY-MM-DD`). |
| `date_to`       | date    | none         | Include visits with `visit_date` on or before this date (`YYYY-MM-DD`). |
| `outcome`       | enum    | none         | Filter by visit outcome: `Positive`, `Neutral`, or `Negative`. |
| `agency`        | string  | none         | Case-insensitive substring match against `agency_code` or `agency_name`. |
| `submitted_by`  | uuid    | none         | Filter to a single field-sales employee by their `submitter.id`. |
| `has_lead`      | boolean | none         | `true` or `false`. Filters on the DMC lead-interest flag. |
| `updated_since` | ISO8601 | none         | Include visits with `updated_at` on or after this timestamp. Use this for incremental sync. |
| `sort`          | enum    | `visit_date` | Sort field: `visit_date`, `created_at`, or `updated_at`. |
| `order`         | enum    | `desc`       | Sort direction: `asc` or `desc`. |
| `page`          | integer | `1`          | 1-based page number. |
| `page_size`     | integer | `50`         | Rows per page. Minimum `1`, maximum `500`. |

Results are stably ordered (ties are broken by a fixed internal key), so paging
through the same filter set never skips or repeats a row.

#### Example request

```bash
curl -s \
  -H "Authorization: Bearer $DSR_API_KEY" \
  "https://<your-deployment-host>/api/v1/visits?date_from=2026-06-01&date_to=2026-06-30&has_lead=true&page=1&page_size=50"
```

#### Example response (`200 OK`)

```json
{
  "data": [
    {
      "id": "3f7c1e0a-9b2d-4c8e-8a11-6a5b4c3d2e1f",
      "visit_date": "2026-06-30",
      "submitter": {
        "id": "a1b2c3d4-e5f6-4788-9a0b-1c2d3e4f5a6b",
        "name": "Ravi Kumar",
        "employee_code": "FS014"
      },
      "header": {
        "agent_type": "registered",
        "agency_code": "AG10234",
        "agency_name": null
      },
      "flight": {
        "escalation": { "has_ref": true, "booking_id": "ETR-88231" },
        "monthly_txn_lakhs": 12.5,
        "domestic_portals": ["TBO", "Cleartrip B2B"],
        "international_portals": ["TBO"],
        "issue_complaint": ["Pricing"],
        "agent_mode": "Both",
        "dealing_type": "Direct",
        "client_type": "Corporate",
        "payment_mode": "Credit",
        "credit_type": "Weekly"
      },
      "hotel": {
        "escalation": { "has_ref": false, "booking_id": null },
        "monthly_room_nights_other": 320,
        "current_room_nights_etrav": 45,
        "primary_platform": ["MMT B2B", "Agoda"],
        "committed_room_nights": 100,
        "category_preference": ["4*", "5*"],
        "issue_complaint": null
      },
      "dmc": {
        "escalation": { "has_ref": false, "booking_id": null },
        "destination_discussed": ["Dubai", "Thailand"],
        "agent_active": true,
        "current_vendor": "Local DMC Co",
        "current_vendor_pax": 60,
        "lead_interest": true,
        "committed_pax": 25,
        "objection": ["Price"]
      },
      "close": {
        "visit_outcome": "Positive",
        "visit_commitment": "Send quote"
      },
      "created_at": "2026-06-30T09:15:42.512Z",
      "updated_at": "2026-06-30T09:15:42.512Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 50,
    "total": 1,
    "total_pages": 1,
    "has_next": false,
    "has_prev": false
  }
}
```

### 4.2 Get a single visit

```
GET /api/v1/visits/{id}
```

Returns one visit by its UUID. `{id}` must be a valid UUID.

#### Example request

```bash
curl -s \
  -H "Authorization: Bearer $DSR_API_KEY" \
  "https://<your-deployment-host>/api/v1/visits/3f7c1e0a-9b2d-4c8e-8a11-6a5b4c3d2e1f"
```

#### Example response (`200 OK`)

```json
{ "data": { "id": "3f7c1e0a-9b2d-4c8e-8a11-6a5b4c3d2e1f", "...": "same visit object as above" } }
```

If no visit has that id, the response is `404` with error code `not_found`.

---

## 5. The visit object

Every field below is always present. The five sections (`header`, `flight`,
`hotel`, `dmc`, `close`) mirror the report the field-sales rep fills in.

### Top level

| Field        | Type   | Notes |
|--------------|--------|-------|
| `id`         | string (uuid) | Unique visit id. |
| `visit_date` | string (date) | `YYYY-MM-DD`, in IST. The day the visit was logged. |
| `submitter`  | object | The employee who submitted the report (see below). |
| `header`     | object | Agency identification. |
| `flight`     | object | Flight business section. |
| `hotel`      | object | Hotel business section. |
| `dmc`        | object | DMC (destination management) business section. |
| `close`      | object | Visit outcome and commitment. |
| `created_at` | string (ISO 8601) | When the row was created (UTC). |
| `updated_at` | string (ISO 8601) | When the row was last modified (UTC). |

### `submitter`

| Field           | Type   | Notes |
|-----------------|--------|-------|
| `id`            | string (uuid) | Employee id. Use as `submitted_by` in list filters. |
| `name`          | string | Employee full name. |
| `employee_code` | string | Employee code (for example `FS014`). |

### `header`

| Field         | Type          | Notes |
|---------------|---------------|-------|
| `agent_type`  | enum          | `registered` or `new`. |
| `agency_code` | string / null | Set when `agent_type` is `registered`; otherwise `null`. |
| `agency_name` | string / null | Set when `agent_type` is `new`; otherwise `null`. |

Exactly one of `agency_code` / `agency_name` is non-null for any visit.

### `flight`

| Field                   | Type          | Notes |
|-------------------------|---------------|-------|
| `escalation.has_ref`    | boolean       | Whether an escalation reference was provided. |
| `escalation.booking_id` | string / null | The reference; non-null only when `has_ref` is `true`. |
| `monthly_txn_lakhs`     | number        | Monthly flight transaction value, in lakhs. May be fractional. |
| `domestic_portals`      | string[]      | Domestic booking portals used. At least one. |
| `international_portals` | string[]      | International booking portals used. At least one. |
| `issue_complaint`       | string[]      | Reported flight issues. May be empty. |
| `agent_mode`            | enum          | `Offline`, `Online`, or `Both`. |
| `dealing_type`          | enum          | `Direct` or `Distributor`. |
| `client_type`           | enum          | `Corporate` or `Direct customer`. |
| `payment_mode`          | enum          | `Cash`, `Credit`, or `Bank transfer`. |
| `credit_type`           | enum / null   | `3 days`, `Weekly`, or `BSP`; non-null only when `payment_mode` is `Credit`. |

### `hotel`

| Field                       | Type          | Notes |
|-----------------------------|---------------|-------|
| `escalation.has_ref`        | boolean       | Whether an escalation reference was provided. |
| `escalation.booking_id`     | string / null | The reference; non-null only when `has_ref` is `true`. |
| `monthly_room_nights_other` | number        | Monthly room nights booked on other platforms (integer). |
| `current_room_nights_etrav` | number        | Current monthly room nights on Etrav (integer). |
| `primary_platform`          | string[]      | Primary hotel platforms used. At least one. |
| `committed_room_nights`     | number        | Room nights the agent committed to Etrav (integer). |
| `category_preference`       | string[]      | Subset of `3*`, `4*`, `5*`. At least one. |
| `issue_complaint`           | string / null | Free-text hotel issue, or `null`. |

### `dmc`

| Field                   | Type          | Notes |
|-------------------------|---------------|-------|
| `escalation.has_ref`    | boolean       | Whether an escalation reference was provided. |
| `escalation.booking_id` | string / null | The reference; non-null only when `has_ref` is `true`. |
| `destination_discussed` | string[]      | Destinations discussed. At least one. |
| `agent_active`          | boolean       | Whether the agent is currently active in DMC. |
| `current_vendor`        | string        | The agent's current DMC vendor. |
| `current_vendor_pax`    | number        | Monthly pax with the current vendor (integer). |
| `lead_interest`         | boolean       | Whether the visit produced a DMC lead. Matches the `has_lead` filter. |
| `committed_pax`         | number        | Pax the agent committed to Etrav (integer). |
| `objection`             | string[]      | Objections raised. May be empty. |

### `close`

| Field              | Type   | Notes |
|--------------------|--------|-------|
| `visit_outcome`    | enum   | `Positive`, `Neutral`, or `Negative`. |
| `visit_commitment` | string | What the rep committed to the agent. |

The multi-select fields (`domestic_portals`, `hotel.primary_platform`,
`dmc.destination_discussed`, and so on) draw from an admin-managed option list
that can change over time, so treat their string values as free-form rather than
a fixed enum. The values called out as `enum` above are fixed in the data model.

---

## 6. Status codes and errors

| HTTP | `error.code`         | When |
|------|----------------------|------|
| 200  | (none)               | Success. |
| 400  | `invalid_query`      | A list query parameter failed validation. See `details`. |
| 400  | `invalid_id`         | The path id is not a valid UUID. |
| 401  | `missing_credentials`| No API key was supplied. |
| 401  | `invalid_credentials`| The API key is not recognised. |
| 404  | `not_found`          | No visit exists with the given id. |
| 405  | (framework default)  | A method other than GET was used. This response comes from the framework and does not use the JSON error envelope below. |
| 500  | `internal_error`     | Unexpected server or database error. Safe to retry. |
| 503  | `api_not_configured` | The API key is not configured on the server. Contact the administrator. |

---

## 7. Recipes

### Full export (page through everything)

```bash
page=1
while : ; do
  resp=$(curl -s -H "Authorization: Bearer $DSR_API_KEY" \
    "https://<your-deployment-host>/api/v1/visits?page=$page&page_size=500")
  echo "$resp" | jq '.data[]'
  has_next=$(echo "$resp" | jq -r '.pagination.has_next')
  [ "$has_next" = "true" ] || break
  page=$((page + 1))
done
```

### Incremental sync (only what changed)

Record the time of your last successful sync, then request only rows updated
since then, oldest first so you can advance your cursor safely:

```bash
curl -s -H "Authorization: Bearer $DSR_API_KEY" \
  "https://<your-deployment-host>/api/v1/visits?updated_since=2026-06-30T00:00:00Z&sort=updated_at&order=asc&page_size=500"
```

### JavaScript (fetch)

```js
const res = await fetch(
  "https://<your-deployment-host>/api/v1/visits?outcome=Positive&page_size=100",
  { headers: { Authorization: `Bearer ${process.env.DSR_API_KEY}` } }
)
if (!res.ok) {
  const { error } = await res.json()
  throw new Error(`${error.code}: ${error.message}`)
}
const { data, pagination } = await res.json()
```

---

## 8. Server configuration (for the DSR administrator)

The API is disabled until at least one key is configured. Set the `DSR_API_KEY`
environment variable on the deployment:

```
DSR_API_KEY=<long-random-string>
```

- Generate a strong key, for example: `openssl rand -hex 32`.
- Multiple keys are supported, comma-separated, which is useful for rotation or
  for issuing a distinct key per consumer:
  `DSR_API_KEY=key_for_partner_a,key_for_partner_b`
- To revoke a key, remove it from the list and redeploy.

There is no built-in rate limiting. If the API is exposed to untrusted networks,
place it behind a gateway or CDN that enforces rate limits and IP allow-listing.

---

## 9. Versioning

This is `v1`. Additive changes (new fields, new optional query parameters) may be
made without a version bump, so consumers should ignore unknown fields rather
than fail on them. Any breaking change will be published under a new path prefix
(`/api/v2`).
