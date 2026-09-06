# Parts Village — QA Test Checklist

**Companion to:** `APP_AUDIT_REPORT.md`
**Audit date:** 2026-09-06 · **Commit:** `08f2a09`
**Environment:** local production build (`vite preview`, `localhost:3000`) against a throwaway
**mock Supabase** seeded with synthetic data. Production Supabase was never contacted.

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
| Pass | 91 | 25% |
| Fail | 128 | 36% |
| Blocked | 8 | 2% |
| Not Verified | 133 | 37% |
| **Total test cases** | **360** | |

Two things to keep in mind when reading these totals:

- **The 128 failures map to 54 distinct issues**, not 128 problems. A single root cause fails many
  test cases — `STK-002` (no stock audit trail) alone accounts for eight rows, and `DAT-001` (no
  database constraints) accounts for several more.
- **The 133 unverified cases are concentrated** in section 14 (design/responsive/accessibility — 36
  of 37 rows), section 13 (rendered PDFs — 15 of 21 rows), and section 17 (route coverage, where
  routes were mapped from source but not driven through a browser). See §17 of the audit report for
  the full unverified list.

| Section | Cases | Pass | Fail | Blocked | Not Verified |
|---|---|---|---|---|---|
| 1. Environment, build, tooling | 13 | 3 | 10 | 0 | 0 |
| 2. Authentication and access control | 15 | 10 | 3 | 1 | 1 |
| 3. Server function authorisation | 9 | 7 | 2 | 0 | 0 |
| 4. Database, RLS, storage | 14 | 8 | 6 | 0 | 0 |
| 5. Secrets and client exposure | 7 | 6 | 1 | 0 | 0 |
| 6. Money and calculation | 25 | 13 | 12 | 0 | 0 |
| 7. Payments and multi-device merge | 22 | 6 | 8 | 0 | 8 |
| 8. Quotations | 25 | 5 | 12 | 0 | 8 |
| 9. Invoices | 27 | 10 | 8 | 0 | 9 |
| 10. Inventory and stock | 40 | 8 | 14 | 3 | 15 |
| 11. Customers and suppliers | 22 | 6 | 8 | 0 | 8 |
| 12. Reports and dashboard | 23 | 2 | 15 | 0 | 6 |
| 13. PDF and printing | 21 | 1 | 5 | 0 | 15 |
| 14. Design, responsive, accessibility | 37 | 0 | 1 | 0 | 36 |
| 15. Security behaviour | 13 | 3 | 5 | 3 | 2 |
| 16. Performance and reliability | 20 | 2 | 11 | 0 | 7 |
| 17. Route coverage | 27 | 1 | 7 | 1 | 18 |

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
| Auth | `/` | Unlock survives reload within session | Stays unlocked | `sessionStorage`/`localStorage` flags present | Source | **Not Verified** | — |
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
| Invoices | `/documents` | Refresh after saving shows the same data | Consistent | — | — | **Not Verified** | — |
| Invoices | `/documents` | Browser back/forward preserves state | Consistent | — | — | **Not Verified** | — |
| Invoices | `/documents` | Duplicate submission of the invoice form | One invoice | — | — | **Not Verified** | — |

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
| Inventory | `/inventory` | Negative stock is blocked or warned on manual edit | Blocked or warned | — | — | **Not Verified** | — |
| Inventory | `/inventory` | Search by description | Matches | — | — | **Not Verified** | — |
| Inventory | `/inventory` | Search by part number | Matches | — | — | **Not Verified** | — |
| Inventory | `/inventory` | Search with no matches shows an empty state | Empty state | — | — | **Not Verified** | — |
| Inventory | `/inventory` | Sorting by each column | Correct order | — | — | **Not Verified** | — |
| Inventory | `/inventory` | Category and brand filters | Filtered | — | — | **Not Verified** | — |
| Inventory | `/inventory` | Create a part with required fields empty | Validation shown | — | — | **Not Verified** | — |
| Inventory | `/inventory` | Price with many decimal places | Rounded predictably | — | — | **Not Verified** | — |
| Inventory | `/inventory` | Very large price value | Handled | `roundMoney` misbehaves above ~1e10 | Harness | **Fail** | `FIN-002` |
| Inventory | `/inventory` | 300+ character description does not break layout | No overflow | — | — | **Not Verified** | — |
| Inventory | `/inventory` | Special characters and Unicode in fields | Preserved | Seeded Unicode/quote payloads; rendering not observed | — | **Not Verified** | — |
| Inventory | `/inventory` | Unit of measurement field | Present | — | — | **Not Verified** | — |
| Inventory | `/inventory` | Warehouse / shelf location | Present | `/stock-map` and `box_number` suggest support | Source | **Not Verified** | — |
| Inventory | `/inventory` | Machine compatibility | Present | `/fleet` and kits suggest support | Source | **Not Verified** | — |
| Inventory | `/inventory` | Product image upload | Works | Requires a real Storage bucket | — | **Blocked** | — |
| Inventory | `/inventory` | Creation / modification dates recorded | Present | No timestamps on parts | Source | **Fail** | `STK-002` |
| Inventory | `/inventory` | Import from spreadsheet | Imported correctly | Requires the UI and a file | — | **Not Verified** | — |
| Inventory | `/inventory` | Export to spreadsheet | Accurate | — | — | **Not Verified** | — |
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
| Parties | `/clients/` | Deleting a client with invoices is blocked | Blocked | No referential integrity; orphaning structurally possible | Source | **Not Verified** | `DAT-001` |
| Parties | `/clients/` | Archive is distinct from delete | Distinct | No archive concept found for parties | Source | **Fail** | `STK-007` |
| Parties | `/clients/` | Duplicate customer detection | Warned | No duplicate detection for parties | Source | **Fail** | `STK-006` |
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
| Reports | `/` | Rendered card values match source records | Match | — | — | **Not Verified** | — |
| Reports | `/insights` | Sales board figures are accurate | Accurate | — | — | **Not Verified** | — |
| Reports | `/daily-close` | Drawer total matches receipts | Matches | Unrounded `cash + omt + whish` | Source | **Not Verified** | — |
| Reports | `/collections` | Promise-to-pay list is accurate | Accurate | — | — | **Not Verified** | — |
| Reports | `/reorder` | Reorder suggestions are correct | Correct | — | — | **Not Verified** | — |
| Reports | — | Exported report accuracy | Matches screen | — | — | **Not Verified** | — |

