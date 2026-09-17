# Parts Village — QA Test Checklist

**Companion to:** `APP_AUDIT_REPORT.md`
**Audit date:** 2026-09-06 · **Commit:** `08f2a09`
**Environment:** local production build (`vite preview`, `localhost:3000`) against a throwaway
**mock Supabase** seeded with synthetic data. Production Supabase was never contacted. The only
request made to the live deployment was a read-only, token-less `GET /portal` to confirm `UX-002`;
it triggered no Supabase call of any kind.

**On evidence that no longer exists as files.** Screenshots, harness scripts, and raw measurement
JSON were written to scratch directories on the audit machine and do not persist beyond the run.
Every figure in this checklist — ratios, pixel counts, tab-stop indices, millimetre positions — is
therefore restated in the row itself and in the matching report finding, so no row depends on a file
you cannot open.

**Two runtime passes are recorded here.** The first drove the app across 26 routes at three widths
and executed the PDF builders directly. The second closed the gaps the first left open: the Arabic
PDF path, browser print, the inventory form's full numeric and duplicate-submit matrix, XSS in the
DOM, the dashboard reconciliation, `/fleet/$machineId`, `/china-shipments`, offline-and-reconnect,
and runtime timings. Rows changed by the second pass carry a `Runtime` method and restate the
measurement inline.

## How to read the Status column

| Status | Meaning |
|---|---|
| **Pass** | Executed and behaved correctly. |
| **Fail** | Executed and behaved incorrectly. A linked issue ID always accompanies this. |
| **Blocked** | Could not be executed because the environment cannot support it (no device, no production access). |
| **Not Verified** | Not executed in this audit run. **No claim is made either way.** |

