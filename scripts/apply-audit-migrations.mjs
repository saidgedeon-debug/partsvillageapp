import fs from "fs";
import pg from "pg";

const ref = process.env.SUPABASE_PROJECT_ID;
const pass = process.env.SUPABASE_DB_PASSWORD;
if (!ref || !pass) {
  console.error("Missing SUPABASE_PROJECT_ID or SUPABASE_DB_PASSWORD");
  process.exit(1);
}

const urls = [
  `postgresql://postgres:${encodeURIComponent(pass)}@db.${ref}.supabase.co:5432/postgres`,
  `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
];

const files = [
  "supabase/migrations/20260903090000_lock_shop_state_authenticated.sql",
  "supabase/migrations/20260903090100_lock_legacy_table_selects.sql",
  "supabase/migrations/20260903090200_part_photos_bucket.sql",
  "supabase/migrations/20260903110000_operator_role_rls.sql",
  "supabase/migrations/20260903120000_operator_app_metadata_only.sql",
];

let client;
for (const url of urls) {
  const c = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await c.connect();
    console.log("connected");
    client = c;
    break;
  } catch (e) {
    console.log("fail", String(e.message).slice(0, 160));
  }
}

if (!client) process.exit(1);

for (const f of files) {
  const sql = fs.readFileSync(f, "utf8");
  try {
    await client.query(sql);
    console.log("OK", f);
  } catch (e) {
    console.log("ERR", f, e.message);
  }
}
await client.end();