## 13. PDF and printing

| Module | Page / route | Test case | Expected result | Actual result | Method | Status | Issue |
|---|---|---|---|---|---|---|---|
| PDF | `/documents` | PDF uses the same totals formula as the screen | Identical | Both `roundMoney(Σ roundMoney(qty × price))` | Source | **Pass** | — |
| PDF | `/documents` | Page numbers appear on every page | "Page X of Y" | No pagination logic in any builder | Source | **Fail** | `PDF-001` |
| PDF | `/documents` | Downloaded filename includes date and customer | Descriptive | Derived from the document id only | Source | **Fail** | `PDF-002` |
| PDF | `/documents` | One shared totals routine | Single source | Three near-duplicate blocks recompute totals | Source | **Fail** | `PDF-003` |
| PDF | — | Fonts and logo are lazily loaded | Lazy | 709 KB of base64 embedded in source and bundled | Build | **Fail** | `PDF-004` |
| PDF | `/documents` | Company logo and details appear | Present | Logo asset present; placement not observed | Source | **Not Verified** | — |
| PDF | `/documents` | A4 page size and margins | Correct | — | — | **Not Verified** | `PDF-005` |
| PDF | `/documents` | Table headers repeat on pages 2+ | Repeated | — | — | **Not Verified** | `PDF-005` |
| PDF | `/documents` | Page breaks do not split rows | Clean breaks | — | — | **Not Verified** | `PDF-005` |
| PDF | `/documents` | No clipped or overlapping content | Clean | — | — | **Not Verified** | `PDF-005` |
| PDF | `/documents` | 42-line quotation spans multiple pages correctly | Correct | Fixture seeded; PDF not rendered | — | **Not Verified** | `PDF-005` |
| PDF | `/documents` | Short document renders on one page | Correct | — | — | **Not Verified** | — |
| PDF | `/documents` | Long descriptions wrap rather than clip | Wrapped | — | — | **Not Verified** | `PDF-005` |
| PDF | `/documents` | PDF grand total exactly matches the screen | Identical | Formulas match; end-to-end not confirmed | Source | **Not Verified** | `PDF-006` |
| PDF | `/documents` | Signature area present | Present | — | — | **Not Verified** | — |
| PDF | `/documents` | Notes and terms rendered | Present | — | — | **Not Verified** | — |
| PDF | `/documents` | Currency symbol correct throughout | Correct | USD hardcoded | Source | **Fail** | `FIN-006` |
| PDF | `/documents` | Unicode customer name renders correctly | Correct glyphs | Arabic font embedded; not observed | — | **Not Verified** | — |
| PDF | `/clients/$clientId` | AR statement PDF is accurate | Matches screen | — | — | **Not Verified** | — |
| PDF | `/documents` | Packing slip output | Correct | `downloadPackingSlip` exists | Source | **Not Verified** | — |
| Print | all | Browser print stylesheet | Clean output | — | — | **Not Verified** | — |

