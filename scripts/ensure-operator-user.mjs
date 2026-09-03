import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.OPERATOR_EMAIL || "operator@partsvillage.local";
const password = process.env.OPERATOR_PASSWORD || process.env.OPERATOR_PIN || "partsvillage";

if (!url || !key) {
  console.error("Missing URL or SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const existing = listed.data?.users?.find(
  (u) => u.email?.toLowerCase() === email.toLowerCase(),
);

if (!existing) {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "operator" },
  });
  if (created.error) {
    console.error(created.error.message);
    process.exit(1);
  }
  console.log("created operator user");
} else {
  const updated = await admin.auth.admin.updateUserById(existing.id, { password });
  if (updated.error) {
    console.error(updated.error.message);
    process.exit(1);
  }
  console.log("updated operator password");
}

const { error } = await admin.auth.signInWithPassword({ email, password });
if (error) {
  console.error("sign-in check failed", error.message);
  process.exit(1);
}
console.log("operator sign-in ok");
