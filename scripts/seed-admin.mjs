// Seeds (or upgrades) one employee row to admin. Run once to bootstrap login.
//   SUPABASE_POOLER_HOST=... SUPABASE_DB_PASSWORD=... node scripts/seed-admin.mjs <phone> <full_name> <employee_code>
// or interactively populate with the constants below.

import { Client } from "pg"

const url = process.env.SUPABASE_URL
const password = process.env.SUPABASE_DB_PASSWORD
if (!url || !password) {
  console.error("SUPABASE_URL and SUPABASE_DB_PASSWORD must be set")
  process.exit(1)
}

const ref = new URL(url).hostname.split(".")[0]
const host = process.env.SUPABASE_POOLER_HOST ?? `db.${ref}.supabase.co`
const port = Number(process.env.SUPABASE_POOLER_PORT ?? 5432)
const user = process.env.SUPABASE_POOLER_HOST != null ? `postgres.${ref}` : "postgres"

const phone = process.argv[2]
const fullName = process.argv[3]
const employeeCode = process.argv[4]

if (!phone || !fullName || !employeeCode) {
  console.error("usage: node scripts/seed-admin.mjs <+91XXXXXXXXXX> <name> <code>")
  process.exit(1)
}

if (!/^\+91[6-9]\d{9}$/.test(phone)) {
  console.error("phone must be E.164 +91XXXXXXXXXX")
  process.exit(1)
}

const client = new Client({
  host, port, user, password, database: "postgres",
  ssl: { rejectUnauthorized: false },
})

await client.connect()
console.log(`connected to ${host}:${port}`)

const { rows } = await client.query(
  `insert into public.employees (full_name, phone, employee_code, role, is_active)
   values ($1, $2, $3, 'admin', true)
   on conflict (phone) do update
     set role = 'admin', is_active = true, full_name = excluded.full_name, employee_code = excluded.employee_code
   returning id, full_name, phone, employee_code, role`,
  [fullName, phone, employeeCode]
)

console.log("seeded:", rows[0])
await client.end()