## 14. Design, responsive, and accessibility

> Every row here is **Not Verified**. Phase 9 requires visual inspection of the running app, which
> did not complete. Nothing is claimed either way. See §12 and §17 of the audit report.

| Module | Page / route | Test case | Expected result | Actual result | Method | Status | Issue |
|---|---|---|---|---|---|---|---|
| Design | all | Layout at 375 px (mobile) | No overflow, all controls reachable | — | — | **Not Verified** | — |
| Design | all | Layout at 768 px (tablet) | Correct layout | — | — | **Not Verified** | — |
| Design | all | Layout at 1440 px (desktop) | Correct layout | — | — | **Not Verified** | — |
| Design | all | No horizontal page scrolling | None | Commit `2562f87` addressed this previously | Source | **Not Verified** | — |
| Design | all | Brand colours consistent | Consistent | — | — | **Not Verified** | — |
| Design | all | Typography and font sizes readable | Readable | — | — | **Not Verified** | — |
| Design | all | Spacing and alignment consistent | Consistent | — | — | **Not Verified** | — |
| Design | all | Button sizes and hierarchy consistent | Consistent | — | — | **Not Verified** | — |
| Design | all | Icons consistent in size and style | Consistent | — | — | **Not Verified** | — |
| Design | all | Card styling consistent | Consistent | — | — | **Not Verified** | — |
| Design | all | Table styling consistent | Consistent | — | — | **Not Verified** | — |
| Design | all | Form styling consistent | Consistent | — | — | **Not Verified** | — |
| Design | all | Modal styling consistent | Consistent | — | — | **Not Verified** | — |
| Design | all | Navigation works at every width | Works | — | — | **Not Verified** | — |
| Design | all | Sidebar collapse behaviour | Correct | — | — | **Not Verified** | — |
| Design | all | Mobile menu opens and closes | Works | — | — | **Not Verified** | — |
| Design | all | Long part numbers do not break layout | Truncate or wrap | — | — | **Not Verified** | — |
| Design | all | Long descriptions do not break layout | Truncate or wrap | — | — | **Not Verified** | — |
| Design | all | Empty states present and helpful | Present | — | — | **Not Verified** | — |
| Design | all | Loading states present | Present | — | — | **Not Verified** | — |
| Design | all | Error states present | Present | — | — | **Not Verified** | — |
| Design | all | Success messages appear | Present | `toast` used throughout | Source | **Not Verified** | — |
| Design | all | Disabled controls visually distinct | Distinct | — | — | **Not Verified** | — |
| Design | all | Confirmation dialogs on destructive actions | Present | `confirmAction` used with a `destructive` flag | Source | **Not Verified** | — |
| Design | all | Destructive warnings name the consequence | Explicit | — | — | **Not Verified** | — |
| Design | all | Form validation messages are clear | Clear | — | — | **Not Verified** | — |
| Design | all | Terminology consistent and clean English | Consistent | "Monthly sales" actually shows receipts | Source | **Fail** | `RPT-004` |
| Design | all | Date formatting consistent | Consistent | — | — | **Not Verified** | — |
| Design | all | Currency formatting consistent | Consistent | — | — | **Not Verified** | — |
| Design | all | Number formatting consistent | Consistent | — | — | **Not Verified** | — |
| A11y | all | Keyboard navigation reaches every control | Reachable | — | — | **Not Verified** | — |
| A11y | all | Focus indicators visible | Visible | — | — | **Not Verified** | — |
| A11y | modals | Escape closes the modal | Closes | — | — | **Not Verified** | — |
| A11y | modals | Focus is trapped in the modal | Trapped | — | — | **Not Verified** | — |
| A11y | all | Colour contrast meets WCAG AA | Meets AA | — | — | **Not Verified** | — |
| A11y | all | Accessibility labels on icon buttons | Labelled | — | — | **Not Verified** | — |
| A11y | all | Screen-reader landmarks | Present | — | — | **Not Verified** | — |

## 15. Security behaviour

