import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pin = process.env.OPERATOR_PIN?.trim();
const password = process.env.OPERATOR_PASSWORD?.trim() || pin;

function operatorEmails() {
  const primary = process.env.OPERATOR_EMAIL?.trim();
  const listed = process.env.OPERATOR_EMAILS?.trim();
  const fromList = listed
    ? listed
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean)
    : [];
  const emails = [];
  const add = (e) => {
    if (!emails.some((x) => x.toLowerCase() === e.toLowerCase())) emails.push(e);
  };
  if (primary) add(primary);
  for (const e of fromList) add(e);
  if (emails.length === 0) add("operator@partsvillage.local");
  return emails;
}

if (!url || !key) {
  console.error("Missing URL or SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!pin) {
  console.error("OPERATOR_PIN is required");
  process.exit(1);
}
if (!password) {
  console.error("OPERATOR_PASSWORD or OPERATOR_PIN is required");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const emails = operatorEmails();
const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
if (listed.error) {
  console.error(listed.error.message);
  process.exit(1);
}

for (const email of emails) {
  const existing = listed.data?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );

  if (!existing) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "operator" },
      app_metadata: { role: "operator" },
    });
    if (created.error) {
      console.error(created.error.message);
      process.exit(1);
    }
    console.log("created operator user", email);
  } else {
    const updated = await admin.auth.admin.updateUserById(existing.id, {
      password,
      user_metadata: { role: "operator" },
      app_metadata: { role: "operator" },
    });
    if (updated.error) {
      console.error(updated.error.message);
      process.exit(1);
    }
    console.log("updated operator user", email);
  }
}

const signInEmail = process.env.OPERATOR_EMAIL?.trim() || emails[0];
const { error } = await admin.auth.signInWithPassword({ email: signInEmail, password });
if (error) {
  console.error("sign-in check failed", error.message);
  process.exit(1);
}
console.log("operator sign-in ok", signInEmail);