**Verification method** is recorded per row so the strength of each result is explicit:
`Runtime` (driven against the running app or a live HTTP probe) ·
`Harness` (the application's own functions executed directly with real inputs) ·
`Source` (code reviewed; behaviour inferred, not observed) ·
`Build` (build/tooling output).

### Summary

| Status | Count | Share |
|---|---|---|
| Pass | 195 | 41% |
| Fail | 219 | 46% |
| Blocked | 8 | 2% |
| Not Verified | 49 | 10% |
| **Total test cases** | **471** | |

Four things to keep in mind when reading these totals:

- **The 219 failures map to 96 distinct issues**, not 219 problems. A single root cause fails many
  test cases — `UX-003` (`overflow-x: clip`) accounts for eleven rows, `STK-002` (no stock audit
  trail) for eight, and `FIN-001`, `FIN-002`, `CUS-001`, `RPT-002`, `UX-005`, and `UX-008` for six
  each.
- **Sections 13 and 14 were executed, not read.** Section 13's 51 cases come from running the
  application's own PDF builders and parsing the resulting page content streams — plus, in the
  second pass, clicking *Share PDF* in the live app and decoding the Arabic rasters out of the
  downloaded file — so every position is a measurement in millimetres or pixels. Section 14's 84
  cases come from driving the running app in headless Chrome across 26 routes at three widths.
  Together they are 135 of the 471 cases and they are the strongest evidence in this checklist.
- **42 of section 14's 84 cases pass**, which is worth stating as plainly as the failures: focus is
  trapped correctly in dialogs, every field in the "Add part" form is labelled, the offline banner
  works and clears on reconnect, and the destructive confirmation defaults to Cancel.
- **The 49 remaining unverified cases are concentrated** in per-form edge cases for the quotation,
  invoice, payment, and client forms (sections 7–9, 11) and in things this environment cannot reach:
  physical printing and scanning hardware, a platform authenticator for WebAuthn, and the production
  Supabase project. §17 of the audit report lists all of them individually. The second runtime pass
  cut this number from 67 to 49 and drove the inventory form's matrix to completion.

| Section | Cases | Pass | Fail | Blocked | Not Verified |
|---|---|---|---|---|---|
| 1. Environment, build, tooling | 13 | 3 | 10 | 0 | 0 |
| 2. Authentication and access control | 16 | 12 | 3 | 1 | 0 |
| 3. Server function authorisation | 9 | 7 | 2 | 0 | 0 |
| 4. Database, RLS, storage | 14 | 8 | 6 | 0 | 0 |
| 5. Secrets and client exposure | 7 | 6 | 1 | 0 | 0 |
| 6. Money and calculation | 25 | 13 | 12 | 0 | 0 |
| 7. Payments and multi-device merge | 22 | 6 | 8 | 0 | 8 |
| 8. Quotations | 25 | 5 | 12 | 0 | 8 |
| 9. Invoices | 27 | 10 | 8 | 0 | 9 |
| 10. Inventory and stock | 60 | 28 | 24 | 3 | 5 |
| 11. Customers and suppliers | 28 | 7 | 14 | 0 | 7 |
| 12. Reports and dashboard | 24 | 2 | 17 | 0 | 5 |
| 13. PDF and printing | 51 | 25 | 22 | 1 | 3 |
| 14. Design, responsive, accessibility | 84 | 42 | 41 | 0 | 1 |
| 15. Security behaviour | 14 | 6 | 5 | 3 | 0 |
| 16. Performance and reliability | 23 | 8 | 13 | 0 | 2 |
| 17. Route coverage | 29 | 7 | 21 | 0 | 1 |

---

## 1. Environment, build, and tooling

| Module | Page / route | Test case | Expected result | Actual result | Method | Status | Issue |
|---|---|---|---|---|---|---|---|
| Tooling | — | `npm ci` on clean checkout | Installs cleanly | Fails: lockfile out of sync, `Missing: lru-cache@11.5.2`; `EBADENGINE` for `@zxing/library` (needs Node ≥24, running 22) | Build | **Fail** | `DEP-002` |
| Tooling | — | `npm run build` | Production build succeeds | Succeeds in 779 ms | Build | **Pass** | — |
| Tooling | — | `npm run test` | All tests pass | 18/18 pass in 4 files, 227 ms | Build | **Pass** | — |
| Tooling | — | Test coverage is meaningful | Core business logic covered | 4 test files for 226 source files; no tests for stock, conversion, auth, AR, PDF | Build | **Fail** | §16 |
| Tooling | — | `npm run typecheck` exists | A typecheck script is available | No such script in `package.json` | Source | **Fail** | `BLD-001` |
| Tooling | — | `npx tsc --noEmit` | Zero type errors | 1 error: `delivery-board.tsx(246,32)` TS2741 | Build | **Fail** | `BLD-001`, `FUN-004` |
| Tooling | — | `npm run lint` | Zero errors | 985 errors, 75 warnings (977 formatting; 8 `no-useless-escape`; 35 `exhaustive-deps`) | Build | **Fail** | `LNT-001`, `PERF-004` |
| Tooling | — | `npm audit` | No high/critical advisories | 5 high, 2 moderate; `xlsx` has no fix available | Build | **Fail** | `DEP-001` |
| Tooling | — | `vite preview` serves the build | App responds | HTTP 200 in 6 ms | Runtime | **Pass** | — |
| Tooling | — | `vite dev` starts without client errors | Clean console | Repeated `node:crypto has been externalized` from `operator-auth-server.ts` | Runtime | **Fail** | `BLD-002` |
| Tooling | — | Single package manager declared | One lockfile and one config | `bunfig.toml` coexists with `package-lock.json` | Source | **Fail** | `DEP-003` |
| Tooling | — | Generated route tree matches generator | No dirty file after build | Build adds a 10-line `declare module` block | Build | **Fail** | `DEP-004` |
| Tooling | — | CI enforces lint/type/test | CI config present | No CI configuration in the repository | Source | **Fail** | §16 |

## 2. Authentication and access control

| Module | Page / route | Test case | Expected result | Actual result | Method | Status | Issue |
|---|---|---|---|---|---|---|---|
| Auth | `/` | App is gated until unlock | Cannot reach data without unlocking | `OperatorUnlockGate` blocks all routes except `/portal` and `/share` | Source | **Pass** | — |
| Auth | `/_serverFn/unlockOperator` | Correct PIN issues a session | Session returned | Session issued with access + refresh token | Runtime | **Pass** | — |
| Auth | `/_serverFn/unlockOperator` | Wrong PIN is rejected | `Invalid PIN` | `{"ok":false,"error":"Invalid PIN"}` | Runtime | **Pass** | — |
| Auth | `/_serverFn/unlockOperator` | 8 wrong PINs from one IP lock out | Locked after 5 | Attempts 1-4 counted, 5-8 `RATE LIMITED` — works as designed | Runtime | **Pass** | — |
| Auth | `/_serverFn/unlockOperator` | 12 wrong PINs with rotating `X-Forwarded-For` lock out | Locked after 5 regardless of claimed IP | **0 of 12 throttled**; correct PIN then accepted from a fresh spoofed IP | Runtime | **Fail** | `SEC-001` |
| Auth | — | PIN comparison is constant-time | No timing oracle | `timingSafeEqualString` used | Source | **Pass** | — |
| Auth | — | Supabase password is not the raw PIN | Derived credential | `sha256("parts-village-operator-v1:" + pin)` | Source | **Pass** | — |
| Auth | — | Operator role cannot be self-assigned | Role set server-side only | Set in `app_metadata` via service role; RLS ignores `user_metadata` | Source | **Pass** | — |
| Auth | — | Public signup is disabled | No self-registration | `enable_signup = false` | Source | **Pass** | — |
| Auth | — | Rate limiter fails closed on store error | Unlock refused | Returns `{ok:true}` on any error — fails **open** | Source | **Fail** | `SEC-003` |
| Auth | — | Failure counter increments atomically | Concurrent failures all counted | Non-atomic load-then-save; a burst counts as ~1 | Source | **Fail** | `SEC-003` |
| Auth | — | Session expiry is enforced | Session expires | `jwt_expiry = 3600`; absolute + session unlock flags in browser storage | Source | **Pass** | — |
| Auth | `/` | Unlock survives reload within session | Stays unlocked | Confirmed across dozens of hard navigations and reloads in the runtime passes: the PIN gate did not reappear and `#operator-pin` stayed absent | Runtime | **Pass** | — |
| Auth | all | Browser back and forward stay unlocked and render | Unlocked, correct route | Back → `/clients` (`h1` "Clients CRM", 1072 chars), forward → `/documents` (`h1` "Documents", 903 chars), gate absent both times, no console errors | Runtime | **Pass** | — |
| Auth | — | WebAuthn register requires operator token | Rejected without token | `requireOperatorAccessToken` enforced | Source | **Pass** | — |
| Auth | — | Face ID / WebAuthn end-to-end | Enrol and unlock | Requires a platform authenticator | — | **Blocked** | — |

## 3. Server function authorisation

| Module | Page / route | Test case | Expected result | Actual result | Method | Status | Issue |
|---|---|---|---|---|---|---|---|
| API | `/_serverFn/syncTitusOrders` | Unauthenticated call is rejected | 401/403, no outbound request | Accepted and dispatched to the handler; no auth parameter exists in its schema | Runtime | **Fail** | `SEC-002` |
| API | `/_serverFn/beginFaceIdRegister` | Requires operator token | Rejected without token | Gated by `requireOperatorAccessToken` | Source | **Pass** | — |
| API | `/_serverFn/finishFaceIdRegister` | Requires operator token | Rejected without token | Gated by `requireOperatorAccessToken` | Source | **Pass** | — |
| API | `/_serverFn/beginFaceIdUnlock` | Pre-auth by design, rate limited | Throttled | Pre-auth as intended; shares the `SEC-001` limiter | Source | **Pass** | `SEC-001` |
| API | `/_serverFn/finishFaceIdUnlock` | Pre-auth by design, rate limited | Throttled | Pre-auth as intended; shares the `SEC-001` limiter | Source | **Pass** | `SEC-001` |
| API | `/_serverFn/fetchPortalStatement` | Requires a valid portal token | Rejected without token | Verifies token, rate limited 40/15 min | Source | **Pass** | — |
| API | `/_serverFn/fetchPortalStatement` | Returns only the requesting client's data | No cross-client leakage | Server-side scoping; never returns the full blob | Source | **Pass** | — |
| API | `/_serverFn/unlockOperator` | Server function endpoints are enumerable | — | Function ids are hashes but appear in the client bundle and server manifest | Source | **Pass** | — |
| API | — | Invalid payload returns a clean error | Validation error | Returns an unhandled HTTP 500 with a generic HTML page | Runtime | **Fail** | `FUN-005` |

## 4. Database, RLS, and storage

| Module | Page / route | Test case | Expected result | Actual result | Method | Status | Issue |
|---|---|---|---|---|---|---|---|
| RLS | `shop_state` | Anonymous read is denied | Denied | Policies require `authenticated` + `app_metadata.role = 'operator'` | Source | **Pass** | — |
| RLS | `shop_state` | Anonymous write is denied | Denied | All four operations gated on the operator claim | Source | **Pass** | — |
| RLS | `shop_state` | Role claim read from `app_metadata` not `user_metadata` | Uses `app_metadata` | Migration `20260903120000` moved to `app_metadata` deliberately | Source | **Pass** | — |
| RLS | legacy tables | `anon`/`authenticated` have no access | Revoked | `revoke all … from anon, authenticated` applied | Source | **Pass** | — |
| Storage | `part-photos` | Unauthenticated read is denied | Denied | Bucket is `public = true` with `Public read … to public` | Source | **Fail** | `SEC-005` |
| Storage | `part-photos` | Upload requires operator role | Denied without role | Insert/update/delete gated on the operator claim | Source | **Pass** | — |
| Storage | `part-photos` | File type and size are limited | Images only, ≤5 MB | `allowed_mime_types` jpeg/png/webp, `file_size_limit` 5 MB | Source | **Pass** | — |
| Schema | `shop_state` | Unique constraint on part numbers | Enforced | No constraint; JSON blob storage | Source | **Fail** | `STK-006` |
| Schema | `shop_state` | Foreign keys between documents and parties | Enforced | None; all links are plain strings | Source | **Fail** | `DAT-001` |
| Schema | `shop_state` | Multi-step operations are transactional | Atomic | No transactions; independent debounced blob writes | Source | **Fail** | `DAT-001` |
| Schema | `shop_state` | Indexes support live queries | Indexed | All 18 indexes are on dead legacy tables | Source | **Fail** | `PERF-003` |
| Schema | — | Migrations apply in a consistent final state | Correct end state | Reviewed all 12; final RLS state is correct | Source | **Pass** | — |
| Schema | — | Database triggers / functions reviewed | Documented | None exist beyond the initial schema | Source | **Pass** | — |
| Backup | — | Backup / restore capability exists | Restorable | No export-all, snapshot, or restore hook in the app | Source | **Fail** | §14 |

## 5. Secrets and client exposure

| Module | Page / route | Test case | Expected result | Actual result | Method | Status | Issue |
|---|---|---|---|---|---|---|---|
| Secrets | client bundle | `OPERATOR_PIN` absent | Absent | Not present | Build | **Pass** | — |
| Secrets | client bundle | `SUPABASE_SERVICE_ROLE_KEY` absent | Absent | Not present | Build | **Pass** | — |
| Secrets | client bundle | Server-only modules absent | Absent | `operator-auth-server`, `ensureOperatorUser`, `TITUS_ORIGIN` all absent | Build | **Pass** | — |
| Secrets | client bundle | Anon key present (expected) | Present and safe | Present; safe under RLS | Build | **Pass** | — |
| Secrets | browser storage | No third-party credentials stored | None | Titus username + password in `sessionStorage` as plain JSON | Source | **Fail** | `SEC-006` |
| Secrets | repository | No credential files committed | None | `.env` gitignored; no secrets in the repo | Source | **Pass** | — |
| Secrets | error messages | Errors do not leak internals | Generic | Server-fn failure returns a generic HTML page; stack traces stay server-side | Runtime | **Pass** | — |

## 6. Money and calculation (harness-verified)

Executed against the application's real `src/lib/document-money.ts` and `document-money-heal.ts`.

| Module | Page / route | Test case | Expected result | Actual result | Method | Status | Issue |
|---|---|---|---|---|---|---|---|
| Money | `document-money` | `roundMoney(1.005)` | `1.01` | `1.01` | Harness | **Pass** | — |
| Money | `document-money` | `roundMoney(2.675)` | `2.68` | `2.68` | Harness | **Pass** | — |
| Money | `document-money` | `roundMoney(8.475)` | `8.48` | `8.48` | Harness | **Pass** | — |
| Money | `document-money` | Negative rounding is symmetric | `roundMoney(-1.005) = -1.01` | `-1` — one cent lost | Harness | **Fail** | `FIN-002` |
| Money | `document-money` | Negative rounding is symmetric | `roundMoney(-2.675) = -2.68` | `-2.67` — one cent lost | Harness | **Fail** | `FIN-002` |
| Money | `document-money` | Negative rounding is symmetric | `roundMoney(-0.615) = -0.62` | `-0.61` — one cent lost | Harness | **Fail** | `FIN-002` |
| Money | `document-money` | Large value keeps the half cent | `roundMoney(1e10 + 0.005) = 10000000000.01` | `10000000000` — dropped | Harness | **Fail** | `FIN-002` |
| Money | `document-money` | Output is always cent-exact | 2 decimal places | `roundMoney(1e15 + 0.5) = 1000000000000000.5` — not cent-rounded | Harness | **Fail** | `FIN-002` |
| Money | `document-money` | Percent discount clamped to 100% | `100` on a 100 subtotal | `100` | Harness | **Pass** | — |
| Money | `document-money` | Fixed discount clamped to subtotal | `100` for a $500 discount on 100 | `100` | Harness | **Pass** | — |
| Money | `document-money` | Negative discount ignored | `0` | `0` | Harness | **Pass** | — |
| Money | `document-money` | Zero discount ignored | `0` | `0` | Harness | **Pass** | — |
| Money | `document-money` | Negative subtotal floored | `0` | `0` | Harness | **Pass** | — |
| Money | `document-money` | Percent normalised above 100 | Clamped to 100 | `{type:"percent",value:100}` | Harness | **Pass** | — |
| Money | `document-money` | Fixed discount clamped at mint time | Clamped | `{type:"amount",value:1000000000}` — not clamped until applied | Harness | **Pass** | — |
| Money | `document-money` | Tax applies to the discounted net | `99.9` for 100 − 10% + 11% | `99.9` | Harness | **Pass** | — |
| Money | `document-money` | Tax rate is configurable | Settable | `DOCUMENT_TAX_RATE_PERCENT = 0` hardcoded; no UI | Source | **Fail** | `FIN-005` |
| Money | `document-money` | Subtotal definition is consistent | UI basis === ratio basis | 12 × 0.005 lines: UI `0.12` vs ratio basis `0.06` | Harness | **Fail** | `FIN-004` |
| Money | `document-money` | Ratio basis includes all lines | Same line set as UI | Skips `Payment`/`Discount`: `30` vs `100` | Harness | **Fail** | `FIN-004` |
| Money | `document-money` | `roundMoney(NaN)` rejected | Throws or `null` | Returns `0` silently | Harness | **Fail** | `FUN-005` |
| Money | `document-money` | `roundMoney(Infinity)` rejected | Throws or `null` | Returns `0` silently | Harness | **Fail** | `FUN-005` |
| Money | `document-money` | Subtotal with `NaN` qty rejected | Throws | Returns `0` — a plausible-looking zero total | Harness | **Fail** | `FUN-005` |
| Money | `document-money` | Credit note total matches invoice net | Equal | `21.91` === `21.91` for the tested case | Harness | **Pass** | — |
| Money | `document-money` | Discount ratio is exact for 10% | `0.9` | `0.900164338537387` — unrounded float | Harness | **Fail** | `FIN-004` |
| Money | UI vs PDF | Screen and PDF use the same subtotal formula | Identical | Both use `roundMoney(Σ roundMoney(qty × price))` | Source | **Pass** | — |

## 7. Payments and multi-device merge (harness-verified)

| Module | Page / route | Test case | Expected result | Actual result | Method | Status | Issue |
|---|---|---|---|---|---|---|---|
| Payments | merge | Invoice with matching receipts survives a merge | Unchanged | `INV-…aaaa` paid 400 vs receipts 250+150 → unchanged | Harness | **Pass** | — |
| Payments | merge | Fully paid invoice with a receipt survives | Unchanged | `INV-…bbbb` 219.98 → unchanged | Harness | **Pass** | — |
| Payments | merge | Unpaid invoice survives | Unchanged | `INV-…cccc` → unchanged | Harness | **Pass** | — |
| Payments | merge | Legacy `Paid` invoice with no receipt survives | Stays `Paid` | `INV-…dddd` → `amountPaid: 0`, `status: "Unpaid"` | Harness | **Fail** | `FIN-001` |
| Payments | merge | Manual `amountPaid` with no receipt survives | Retained | `750` on a 1000 invoice → erased to `0`, `Unpaid` | Harness | **Fail** | `FIN-001` |
| Payments | merge | Merge never lowers `amountPaid` | Never lowers | Lowers unconditionally to the receipt sum | Harness | **Fail** | `FIN-001` |
| Payments | merge | Loss is recoverable on a later merge | Recoverable | Second merge is identical — loss is permanent | Harness | **Fail** | `FIN-001` |
| Payments | merge | User is warned that a payment was removed | Explicit warning | Only a generic sync-conflict notice | Source | **Fail** | `FIN-001` |
| Payments | merge | Numeric quantity deltas merge additively | Additive | Covered by the project's own passing tests | Build | **Pass** | — |
| Payments | — | Status derives correctly from paid + credits | Paid/Partial/Unpaid | `resolveStatus` correct for those three | Source | **Pass** | — |
| Payments | — | `Overdue` is derived from a due date | Derived | Never set — only preserved if already present | Source | **Fail** | `FIN-003` |
| Payments | — | Negative `amountPaid` is surfaced | Error raised | Clamped to `0`, hiding corruption | Source | **Fail** | `FIN-007` |
| Payments | — | Paid amount is not inferred from status | Receipt-derived | Falls back to `status==="Paid" ? total : 0` | Source | **Fail** | `FIN-007` |
| Payments | `/documents` | Reducing an invoice below payments received is blocked | Blocked with a message | Blocked: "Cannot reduce this invoice below payments already received" | Source | **Pass** | — |
| Payments | `/documents` | Partial payment updates balance and status | Correct | — | — | **Not Verified** | — |
| Payments | `/documents` | Overpayment beyond the balance | Warned or blocked | — | — | **Not Verified** | — |
| Payments | `/documents` | Zero-amount payment | Rejected | — | — | **Not Verified** | — |
| Payments | `/documents` | Negative payment amount | Rejected | — | — | **Not Verified** | — |
| Payments | `/documents` | Double-submitting a payment | One receipt only | — | — | **Not Verified** | — |
| Payments | `/documents` | Deleting a receipt recalculates `amountPaid` | Recalculated, status reverts | — | — | **Not Verified** | — |
| Payments | `/documents` | Multiple payments accumulate correctly | Sum correct | — | — | **Not Verified** | — |
| Payments | `/documents` | Payment method is recorded | Stored and shown | — | — | **Not Verified** | — |

## 8. Quotations

| Module | Page / route | Test case | Expected result | Actual result | Method | Status | Issue |
|---|---|---|---|---|---|---|---|
| Quotations | `/documents` | Quotation numbering is unique | Unique | Timestamp + random suffix; no uniqueness check or constraint | Source | **Fail** | `FUN-003` |
| Quotations | `/documents` | Numbering is sequential and gapless | Sequential | Non-sequential; gaps on delete and conversion | Source | **Fail** | `FUN-002` |
| Quotations | `/documents` | Quotation has an expiry date | Present | No `validUntil` field exists | Source | **Fail** | `QUO-001` |
| Quotations | `/documents` | `Expired` status exists | Present | Only `Draft` and `Sent` | Source | **Fail** | `QUO-002` |
| Quotations | `/documents` | `Accepted` / `Rejected` statuses exist | Present | Absent | Source | **Fail** | `QUO-002` |
| Quotations | `/documents` | `Converted` status exists | Present | Absent — the quotation is deleted instead | Source | **Fail** | `FUN-001`, `QUO-002` |
| Quotations | `/documents` | Quotations do not change stock | Unchanged | Confirmed: stock only moves at conversion | Source | **Pass** | — |
| Quotations | `/documents` | Over-quoting the same stock is warned | Warned | No reservation and no warning | Source | **Fail** | `QUO-003` |
| Quotations | `/documents` | Conversion copies all line information | Copied | Spread from the quote (`...quote`), so lines/party/dates carry over | Source | **Pass** | — |
| Quotations | `/documents` | Conversion does not create duplicate invoices | One invoice | Quote is removed, so a second call throws `Quotation not found` | Source | **Pass** | — |
| Quotations | `/documents` | Conversion preserves a link to the invoice | Structured link | Free-text `internalNote` only; no `quotationId`/`invoiceId` field | Source | **Fail** | `FUN-001` |
| Quotations | `/documents` | Original quotation is retained after conversion | Retained | **Deleted** from the documents array | Source | **Fail** | `FUN-001` |
| Quotations | `/documents` | Repeated conversion clicks are safe for stock | Deduct once | Stock deducted **before** the conversion, with no re-entrancy guard → deducted twice | Source | **Fail** | `STK-001` |
| Quotations | `/documents` | Failed conversion rolls back stock | Rolled back | `catch` only shows a toast; stock stays deducted | Source | **Fail** | `STK-001` |
| Quotations | `/documents` | Conversion applies the correct status | `Unpaid` | `status: "Unpaid"`, `amountPaid: 0` | Source | **Pass** | — |
| Quotations | `/documents` | Convert with "Keep stock" leaves stock alone | Unchanged | Honoured via the `stockDeducted` flag | Source | **Pass** | — |
| Quotations | `/documents` | Stock effect is visible on the invoice | Clearly shown | Stored as a flag; prominence not verified | Source | **Fail** | `QUO-004` |
| Quotations | `/documents` | Create a quotation through the UI | Saved and listed | — | — | **Not Verified** | — |
| Quotations | `/documents` | Edit a quotation | Changes persist | — | — | **Not Verified** | — |
| Quotations | `/documents` | Duplicate a quotation | Copy created | — | — | **Not Verified** | — |
| Quotations | `/documents` | Delete a quotation | Removed with confirmation | — | — | **Not Verified** | — |
| Quotations | `/documents` | Cancel out of the editor | No changes saved | — | — | **Not Verified** | — |
| Quotations | `/documents` | Custom (non-catalog) line items | Accepted | — | — | **Not Verified** | — |
| Quotations | `/documents` | Line-level and document-level discounts | Both applied | Logic verified by harness; UI not driven | Harness | **Not Verified** | — |
| Quotations | `/documents` | Notes and terms appear on output | Present | — | — | **Not Verified** | — |

## 9. Invoices

| Module | Page / route | Test case | Expected result | Actual result | Method | Status | Issue |
|---|---|---|---|---|---|---|---|
| Invoices | `/documents` | Invoice numbering is unique | Unique | Timestamp + random; collision possible in the same millisecond | Source | **Fail** | `FUN-003` |
| Invoices | `/documents` | Numbering is sequential and gapless | Sequential | Non-sequential with gaps | Source | **Fail** | `FUN-002` |
| Invoices | `/documents` | Invoice has a due date | Present | No `dueDate` field | Source | **Fail** | `FIN-003` |
| Invoices | `/documents` | `Draft` state exists | Present | Not in the status set (`Unpaid`/`Partial`/`Paid`/`Overdue`) | Source | **Fail** | `QUO-002` |
| Invoices | `/documents` | `Cancelled` state exists | Present | Absent — deletion is the only route | Source | **Fail** | `FIN-003` |
| Invoices | `/documents` | `Refunded` state exists | Present | Absent — credit notes are used instead | Source | **Pass** | — |
| Invoices | `/documents` | Revert to quotation blocked when payments exist | Blocked | Blocked: "Cannot revert — invoice has payments" | Source | **Pass** | — |
| Invoices | `/documents` | Revert blocked when receipts exist | Blocked | Blocked with a clear message | Source | **Pass** | — |
| Invoices | `/documents` | Revert blocked when credit notes exist | Blocked | Blocked with a clear message | Source | **Pass** | — |
| Invoices | `/documents` | Revert menu hidden for paid invoices | Hidden | Gated on `amountPaid ≤ 0.005` and no receipts/credits | Source | **Pass** | — |
| Invoices | `/documents` | Revert restores stock only after validation | Validate first | Stock restored **before** validation → phantom stock on a concurrent receipt | Source | **Fail** | `STK-004` |
| Invoices | `/documents` | Restock is capped for oversold lines | Capped | `physicalRestockCap(soldQty, oversoldQty, 0)` applied | Source | **Pass** | — |
| Invoices | `/documents` | Deleting an invoice warns about accounting history | Warned | Confirmation exists; wording and orphan handling not verified | Source | **Not Verified** | — |
| Invoices | `/documents` | Deleting an invoice cleans up linked receipts | No orphans | No referential integrity; orphans structurally possible | Source | **Fail** | `DAT-001` |
| Invoices | `/documents` | Create an invoice through the UI | Saved and listed | — | — | **Not Verified** | — |
| Invoices | `/documents` | Edit an invoice after issuance | Totals recomputed | — | — | **Not Verified** | — |
| Invoices | `/documents` | Editing after payment cannot go below paid | Blocked | Guard confirmed in source | Source | **Pass** | — |
| Invoices | `/documents` | Quantity greater than one | Correct line total | Formula verified by harness | Harness | **Pass** | — |
| Invoices | `/documents` | Decimal quantities | Correct | `2.5 × 1.999` handled correctly | Harness | **Pass** | — |
| Invoices | `/documents` | Decimal prices | Correct | `7 × 3.333 = 23.33` | Harness | **Pass** | — |
| Invoices | `/documents` | Very large totals display correctly | Formatted | Seeded a 15,000,034.99 invoice; rendering not observed | — | **Not Verified** | — |
| Invoices | `/documents` | Zero-value line | Handled | — | — | **Not Verified** | — |
| Invoices | `/documents` | Negative line price | Rejected or handled | — | — | **Not Verified** | — |
| Invoices | `/documents` | Multiple currencies | Supported | Currency effectively hardcoded to USD | Source | **Fail** | `FIN-006` |
| Invoices | `/documents` | Refresh after saving shows the same data | Consistent | Driven on the **inventory** form, where it passes; the invoice form itself was not submitted through the UI | — | **Not Verified** | — |
| Invoices | `/documents` | Browser back/forward preserves state | Consistent | Route-level back/forward verified (see §2); the invoice editor's own in-progress state was not | — | **Not Verified** | — |
| Invoices | `/documents` | Duplicate submission of the invoice form | One invoice, one message | Driven on the **inventory** form, where it creates one record but emits three success toasts (`FUN-007`); the invoice form is expected to share the pattern but was not driven | — | **Not Verified** | `FUN-007` |

## 10. Inventory and stock

| Module | Page / route | Test case | Expected result | Actual result | Method | Status | Issue |
|---|---|---|---|---|---|---|---|
| Inventory | `/inventory` | Duplicate part number blocked on **create** | Rejected | `findDuplicatePart` throws "Part number already exists" | Source | **Pass** | — |
| Inventory | `/inventory` | Duplicate detection is case/whitespace-insensitive | Normalised | Trimmed, lowercased, includes OEM cross-refs | Source | **Pass** | — |
| Inventory | `/inventory` | Duplicate part number blocked on **edit** | Rejected | `updatePart` performs **no** duplicate check | Source | **Fail** | `STK-005` |
| Inventory | `/inventory` | Concurrent create of the same part number | One succeeds | Both succeed; no server-side constraint | Source | **Fail** | `STK-006` |
| Inventory | — | Every stock change writes a movement record | Movement logged | **No movement/ledger/audit concept exists anywhere** | Source | **Fail** | `STK-002` |
| Inventory | — | Each adjustment records the responsible user | Attributed | No `changedBy`/`updatedBy` field in the codebase | Source | **Fail** | `STK-002` |
| Inventory | — | Stock movement history is viewable | History screen | No such screen | Source | **Fail** | `STK-002` |
| Inventory | — | All 14 stock mutation sites are auditable | All logged | 14 sites, 0 records | Source | **Fail** | `STK-002` |
| Inventory | `/documents` | Invoice deduction happens exactly once | Once | Deducted before commit, no guard → twice on retry | Source | **Fail** | `STK-001` |
| Inventory | `/documents` | Failed conversion leaves stock untouched | Untouched | Stock stays deducted | Source | **Fail** | `STK-001` |
| Inventory | `/documents` | Document-created parts are not invented | No phantom stock | Shortfall added then deducted, forcing quantity to 0 | Source | **Fail** | `STK-003` |
| Inventory | `/documents` | Oversell is warned before committing | Warned | `confirmOversell(stockShortagesForQty(...))` prompts | Source | **Pass** | — |
| Inventory | `/documents` | Returns restore stock | Restored | `create-return-dialog` adjusts quantity | Source | **Pass** | — |
| Inventory | `/china-shipments` | Receiving a shipment increases stock | Increased | `shipment-receive-dialog` adjusts quantity | Source | **Pass** | — |
| Inventory | `/stock-take` | Manual adjustment updates quantity | Updated | Two adjustment call sites present | Source | **Pass** | — |
| Inventory | `/stock-take` | Manual adjustment records a reason and user | Recorded | Not recorded | Source | **Fail** | `STK-002` |
| Inventory | `/inventory` | Removing a catalog part preserves its values | Preserved or archived | Deletes the override; quantity and pricing snap back to catalog defaults | Source | **Fail** | `STK-007` |
| Inventory | `/inventory` | Large catalogs render without freezing | Virtualised | `VirtualInventoryTable` in use | Source | **Pass** | — |
| Inventory | `/inventory` | Negative quantity, cost, or price cannot be stored | Impossible | `clampNonNeg` in `applyOverride`/`normalizePart`, `Math.max(0, …)` in `bulkUpdateParts`, and a zero clamp in `adjustPartQuantity` | Source | **Pass** | — |
| Inventory | `/inventory` | Negative qty rejected with a message in the Add/Edit dialog | Rejected with a message | Typed `-5`; **nothing was created** and the toast read `Qty, reorder, cost, and price cannot be negative` | Runtime | **Pass** | — |
| Inventory | `/inventory` | Negative cost rejected with a message in the Add/Edit dialog | Rejected with a message | Typed `-12`; nothing created, same clear message | Runtime | **Pass** | — |
| Inventory | `/inventory` | Non-numeric qty rejected with a message | Rejected with a message | Typed `abc`; nothing created, toast read `Qty, reorder, cost, and price must be numbers` | Runtime | **Pass** | — |
| Inventory | `/inventory` | Negative input rejected in the inline quantity cell | Rejected with a message | Silently discarded and reverted to the previous value with no message at all | Runtime | **Fail** | `STK-010` |
| Inventory | `/inventory` | Fractional quantity preserved or rejected — Add/Edit dialog | Preserved or rejected | Typed `2.5`, **stored `3`** (`Math.round`), no warning | Runtime | **Fail** | `STK-009` |
| Inventory | `/inventory` | Fractional quantity preserved or rejected — inline cell | Preserved or rejected, same rule as the dialog | Typed `7.5`, **stored `7`** (`parseInt` then `Math.floor`) — a different rule from the dialog, no warning | Runtime | **Fail** | `STK-009` |
| Inventory | `/inventory` | Search by part number | Matches | `HOSE-1/2` and `XSS-001` both return the intended part **as the first row** | Runtime | **Pass** | — |
| Inventory | `/inventory` | Search by description | Matches | `hydraulic` matches parts by description text, not only by code | Runtime | **Pass** | — |
| Inventory | `/inventory` | Search result count reflects real matches | Count is accurate | `HOSE-1/2` (one real match) reports **`500 of 2344 parts`** — the render cap read as a match count | Runtime | **Fail** | `STK-011` |
| Inventory | `/inventory` | Arabic-Indic digits normalised in search | Normalised | `٠-٩` and `۰-۹` mapped to ASCII before matching, so `١/٢` finds `1/2` | Source | **Pass** | — |
| Inventory | `/inventory` | Search with no matches shows an empty state | Empty state | `0 of 2344 parts` plus `No parts match "zzzz-definitely-not-a-part".` | Runtime | **Pass** | — |
| Inventory | `/inventory` | Sorting by each column | Correct order | **0 `<th>` elements, 0 `aria-sort`, 0 clickable headers** among 172 controls; the only sort toggle applies to O-Rings alone | Runtime | **Fail** | `STK-012` |
| Inventory | `/inventory` | Category and brand filters | Filtered | Category chips plus quick filters (low stock, zero cost, no photo, favourites, seals-in-stock) all present and applied | Runtime | **Pass** | — |
| Inventory | `/inventory` | Create a part with required fields empty | Validation shown | Blocked, but as a **transient toast only** — no inline error, no `aria-invalid`; focus stayed on `part-number` | Runtime | **Fail** | `UX-007` |
| Inventory | `/inventory` | Three rapid Create clicks create one part | One part, one message | One part created — but **three "Added DUPSUBMIT-1" toasts** appeared | Runtime | **Fail** | `FUN-007` |
| Inventory | `/inventory` | Duplicate part number rejected on create | Rejected, dialog stays open | `Part number already exists: HOSE-1/2 (Hydraulic hose 1/2 inch)`; count unchanged at 7, dialog stayed open | Runtime | **Pass** | — |
| Inventory | `/inventory` | New part survives a full page reload | Persists | Present in the backing store before and after a hard reload | Runtime | **Pass** | — |
| Inventory | `/inventory` | Price with many decimal places | Rounded predictably | Not driven with a many-decimal price; only integer and 10¹⁵ cases were entered | — | **Not Verified** | — |
| Inventory | `/inventory` | Very large price value | Handled | `roundMoney` misbehaves above ~1e10; `1000000000000000` was accepted and stored verbatim with no upper bound | Runtime | **Fail** | `FIN-002` |
| Inventory | `/inventory` | 300+ character description does not break layout | No overflow | With a 300-char description and a 108-char client name seeded, `/inventory` keeps `scrollWidth === clientWidth` at 1440 px | Runtime | **Pass** | — |
| Inventory | `/inventory` | Special characters and Unicode in fields | Preserved | `<b>test</b><img src=x onerror=…>` round-tripped and rendered as literal text; Arabic part names preserved through to the PDF | Runtime | **Pass** | — |
| Inventory | `/inventory` | Unit of measurement field | Present | — | — | **Not Verified** | — |
| Inventory | `/inventory` | Warehouse / shelf location | Present | `/stock-map` and `box_number` suggest support | Source | **Not Verified** | — |
| Inventory | `/inventory` | Machine compatibility | Present | `/fleet` and kits suggest support | Source | **Not Verified** | — |
| Inventory | `/inventory` | Product image upload | Works | Requires a real Storage bucket | — | **Blocked** | — |
| Inventory | `/inventory` | Creation / modification dates recorded | Present | No timestamps on parts | Source | **Fail** | `STK-002` |
| Inventory | `/inventory` | Import matches part codes exactly | Exact match | `index.get(code.toLowerCase())` against `partNumber` plus every OEM cross-reference; a code containing `/` matches itself | Source | **Pass** | — |
| Inventory | `/inventory` | The app's own export re-imports without corruption | Round trip is identity-safe | Export writes `"Part Code": p.partNumber` verbatim and the importer maps `"part code"` straight back | Source | **Pass** | — |
| Inventory | `/inventory` | A dry run is shown before anything is written | Preview | Update/create/skip counts plus per-row `code · qty a→b · cost a→b · price a→b` | Source | **Pass** | — |
| Inventory | `/inventory` | Skipped rows carry a reason | Reason given | `{ action: "skip", reason: "Missing part number" }` | Source | **Pass** | — |
| Inventory | `/inventory` | Large drops require explicit confirmation | Confirmation | Any quantity or cost below 50% of current triggers a destructive confirm naming up to 5 codes | Source | **Pass** | — |
| Inventory | `/inventory` | Blank cells do not erase existing data | Left untouched | `toNum("")` → `undefined`, and undefined fields are skipped on write | Source | **Pass** | — |
| Inventory | `/inventory` | Export column set is complete | Complete | 14 columns including OEM, machine, location, notes | Source | **Pass** | — |
| Inventory | `/inventory` | Duplicate rows for one part are summed or rejected | Summed or rejected | Silently last-wins; 10/7/3 leaves 3, and the toast reports "3 updated" for one part | Source | **Fail** | `IMP-002` |
| Inventory | `/inventory` | Dry run lists every affected row | All rows or a count disclosure | `preview.slice(0, 30)`; on a 500-row file 470 rows apply unseen | Source | **Fail** | `IMP-003` |
| Inventory | `src/lib/inventory-import.ts` | No unreachable importer with different matching rules | One matching rule | `parseInventoryExcelFile` is exported but never called, and truncates codes at the first separator | Source | **Fail** | `IMP-001` |
| Inventory | `/inventory` | Import driven through the real dialog with a real file | Imported correctly | The path was traced end to end in source; a file was not uploaded through the browser | — | **Not Verified** | — |
| Inventory | `/inventory` | Malformed import file handled safely | Rejected safely | `xlsx` has unfixed prototype-pollution and ReDoS advisories | Build | **Fail** | `DEP-001` |
| Inventory | `/inventory` | Merging duplicate parts blends cost | Weighted blend | `blendedUnitCost` implemented | Source | **Pass** | — |
| Inventory | `/labels` | Barcode scanning | Scans | Requires a camera | — | **Blocked** | — |
| Inventory | `/labels` | Label printing | Prints | Requires a printer | — | **Blocked** | — |

## 11. Customers and suppliers

| Module | Page / route | Test case | Expected result | Actual result | Method | Status | Issue |
|---|---|---|---|---|---|---|---|
| Parties | `/clients/` | Phone numbers normalised | E.164 | `normalizePhoneE164` covered by 5 passing tests | Build | **Pass** | — |
| Parties | `/clients/$clientId` | AR statement builds per client | Correct | `buildArStatement` implemented | Source | **Pass** | — |
| Parties | `/clients/$clientId` | Documents attribute to the correct client | Correct | `documentBelongsToClient` matches on id, falling back to name | Source | **Pass** | — |
| Parties | `/clients/$clientId` | Deleting a client with unpaid invoices is blocked | Blocked | Deletion proceeds; the invoices remain but leave AR | Harness | **Fail** | `CUS-001` |
| Parties | `/` | Dashboard AR total survives deleting an indebted client | Unchanged | **$6,950.00 → $950.00**; $6,000 of receivables vanished | Harness | **Fail** | `CUS-001` |
| Parties | `/clients/$clientId` | Deleted client's statement is still reachable | Reachable | `getClient(id)` misses → "Client not found"; no route can reach it | Source | **Fail** | `CUS-001` |
| Parties | `/suppliers/$supplierId` | Delete warns about related history | Warned | Confirm dialog mentions no related inquiries or orders at all | Source | **Fail** | `CUS-001` |
| Parties | `/clients/` | Archive is distinct from delete | Distinct | No archive concept found for parties | Source | **Fail** | `CUS-001` |
| Parties | `/clients/` | Duplicate customer detection | Warned | No duplicate detection anywhere in the party forms | Source | **Fail** | `CUS-002` |
| Parties | `/clients/` | Re-adding an existing name preserves contact details | Preserved | `phone`/`email`/`address`/`contactName` overwritten with `""` | Source | **Fail** | `CUS-002` |
| Parties | `/documents` | Quotation Excel import preserves an existing client's contacts | Preserved | `addClient({name, notes})` blanks every contact field | Source | **Fail** | `CUS-002` |
| Parties | `/clients/` | Duplicate name keeps documents correctly linked | Linked | Existing `id` is preserved, so documents stay attached | Source | **Pass** | — |
| Parties | `/clients/` | Client balance matches source documents | Matches | `netDue = total − paid − credits`; distorted by `FIN-001`/`FIN-003` | Source | **Fail** | `FIN-001` |
| Parties | `/suppliers/` | Supplier balances tracked | Tracked | Inquiries link to suppliers; no payables ledger | Source | **Not Verified** | — |
| Parties | `/clients/` | Create a client | Saved | — | — | **Not Verified** | — |
| Parties | `/clients/` | Edit a client | Persists | — | — | **Not Verified** | — |
| Parties | `/clients/` | Email format validation | Validated | — | — | **Not Verified** | — |
| Parties | `/clients/` | Tax / registration number field | Present | — | — | **Not Verified** | — |
| Parties | `/clients/` | Search and filter | Works | — | — | **Not Verified** | — |
| Parties | `/clients/$clientId` | Transaction history is complete | All documents shown | — | — | **Not Verified** | — |
| Parties | `/clients/$clientId` | Renaming a client keeps reporting intact | Intact | Dashboard groups revenue by **name**, so a rename splits history | Source | **Fail** | `RPT-003` |
| Parties | `/portal` | Portal token grants access to one client only | Scoped | Server-side scoping verified | Source | **Pass** | — |
| Parties | `/portal` | Expired token is rejected | Rejected | Missing or unparseable expiry treated as **not** expired | Source | **Fail** | `SEC-004` |
| Parties | `/portal` | Token comparison is timing-safe | Timing-safe | `timingSafeEqualString` used | Source | **Pass** | — |
| Parties | `/portal` | Token entropy is adequate | ≥128 bits | 16 random bytes | Source | **Pass** | — |
| Parties | `/portal` | Token generation always uses a CSPRNG | Always | Falls back to `Math.random()` if `crypto` is absent | Source | **Fail** | `SEC-004` |
| Parties | `/portal` | Token is not exposed in the URL | Not in query string | Passed as `?c=…&t=…` | Source | **Fail** | `SEC-004` |
| Parties | `/portal` | Portal requests are rate limited | Limited | 40 per 15 min — but shares the `SEC-001` weakness | Source | **Fail** | `SEC-001` |

## 12. Reports and dashboard

| Module | Page / route | Test case | Expected result | Actual result | Method | Status | Issue |
|---|---|---|---|---|---|---|---|
| Reports | `/` | Every card's formula is documented | Documented | All 16 documented in §11 of the report | Source | **Pass** | — |
| Reports | `/` | Paid sales derives from one source | Single source | Invoices **plus** the zombie `orders` collection | Source | **Fail** | `RPT-001` |
| Reports | `/` | Paid sales applies invoice discounts | Applied | `orders` branch uses raw `qty × unitPrice` | Source | **Fail** | `RPT-001` |
| Reports | `/` | Paid sales subtracts credit notes and refunds | Subtracted | Never subtracted | Source | **Fail** | `RPT-001` |
| Reports | `/` | Low stock includes out-of-stock parts | Included | Dashboard requires `quantity > 0`, excluding them | Source | **Fail** | `RPT-002` |
| Reports | `/` vs `/low-stock` | Both screens agree on low stock | Same set | Different predicates → different results | Source | **Fail** | `RPT-002` |
| Reports | `/` | Top clients group by client id | By id | Grouped by `partyName` string | Source | **Fail** | `RPT-003` |
| Reports | `/` | Monthly sales measures sales | Sales | Measures cash **receipts**, though labelled sales | Source | **Fail** | `RPT-004` |
| Reports | `/` | Date bucketing is timezone-consistent | Consistent | Local-time bucket keys vs raw date-string slicing | Source | **Fail** | `RPT-004` |
| Reports | `/` | P&L date filter is timezone-safe | Safe | `YYYY-MM-DD` string comparison | Source | **Fail** | `RPT-004` |
| Reports | `/` | Inventory value is rounded to cents | Rounded | Raw float accumulation | Source | **Fail** | `STK-008` |
| Reports | `/` | Negative stock does not reduce inventory value | No reduction | Negative quantities subtract | Source | **Fail** | `STK-008` |
| Reports | `/` | Average margin reflects realised sales | Realised | Catalog-weighted theoretical margin; no sales input | Source | **Fail** | `RPT-001` |
| Reports | `/` | AR aging uses the due date | Due date | Ages from the invoice date | Source | **Fail** | `FIN-003` |
| Reports | `/` | AR total equals the sum of client statements | Equal | `Σ netDue`, floored at 0 per invoice | Source | **Pass** | — |
| Reports | `/` | Cards capped at 8 disclose the total | "8 of N" shown | Silent `.slice(0, 8)` on five cards | Source | **Fail** | `RPT-002` |
| Reports | `/` | Cancelled and draft documents excluded | Excluded | Neither status exists | Source | **Fail** | `QUO-002` |
| Reports | `/` | Rendered card values match source records | Match | Every KPI was scraped and reconciled by hand against the seeded records; **"Low Stock Alerts" showed 8 where the source data holds 136** | Runtime | **Fail** | `RPT-002` |
| Reports | `/low-stock` | Dashboard low-stock count agrees with the low-stock page | Same number | Dashboard 8 (capped by `.slice(0,8)`, zero-qty parts excluded) vs `/low-stock` 136 — a 128-part disagreement | Runtime | **Fail** | `RPT-002` |
| Reports | `/insights` | Sales board figures are accurate | Accurate | — | — | **Not Verified** | — |
| Reports | `/daily-close` | Drawer total matches receipts | Matches | Unrounded `cash + omt + whish` | Source | **Not Verified** | — |
| Reports | `/collections` | Promise-to-pay list is accurate | Accurate | — | — | **Not Verified** | — |
| Reports | `/reorder` | Reorder suggestions are correct | Correct | — | — | **Not Verified** | — |
| Reports | — | Exported report accuracy | Matches screen | — | — | **Not Verified** | — |

## 13. PDF and printing

> **Method note.** Two methods appear in this section.
> `Rendered` rows come from loading the application's own `buildPdf()` and `downloadStatementPdf()`
> through Vite's SSR module loader and executing them: 16 document fixtures plus a 350-shape AR
> statement sweep were produced, and the resulting PDF content streams were parsed to recover the
> position, font size, and text of every drawn string. Positions are in millimetres on a
> 210 × 297 mm page with a 14 mm margin and the footer rule at y = 281.
> `Runtime` rows come from the second pass: a document containing Arabic was opened in the running
> app, *Share PDF* was clicked, and the **downloaded file** was parsed — image XObjects extracted,
> soft masks decoded to PNG and inspected, and glyph ink measured per row and column. Browser print
> output was captured through the print pipeline on the same session.

| Module | Page / route | Test case | Expected result | Actual result | Method | Status | Issue |
|---|---|---|---|---|---|---|---|
| PDF | `/documents` | A4 page size | 210 × 297 mm | `MediaBox [0 0 595.28 841.89]` on every document from every builder | Rendered | **Pass** | — |
| PDF | `/documents` | Page margins consistent | Uniform | 14 mm left/right; footer rule at 281 mm | Rendered | **Pass** | — |
| PDF | `/documents` | Short document renders on one page | 1 page | 3-line invoice → 1 page | Rendered | **Pass** | — |
| PDF | `/documents` | Long document spans multiple pages | Correct | 40-line invoice → 3 pages | Rendered | **Pass** | — |
| PDF | `/documents` | Table headers repeat on pages 2+ | Repeated | Header found on pages 1, 2 **and** 3 | Rendered | **Pass** | — |
| PDF | `/documents` | Page breaks do not split rows | Clean breaks | No row straddles a boundary in any fixture | Rendered | **Pass** | — |
| PDF | `/documents` | Long descriptions wrap rather than clip | Wrapped | 210-char description wraps in the auto-width column | Rendered | **Pass** | — |
| PDF | `/documents` | Long part numbers wrap rather than clip | Wrapped | 75-char part number wraps in the fixed 28 mm column | Rendered | **Pass** | — |
| PDF | `/documents` | Special characters render as literal text | Literal | `<b>test</b> & 'quote' "dq" \ ; DROP TABLE parts;--` printed verbatim; parens/backslashes correctly escaped in the stream | Rendered | **Pass** | — |
| PDF | `/documents` | PDF grand total exactly matches the screen — no discount | Identical | `$141.09` computed and printed | Rendered | **Pass** | — |
| PDF | `/documents` | …with a 12.5% percent discount | Identical | `$123.45` computed and printed | Rendered | **Pass** | — |
| PDF | `/documents` | …with a $33.33 amount discount | Identical | `$107.76` computed and printed | Rendered | **Pass** | — |
| PDF | `/documents` | …with a discount exceeding the subtotal | Clamped, identical | Total 0 → prints `TBD` | Rendered | **Pass** | — |
| PDF | `/documents` | …with a 150% discount | Clamped to 100% | Total 0 → prints `TBD` | Rendered | **Pass** | — |
| PDF | `/documents` | Zero-priced document | Sensible output | Prints `TBD`, not `$0.00` | Rendered | **Pass** | — |
| PDF | `/documents` | Supplier inquiry without costs hides money | No money columns | Money columns and total omitted | Rendered | **Pass** | — |
| PDF | `/documents` | Company logo appears | Present | Logo image drawn at 14 mm, 36 × 37.5 mm, page 1 | Rendered | **Pass** | — |
| PDF | `/documents` | PDF uses the same totals formula as the screen | Identical | Both `roundMoney(Σ roundMoney(qty × price))` | Source | **Pass** | — |
| PDF | `/clients/$clientId` | AR statement total block stays on the page | On page | **`Net due` drawn at y = 303 mm on a 297 mm page** — 8 of 350 statement shapes | Rendered | **Fail** | `PDF-005` |
| PDF | `/documents` | Long client name stays inside the Bill-to card | Within 103 mm | 78-char name is 187.1 mm wide from x = 19 → **right edge 206.1 mm**, past the 196 mm margin | Rendered | **Fail** | `PDF-006` |
| PDF | `/documents` | Long customer note stays above the footer | Above 281 mm | 12 rows + 600-char note → lowest text at **301.7 mm, off the paper** | Rendered | **Fail** | `PDF-007` |
| PDF | `/documents` | Continuation pages identify the document | Reference + customer | Page 2 has no client name, no BILL TO/DOCUMENT card, no date | Rendered | **Fail** | `PDF-008` |
| PDF | `/clients/$clientId` | Statement page 2 identifies the account | Identified | Page 2 carries nothing — no header and no footer at all | Rendered | **Fail** | `PDF-008` |
| PDF | `/documents` | All payments print in the history block | All | 20 supplied, **12 printed**, 8 silently dropped | Rendered | **Fail** | `PDF-009` |
| PDF | `/documents` | Page numbers appear on every page | "Page X of Y" | No page-number string on any page of any fixture | Rendered | **Fail** | `PDF-001` |
| PDF | `/documents` | Signature area present | Present | No signature / "received by" area on any document type | Rendered | **Fail** | `PDF-010` |
| PDF | `/documents` | Notes and terms rendered | Present | Free-text note renders; **no structured terms block exists** | Rendered | **Fail** | `PDF-010` |
| PDF | `/documents` | Document reference stays inside its card | Within 196 mm | 27-char generated id ok (162 mm); 60-char id reaches **234.7 mm, off the paper** | Rendered | **Fail** | `PDF-011` |
| PDF | `/documents` | Totals box fits very large amounts | Fits | `$987,653,332,345.68` fits (192 mm); `$987,654,311,123,456.80` escapes to 197.8 mm | Rendered | **Fail** | `PDF-012` |
| PDF | `/documents` | Table column alignment consistent with headers | Consistent | Description column right-aligned under a left-aligned header | Rendered | **Fail** | `PDF-013` |
| PDF | `/documents` | Downloaded filename includes date and customer | Descriptive | `${id}.pdf`; statement is `statement-<client>.pdf` with **no date** — 7 statements requested the identical filename | Rendered | **Fail** | `PDF-002` |
| PDF | `/documents` | One shared totals routine | Single source | Three near-duplicate blocks recompute totals | Source | **Fail** | `PDF-003` |
| PDF | — | Fonts and logo are lazily loaded | Lazy | 709 KB of base64 embedded in source and bundled | Build | **Fail** | `PDF-004` |
| PDF | `/documents` | Currency symbol correct throughout | Correct | USD hardcoded | Rendered | **Fail** | `FIN-006` |
| PDF | `/documents` | A PDF is produced from a document containing Arabic | Valid PDF | *Share PDF* clicked in the app's own dialog → `QUO-AUDIT-AR.pdf`, 585,433 bytes, `%PDF-1.3`, 1 page, `%%EOF` present | Runtime | **Pass** | — |
| PDF | `/documents` | Arabic runs reach the PDF rather than being dropped | Present | **3 Arabic rasters** (285×76, 321×50, 1037×53 px) — exactly one per seeded Arabic run, among 8 image XObjects | Runtime | **Pass** | — |
| PDF | `/documents` | Arabic rasters contain real glyph ink, not blank canvases | Ink present | Each soft mask carries 9–10% ink over 76–83% of its columns with 7 / 16 / 72 ink-blank transitions — a blank canvas scores 0 | Runtime | **Pass** | — |
| PDF | `/documents` | Arabic / RTL text shapes correctly | Correct glyphs | Masks decoded to PNG and read back: `شركة بيتا للمحاجر` and `خرطوم هيدروليكي ١/٢ انش` show correct cursive joining, correct letter forms, correct RTL order | Runtime | **Pass** | — |
| PDF | `/documents` | Arabic-Indic digits render correctly | Correct | `١/٢` and `٣٠` render correctly inside the Arabic runs | Runtime | **Pass** | — |
| PDF | `/documents` | Mixed Arabic and Latin in one line | Both scripts correct | The customer note renders both in one raster, with `delivery ex-works` left-to-right inside the RTL line | Runtime | **Pass** | — |
| PDF | `/documents` | `maxWidthMm` honoured on the Arabic path | Constrained | Honoured — `ctx.fillText(…, maxWidthPx)`; this is the constraint the Latin path ignores under `PDF-006` | Runtime | **Pass** | — |
| PDF | `/documents` | Arabic glyphs are not clipped by the canvas they are drawn on | No clipping | Canvas is `ceil(fontPx × 1.45)` tall with a middle baseline: the customer-note run needs 32.89 px above centre and has 26.5 — **6.39 px (0.56 mm) of ink lost at the top**, 16 inked pixels sitting on row 0 | Runtime | **Fail** | `PDF-014` |
| PDF | `/documents` | Arabic documents are not disproportionately large | Comparable size | Latin `QUO-AUDIT-0001.pdf` 213,635 bytes vs Arabic 585,433 bytes — **2.7×**; 370,684 bytes (63%) is uncompressed raster, incl. solid-colour RGB planes with no `/Filter` | Runtime | **Fail** | `PDF-015` |
| PDF | `/documents` | Arabic text in the PDF is selectable and searchable | Selectable | Rasterised as images, so the Arabic is neither selectable nor searchable | Runtime | **Fail** | `PDF-015` |
| PDF | `/documents` | Packing slip output | Correct | `downloadPackingSlip` exists (`src/lib/packing-slip.ts`, A4) | Source | **Not Verified** | — |
| PDF | `/labels` | Part label output (57 × 32 mm stock) | Correct | `part-label.ts` uses a 57 × 32 mm landscape format | Source | **Not Verified** | — |
| PDF | `/daily-close` | Z-report output | Correct | `z-report.ts` uses A4 | Source | **Not Verified** | — |
| Print | all | A print stylesheet exists | `@media print` rules present | **0 print media rules** — `src/styles.css` contains no `@media print` block anywhere | Runtime | **Fail** | `PRN-001` |
| Print | `/documents` | Browser print output is a clean document | App chrome hidden | Printed to a 2-page, 378,411-byte document whose first page begins `PARTS VILLAGE / … / Operations / Dashboard / Search / Inventory / …` — the whole navigation sidebar | Runtime | **Fail** | `PRN-001` |
| Print | all | `window.print()` wired to a document view | Wired or deliberately absent | Never called anywhere in `src/`; printing is PDF-generation only, which is a defensible design but is not stated in the UI | Source | **Fail** | `PRN-001` |
| Print | — | Physical paper margins on a real printer | Correct on paper | Needs a real printer and real paper | — | **Blocked** | — |

## 14. Design, responsive, and accessibility

> **Executed against the running application, not read from source.** Headless Chrome over the
> DevTools Protocol, operator gate unlocked, **26 routes × 375 / 768 / 1440 px = 79 samples** with a
> full-page screenshot each (83 in total), plus measured layout geometry, colour contrast (all
> `oklch()` values resolved to sRGB by canvas paint), accessible names, heading order, tap-target
> sizes, a font-size census, and console errors. Keyboard, focus, dialog, destructive-confirmation,
> offline, and mobile-drawer behaviour were driven with real key and click events. Screenshots and
> raw JSON went to a scratch directory that does not survive the run, so every measurement is
> restated inline here and in §12 of the report.

| Module | Page / route | Test case | Expected result | Actual result | Method | Status | Issue |
|---|---|---|---|---|---|---|---|
| Design | all 26 routes | No page-level horizontal scroll at 375 px | `scrollWidth == innerWidth` | Holds on all 26 routes | Runtime | **Pass** | — |
| Design | all 26 routes | No page-level horizontal scroll at 768 px | `scrollWidth == innerWidth` | Holds on all 26 routes | Runtime | **Pass** | — |
| Design | all 26 routes | No page-level horizontal scroll at 1440 px | `scrollWidth == innerWidth` | Holds on all 26 routes | Runtime | **Pass** | — |
| Design | all 26 routes | Layout captured and measured at 375 px | Captured | 26 samples with screenshots | Runtime | **Pass** | — |
| Design | all 26 routes | Layout captured and measured at 768 px | Captured | 26 samples with screenshots | Runtime | **Pass** | — |
| Design | all 26 routes | Layout captured and measured at 1440 px | Captured | 27 samples with screenshots | Runtime | **Pass** | — |
| Design | 1440 px, all routes | Nothing overflows its container on desktop | 0 overflow | 0, except `/inventory`'s deliberate horizontal scroller | Runtime | **Pass** | — |
| Design | `/stock-map` | Off-container content reachable at 375 px | Reachable | **991 px** clipped; page scroll and `scrollLeft` on every ancestor both fail | Runtime | **Fail** | `UX-003` |
| Design | `/documents` | Status control and Open button reachable at 768 px | Reachable | **160 px** clipped — the row's primary action cannot be reached | Runtime | **Fail** | `UX-003` |
| Design | `/reorder` | Reason column reachable at 768 px | Reachable | **218 px** clipped | Runtime | **Fail** | `UX-003` |
| Design | `/` | Dashboard card columns reachable at 375 px | Reachable | **266 px** clipped (Total, Status) | Runtime | **Fail** | `UX-003` |
| Design | `/` | Dashboard card columns reachable at 768 px | Reachable | **108 px** clipped | Runtime | **Fail** | `UX-003` |
| Design | `/counter` | Long part-name button fits at 375 px | Fits | **85 px** clipped | Runtime | **Fail** | `UX-003` |
| Design | all | Content area stays usable where tables un-stack | ≥ ~700 px | 512 px at 768 px — the sidebar pins at 256 px exactly where tables expand | Runtime | **Fail** | `UX-004` |
| Design | `/documents` | Table readable at 768 px | Readable | Parts column ~30 px; one quotation row ~1000 px tall; 23 clipped elements | Runtime | **Fail** | `UX-004` |
| Design | `/documents` | Collapsing the sidebar restores the 768 px layout | Restores | Content 512 → **720 px**; clipped elements 23 → **0**; `/reorder` 120 → 9 | Runtime | **Pass** | `UX-004` |
| Design | all | Long part numbers do not break layout | Wrap or truncate | They wrap, but at 768 px inflate a single row to ~1000 px | Runtime | **Fail** | `UX-004` |
| Design | `/documents` 375 px | Long part list truncated with an indicator | "+N more" | Cut mid-list, with no ellipsis and no count | Runtime | **Fail** | `UX-008` |
| Design | 6 stacked-table routes | Stacked mobile view keeps column labels | Labelled | `thead` hidden by `max-md:hidden`, with no substitute label | Runtime | **Fail** | `UX-008` |
| Design | all | Navigation works at every width | Works | Pinned sidebar ≥ 768 px; drawer plus bottom nav < 768 px | Runtime | **Pass** | — |
| Design | all | Sidebar collapse toggle behaves correctly | Correct | Toggles cleanly and content reflows | Runtime | **Pass** | — |
| Design | 375 px | Mobile drawer opens and closes | Works | 320 px sheet over a 375 px viewport, 21 links, no inner scroll, Escape closes | Runtime | **Pass** | — |
| Design | 375 px | Mobile drawer has an accessible name | Named | Present | Runtime | **Pass** | — |
| Design | 375 px | Bottom nav does not cover page content | No overlap | `mobile-nav-pad` 60 px; scrolled to the bottom of `/clients`, `/documents`, `/shift`, `/suppliers` — 0 overlaps | Runtime | **Pass** | — |
| Design | all | Zoom is not blocked | Allowed | `maximum-scale=5` | Runtime | **Pass** | — |
| Design | all | Typography readable | 14–16 px body | 12 px dominant (3,863 nodes); 335 nodes at 10 px, 169 at 11 px | Runtime | **Fail** | `UX-012` |
| Design | 1440 px, all routes | Button geometry consistent | A small deliberate set | **17** height/font/radius combinations, 11 heights, 4 radii | Runtime | **Fail** | `UX-017` |
| Design | `/fleet` | Empty state offers a way forward | Primary action | "No machines yet" with no create action anywhere on the page; the description points at the client page but nothing is clickable | Runtime | **Fail** | `UX-019` |
| Design | `/china-shipments` | Empty state offers a way forward | Primary action | **Correction to the first pass:** "New shipment" is rendered unconditionally in the toolbar and the empty state names it — this route is correct | Source | **Pass** | — |
| Design | `/pre-orders`, `/share-inbox` | Empty state offers a way forward | Primary action | Both correct ("New pre-order", "Upload photo / PDF") | Runtime | **Pass** | — |
| Design | all 26 routes | Loading state present during data load | Skeleton or spinner | `skeleton: 0`, `spinner: 0` on every route after unlock | Runtime | **Fail** | `UX-020` |
| Design | unknown route | 404 state present and helpful | Proper 404 | "404 / Page not found / … / Go home" | Runtime | **Pass** | — |
| Design | `/portal` | Error state is fit for an external audience | Friendly message | Raw developer string `useCart must be used within CartProvider` shown to customers | Runtime | **Fail** | `UX-002` |
| Design | `/portal` | Portal renders the client statement | Renders | Error boundary at all three widths, locally **and in production** | Runtime | **Fail** | `UX-002` |
| Design | all | Success messages appear after an action | Present | Sonner toasts observed | Runtime | **Pass** | — |
| Design | `/clients` | Destructive action confirms before acting | Confirms | `role="alertdialog"`, default focus on **Cancel**, destructive styling on Delete | Runtime | **Pass** | — |
| Design | `/clients` | Cancelling a delete leaves the record intact | Intact | Record intact after cancel | Runtime | **Pass** | — |
| Design | `/clients` | Destructive warning names the consequence | Explicit | Names the client, but not the $6,000 of AR that disappears with it | Runtime | **Fail** | `CUS-001` |
| Design | Add part dialog | Validation shows an inline message | Inline and persistent | `inlineErrors: []` — a disappearing toast only | Runtime | **Fail** | `UX-007` |
| Design | Add part dialog | Invalid field is marked | `aria-invalid` set | Set on nothing | Runtime | **Fail** | `UX-007` |
| Design | Add part dialog | Focus moves to the first invalid field | Moves | `firstInvalidFocused: null` | Runtime | **Fail** | `UX-007` |
| Design | Add part dialog | Required fields carry `required` | Marked | 0 of 14 fields | Runtime | **Fail** | `UX-007` |
| Design | all | Date formatting consistent | One format | ISO `YYYY-MM-DD` everywhere except the backup banner (`10/21/2026`) | Runtime | **Fail** | `UX-016` |
| Design | all | Currency formatting consistent | One formatter | 166 amounts at 2 dp, 12 at 0 dp | Runtime | **Fail** | `UX-016` |
| Design | `/china-shipments` | `formatMoneyWithUsd` zero-decimal output seen on screen | One money format app-wide | With shipments seeded, **`$1,200` and `$69.93` render side by side on the same page** | Runtime | **Fail** | `UX-016` |
| Design | all | Terminology consistent and clean English | Consistent | "Monthly sales" actually shows receipts | Source | **Fail** | `RPT-004` |
| Design | all 26 routes | Backup banner does not dominate every page | Once per session | Renders on all 26 routes at all widths; ~100 px of an 812 px phone viewport | Runtime | **Fail** | `UX-018` |
| A11y | all routes | Skip link present | Present | `a[href^="#"]` returns nothing on any route | Runtime | **Fail** | `UX-009` |
| A11y | `/inventory` | Page content reached in few tab stops | Few | First in-content control is tab stop **23**; stops 1–22 are sidebar links | Runtime | **Fail** | `UX-009` |
| A11y | all | Keyboard navigation reaches every control | Reachable | Tab walk reached sidebar and in-content controls in order | Runtime | **Pass** | — |
| A11y | all | Focus indicators visible | Visible | `box-shadow: <accent> 0 0 0 Npx` on every focusable; correctly matches `:focus-visible` | Runtime | **Pass** | — |
| A11y | all | Focus ring meets 3:1 (WCAG 2.4.11) | ≥ 3:1 | **2.51:1** | Runtime | **Fail** | `UX-011` |
| A11y | all | Focus ring width consistent | Consistent | 2 px on sidebar links, 1 px on in-content controls | Runtime | **Fail** | `UX-011` |
| A11y | Add part dialog | Escape closes the modal | Closes | Closes | Runtime | **Pass** | — |
| A11y | Add part dialog | Focus is trapped in the modal | Trapped | Held across **30 consecutive Tab presses** | Runtime | **Pass** | — |
| A11y | Add part dialog | Focus moves into the dialog on open | Moves | Lands on the first field | Runtime | **Pass** | — |
| A11y | Add part dialog | Focus returns to the opener on close | Returns | Returns | Runtime | **Pass** | — |
| A11y | Add part dialog | Body scroll restored on close | Restored | Restored | Runtime | **Pass** | — |
| A11y | Add part dialog | Dialog has a role and an accessible name | Present | `role="dialog"` plus `aria-labelledby` and `aria-describedby` | Runtime | **Pass** | — |
| A11y | Add part dialog | Dialog scrolls internally when taller than the viewport | Scrolls | Scrolls internally | Runtime | **Pass** | — |
| A11y | Add part dialog | Background inert for assistive technology | `aria-modal` or `inert` | Neither; the app shell reports `ariaHidden: null, inert: false` | Runtime | **Fail** | `UX-015` |
| A11y | Add part dialog | All fields labelled | Labelled | 14 of 14 have real `<label>` elements | Runtime | **Pass** | — |
| A11y | Add part dialog | Numeric fields request a numeric keyboard | `inputMode` set | `numeric` / `decimal` set | Runtime | **Pass** | — |
| A11y | 23 routes | Text contrast meets 4.5:1 | ≥ 4.5:1 | Accent money and stock figures measure **2.52–2.66:1** | Runtime | **Fail** | `UX-005` |
| A11y | `/clients` | "Owes" badge meets 4.5:1 | ≥ 4.5:1 | **4.48:1** — a marginal fail | Runtime | **Fail** | `UX-005` |
| A11y | 23 routes | Body and muted text pass on the standard surfaces | Pass | `foreground` and `muted-foreground` pass; most routes have 0 text failures | Runtime | **Pass** | — |
| A11y | 23 routes | Non-text contrast meets 3:1 (WCAG 1.4.11) | ≥ 3:1 | Borders measure **1.27–1.34:1**; 13 distinct failing pairs | Runtime | **Fail** | `UX-006` |
| A11y | all | Form controls have accessible names | Named | 5 inputs unnamed; 5 more rely on placeholder text alone | Runtime | **Fail** | `UX-013` |
| A11y | all 27 samples | Every route has an `h1` | Present | 27 of 27 | Runtime | **Pass** | — |
| A11y | `/clients`, `/suppliers` | Heading levels do not skip | No skip | `h1` → `h3`, across 6 samples | Runtime | **Fail** | `UX-014` |
| A11y | all | `<html lang>` is set | Set | `lang="en"` on every route | Runtime | **Pass** | — |
| A11y | all | Distinct, meaningful `<title>` per route | Distinct | 21 distinct titles | Runtime | **Pass** | — |
| A11y | all | No duplicate DOM ids | 0 | 0 | Runtime | **Pass** | — |
| A11y | all | Every `<img>` has `alt` | All | 0 missing | Runtime | **Pass** | — |
| A11y | 375 px | Interactive targets ≥ 24 × 24 (WCAG 2.5.8) | ≥ 24 × 24 | `/labels` row toggles are **16 × 16 px** | Runtime | **Fail** | `UX-010` |
| A11y | 1440 px | Controls meet the 44 px touch guideline | 44 px | 32 px dominant (495 instances); `/low-stock` has 416 of 424 under 40 × 40 at 375 px | Runtime | **Fail** | `UX-010` |
| A11y | 375 px | Hamburger and bottom nav meet 44 px | ≥ 44 px | Hamburger 44 × 44; bottom-nav items 75 × 56 | Runtime | **Pass** | — |
| A11y | all | Landmark structure present | `main` plus `nav` | `<main>` and a sidebar `<nav>` present on every sample | Runtime | **Pass** | — |
| A11y | all | Screen-reader announcement order and phrasing | Correct | Structure was measured programmatically; no screen reader was run | — | **Not Verified** | — |
| Reliability | `/documents` | Offline banner appears when the network drops | Appears | "You are offline — Working from the last cached shop data. Edits save on this device until you reconnect." | Runtime | **Pass** | — |
| Reliability | `/documents` | Offline banner clears on reconnect | Clears | Cleared automatically | Runtime | **Pass** | — |
| Reliability | 26 operator routes | No uncaught console errors | None | Clean on every operator route; `/portal` throws | Runtime | **Fail** | `UX-002` |
| Security | `/portal` | Portal load makes no unauthenticated data request | None | Production GET with no token: 34 static assets and **zero** Supabase calls | Runtime | **Pass** | — |
| Performance | `/portal` | Portal ships only what it renders | Minimal bundle | Pulls `inventory-context`, the catalog taxonomies, and `jspdf.es.min` — 34 requests | Runtime | **Fail** | `UX-021` |

## 15. Security behaviour

| Module | Page / route | Test case | Expected result | Actual result | Method | Status | Issue |
|---|---|---|---|---|---|---|---|
| Security | `/documents`, `/delivery-board`, `/counter` | Stored XSS payload is escaped on screen | Rendered as literal text | Seeded `<b>test</b>` part name rendered as **literal text** on all three routes | Runtime | **Pass** | `UX-001` |
| Security | all | Absence of an injected element asserted in the DOM tree | No such node | Asserted on `/documents`, `/inventory`, `/counter`, `/delivery-board`, `/search`, and the part-detail dialog: **0** `img[src=x]`, **0** `[onerror]`, **0** `script` with the probe, **0** injected `<b>`; all three execution probes stayed false and the payload rendered HTML-escaped as text | Runtime | **Pass** | — |
| Security | PDF | XSS payload escaped in the PDF | Literal text | Rendered PDF content stream contains the payload as literal text | Harness | **Pass** | — |
| Security | all | SQL injection payload is inert | Stored as text | All access via PostgREST with parameterised filters; no raw SQL | Source | **Pass** | — |
| Security | `src/` | No `innerHTML` / `eval` / `new Function` | None | None found | Source | **Pass** | — |
| Security | `src/` | `dangerouslySetInnerHTML` usage reviewed | Safe | One instance, developer-controlled chart CSS | Source | **Pass** | `UX-001` |
| Security | `/share` | Share target validates file type | Allow-list | Accepts any type, defaults to `application/octet-stream` | Source | **Fail** | `SEC-007` |
| Security | `/share` | Share target enforces a size limit | Limited | No size check | Source | **Fail** | `SEC-007` |
| Security | `sw.js` | Cache is versioned per release | Versioned | Fixed `pv-shell-v1`; never purged | Source | **Fail** | `SEC-008` |
| Security | `sw.js` | Cached navigations are bounded | Bounded | Every successful navigation cached without limit | Source | **Fail** | `SEC-008` |
| Security | — | CSRF protection where applicable | Protected | Server functions are token-based, not cookie-authenticated, so CSRF is largely N/A — except `syncTitusOrders`, which needs no auth at all | Source | **Fail** | `SEC-002` |
| Security | — | Production Supabase policies match the repo | Match | Cannot inspect the live project | — | **Blocked** | — |
| Security | — | Live `X-Forwarded-For` handling on Vercel | Sanitised by the platform | Cannot inspect the live deployment | — | **Blocked** | — |
| Security | — | Backup restore has been tested | Tested | Outside the repository | — | **Blocked** | — |

## 16. Performance and reliability

| Module | Page / route | Test case | Expected result | Actual result | Method | Status | Issue |
|---|---|---|---|---|---|---|---|
| Performance | build | Initial JS within a sane budget | Reasonable | 4481.8 KB total; 1348.8 KB main chunk | Build | **Fail** | `PERF-001` |
| Performance | build | Heavy libraries code-split | Lazy | `jspdf`, `html2canvas`, `xlsx`, `@zxing` in the client graph | Build | **Fail** | `PERF-001` |
| Performance | build | Static catalogs not shipped as JS | Fetched on demand | ~594 KB of catalog source compiled into chunks | Build | **Fail** | `PERF-001` |
| Performance | `/inventory` | Large tables virtualised | Virtualised | `VirtualInventoryTable` | Source | **Pass** | — |
| Performance | — | Saves are debounced | Debounced | 400 ms debounce in `useCloudState` | Source | **Pass** | — |
| Performance | — | Reads are paginated or projected | Paginated | Whole-blob reads; no pagination possible | Source | **Fail** | `PERF-002` |
| Performance | — | Writes touch only changed rows | Targeted | Whole blob rewritten on any change | Source | **Fail** | `PERF-002` |
| Performance | — | Indexes support live queries | Indexed | All 18 indexes on dead tables | Source | **Fail** | `PERF-003` |
| Reliability | — | No stale-closure risk in the data layer | Clean deps | 35 `exhaustive-deps` warnings, 31 in the context files | Build | **Fail** | `PERF-004` |
| Reliability | — | Conflict retries back off | Backoff | No backoff or attempt ceiling | Source | **Fail** | `PERF-005` |
| Reliability | — | Partial failure leaves no inconsistent state | Atomic | Multi-step flows are non-atomic | Source | **Fail** | `DAT-001` |
| Reliability | — | Concurrent stock updates cannot corrupt quantity | Safe | Numeric-delta merge helps, but `STK-001` bypasses it | Harness | **Fail** | `STK-001` |
| Performance | — | Real page-load timings | Within budget | First contentful paint **152–252 ms** across 8 routes; `load` event 2024–2150 ms, the tail being 33–47 separate JS requests | Runtime | **Pass** | — |
| Performance | `/inventory` | Search responsiveness on a full catalog | Responsive | Over **2,344 parts**: 46.9 / 58.2 / 61.2 / 50.0 / 48.4 ms for five queries including the no-match case — worst case under 62 ms | Runtime | **Pass** | — |
| Performance | — | No duplicate network requests | None | 70 GETs on a fresh `/inventory` load across 69 distinct URLs; `key=eq.inventory` was fetched **twice** | Runtime | **Fail** | `PERF-002` |
| Performance | `/inventory` | One navigation costs a bounded number of data reads | Bounded | **11 `shop_state` GETs over 10 keys, plus a preflight each — 24 requests to one table per page load** | Runtime | **Fail** | `PERF-002` |
| Performance | — | No memory leak over a long session | Stable | No multi-hour session was run | — | **Not Verified** | — |
| Reliability | `/documents` | Offline operation | Works offline | Network forced offline: the app kept working from cached shop data and said so | Runtime | **Pass** | — |
| Reliability | — | Reconnect clears the offline state | Cleared | Banner cleared automatically on reconnect | Runtime | **Pass** | — |
| Reliability | `/inventory` | Reconnect syncs queued changes to the server | Synced | Edit made offline (`oring-0004` → 123) was held locally, then **written to the backing store on reconnect** with the correct value — 0 overrides while offline, 1 after | Runtime | **Pass** | — |
| Reliability | — | Behaviour on simulated network failure | Graceful | Network cut at the protocol level: no crash, no data loss, no double-apply; the offline state surfaced and cleared correctly | Runtime | **Pass** | — |
| Reliability | — | Behaviour when the network drops mid-write | Graceful | Offline-then-reconnect is covered above, but cutting the network *during* the write itself was not driven | — | **Not Verified** | — |
| Reliability | — | Behaviour on database failure | Graceful | Rate limiter fails **open** on store errors | Source | **Fail** | `SEC-003` |

## 17. Route coverage

Every registered route. Each route's purpose, data dependencies, and CRUD behaviour were first
established from source (§3 of the report), then the route was **loaded in a real browser at 375 /
768 / 1440 px** and measured. `Pass` here means the route rendered at all three widths with no
runtime defect observed **on that page**; `Fail` names the defects that were. Two routes could not be
rendered and say so.

| Module | Page / route | Test case | Expected result | Actual result | Method | Status | Issue |
|---|---|---|---|---|---|---|---|
| Routes | `/` | Renders and measures cleanly at 3 widths | Clean | Renders; 16 formulas documented; 266 px clipped at 375 px, 108 px at 768 px | Runtime | **Fail** | `UX-003`, `RPT-001` |
| Routes | `/inventory` | Renders and measures cleanly at 3 widths | Clean | Renders with the virtualised table; low-stock qty at 2.66:1; first in-content tab stop is 23 | Runtime | **Fail** | `UX-005`, `UX-009` |
| Routes | `/documents` | Renders and measures cleanly at 3 widths | Clean | Worst route measured: 23 clipped elements at 768 px, unlabelled stacked cards at 375 px | Runtime | **Fail** | `UX-003`, `UX-004`, `UX-008` |
| Routes | `/clients/` | Renders and measures cleanly at 3 widths | Clean | Renders; `h1` → `h3` skip; "Owes" badge at 4.48:1 | Runtime | **Fail** | `UX-014`, `UX-005` |
| Routes | `/clients/$clientId` | Renders and measures cleanly at 3 widths | Clean | Rendered for `cl-alpha`; AR statement reachable; balance `$926.87` at 2.66:1 | Runtime | **Fail** | `UX-005`, `FIN-003` |
| Routes | `/suppliers/` | Renders and measures cleanly at 3 widths | Clean | Renders; `h1` → `h3` skip | Runtime | **Fail** | `UX-014` |
| Routes | `/suppliers/$supplierId` | Renders and measures cleanly at 3 widths | Clean | Renders; no route-specific runtime defect observed | Runtime | **Pass** | — |
| Routes | `/low-stock` | Renders and measures cleanly at 3 widths | Clean | Renders; predicate differs from the dashboard; 416 of 424 targets under 40 × 40 at 375 px | Runtime | **Fail** | `RPT-002`, `UX-010` |
| Routes | `/reorder` | Renders and measures cleanly at 3 widths | Clean | Renders; Reason column 218 px past the clip edge at 768 px | Runtime | **Fail** | `UX-003` |
| Routes | `/stock-take` | Renders and measures cleanly at 3 widths | Clean | Renders; 2 stock mutation sites, neither logged | Runtime | **Fail** | `STK-002` |
| Routes | `/stock-map` | Renders and measures cleanly at 3 widths | Clean | Renders; **991 px** unreachable at 375 px; search input unnamed | Runtime | **Fail** | `UX-003`, `UX-013` |
| Routes | `/labels` | Renders and measures cleanly at 3 widths | Clean | Renders; 16 × 16 px row toggles; search input unnamed. Physical label printing is Blocked (§10) | Runtime | **Fail** | `UX-010`, `UX-013` |
| Routes | `/counter` | Renders and measures cleanly at 3 widths | Clean | Renders; 85 px clipped at 375 px; part-number input unnamed | Runtime | **Fail** | `UX-003`, `UX-013` |
| Routes | `/collections` | Renders and measures cleanly at 3 widths | Clean | Renders; stacked view drops column labels at 375 px | Runtime | **Fail** | `UX-008` |
| Routes | `/daily-close` | Renders and measures cleanly at 3 widths | Clean | Renders; drawer formula documented; no route-specific runtime defect | Runtime | **Pass** | — |
| Routes | `/shift` | Renders and measures cleanly at 3 widths | Clean | Renders; scrolled to the bottom at 375 px with no bottom-nav overlap | Runtime | **Pass** | — |
| Routes | `/delivery-board` | Renders and measures cleanly at 3 widths | Clean | Renders; 10–11 px text on part-number lines; carries the shipped type error | Runtime | **Fail** | `FUN-004`, `UX-012` |
| Routes | `/pre-orders` | Renders and measures cleanly at 3 widths | Clean | Renders; empty state correct; stacked labels dropped; 1 unlogged stock site | Runtime | **Fail** | `STK-002`, `UX-008` |
| Routes | `/china-shipments` | Renders and measures cleanly at 3 widths | Clean | Renders; Titus sync unauthenticated. **Correction:** the first pass recorded "no create action" here — that was wrong, "New shipment" is rendered unconditionally and the empty state names it, so `UX-019` no longer applies to this route | Runtime | **Fail** | `SEC-002` |
| Routes | `/fleet` | Renders and measures cleanly at 3 widths | Clean | Renders "No machines yet" with no create action; search input unnamed | Runtime | **Fail** | `UX-019`, `UX-013` |
| Routes | `/fleet/$machineId` | Renders with a seeded machine | Machine detail with serial, hours, and order history | Two machines seeded and linked from `/fleet`; navigating to `/fleet/mc-audit-1` renders the **`/fleet` list again**, byte-identical (same `h1`, same 410-character body) — the parent route renders no `<Outlet />`, so the detail component never mounts | Runtime | **Fail** | `FUN-006` |
| Routes | `/china-shipments` | Renders with seeded shipments | Shipment list | 2 shipments render with status, ETD/ETA, and costs — and exposed the `UX-016` money inconsistency | Runtime | **Fail** | `UX-016` |
| Routes | `/insights` | Renders and measures cleanly at 3 widths | Clean | Renders; margin figure at 2.66:1; stacked labels dropped | Runtime | **Fail** | `UX-005`, `UX-008` |
| Routes | `/search` | Renders and measures cleanly at 3 widths | Clean | Renders; no route-specific runtime defect observed | Runtime | **Pass** | — |
| Routes | `/share-inbox` | Renders and measures cleanly at 3 widths | Clean | Renders; empty state correctly offers "Upload photo / PDF" | Runtime | **Pass** | — |
| Routes | `/portal` | Renders the client statement | Statement | **Crashes on every load** at every width, locally and in production; ships 34 assets including `jspdf` | Runtime | **Fail** | `UX-002`, `SEC-004`, `UX-021` |
| Routes | `/share` | Accepts a shared file | Accepts | Server action reached only by the Web Share Target; needs an installed PWA | — | **Not Verified** | `SEC-007` |
| Routes | unknown path | 404 fallback renders | Proper 404 | "404 / Page not found / … / Go home" | Runtime | **Pass** | — |
| Routes | `__root` | Layout, gates, and offline banner | Correct | `CloudGate` + `OperatorUnlockGate` confirmed by unlocking through the real UI; offline banner verified | Runtime | **Pass** | — |

---

## Retest priorities after remediation

Ordered to match the repair stages in §19 of the audit report.

| Order | Retest | Confirms |
|---|---|---|
| 1 | 12 failed unlocks with 12 distinct `X-Forwarded-For` values must lock out | `SEC-001` |
| 2 | Unauthenticated `syncTitusOrders` must return 401 with **zero** outbound requests | `SEC-002` |
| 3 | Merge must never lower `amountPaid`; legacy `Paid` invoices must survive | `FIN-001` |
| 4 | Failed conversion leaves stock untouched; double-fire deducts exactly once | `STK-001` |
| 5 | Every one of the 14 stock sites writes exactly one movement record | `STK-002` |
| 6 | `roundMoney(-x) === -roundMoney(x)` and cent-exact from 1e0 to 1e15 | `FIN-002` |
| 7 | UI subtotal === PDF subtotal === ratio basis, including `Payment`/`Discount` lines | `FIN-004` |
| 8 | Dashboard and `/low-stock` return the same set, including zero-quantity parts | `RPT-002` |
| 9 | Unauthenticated GET of a `part-photos` object returns 403 | `SEC-005` |
| 10 | Rate limiter refuses unlock when the store is unavailable | `SEC-003` |
| 11 | `/portal` renders a statement with no params, an invalid token, and a valid token | `UX-002` |
| 12 | Every route at 375 / 768 / 1440 px: no element sits outside an ancestor that can actually scroll | `UX-003` |
| 13 | Content area ≥ ~700 px at every width where tables render un-stacked | `UX-004` |
| 14 | Contrast assertion over the rendered theme: text pairs ≥ 4.5:1, border and ring pairs ≥ 3:1 | `UX-005`, `UX-006`, `UX-011` |
| 15 | Each dialog submitted empty shows an inline message, sets `aria-invalid`, and focuses the field | `UX-007` |
| 16 | A three-row duplicate import file totals correctly or is rejected, and reports 1 part not 3 | `IMP-002` |
| 17 | `/fleet/mc-*` renders machine detail, not the `/fleet` list — assert the detail body differs from the list body | `FUN-006` |
| 18 | Three rapid Create clicks yield one record **and one** success message | `FUN-007` |
| 19 | The inline quantity cell rejects `-5` and `abc` with a visible message, and resolves `7.5` the same way the dialog resolves `2.5` | `STK-010`, `STK-009` |
| 20 | Every Arabic raster in a generated PDF has zero ink on its outermost row and column | `PDF-014` |
| 21 | A fixture Arabic invoice stays within a byte budget, and its Arabic text is selectable | `PDF-015` |
| 22 | A print-emulated snapshot of `/documents` contains no sidebar navigation text | `PRN-001` |
| 23 | Searching an exact unique part number returns exactly one row, with and without separators in the code | `STK-011` |
| 24 | Clicking each inventory column header reorders rows and sets `aria-sort` | `STK-012` |
| 25 | `/fleet` empty state renders a primary action | `UX-019` |
| 26 | One navigation reads each `shop_state` key at most once | `PERF-002` |
| 27 | Run the passes that need hardware or a live environment: physical paper margins, barcode scanning, label printing, photo upload, WebAuthn, the Web Share Target, and a screen-reader pass | §17 items 12–18 |