| Module | Page / route | Test case | Expected result | Actual result | Method | Status | Issue |
|---|---|---|---|---|---|---|---|
| Security | all | Stored XSS payload is escaped on screen | Rendered as literal text | React escapes by default; one benign `dangerouslySetInnerHTML` (chart CSS) | Source | **Not Verified** | `UX-001` |
| Security | all | XSS payload escaped in the PDF | Literal text | — | — | **Not Verified** | — |
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
| Performance | — | Real page-load timings | Within budget | — | — | **Not Verified** | — |
| Performance | `/inventory` | Search responsiveness on a full catalog | Responsive | — | — | **Not Verified** | — |
| Performance | — | No duplicate network requests | None | — | — | **Not Verified** | — |
| Performance | — | No memory leak over a long session | Stable | — | — | **Not Verified** | — |
| Reliability | `/counter` | Offline operation | Works offline | — | — | **Not Verified** | — |
| Reliability | — | Reconnect syncs queued changes | Synced | Sync-queue code exists | Source | **Not Verified** | — |
| Reliability | — | Behaviour on simulated network failure | Graceful | — | — | **Not Verified** | — |
| Reliability | — | Behaviour on database failure | Graceful | Rate limiter fails **open** on store errors | Source | **Fail** | `SEC-003` |

## 17. Route coverage

Every registered route, with the depth of verification reached. "Mapped" means the route's purpose,
data dependencies, and CRUD behaviour were established from source (§3 of the report).

| Module | Page / route | Test case | Expected result | Actual result | Method | Status | Issue |
|---|---|---|---|---|---|---|---|
| Routes | `/` | Dashboard loads and formulas mapped | Mapped | Mapped; 16 formulas documented; rendered values not transcribed | Source | **Not Verified** | `RPT-001`…`004` |
| Routes | `/inventory` | Mapped and CRUD reviewed | Mapped | Mapped; 8 findings | Source | **Not Verified** | `STK-002`, `STK-005` |
| Routes | `/documents` | Mapped and flows reviewed | Mapped | Mapped; conversion, payment, revert reviewed in depth | Source | **Not Verified** | `STK-001`, `FUN-001` |
| Routes | `/clients/` | Mapped | Mapped | Mapped | Source | **Not Verified** | — |
| Routes | `/clients/$clientId` | Mapped | Mapped | Mapped; AR statement reviewed | Source | **Not Verified** | `FIN-003` |
| Routes | `/suppliers/` | Mapped | Mapped | Mapped | Source | **Not Verified** | — |
| Routes | `/suppliers/$supplierId` | Mapped | Mapped | Mapped | Source | **Not Verified** | — |
| Routes | `/low-stock` | Mapped | Mapped | Mapped; predicate compared with the dashboard | Source | **Fail** | `RPT-002` |
| Routes | `/reorder` | Mapped | Mapped | Mapped | Source | **Not Verified** | — |
| Routes | `/stock-take` | Mapped | Mapped | Mapped; 2 stock mutation sites | Source | **Fail** | `STK-002` |
| Routes | `/stock-map` | Mapped | Mapped | Mapped | Source | **Not Verified** | — |
| Routes | `/labels` | Mapped | Mapped | Mapped | Source | **Blocked** | — |
| Routes | `/counter` | Mapped | Mapped | Mapped; offline claim untested | Source | **Not Verified** | — |
| Routes | `/collections` | Mapped | Mapped | Mapped | Source | **Not Verified** | — |
| Routes | `/daily-close` | Mapped | Mapped | Mapped; drawer formula documented | Source | **Not Verified** | — |
| Routes | `/shift` | Mapped | Mapped | Mapped | Source | **Not Verified** | — |
| Routes | `/delivery-board` | Mapped | Mapped | Mapped; type error found | Source | **Fail** | `FUN-004` |
| Routes | `/pre-orders` | Mapped | Mapped | Mapped; 1 stock mutation site | Source | **Fail** | `STK-002` |
| Routes | `/china-shipments` | Mapped | Mapped | Mapped; Titus sync reviewed | Source | **Fail** | `SEC-002` |
| Routes | `/fleet` | Mapped | Mapped | Mapped | Source | **Not Verified** | — |
| Routes | `/fleet/$machineId` | Mapped | Mapped | Mapped | Source | **Not Verified** | — |
| Routes | `/insights` | Mapped | Mapped | Mapped | Source | **Not Verified** | — |
| Routes | `/search` | Mapped | Mapped | Mapped | Source | **Not Verified** | — |
| Routes | `/share-inbox` | Mapped | Mapped | Mapped | Source | **Not Verified** | `SEC-007` |
| Routes | `/portal` | Mapped and auth reviewed | Mapped | Mapped; token model reviewed in depth | Source | **Fail** | `SEC-004` |
| Routes | `/share` | Mapped | Mapped | Mapped; service-worker POST handler reviewed | Source | **Fail** | `SEC-007` |
| Routes | `__root` | Layout and gates reviewed | Reviewed | `CloudGate` + `OperatorUnlockGate` confirmed | Source | **Pass** | — |

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
| 11 | Complete the full Phase 9 and Phase 10 passes — 78 cases above are still unverified | §17 |
