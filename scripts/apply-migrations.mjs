// One-shot migration runner for the Supabase Postgres DB.
// Reads SUPABASE_URL (to derive host) and SUPABASE_DB_PASSWORD from env;
// applies every *.sql in supabase/migrations/ in lexical order, each in
// its own transaction. Logs progress without ever printing the password.

import { Client } from "pg"
import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"

const url = process.env.SUPABASE_URL
const password = process.env.SUPABASE_DB_PASSWORD

if (!url || !password) {
  console.error("SUPABASE_URL and SUPABASE_DB_PASSWORD must both be set")
  process.exit(1)
}

const ref = new URL(url).hostname.split(".")[0]

// Try direct DB first; if it fails on DNS/connect, the user can re-run with
// SUPABASE_POOLER_HOST and SUPABASE_POOLER_PORT set to the pooler endpoint.
const host = process.env.SUPABASE_POOLER_HOST ?? `db.${ref}.supabase.co`
const port = Number(process.env.SUPABASE_POOLER_PORT ?? 5432)
const user =
  process.env.SUPABASE_POOLER_HOST != null ? `postgres.${ref}` : "postgres"

const client = new Client({
  host,
  port,
  user,
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
})

const start = Date.now()
console.log(`connecting to ${host}:${port} as ${user} ...`)
await client.connect()
console.log(`connected in ${Date.now() - start}ms`)

const dir = "supabase/migrations"
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort()
if (files.length === 0) {
  console.error(`no .sql files under ${dir}`)
  process.exit(1)
}

for (const file of files) {
  const path = join(dir, file)
  const sql = await readFile(path, "utf8")
  process.stdout.write(`applying ${file} (${sql.length} chars) ... `)
  await client.query("begin")
  try {
    await client.query(sql)
    await client.query("commit")
    console.log("ok")
  } catch (err) {
    await client.query("rollback").catch(() => {})
    console.log("FAILED")
    console.error(`  ${err.code ?? "?"}: ${err.message}`)
    if (err.detail) console.error(`  detail: ${err.detail}`)
    if (err.hint) console.error(`  hint: ${err.hint}`)
    if (err.position) console.error(`  position: ${err.position}`)
    process.exit(1)
  }
}

const { rows: tables } = await client.query(
  "select tablename from pg_tables where schemaname = 'public' order by tablename"
)
console.log(`\npublic tables (${tables.length}):`)
for (const r of tables) console.log(`  - ${r.tablename}`)

const { rows: optsCount } = await client.query(
  "select field_key, count(*)::int as n from public.placeholder_options group by field_key order by field_key"
)
console.log(`\nplaceholder_options seeded:`)
for (const r of optsCount) console.log(`  - ${r.field_key}: ${r.n}`)

await client.end()
console.log("\ndone")
