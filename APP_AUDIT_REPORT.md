# Parts Village — Full Application Audit Report

**Audit type:** Read-only audit. No application code, schema, or production data was modified.
**Audit date:** 2026-09-06, with a second runtime pass on 2026-09-17 and a third on 2026-09-21
**Commit audited:** `08f2a09` ("Remove all Kafu supplier, catalog leftovers, and data files.")
**Branch:** `cursor/full-application-audit-33f7`
**Live deployment:** https://partsvillageapp.vercel.app

> **Safety statement.** Production Supabase was never contacted. All runtime testing ran against a
> throwaway **mock Supabase** on localhost seeded with synthetic data, created purely for this audit
> outside the repository. No environment-variable values, keys, PINs, or connection strings appear in
> this report. Only `APP_AUDIT_REPORT.md` and `QA_TEST_CHECKLIST.md` were created. `package.json`,
> `package-lock.json`, `src/routeTree.gen.ts`, and all application code are byte-for-byte unchanged —
> `git diff` between the merge base and this branch touches nothing but the two report files.

> **Three passes are recorded here.** The first established the findings. The second closed the
> items it had to leave open — Arabic PDF rendering, browser print, the inventory form's full
> numeric and duplicate-submit matrix, XSS in the DOM, the dashboard reconciliation,
> `/fleet/$machineId`, `/china-shipments`, offline-and-reconnect, and runtime timings — and in doing
> so it **corrected five earlier findings**, two upward and three downward.
>
> The third pass closed the remaining `NOT VERIFIED` items that were testable at all: the packing
> slip, part label, and Z-report PDFs; real `.xlsx` uploads through the import dialog; the full
> accessibility tree on seven routes; WebAuthn against a virtual authenticator; a write failed
> while in flight; memory across a long session; the payment, quotation, invoice, and client forms
> driven to completion; and a genuine two-device payment race. It added **nine findings** — two P0
> (`SYN-001`, `FIN-008`), three P1 (`PDF-016`, `IMP-004`, `FUN-008`), two P2 and two P3 — and
> **corrected three earlier results**. Two of those corrections matter: offline-and-reconnect was
> recorded in pass two as working, and it works only if the operator keeps editing; and `FIN-001`,
> the highest-severity finding in the report, named the wrong code path in both earlier passes.
> Every correction is stated in place rather than quietly edited, so the reasoning is auditable.
> See §17 for the full before/after list.

---

## 1. Executive summary

Parts Village is a single-operator business-management app (inventory, customers/suppliers,
inquiries, quotations, invoices, payments, reports, PDF generation) built on TanStack Start +
React 19 + Vite, with Supabase as the backend. It is a genuinely feature-rich application — 26
pages covering workflows well beyond basic CRUD (stock-take, label station, delivery board, shift
handoff, China shipment tracking, client portal, AR aging, daily close). The production build
succeeds, the existing 18 unit tests pass, and several defensive measures are already in place and
correct (Row Level Security is properly locked to an operator role, no server secrets leak into the
client bundle, the inventory table is virtualised, and reverting a paid invoice is properly
blocked).

However, the audit found **eight P0 issues** that put financial and stock data at risk, and the root
cause of most of them is architectural: **the application does not use a relational database.**
All business data lives in twelve giant JSONB rows in a single `shop_state` table. The whole
dataset is loaded into the browser, mutated in React state, and written back as a whole blob. There
are therefore no foreign keys, no unique constraints, no transactions, no row-level locking, and no
database-enforced invariants anywhere in the live data path. Every business rule is enforced only by
client-side JavaScript, and every concurrent edit is resolved by a hand-written JSON merge function.

The three most serious findings, all confirmed by executing the application's own code rather than
by reading it:

1. **The operator PIN lockout can be completely bypassed** by sending a different
   `X-Forwarded-For` header on each request. I demonstrated 12 consecutive failed PIN attempts with
   zero throttling, then successful entry — against a control run that correctly locked out after 4
   attempts from a fixed IP. The PIN is the only thing protecting all business data. (`SEC-001`)
2. **Recorded payments can be silently erased, and incoming ones silently ignored.** Deleting a
   receipt does not subtract that receipt — it overwrites the invoice's `amountPaid` with the sum of
   whatever receipts remain, so any paid amount not backed by a receipt document is destroyed.
   Driven through the app's own Delete button: an invoice at **$125 paid dropped to $0 and `Unpaid`
   on deleting a $25 receipt**, while the confirmation dialog promised it would put $25.00 back on
   the balance. Separately, when two devices take payments at once the merge keeps both receipts but
   credits only one: **$65 of receipts against an invoice recording $40 paid**. (`FIN-001`,
   `FIN-008`)
3. **Stock is deducted before the quotation→invoice conversion commits, and is never rolled back
   if the conversion fails.** A repeated or concurrent conversion deducts stock twice while creating
   only one invoice. Combined with `STK-002` — there is **no stock movement audit trail anywhere in
   the codebase** across 14 stock-mutation call sites — a wrong quantity is undetectable and
   untraceable after the fact. (`STK-001`, `STK-002`)

The next P0 is the one a customer sees first. **The client portal is completely broken** — the only
page this business shares with the outside world crashes on every load and shows the customer a raw
React error, `useCart must be used within CartProvider`. This was raised to P0 in the second runtime
pass after confirming it three ways: on the live deployment, in the local build at all three
viewport widths, and in the server log, which throws the same error during server-side rendering
before any HTML reaches the browser. There is no partial degradation and no fallback — the page is
unusable, and it leaks an internal stack trace to whoever opens the link. (`UX-002`)

The last P0 was found in the third pass, and it is the one most likely to be met on an ordinary
day. **When a save fails, the app tells the operator the edit is "saved offline; will sync when
connection returns" — and then destroys it.** Pressing the app's own *Retry sync* button re-reads
the server and overwrites the pending edit; reloading the tab does the same, because the pending
queue is an in-memory `Map` that does not survive a refresh. Driven against the running app on one
part with a known starting quantity of 4444: an edit to 5,555 was reverted to 4,444 by *Retry sync*,
and an edit to 6,666 was reverted to 4,444 by a reload. The only path that preserves the change is
to carry on editing the same data, which works by accident rather than by design. A false assurance
of durability is worse than an honest failure, because the operator stops watching. (`SYN-001`)

One further finding is worth surfacing here because it also affects what customers see.
**The account statement can print the "Net due" figure off the bottom of the page.** The number is
computed correctly and displayed correctly on screen; the PDF simply draws it past the paper edge, so
the customer gets a statement listing what they were invoiced with no indication of what they owe.
Rendering the app's real PDF code across 350 statement shapes found 8 that do this. (`PDF-005`)

**Two corrections to record, because each changes a headline.**

The first concerns `FIN-001` itself, the highest-severity finding in this report. The first two
passes said payments are erased during a **multi-device merge**, on the strength of running the
merge's healing function directly. Driving the running app found no erasure on any merge — because
that function never executes. `mergeShopStateValue` heals its array branch only when it is handed a
`fieldKey` of `"documents"`, and the two call sites in `cloud-store.ts` pass no `fieldKey` at all;
the object branch that would otherwise catch it needs a wrapper shape the `documents` row does not
have. So the protection is dead code, and the project's own unit test passes only because it
constructs that wrapper shape by hand (`FIN-009`). Searching for where the erasure *does* happen
found it in **receipt deletion**, on a single device with no concurrency involved — which makes it
easier to hit than originally described, not harder. `FIN-001` stays P0 with a corrected code path,
and the absence of healing turned out to be a second P0 in its own right (`FIN-008`).

The second: an earlier pass reported a P0 that exporting inventory to Excel and re-importing it
overwrites the wrong part, because part codes are truncated at the first `/`. That truncation is
real, but it lives in `parseInventoryExcelFile`, which is **exported and never called anywhere in
the application**. The live Upload-Excel path (`ExcelImportDialog` → `buildInventoryImportPreview`)
matches part codes exactly and round-trips the app's own export file correctly. The finding is
retained as `IMP-001` at **P3** — a latent trap in dead code, not a live data-corruption bug. See §8.

**Recommendation.** Do not treat this as a list of bugs to patch individually. Fix the contained P0s
first (they are small, local changes), then decide on the architectural question in §18, because
roughly half of the P1/P2 findings are symptoms of the JSON-blob data model and will keep reappearing
until that is addressed.

### Findings by priority

| Priority | Count | Meaning |
|---|---|---|
| **P0 — Critical** | 8 | Data loss, major security exposure, or incorrect financial/stock data |
| **P1 — High** | 19 | Core feature broken or serious business risk |
| **P2 — Medium** | 45 | Important defect with a workaround |
| **P3 — Low** | 34 | Minor defect, visual inconsistency, or improvement |
| **Total** | **106** | Plus 11 controls verified sound and a 7-row verified WebAuthn table (§14), 5 verified-correct stock behaviours, 6 verified-correct search behaviours and 7 verified-correct import behaviours (§8), a verified-correct numeric-validation table (§6), a 10-row verified-correct PDF table, a 3-row verified document-output table and a 6-row verified-correct Arabic table (§13), a 12-row verified-correct design/UX table plus a 7-route accessibility-tree table (§12), and a much shorter `NOT VERIFIED` list (§17) |

Note that the count is not a measure of quality on its own: 977 of the 985 lint errors are pure
formatting, and roughly a third of the P2 findings are consequences of the single architectural
decision described in `DAT-001`. Several findings also record things that work: the screen total and
the PDF total agree exactly across every discount scenario tested, stock quantities cannot be driven
negative through either editing path, oversell is deliberately tracked rather than lost, the Add/Edit
part form correctly rejects negative and non-numeric input with a clear message, the stored XSS
payload is inert in the DOM on every route tested, search over 2,344 parts stays under 62 ms,
Arabic renders in PDFs with correct shaping and right-to-left order, the modal dialogs correctly
trap focus, close on Escape, and label every field, Face ID enrolment and unlock work end to end
with a captured assertion correctly refused on replay, every interactive control on seven routes
exposes an accessible name, and 48 navigations produced no memory leak.

---

## 2. Technology and architecture summary

| Layer | Technology | Notes |
|---|---|---|
| Framework | TanStack Start (Nitro 3 beta), file-based routing | SSR enabled, Vercel preset |
| UI | React 19, Vite 8, Tailwind, shadcn/ui, Recharts | |
| Language | TypeScript 5 (`strict: true`) | `noUnusedLocals`/`noUnusedParameters` are `false` |
| Backend | Supabase (Postgres 17) | Auth, Storage, RLS |
| Server logic | 7 `createServerFn` endpoints under `/_serverFn/<hash>` | See §14 |
| Auth | Operator PIN → Supabase session; optional WebAuthn (Face/Touch ID) | Single operator role |
| Data access | Whole-blob read/write of `shop_state` from the browser | See §4 |
| PDF | jsPDF + jspdf-autotable, embedded base64 logo and Arabic font | |
| Import/export | `xlsx` (SheetJS), CSV, `@zxing` barcode scanning | |
| PWA | Service worker: Web Share Target + offline shell | `public/sw.js` |
| Package manager | npm (`package-lock.json`) **and** a stray `bunfig.toml` | See `DEP-003` |

### Architecture in one paragraph

There is **no server-side business logic**. Every route is a client component. On load, the browser
authenticates as an `operator` and reads the twelve `shop_state` rows in full; all business logic
(pricing, stock, statuses, conversions, reports) executes in React contexts
(`documents-context.tsx`, `inventory-context.tsx`, `parties-context.tsx`, …). Writes go through
`useCloudState` (`src/lib/cloud-store.ts`), which debounces 400 ms and writes the entire blob back
with optimistic concurrency on `updated_at`. If the remote row moved ahead, it fetches the remote
value and runs a hand-written three-way merge (`src/lib/shop-state-merge.ts`) before retrying. The
only server-side code is the operator unlock, WebAuthn, the client portal statement, and the Titus
logistics scraper.

**Consequence:** the browser is the database engine. This is why the P0/P1 list is dominated by
concurrency, rollback, and traceability issues rather than by broken buttons.

---

## 3. Complete page and feature inventory

27 routes are registered (26 pages + one non-visual endpoint), all behind the operator gate except
`/portal` and `/share`.

| Route | File | Purpose | Gate |
|---|---|---|---|
| `/` | `index.tsx` | Dashboard: KPI cards, monthly sales, top clients, low stock, AR aging, margin radar, P&L | Operator |
| `/inventory` | `inventory.tsx` | Inventory master (virtualised table), add/edit/merge parts, photos, labels, import/export | Operator |
| `/documents` | `documents.tsx` | All documents: quotations, invoices, receipts, credit notes, inquiries; conversions, payments, returns, PDFs | Operator |
| `/clients/` | `clients.index.tsx` | Client list / CRM | Operator |
| `/clients/$clientId` | `clients.$clientId.tsx` | Client detail, transaction history, AR statement, portal link | Operator |
| `/suppliers/` | `suppliers.index.tsx` | Supplier list | Operator |
| `/suppliers/$supplierId` | `suppliers.$supplierId.tsx` | Supplier detail + inquiries | Operator |
| `/low-stock` | `low-stock.tsx` | Low-stock report | Operator |
| `/reorder` | `reorder.tsx` | Reorder suggestions | Operator |
| `/stock-take` | `stock-take.tsx` | Physical stock count / adjustment | Operator |
| `/stock-map` | `stock-map.tsx` | Shelf/bin location map | Operator |
| `/labels` | `labels.tsx` | Label printing station | Operator |
| `/counter` | `counter.tsx` | Offline-capable counter sales | Operator |
| `/collections` | `collections.tsx` | Promise-to-pay chase list | Operator |
| `/daily-close` | `daily-close.tsx` | Cash drawer / daily close | Operator |
| `/shift` | `shift.tsx` | Shift handoff | Operator |
| `/delivery-board` | `delivery-board.tsx` | Delivery / pickup board | Operator |
| `/pre-orders` | `pre-orders.tsx` | Customer pre-orders | Operator |
| `/china-shipments` | `china-shipments.tsx` | Import shipment tracking + Titus sync | Operator |
| `/fleet` | `fleet.tsx` | Customer machines | Operator |
| `/fleet/$machineId` | `fleet.$machineId.tsx` | Machine service history | Operator |
| `/insights` | `insights.tsx` | Sales board / analytics | Operator |
| `/search` | `search.tsx` | Global search | Operator |
| `/share-inbox` | `share-inbox.tsx` | Received shared files (PWA share target) | Operator |
| `/portal` | `portal.tsx` | **Public** read-only client statement (`?c=<id>&t=<token>`) | Token |
| `/share` | `share.ts` | **Public** Web Share Target entry, redirects to `/share-inbox` | None |
| `__root` | `__root.tsx` | Layout, `CloudGate`, `OperatorUnlockGate`, all data providers | — |

### Document types

`quotation`, `invoice`, `receipt`, `credit_note`, `inquiry` — all stored in one `documents` array
and discriminated by a `kind` field.

### Old / hidden / unfinished / duplicated / unused code

Called out separately as requested:

| Item | Status | Detail |
|---|---|---|
| Relational tables (`clients`, `parts`, `machines`, `orders`, `order_lines`, `quotations`, `invoices`, `supplier_inquiries`) | **Dead** | Created in the initial migration, superseded by `shop_state`. All privileges revoked from `anon`/`authenticated` in `20260903090100`. **All 18 database indexes are on these dead tables.** |
| `orders` collection | **Zombie** | No longer the source of truth, but the dashboard still reads it as a fallback in `paidSales` and "recent activity" — see `RPT-001`. Conversions still write to it (`addOrder`). |
| `src/lib/mock-data.ts` | **Misleading name** | Actually holds the live `Part` type and the `currency` formatter, not mock data. |
| `bunfig.toml` | **Stray** | Bun config alongside `package-lock.json`; two package managers implied. |
| `src/routeTree.gen.ts` | **Stale** | Committed version is missing a 10-line `declare module` block the current generator emits. |
| `DOCUMENT_TAX_RATE_PERCENT` | **Unfinished** | Tax plumbing exists end-to-end but the constant is hardcoded `0` with no UI. See `FIN-005`. |
| `src/lib/fx.ts` | **Partial** | USD conversion for *display only*; no real multi-currency support. See `FIN-006`. |
| `counter.tsx` | **Unclear** | Titled "Offline — counter still works"; offline behaviour not verified (see §17). |

---

## 4. Database and data-flow summary

### Live schema — one table

```sql
create table public.shop_state (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
```

Twelve keys act as the de-facto tables. Each is **one row containing one JSON document**:

| Key | Contents | Written by |
|---|---|---|
| `inventory` | `{ overrides, customParts, customCategories }` | Inventory, stock-take, invoicing, returns, shipments |
| `parties` | `{ clients[], suppliers[] }` incl. `portalToken` | Clients, suppliers |
| `documents` | Array of all quotations/invoices/receipts/credit notes/inquiries | Documents, checkout, payments, returns |
| `fleet` | Customer machines | Fleet |
| `cart` | Active cart / held carts | Counter, cart sheet |
| `kits` | Machine kits | Inventory, counter |
| `prefs` | Operator preferences, price books | Various |
| `shipments` | China shipments | China shipments |
| `share-inbox` | Shared file metadata | Share inbox |
| `pre-orders` | Customer pre-orders | Pre-orders |
| `operator_rate_limits` | Auth throttle buckets | Server only (service role) |
| `operator_webauthn` | WebAuthn credentials + challenges | Server only (service role) |

### Relationships (application-level only — no foreign keys exist)

```
parties.clients[].id ──┬─< documents[kind=quotation].partyId
                       ├─< documents[kind=invoice].partyId
                       ├─< documents[kind=receipt].partyId
                       └─< fleet[].clientId
parties.suppliers[].id ─< documents[kind=inquiry].partyId

documents[kind=invoice].id ──┬─< documents[kind=receipt].invoiceId
                             └─< documents[kind=credit_note].invoiceId

inventory part id ──< documents[].lines[].partId      (no referential integrity)
```

Every one of these relationships is a plain string field. Nothing prevents an orphan, a dangling
`partId`, or two records sharing an id.

### Quotation → invoice → payment → stock flow (as implemented)

```
1. Cart / Create-invoice dialog
     subtotal = roundMoney( Σ roundMoney(qty × unitPrice) )
     total    = documentGrandTotal(subtotal, discount)      ← tax always 0

2. Save quotation                      documents[] += {kind:"quotation", status:"Draft"|"Sent"}
                                       stock: UNCHANGED (quotations never reserve stock)

3. Convert (documents.tsx:285)
     a. confirm "Convert to invoice?"
     b. confirm "Deduct stock?"
     c. ⚠ IF deduct: adjustPartQuantity(partId, -qty) for every line   ← HAPPENS FIRST
     d. convertQuotationToInvoice()
          → creates invoice {kind:"invoice", status:"Unpaid", amountPaid:0}
          → ⚠ DELETES the quotation from documents[]
          → link preserved only as free text in internalNote
     e. addOrder(...)  → writes to the zombie `orders` collection
     ⚠ if (d) throws, the stock deduction in (c) is NOT rolled back      → STK-001

4. Receive payment                     documents[] += {kind:"receipt", invoiceId, total}
                                       invoice.amountPaid += amount
                                       status → Partial | Paid

5. Return / credit                     documents[] += {kind:"credit_note", invoiceId}
                                       stock restored, capped by physicalRestockCap()

6. Any concurrent edit                 mergeShopStateValue() → healDocumentsAmountPaid()
                                       ⚠ rewrites amountPaid + status on EVERY invoice → FIN-001
```

**Where stock changes** — 14 call sites, none of which record a movement:
`stock-take.tsx` ×2, `documents.tsx` ×3, `checkout-dialog.tsx` ×2, `create-invoice-dialog.tsx` ×4,
`create-return-dialog.tsx`, `shipment-receive-dialog.tsx`, `preorder-convert-dialog.tsx`.

---

## 5. Commands run and results

Environment: Node v22.14.0, npm 10.x, Linux.

| # | Command | Result |
|---|---|---|
| 1 | `npm ci` | ❌ **Failed** — lockfile out of sync with `package.json` (`Missing: lru-cache@11.5.2 from lock file`); also `EBADENGINE` for `@zxing/library` requiring Node `>=24.0.0`. See `DEP-002`. |
| 2 | `npm install --no-package-lock` | ❌ Failed — `Cannot read properties of null (reading 'edgesOut')`. |
| 3 | *(workaround)* install into a scratch dir, hardlink-copy `node_modules` | ✅ Dependencies available **without touching the lockfile**. `md5` of `package-lock.json` verified unchanged before and after the audit. |
| 4 | `npx vitest run` | ✅ **18 passed / 18**, 4 files, 227 ms. See §6. |
| 5 | `npx tsc --noEmit` | ❌ **1 error** — `src/routes/delivery-board.tsx(246,32) TS2741`. See `BLD-001`. |
| 6 | `npm run lint` (`eslint .`) | ❌ **985 errors, 75 warnings** across 120 of 241 files. 977 errors are `prettier/prettier` formatting. See §6. |
| 7 | `npm run build` (`vite build`) | ✅ **Succeeded** in 779 ms. Client output 4.48 MB across 60+ chunks. See §15. |
| 8 | `npx vite preview` | ✅ Served on `localhost:3000`, HTTP 200, 6 ms TTFB. |
| 9 | `npm run dev` (`vite dev`) | ⚠️ Starts, but logs a repeated client-side error: `Module "node:crypto" has been externalized for browser compatibility … src/lib/operator-auth-server.ts`. See `BLD-002`. |
| 10 | `npm audit --json` | ⚠️ **7 vulnerabilities: 5 high, 2 moderate**, 0 critical, across 549 deps. No packages were upgraded. See §14 / `DEP-001`. |
| 11 | Schema validation — reviewed all 12 migrations, policies, indexes, constraints | See §4 and §14. |
| 12 | Client-bundle secret scan (`OPERATOR_PIN`, `SUPABASE_SERVICE_ROLE_KEY`, server module names) | ✅ **Clean** — no server-only secret or module reaches the client bundle. |
| 13 | Custom harness: money math via the app's real `document-money.ts` | ⚠️ 4 divergences. See §11. |
| 14 | Custom harness: `healDocumentsAmountPaid` over seeded documents | ❌ Silent payment erasure reproduced. See `FIN-001`. |
| 15 | Runtime probe: operator PIN lockout with fixed vs rotated `X-Forwarded-For` | ❌ **Lockout fully bypassed.** See `SEC-001`. |
| 16 | Runtime probe: `POST /_serverFn/<syncTitusOrders>` with no credentials | ❌ Reachable unauthenticated. See `SEC-002`. |

### Runtime test environment

Because there is no Docker in the audit sandbox, I wrote a **mock Supabase server** (PostgREST-shaped
`shop_state` endpoints + Auth admin/token endpoints) outside the repository and seeded it with
synthetic data engineered to exercise audit edge cases:

- an invoice with a partial payment backed by two receipts (250 + 150 against 676.12);
- a fully paid invoice with a linked credit note;
- an unpaid/overdue invoice with no receipts;
- a legacy invoice marked `Paid` with **no** `amountPaid` field and no receipts;
- an invoice totalling 15,000,034.99 to test large-number formatting;
- a **42-line quotation** for multi-page PDF testing;
- a customer name containing XSS and SQL-injection payloads plus Unicode:
  `Ø26.5×3 «Ürün» — 50% <b>test</b> & 'quote' "dq" \ / ; DROP TABLE parts;--`

---

## 6. Build, lint, type-check, and test results

### Build ✅

`vite build` succeeds in ~779 ms. Notable chunk sizes (client, uncompressed):

| Chunk | Size |
|---|---|
| `index-*.js` (main) | 1348.8 KB |
| `esm-*.js` | 466.7 KB |
| `jspdf.es.min-*.js` | 390.0 KB |
| `routes-*.js` | 384.4 KB |
| `badge-*.js` | 304.4 KB |
| `orings-inventory-*.js` | 225.9 KB |
| `html2canvas-*.js` | 194.9 KB |
| `seals-inventory-*.js` | 155.6 KB |
| **Total client JS** | **4481.8 KB** |

### Type check ❌ — 1 error

```
src/routes/delivery-board.tsx(246,32): error TS2741:
  Property 'search' is missing in type '{ children: string; to: "/documents"; }'
  but required in type 'MakeRequiredSearchParams<...>'
```

The `/documents` route requires search params; this `<Link>` omits them. **Vite does not type-check
during build**, and there is no `typecheck` script in `package.json`, so nothing in the project's
own toolchain would ever surface this. (`BLD-001`)

### Lint ❌ — 985 errors, 75 warnings

| Rule | Count | Severity | Assessment |
|---|---|---|---|
| `prettier/prettier` | 977 | error | Pure formatting. `npm run format` fixes all. Noise that hides the rest. |
| `react-refresh/only-export-components` | 40 | warning | Dev-experience only. |
| `react-hooks/exhaustive-deps` | 35 | warning | **The meaningful ones.** Concentrated in the data layer: `documents-context` 6, `parties-context` 6, `fleet-context` 5, `inventory-context` 5, `prefs-context` 5, `cart-context` 4. Stale-closure risk in exactly the code that writes business data. (`PERF-004`) |
| `no-useless-escape` | 8 | error | Benign `\-` inside regex character classes, all in `titus-import.ts` / `titus-scrape.ts`. (`P3`) |

### Tests ✅ 18/18 passing — but coverage is the real finding

4 test files for **226 source files**:

- `document-money.test.ts` — 2 tests (only `roundMoney`)
- `invoice-money.test.ts` — 4 tests (credits/remaining)
- `phone.test.ts` — 5 tests
- `shop-state-merge.test.ts` — 7 tests

See §16 for the specific missing tests. Nothing covers stock movements, quotation conversion, AR
statements, authentication, rate limiting, the portal, or PDF totals.

---

## 7. Functional issues

### `FUN-001` · P1 · Documents — converting a quotation permanently destroys it

- **Description:** `convertQuotationToInvoice` returns `[invoice, ...cur.filter(d => d.id !== quotationId)]`, removing the quotation from the documents array.
- **Actual:** After conversion the quotation no longer exists. The only trace is free text appended to the invoice's `internalNote`: `"Converted from quotation Q-…"`. There is no `quotationId` field on the invoice.
- **Expected:** The quotation is retained with status `Converted` and a structured, queryable link to the invoice (and vice versa).
- **Evidence:** `src/components/app/documents-context.tsx:1644`.
- **Reproduction:** Create a quotation → convert it → look for it in Documents → it is gone.
- **Business impact:** You cannot show a customer the quotation you originally sent, cannot prove agreed pricing in a dispute, and cannot report quote→order conversion rates. Quotation numbering also develops permanent gaps.
- **Recommended fix:** Keep the quotation, set `status: "Converted"`, add `invoiceId` to the quotation and `quotationId` to the invoice, and filter converted quotations out of the default view rather than deleting them.
- **Regression test:** After conversion, assert the quotation still exists with status `Converted` and that `invoice.quotationId === quote.id`.

### `FUN-002` · P2 · Documents — no structured document numbering; ids double as numbers

- **Description:** `generateDocId` builds ids like `INV-20260820-100000000-aaaa` (prefix + date + timestamp + random suffix) and these are shown to customers as the document number.
- **Actual:** Customer-facing numbers are long, non-sequential, and contain a random suffix. Gaps appear whenever a document is deleted or a quotation is converted.
- **Expected:** A short, gapless, sequential per-type series (`INV-2026-0001`), which most jurisdictions require for invoices.
- **Evidence:** `src/lib/document-export.ts` (`generateDocId`); seeded ids throughout.
- **Business impact:** Non-compliant invoice numbering; hard for customers and accountants to reference.
- **Recommended fix:** Add a separate human-readable `number` field allocated from a server-side counter, keeping the random id as the internal primary key.
- **Regression test:** Issue three invoices; assert numbers are consecutive with no gaps.

### `FUN-003` · P2 · Documents — duplicate document ids are possible by construction

- **Description:** Ids are generated client-side from `Date.now()` plus a short random suffix, with no uniqueness check against existing documents and no database constraint.
- **Actual:** Two devices creating a document in the same millisecond can produce the same id. The merge would then treat them as one document.
- **Expected:** Uniqueness guaranteed by the database.
- **Evidence:** `src/lib/document-export.ts` (`generateDocId`); `shop_state` has no constraint beyond `key`.
- **Business impact:** Low probability, high consequence — a silently lost or conflated invoice.
- **Recommended fix:** Use UUIDv4/v7, or allocate ids server-side.
- **Regression test:** Generate 10⁶ ids in a tight loop and assert zero collisions.

### `FUN-004` · P2 · Delivery board — link to `/documents` omits required search params

- **Description:** The type error from §6 is a real navigation defect, not just a typing complaint.
- **Actual:** `<Link to="/documents">` without the required `search` object. Depending on router strictness this either throws or lands on `/documents` without the expected tab state.
- **Expected:** Navigation always lands on a valid, correctly-tabbed Documents view.
- **Evidence:** `src/routes/delivery-board.tsx:246`; `tsc --noEmit` TS2741.
- **Reproduction:** Open `/delivery-board`, click the documents link.
- **Recommended fix:** Pass `search={{ tab: "invoices" }}` (or the appropriate tab).
- **Regression test:** Click-through test asserting the resulting URL and rendered tab.

### `FUN-005` · P2 · Global — `NaN` / `Infinity` are silently coerced to 0 instead of rejected

- **Description:** `roundMoney` returns `0` for any non-finite input, and `invoiceDiscountRatio` treats non-finite `qty` as `0`.
- **Actual:** Harness output — `roundMoney(NaN) = 0`, `roundMoney(Infinity) = 0`, and a line set of `[qty=NaN, price=NaN, qty=Infinity]` yields a subtotal of `0`.
- **Expected:** Corrupt numeric input is rejected loudly at the input boundary; it must never silently become a valid-looking total of zero.
- **Evidence:** `src/lib/document-money.ts:4-7,84`; harness §11.
- **Scope narrowed in the second runtime pass.** The *part form* is not a way in: the Add/Edit part
  dialog rejects both `abc` and `Infinity` with "Qty, reorder, cost, and price must be numbers"
  (`part-detail-dialog.tsx:220-222` uses `Number.isFinite`, which catches `Infinity` as well as
  `NaN`), and the inline quantity cell refuses them too. The finding therefore stands only for the
  paths that bypass those forms — Excel import, share-target ingestion, and any corrupt value already
  sitting in the `shop_state` blob — where `roundMoney` still turns non-finite input into a
  plausible `0`.
- **Business impact:** A corrupted quantity arriving through import or a stored blob produces a plausible zero-total invoice rather than an error, so the corruption is invisible. Hand-typed input is now known to be guarded.
- **Recommended fix:** Validate at input/parse time with Zod; make `roundMoney` throw (or return `null`) on non-finite input.
- **Regression test:** Assert that constructing a document with `NaN` qty throws rather than producing `total: 0`.

### `FUN-007` · P2 · Forms — a repeated submit creates one record but reports three successes

*Found in the second runtime pass.*

- **Page/feature:** Add-part dialog (and, by shared pattern, other create dialogs).
- **Description:** The Create button is not disabled while a submit is in flight, so a double- or
  triple-click runs the handler once per click. The uniqueness guard keeps the data correct, but each
  invocation raises its own success toast.
- **Actual:** Three rapid Create clicks on a valid new part produced **exactly one** stored part —
  and **three** "Added DUPSUBMIT-1" toasts. Verified against the backing store: custom part count
  went from 6 to 7, and exactly one record carried the new code.
- **Expected:** One click, one record, one confirmation; the button disabled until the write settles.
- **Evidence:** Measured on `/inventory`. Store before: 6 custom parts. After three clicks: 7 custom
  parts, `1` record matching `DUPSUBMIT-1`. Toast queue: `["Added DUPSUBMIT-1", "Added DUPSUBMIT-1",
  "Added DUPSUBMIT-1"]`.
- **Business impact:** Mild but corrosive to trust. Data integrity holds — this is **not** a
  duplicate-record bug — but on a touchscreen at a parts counter, repeated taps are normal, and three
  "Added" confirmations for one part invites the operator to go looking for duplicates that do not
  exist. The same missing in-flight guard is what makes `STK-001`'s double-convert reachable, where
  the consequences *are* financial.
- **Relevant files:** `src/components/app/part-detail-dialog.tsx` (submit handler).
- **Scope narrowed in the third runtime pass.** The second pass assumed the other create dialogs
  shared the pattern. They do not: three rapid clicks on *Create invoice* produced **one** invoice
  and **zero** duplicate toasts, so the invoice form is clean and this finding is specific to the
  Add-part dialog. `STK-001`'s double-convert remains reachable for its own reason — stock is
  deducted before the conversion commits — not because of this toast defect.
- **Recommended fix:** Track an `isSubmitting` flag, disable the primary button while it is set, and
  return early on re-entry.
- **Regression test:** Assert that three synchronous Create clicks yield one record **and** one toast.

### `FUN-008` · **P1** · Documents — nothing in the application can delete or void a document

*Found in the third runtime pass.*

- **Page/feature:** `/documents` — quotations, invoices, credit notes, supplier inquiries.
- **Description:** Every document row offers the same actions, and none of them removes anything. The context exposes a `removeDocument(id)` function, and **no component in the codebase calls it**. The only delete in the documents UI is *Delete receipt*, which removes a payment, not a document.
- **Actual** — the full action set the app offers, read off the live row menus:

  | Document | Actions offered |
  |---|---|
  | Quotation | Edit · Convert to invoice · Share PDF · Download |
  | Invoice | Packing slip · Edit · Revert to quotation · Return parts · Share PDF · Download |

  A quotation raised by mistake can only be edited or converted. An invoice raised against the wrong
  customer, or for the wrong amount, can be edited but never cancelled — and once it carries a
  payment, a receipt, or a credit note, *Revert to quotation* is refused too, so it is permanent.
- **Expected:** A mistaken document can be voided, with the void recorded rather than the row erased, and with a warning about what it is linked to.
- **Evidence:** `src/components/app/documents-context.tsx:324,431-434,1733,1756` — `removeDocument` is declared, implemented, and exported on the context value, and a repository-wide search for a call site returns nothing. The only `Delete` in `src/routes/documents.tsx` is the receipt delete at `:895-916` and `:940-956`. Row menus captured at runtime: `/tmp/pv-audit3/results/quotation2.json`.
- **Reproduction:** Open `/documents`, create a quotation, then open its row menu. There is no delete. Convert it to an invoice and open that row menu. There is no delete there either.
- **Business impact:** Errors are permanent and visible forever. A wrong invoice keeps inflating accounts receivable, the dashboard revenue cards, and the customer's statement, with no way to take it off the books — the only workaround is to edit it down to zero, which leaves a $0.00 invoice in the customer's history and still no record of why. Combined with `QUO-002` (no `Cancelled` or `Void` status exists) there is no correct way to represent a cancelled sale at all. `FUN-001` compounds it from the other side: conversion deletes the quotation automatically, so the app deletes documents the operator did not ask it to and refuses to delete the ones they do.
- **Relevant files:** `src/components/app/documents-context.tsx`, `src/routes/documents.tsx`, `src/routes/clients.$clientId.tsx`.
- **Recommended fix:** Add a `Void` action that sets a `voidedAt` / `voidReason` and excludes the document from AR, revenue, and statements while keeping it visible and numbered. Warn about linked receipts and credit notes before voiding, and block voiding an invoice that has payments until those are reversed. Delete `removeDocument` or wire it to the void path, so the dead API stops implying the capability exists.
- **Regression test:** Assert a voided invoice disappears from AR totals, the dashboard cards, and the client statement while remaining listed in `/documents`; assert voiding an invoice with receipts is refused.

### `CUS-001` · P1 · Customers — deleting a client hides money they still owe

- **Page/feature:** `/clients/$clientId` → Delete.
- **Description:** `removeClient` unconditionally filters the party out of the `clients` array. Their invoices stay in the `documents` blob, still carrying the now-dangling `partyId`. Because the dashboard's "Money owed" card and the collections queue are both built by iterating **clients** (`buildClientsArQueue(clients, invoices, creditNotes)`), a deleted client's open invoices stop being counted anywhere.
- **Actual:** **Verified numerically with the app's own functions.** Two unpaid invoices totalling **$6,000.00** for "Alpha Earthmoving", plus $950.00 for another client:

  | | Alpha Earthmoving | Beta Contracting | Dashboard AR total |
  |---|---|---|---|
  | Before delete | $6,000.00 (2 open) | $950.00 (1 open) | **$6,950.00** |
  | After `removeClient` | — | $950.00 (1 open) | **$950.00** |

  All three invoices are still in the documents blob; `INV-A1` and `INV-A2` still reference the deleted client. **$6,000.00 of receivables silently left the books.** The client detail route resolves the party with `getClient(id)` and renders "Client not found", so there is no longer any route in the app that can produce that client's statement or record a payment against those invoices.
- **Expected:** Either block deletion while unpaid invoices exist, or archive the client (keeping them in AR calculations) rather than removing the record.
- **Evidence:** `src/components/app/parties-context.tsx:243-251` (unconditional filter); `src/lib/ar-statement.ts:156-174` (queue iterates clients); `src/routes/index.tsx:159-169` (dashboard AR total). Harness output above.
- **Reproduction:** Create a client, invoice them twice without payment, note the dashboard "Money owed" figure, delete the client from their detail page, and re-read the dashboard.
- **Business impact:** This is a money-losing defect dressed up as a tidy-up action. The confirmation dialog says *"Their invoices and receipts stay in Documents"* — which is literally true and actively misleading, because it reassures the operator that nothing is lost while the debt stops being chased. There is no referential integrity to prevent it (`DAT-001`) and no audit log to detect it afterwards.
- **Relevant files:** `src/components/app/parties-context.tsx`, `src/routes/clients.$clientId.tsx:335-353`, `src/lib/ar-statement.ts`.
- **Recommended fix:** Block deletion when `invoiceRemaining > 0` for any of the client's invoices; otherwise add an `archived` flag that hides the client from pickers but keeps them in AR and statement calculations.
- **Regression test:** Assert that deleting a client with an unpaid invoice is refused, and that the dashboard AR total is unchanged.
- **Note on suppliers:** `removeSupplier` is worse — its confirmation dialog makes no mention of related history at all (`src/routes/suppliers.$supplierId.tsx:60-72`).

### `CUS-002` · P1 · Customers — re-adding an existing name silently overwrites their contact details

- **Page/feature:** New client / new supplier forms, the party quick-picker, and the quotation Excel import.
- **Description:** `addClient` looks for an existing party whose name matches case-insensitively and, when it finds one, **replaces that record** via `normalizeParty(input, "cli", exists)`. The id is preserved, but `normalizeParty` writes `contactName`, `email`, `phone`, `address`, and `notes` from the input **using `(input.x ?? "").trim()`** — so any field absent from the input becomes an empty string. Nothing in the UI detects or warns about the duplicate.
- **Actual:** Adding "alpha earthmoving" when "Alpha Earthmoving" already exists silently wipes their phone, email, address, and contact name. The most likely trigger is not manual entry but the importer: `quotation-excel-import-dialog.tsx:95` calls `addClient({ name, notes: "Created from quotation Excel import" })` with no contact fields at all, so **importing a quotation spreadsheet for an existing customer erases that customer's entire contact record** and overwrites their notes.
- **Expected:** A duplicate name is detected and the operator is asked whether to use the existing record, merge, or create a separate one. An importer should never blank fields it does not supply.
- **Evidence:** `src/components/app/parties-context.tsx:167-183` (the `exists` branch) and `:118-134` (`normalizeParty` field assignment); call sites at `party-form-dialog.tsx:122`, `party-search-picker.tsx:50`, `quotation-excel-import-dialog.tsx:95`. A repository-wide search for duplicate-name detection in the party forms returns nothing.
- **Reproduction:** Create client "Alpha Earthmoving" with a phone number. Import a quotation spreadsheet naming "Alpha Earthmoving". Re-open the client — the phone number is gone.
- **Business impact:** Customer phone numbers are how this business delivers documents (the app shares quotations and invoices over WhatsApp using `partyPhone`). Losing them silently breaks document delivery, and with no audit log the loss is unattributable and unrecoverable. Note the *upside* of the current design: because the id is preserved, existing documents stay correctly linked — so this is contact-data loss, not orphaning.
- **Relevant files:** `src/components/app/parties-context.tsx`, `src/components/app/quotation-excel-import-dialog.tsx`, `src/components/app/party-form-dialog.tsx`.
- **Recommended fix:** Split "create" from "upsert". Have `addClient` refuse an existing name and return the match so the caller can prompt; give the importer an explicit `findOrCreateClient` that never writes empty fields over populated ones.
- **Regression test:** Assert that `addClient({ name: "alpha earthmoving" })` against an existing "Alpha Earthmoving" with a phone number leaves the phone number intact.

### `CUS-003` · P3 · Customers — the phone number the operator types is replaced with an unformatted digit string

*Found in the third runtime pass.*

- **Page/feature:** Add / edit client and supplier (`party-form-dialog`), and every screen that displays a party's phone.
- **Description:** The form stores the output of `normalizePhoneE164`, which is not E.164 — it strips the `+`, all spaces, and all punctuation, because its real job is to build `wa.me/<digits>` links. That wa.me-shaped string is then what the record holds and what every screen renders.
- **Actual:** Typed `+961 3 424 242` into the Phone field and saved. Stored value: `9613424242`. The clients list, the client detail header, and the party picker all display `9613424242`. The error message shown when the field is invalid asks for *"a valid mobile with country code (e.g. +961 71 000 000)"* — the exact format the app then refuses to keep.
- **Expected:** Keep the operator's input (or a consistently formatted version of it) for display, and derive the digit string only where a `wa.me` URL is being built.
- **Evidence:** `src/components/app/party-form-dialog.tsx:90-99` assigns `phone = normalizePhoneE164(phoneRaw)` into the payload; `src/lib/phone.ts` and its own tests confirm the `+` is dropped (`normalizePhoneE164("+96171000000") === "96171000000"`); `src/components/app/parties-context.tsx:123` stores it verbatim. Runtime: `/tmp/pv-audit3/results/phone.json`.
- **Business impact:** Cosmetic, but it degrades the thing operators read aloud and dial. A ten-digit run with no country-code separator is harder to read back to a customer and harder to scan in a list, and it silently discards deliberate formatting. Nothing is lost that cannot be reconstructed.
- **Relevant files:** `src/components/app/party-form-dialog.tsx`, `src/lib/phone.ts`, `src/components/app/parties-context.tsx`.
- **Recommended fix:** Store the entered value in `phone`, validate it with `normalizePhoneE164`, and keep the normalised digits in a separate derived field (or compute them at the point each `wa.me` link is built, which is what `ar-statement.ts`, `document-export.ts`, and `daily-digest.ts` already do).
- **Regression test:** Save `+961 3 424 242` and assert the client list renders it as typed while the WhatsApp link still resolves to `wa.me/9613424242`.

### `FUN-006` · **P1** · `/fleet/$machineId` — the machine-history page can never render

*Found in the second runtime pass. The first pass could not reach this route because the seed
contained no machines, so it was listed as `NOT VERIFIED` in §17.*

- **Page/feature:** Fleet → click a machine row → machine history.
- **Description:** `fleet.$machineId.tsx` is a complete, non-trivial page (machine header, order
  history, "add kit parts to cart", cross-sell suggestions — it imports `useCart`, `useKits`,
  `useDocuments`, `useInventory` and `addKitPartsToCart`). Under TanStack's flat file-route naming,
  `fleet.$machineId` becomes a **child** of `fleet`, so `/fleet` acts as its layout parent. But
  `src/routes/fleet.tsx` renders no `<Outlet />`, so the child component is never mounted. The
  parent's machine list renders instead, at the child's URL.
- **Actual:** Navigating to `/fleet/mc-audit-1` — the exact `href` the fleet list itself emits —
  leaves the URL updated but renders the **fleet list again**. Clicking a machine looks like a
  no-op, and an entire feature page is unreachable.
- **Expected:** The machine-history page renders, showing that machine's serial, hours, client, and
  every part sold for it; or "Machine not found" for a bad id.
- **Evidence:** Measured at `/fleet/mc-audit-1` with two machines seeded. Strings unique to the
  detail page were all absent while strings unique to the parent list were present, and the body
  text was byte-identical to `/fleet` (410 characters on both):

  | Assertion | Result |
  |---|---|
  | `"Back to fleet"` present (detail page only) | **no** |
  | `"every part sold for this machine"` present (detail subtitle) | **no** |
  | `"Machine not found"` present (detail empty state) | **no** |
  | `"Search every machine by make, model, or serial"` present (**parent list** subtitle) | yes |
  | Body text length | 410 chars — identical to `/fleet` |

  A control rules out the harness: `/clients/cl-alpha` — the same dynamic-segment pattern, but where
  the sibling is `clients.index.tsx` rather than a `clients.tsx` layout — renders correctly
  (`h1` = "Alpha Earthmoving SARL", 1,786 characters). The generated route tree confirms the
  parenting, `src/routeTree.gen.ts:154-158`:

  ```
  const FleetMachineIdRoute = FleetMachineIdRouteImport.update({
    id: '/$machineId',
    path: '/$machineId',
    getParentRoute: () => FleetRoute,        // <- /fleet is the layout parent
  } as any)
  ```

  and `rg -c 'Outlet' src/routes/fleet.tsx` returns **0**.
- **Reproduction:** Open `/fleet`, click any machine row. The URL becomes `/fleet/<id>` and the same
  list re-renders.
- **Business impact:** "Every part ever sold for this machine" is the feature that makes the fleet
  register worth maintaining — it is how the counter answers "what did we fit to this excavator last
  time". It is completely inaccessible, and because the click silently returns the same page, it
  reads as an unresponsive UI rather than a missing feature. The machine-specific kit/cross-sell
  ordering path is unreachable with it.
- **Relevant files:** `src/routes/fleet.tsx` (no `<Outlet />`), `src/routes/fleet.$machineId.tsx`,
  `src/routeTree.gen.ts:154-158`.
- **Recommended fix:** Rename `fleet.tsx` to `fleet.index.tsx`, matching the working
  `clients.index.tsx` / `clients.$clientId.tsx` pair, so `/fleet` and `/fleet/$machineId` are
  siblings rather than parent and child. Adding `<Outlet />` to `fleet.tsx` would also mount the
  child, but then the list would render above it on every machine page.
- **Regression test:** Assert `/fleet/<valid id>` renders the machine's serial number and does **not**
  render the fleet-list subtitle; assert `/fleet/<unknown id>` renders "Machine not found". Add a
  routing check that every route file with a dynamic-segment child either is an `index` route or
  renders an `<Outlet />`.

---

## 8. Inventory issues

### `STK-001` · **P0** · Documents — stock is deducted before conversion commits and is never rolled back

- **Description:** In `convertQuoteToInvoice`, the stock-deduction loop runs *before* `convertQuotationToInvoice()`, and the `catch` block only shows a toast — it does not restore stock.
- **Actual behaviour:**
  ```
  302-319  for (const line of quote.lines) { … adjustPartQuantity(line.partId, -line.qty) }  // stock gone
  321-325  try { convertQuotationToInvoice(quote.id, …) }
  350-352  catch { toast.error("Convert failed") }        // ← no rollback
  ```
  Two failure modes follow:
  1. **Failure path:** if the conversion throws (`"Quotation not found"` — e.g. the quotation was already converted or deleted on another device), stock has been permanently deducted with **no invoice** to account for it.
  2. **Double-deduct path:** trigger the conversion twice (double-click, or two tabs). The first pass deducts and converts. The second pass deducts *again*, then throws `"Quotation not found"` — leaving **one invoice and two deductions**.
- **Scope qualifier (verified):** `adjustPartQuantity` clamps at zero (`Math.max(0, …)`), so this cannot drive a quantity negative. The consequence is that the size of the error depends on stock depth — a part with 100 on hand converted twice for 7 units goes `100 → 93 → 86`, losing 7 units that no document accounts for, whereas a part with 2 on hand simply lands at 0 and the excess is absorbed by the clamp. **The defect is therefore worst on well-stocked, fast-moving parts**, which is the opposite of intuition and makes it easy to miss during casual testing.
- **Expected:** Stock and document changes commit atomically, or the stock change is compensated on failure.
- **Evidence:** `src/routes/documents.tsx:285-353` (deduct at 302-319, convert at 321-325, bare catch at 350-352); `src/components/app/documents-context.tsx:1620-1622` (the throw).
- **Reproduction:** Open `/documents` in two browser tabs. In both, choose Convert on the same quotation and confirm "Deduct stock". One tab succeeds; the other errors — then compare the part quantity against the expected single deduction.
- **Business impact:** Silent, permanent stock inaccuracy on the app's most-used business flow. Because of `STK-002` there is no record to reconcile against, so the error is discovered only at physical stock-take.
- **Relevant files:** `src/routes/documents.tsx`, `src/components/app/documents-context.tsx`, `src/lib/stock-sale.ts`.
- **Recommended fix:** Invert the order — commit the document first, then deduct stock keyed off the created invoice id and guarded by an idempotency check on `invoice.stockDeducted`. Add a re-entrancy guard (`submitting` flag) to the handler. Ideally move both into one server-side transaction.
- **Regression test:** Simulate a throwing `convertQuotationToInvoice` and assert stock is unchanged; fire the handler twice concurrently and assert exactly one deduction and one invoice.

### `STK-002` · **P0** · Global — no stock movement audit trail anywhere

- **Description:** Stock quantities are mutated from 14 call sites via `adjustPartQuantity`, which writes the new number straight into the `inventory` blob. No movement record is created.
- **Actual:** A repository-wide search for `stockMovement`, `stock_movement`, `movements`, `ledger`, `auditTrail`, `audit_log`, `changedBy`, `updatedBy`, `modifiedBy` returns **zero matches** in `src/`. There is no movement history, no before/after snapshot, no timestamp, no reason code, and no user attribution for any stock change.
- **Expected:** Every stock change writes an immutable movement row (part, delta, before/after, reason, source document, user, timestamp). This was an explicit requirement.
- **Evidence:** 14 call sites — `stock-take.tsx` ×2, `documents.tsx` ×3, `checkout-dialog.tsx` ×2, `create-invoice-dialog.tsx` ×4, `create-return-dialog.tsx`, `shipment-receive-dialog.tsx`, `preorder-convert-dialog.tsx`. `src/components/app/inventory-context.tsx` (`adjustPartQuantity`).
- **Reproduction:** Change any quantity anywhere, then try to answer "who changed this, when, and why" — no screen or stored field can answer it.
- **Business impact:** Stock discrepancies are unattributable and uninvestigable. Shrinkage cannot be distinguished from a data bug. Every other stock finding in this report becomes undiagnosable in production because there is nothing to audit. For a parts business this is the single most consequential structural gap.
- **Recommended fix:** Add an append-only `stock_movements` collection (ideally a real table). Route **all** quantity changes through one `recordMovement()` helper — make `adjustPartQuantity` private so no call site can bypass it. Surface the history on the part detail page.
- **Regression test:** Assert every one of the 14 flows produces exactly one movement record whose delta matches the quantity change, and that movement sum equals current on-hand.

### `STK-003` · P1 · Documents — phantom stock is invented for document-created parts

- **Description:** When a line references a part created on the document itself and on-hand is less than the line quantity, the code first *adds* the shortfall and then deducts the full quantity.
- **Actual:** `if (isDocumentCreatedPart(line.partId) && part.quantity < line.qty) adjustPartQuantity(line.partId, line.qty - part.quantity)` immediately followed by `adjustPartQuantity(line.partId, -line.qty)`. Net effect: quantity is forced to `0`, having briefly conjured stock that was never received.
- **Expected:** Selling stock you never received is either blocked or recorded as a positive receipt/adjustment with a reason, not silently manufactured.
- **Evidence:** `src/routes/documents.tsx:313-315`; identical logic in `checkout-dialog.tsx` and `create-invoice-dialog.tsx`.
- **Business impact:** Goods-in is never recorded, so cost of goods and inventory valuation are understated for these parts; combined with `STK-002` the invention is invisible.
- **Recommended fix:** Record an explicit `goods_in` movement with a reason, or require the part to be received before invoicing.
- **Regression test:** Invoice a document-created part with zero on-hand; assert a receipt movement exists and valuation reflects it.

### `STK-004` · P1 · Documents — reverting an invoice restores stock before the revert is validated

- **Description:** Same ordering flaw as `STK-001`, in `revertInvoiceToQuote`: stock is restored at lines 368-376, then `convertInvoiceToQuotation` (which *does* throw on payments, receipts, or credit notes) is called at line 377.
- **Actual:** If the guard throws, stock has already been increased while the invoice remains an invoice — inflating on-hand by the full invoice quantity.
- **Mitigating factor:** the menu item is hidden unless `amountPaid <= 0.005` and there are no receipts/credit notes (`documents.tsx:780-790`), so the common path is safe. The window is a **race**: the menu is gated on a render-time snapshot while `convertInvoiceToQuotation` re-checks against `prev` inside the state updater. A receipt arriving from another device between render and click reopens it.
- **Expected:** Validate first, then mutate stock; or compensate on failure.
- **Evidence:** `src/routes/documents.tsx:355-388`; guards at `src/components/app/documents-context.tsx:1669-1681`.
- **Reproduction:** Open an unpaid invoice's menu in tab A. In tab B record a payment. In tab A click "Revert to quotation" → error toast, but stock has increased.
- **Recommended fix:** Move the validation ahead of the stock restore (call a `canRevert()` check first), or restore stock only after the document change commits.
- **Regression test:** Force the receipts guard to throw and assert stock is unchanged.

### `STK-005` · P2 · Inventory — part-number uniqueness is enforced on create but not on edit

- **Description:** `addPart` calls `findDuplicatePart` and throws `"Part number already exists: …"`. `updatePart` performs **no** duplicate check.
- **Actual:** You can edit an existing part and change its part number to one already used by another part. Both then coexist with the same number.
- **Expected:** Uniqueness enforced on create *and* update, ideally by a database constraint.
- **Evidence:** `src/components/app/inventory-context.tsx:305-331` (checked) vs `:334-360` (not checked); `findDuplicatePart` in `src/lib/part-identity.ts`.
- **Business impact:** Duplicate part numbers split stock and sales history across two records; the wrong one gets picked at invoicing.
- **Recommended fix:** Call `findDuplicatePart(existing, patch, id)` in `updatePart` and reject on conflict.
- **Regression test:** Rename part B's number to part A's number; assert rejection.

### `STK-006` · P2 · Inventory — concurrent creates can both insert the same part number

- **Description:** The duplicate check runs against the in-memory client snapshot only; there is no unique constraint on the underlying JSON blob.
- **Actual:** Two devices adding the same part number simultaneously both pass their local check, and the merge keeps both.
- **Expected:** The second insert fails.
- **Evidence:** `inventory-context.tsx:313-316`; no constraint in any migration for `shop_state`.
- **Recommended fix:** Enforce server-side on write, or normalise parts into a real table with a unique index on the normalised number.
- **Regression test:** Two clients, same part number, concurrent save → exactly one succeeds.

### `STK-007` · P2 · Inventory — `removePart` can silently reset quantity and pricing

- **Description:** For catalog-backed parts, "removing" deletes the override entry rather than the part, so the part reverts to its static catalog values.
- **Actual:** Quantity, cost, price, and reorder point silently snap back to catalog defaults instead of the part disappearing.
- **Expected:** Either a real archive with retained values, or a clear warning that live figures will be discarded.
- **Evidence:** `src/components/app/inventory-context.tsx` (`removePart`); override model in `applyOverride`.
- **Recommended fix:** Add an explicit `archived` flag; never discard override values on delete.
- **Regression test:** Remove a catalog part with a custom quantity; assert either archival or an explicit confirmation naming the values to be lost.

### `STK-009` · P2 · Inventory — quantities are silently rounded to whole units

- **Description:** `adjustPartQuantity` applies `Math.max(0, Math.round(current.quantity + delta))` on both the catalog-override and custom-part branches. Two *further* write paths round the same field by **two different rules**, so the result depends on which control the operator used.
- **Actual:** Every stock change is rounded to an integer, silently. A fractional movement (2.5 m of hose, 0.75 kg of grease) is rounded rather than stored, and repeated fractional sales accumulate drift. `Math.round` also rounds `.5` toward positive infinity, so the drift is directionally biased.

  **Confirmed through the real UI in the second runtime pass**, and it exposed an inconsistency not
  visible from `adjustPartQuantity` alone — the same fractional quantity is resolved differently by
  the two controls that write it:

  | Control | Typed | Stored | Rule applied | Warning |
  |---|---|---|---|---|
  | Add/Edit part dialog | `2.5` | **3** | `Math.max(0, Math.round(qty))` — rounds half up | none |
  | Inline quantity cell | `7.5` | **7** | `Number.parseInt(draft, 10)` then `Math.floor(n)` — truncates | none |

  So `2.5` becomes `3` in one place and `7.5` becomes `7` in another. Neither warns that the
  fraction was discarded.
- **Expected:** Either fractional quantities are supported for parts sold by length/weight/volume, or non-integer movements are rejected at input with a clear message — and in either case one rule, not two.
- **Evidence:** `src/components/app/inventory-context.tsx:395` (catalog branch) and `:405` (custom-parts branch); `src/components/app/part-detail-dialog.tsx:242` (`Math.round`); `src/components/app/inline-number-cell.tsx:33,39` (`parseInt` then `Math.floor`). The two runtime measurements above were taken against the backing store, not the rendered cell.
- **Reproduction:** Create a part with quantity `2.5` through the Add-part dialog — it stores `3`. Click the same part's inline quantity cell and type `7.5` — it stores `7`. Neither shows a message. Separately, sell 0.5 of a part twice from a stock of 10: each `Math.round(10 − 0.5) = 10`, so on-hand does not move at all despite two sales.
- **Business impact:** For a hydraulics business, hose, seal cord, and bulk lubricants are commonly sold by fractional measure. Those parts cannot be tracked accurately, and because there is no movement log (`STK-002`) the drift is invisible. The two-rule inconsistency adds a second problem: the same correction entered through two different controls lands on two different numbers, so a stock count can disagree with itself depending on how it was entered.
- **Relevant files:** `src/components/app/inventory-context.tsx`, `src/components/app/part-detail-dialog.tsx:242`, `src/components/app/inline-number-cell.tsx:33,39`, `src/lib/mock-data.ts` (`Part.quantity`).
- **Recommended fix:** Decide per unit of measurement whether fractional stock is allowed; store quantities as integers in a base unit (e.g. millimetres, grams) to avoid float drift entirely. Until then, make every write path share one rounding helper and warn when a fraction is discarded.
- **Regression test:** Two 0.5 sales from a stock of 10 must leave 9, not 10. Assert the dialog and the inline cell resolve the same fractional input to the same stored value.

### `STK-011` · P3 · Inventory search reports a capped result count as if it were the match count

- **Page/feature:** `/inventory` search box.
- **Description:** `rankByFuzzyScore` is called with a limit of `Math.min(list.length, 500)`, so the result set is hard-capped at 500. Separately, `scoreFuzzyMatch` awards a partial score of `round(hits / queryTokens × 400)` when only *some* query tokens match, and `normalizeSearchText` strips `/` to a space — so a query like `HOSE-1/2` becomes the two tokens `hose-1` and `2`, and every part whose text contains a `2` scores 200 and enters the result set. The count under the box then reads as though 500 parts matched.
- **Actual:** Measured against the 2,344-part catalogue: `HOSE-1/2` (one part actually bears that code) shows **"500 of 2344 parts"**; `HOSE` shows 174; `hydraulic` shows 500; `XSS-001` and `ZERO-QTY-1`, which contain no separator that splits into a common token, correctly show **1**. In every case the genuine match is ranked first, so the feature is usable — the defect is the count and the length of the tail.
- **Expected:** The count reflects real matches, and typing a complete unique part number narrows to that part.
- **Evidence:** `src/lib/fuzzy-search.ts:11` (`/` falls outside the kept character class), `:38-45` (partial-token scoring), `src/routes/inventory.tsx:398-416` (the 500 cap). Runtime measurements in `/tmp/pv-audit2/results/search-behaviour.json`.
- **Reproduction:** Open `/inventory`, type a part number containing a `/`, and read the count line.
- **Business impact:** Low. Exact-match-first ranking means the operator finds the part immediately, so this costs a moment of doubt rather than a wrong answer. It matters more on a phone, where 500 rows of tail is a lot of scrolling past the thing you wanted.
- **Relevant files:** `src/lib/fuzzy-search.ts`, `src/routes/inventory.tsx`.
- **Recommended fix:** Require a minimum score (say ≥ 400, i.e. all query tokens hit) before a part enters the list, keep the 500 cap purely as a render guard, and label the count "showing first 500 of N matches" when it bites.
- **Regression test:** Assert that searching an exact unique part number returns exactly one row, for codes with and without separators.

### `STK-012` · P3 · The inventory table cannot be sorted by the columns it displays

- **Page/feature:** `/inventory`.
- **Description:** The table renders a header row reading `Photo · Code · Description · OEM · Machine · Page · Category · Qty · Cost · Price · Actions`, but those headers are plain `<div>`s: there is **no `<th>` element and no `aria-sort` attribute anywhere on the page**, and none of them responds to a click. The only sort control is a two-option toggle (`size` / `box`), and `sortParts` is reached with the operator's chosen mode **only when the active category is O-Rings** — `isORings ? sortMode : "box"` — so every other category is forced to box order.
- **Actual:** Confirmed at runtime: 0 `<th>` elements, 0 `aria-sort` attributes, 0 clickable headers among 172 controls on the page. There is no way to list the catalogue by quantity, by cost, by price, or alphabetically by code.
- **Expected:** Clicking a column header sorts by that column, for any category.
- **Evidence:** `src/routes/inventory.tsx:170-190` (`sortParts` handles only `box` and inside-diameter order), `:433` (`isORings ? sortMode : "box"`), `src/components/app/virtual-inventory-table.tsx` (header row is div-based). Runtime DOM census in `/tmp/pv-audit2/results/final-gaps2.json`.
- **Reproduction:** Open `/inventory` on any non-O-Ring category and try to sort by Qty or Price.
- **Business impact:** Low individually, but it removes the obvious way to answer everyday questions — what is my most expensive stock, what is nearly out, what has no cost recorded. Some of that is recoverable through the quick filters (`low-stock`, `zero-cost`) and the dedicated `/low-stock` and `/reorder` pages, which is why this is P3 rather than higher. The missing `<th>` semantics also mean a screen reader cannot announce column context, which compounds `UX-008`.
- **Relevant files:** `src/routes/inventory.tsx`, `src/components/app/virtual-inventory-table.tsx`.
- **Recommended fix:** Add a sort key to the table state, make the header cells buttons that set it, and render them as real `<th>` elements with `aria-sort`. Apply the chosen sort for every category, not only O-Rings.
- **Regression test:** Assert that clicking each header reorders rows and sets `aria-sort` correctly.

### Verified-correct search and filter behaviour ✅

Driven at runtime against the 2,344-part catalogue, and worth recording because search is the single
most-used feature in the app:

- **Search matches on far more than the part number.** The haystack spans all part numbers, name, description, category, subcategory, box number, location, inside diameter, cross-section, notes, and machine compatibility. Searching `hydraulic` returns parts whose *description* matches, not just their code.
- **Exact matches rank first.** `scoreFuzzyMatch` scores an exact normalised match 1000, a prefix match 800, and a substring match 600, well above any partial-token score. In every query tested the intended part was the first row.
- **Arabic and Eastern Arabic-Indic digits are normalised** before matching (`٠-٩` and `۰-۹` → ASCII), so an operator can search `١/٢` and find `1/2`. For a Lebanese parts counter that is the right call and it is easy to miss.
- **A no-match query shows a real empty state, not a blank table.** Searching `zzzz-definitely-not-a-part` renders `No parts match "zzzz-definitely-not-a-part".` and the count drops to `0 of 2344 parts`.
- **Categorical filters exist and work** — category chips plus quick filters for low stock, zero cost, no photo, favourites, and seals-in-stock.
- **Long seeded strings do not widen the page.** With a 108-character client name and a 300-character description in the data, `/inventory` still reports `scrollWidth === clientWidth` at 1440 px.

### Verified-correct stock behaviours ✅

Established from source and worth preserving during remediation:

- **Quantities cannot go negative.** `adjustPartQuantity` clamps at `Math.max(0, …)` on both branches.
- **Oversell is tracked separately rather than lost.** Because the clamp would otherwise hide a shortfall, `computeOversoldByPart` records the oversold amount on the invoice (`oversoldByPart`), and `physicalRestockCap(soldQty, oversoldQty, alreadyRestocked)` uses it so a return only restocks units that physically existed. This is a genuinely careful piece of design.
- **Oversell is confirmed with the operator** before committing, via `confirmOversell(stockShortagesForQty(...))`.
- **Below-cost sales are confirmed** in the same pre-commit check.
- **Duplicate part merges blend cost** using a weighted average (`blendedUnitCost`) rather than overwriting.

### `STK-008` · P3 · Inventory — inventory valuation is an unrounded float over the whole catalog

- **Description:** `inventoryValue = parts.reduce((s, p) => s + p.cost * p.quantity, 0)` — raw float accumulation with no rounding and no exclusion of never-stocked catalog rows.
- **Actual:** The figure is a raw float rather than a cents-exact currency amount, and it is computed across the entire static catalog (thousands of O-ring and seal rows) rather than only parts actually held.
- **Expected:** `roundMoney(Σ cost × quantity)` over stocked parts.
- **Evidence:** `src/routes/index.tsx:216`.
- **Assessment — downgraded to P3 after verification.** I initially expected negative on-hand to be able to subtract from this total. It cannot: `clampNonNeg` is applied in `applyOverride` and `normalizePart`, `bulkUpdateParts` clamps quantity/cost/price/reorderAt at `Math.max(0, …)`, and `adjustPartQuantity` clamps at zero. **Negative quantities, costs, and prices are impossible throughout inventory**, so the only real defect here is the missing rounding and the catalog-wide scope.
- **Business impact:** Cosmetic and mild — a long float where a currency figure belongs.
- **Recommended fix:** `roundMoney(...)` and filter to `quantity > 0`.
- **Regression test:** Assert the value is cents-exact and unchanged by catalog rows with zero on-hand.

### `STK-010` · **P3** · Inventory — the inline quantity editor discards invalid input with no message

> **Corrected and downgraded from P2 to P3 in the second runtime pass. The original finding was
> wrong about the main form.** The first pass reported that typing `-5` as a quantity silently
> stores `0`, overwriting the real figure, and cited `clampNonNeg`. Driving the actual Add/Edit part
> dialog shows it **validates and refuses** such input before any clamp is reached. What remains is a
> much smaller defect in a different control: the inline quantity cell rejects invalid input
> *silently*. The original description is retracted; the corrected finding follows.

- **Description:** `InlineNumberCell` — the click-to-edit quantity control on the inventory table and
  the `/low-stock` reorder queue — discards out-of-range input by resetting its own draft and
  returning, with no toast, no inline error, and no change in appearance.
- **Actual:** Measured on `/inventory`. The cell opens as `<input type="number" min="0">`, accepts
  the typed text, and on Enter writes nothing:

  | Typed | Field displayed | Written to store | Message shown |
  |---|---|---|---|
  | `-5` | `-5` | **nothing** (0 overrides written) | **none** |
  | `7.5` | `7.5` | `{ quantity: 7 }` | none — see `STK-009` |

  With `-5` the operator sees the value they typed, presses Enter, and the cell reverts to the old
  number with no explanation. Nothing was corrupted — but nothing tells them the edit did not happen.
- **Expected:** Either a short message ("Quantity cannot be negative"), or the same toast the main
  dialog already shows.
- **Evidence:** `src/components/app/inline-number-cell.tsx:32-41`:

  ```
  const commit = () => {
    const n = decimal ? Number.parseFloat(draft) : Number.parseInt(draft, 10);
    setEditing(false);
    if (!Number.isFinite(n) || n < 0) {
      setDraft(String(value));      // <- silent revert, no message
      return;
    }
    const next = decimal ? Math.round(n * 100) / 100 : Math.floor(n);
    if (next !== value) onCommit(next);
  };
  ```

- **Reproduction:** On `/inventory`, click a quantity, type `-5`, press Enter. The old value returns with no feedback.
- **Business impact:** Low. No data is lost or corrupted — the silent no-op is the *safe* outcome. The
  cost is a confusing interaction: an operator correcting a count may believe the edit saved. On
  `/low-stock` the sibling call site does show a success toast on a valid commit, which makes the
  silent failure more confusing by contrast.
- **Relevant files:** `src/components/app/inline-number-cell.tsx:32-41`, call sites
  `src/components/app/virtual-inventory-table.tsx:135-142`, `src/routes/low-stock.tsx:160-167`.
- **Recommended fix:** In the `!Number.isFinite(n) || n < 0` branch, emit the same
  `toast.error("Qty cannot be negative")` the dialog uses before reverting.
- **Regression test:** Assert that committing `-5` in an inline cell leaves the value unchanged **and**
  raises a visible message.

### Verified-correct numeric validation in the part form ✅

*Established in the second runtime pass by driving the real Add-part dialog on `/inventory` and
checking the stored result in the backing store, not just the screen.* This supersedes the first
pass's claim that negative and non-finite input is silently coerced:

| Input | Field | Result | Message shown |
|---|---|---|---|
| `-5` | Qty | **rejected**, nothing created | "Qty, reorder, cost, and price cannot be negative" |
| `-12` | Cost | **rejected**, nothing created | "Qty, reorder, cost, and price cannot be negative" |
| `abc` | Qty | **rejected**, nothing created | "Qty, reorder, cost, and price must be numbers" |
| `Infinity` | Qty | **rejected**, nothing created | "Qty, reorder, cost, and price must be numbers" |
| *(empty)* | all | **rejected**, nothing created | "Primary part number is required" |
| `HOSE-1/2` (existing) | Part number | **rejected**, no duplicate created | "Part number already exists: HOSE-1/2 (Hydraulic hose 1/2 inch)" |

The guards are at `src/components/app/part-detail-dialog.tsx:216-227` — `Number.isFinite` catches both
`NaN` and `Infinity`, and a separate `n < 0` check catches negatives, each with its own message. This
is the correct pattern, and it means `clampNonNeg` and `bulkUpdateParts`' `Math.max(0, …)` act as
defence in depth behind a validating form rather than as the primary (silent) gate. The clamps do
remain the *only* gate on the Excel-import and programmatic paths, which is where `FUN-005` still
applies.

### Inventory import and export

**What the live import path gets right ✅** — verified by reading the whole path end to end
(`ExcelImportDialog` → `readInventoryWorkbook` → `guessInventoryMapping` →
`buildInventoryImportPreview` → `bulkUpdateParts`):

| Behaviour | Result |
|---|---|
| Part codes are matched **exactly** | `index.get(code.toLowerCase())` against `partNumber` plus every OEM cross-reference (`inventory-import.ts:83-84,94`). A code containing `/` matches itself. |
| The app's own export round-trips | `downloadInventoryExcel` writes `"Part Code": p.partNumber` verbatim (`inventory-export.ts:24`) and `guessInventoryMapping` maps `"part code"` back to it (`inventory-import.ts:66`). |
| A dry run is shown before anything is written | Counts of updates / creates / skips, plus per-row `ACTION · code · name · qty a→b · cost a→b · price a→b` (`excel-import-dialog.tsx:180-196`). |
| Skips carry a reason | `{ action: "skip", reason: "Missing part number" }` (`inventory-import.ts:89`). |
| Large drops require confirmation | Any quantity or cost falling below 50% of its current value triggers a destructive `confirmAction` naming up to five affected codes (`excel-import-dialog.tsx:71-97`). |
| Blank cells do not erase data | `toNum("")` returns `undefined`, and `bulkUpdateParts` skips undefined fields, so an empty Cost column leaves cost untouched (`inventory-import.ts:151`, `inventory-context.tsx:436-448`). |
| Export column set is complete | 14 columns including OEM, machine, location, and notes (`inventory-export.ts:23-38`). |

### `IMP-001` · P3 · Inventory import — dead parser truncates part codes at `/`, `|`, or `,`

- **Description:** `parseInventoryExcelFile` derives the lookup key as `String(codeRaw).split(/[/|,]/)[0]`, so any part code containing `/`, `|`, or `,` is truncated at the first separator and resolves to a **different part**.
- **Actual:** A row for `HOSE-1/2` computes the key `hose-1` and therefore matches the part `HOSE-1`, writing that row's quantity, cost, and price onto the wrong record. The function reports the write as a success in its `matched` count.
- **Expected:** Exact matching, as the live path already does.
- **Why this is P3 and not P0.** The function is **exported but never called**. `rg parseInventoryExcelFile` across the repository returns only its own definition (`src/lib/inventory-import.ts:157`). Every Excel import in the UI goes through `buildInventoryImportPreview`, which matches exactly. An earlier pass of this audit exercised this function directly and reported the resulting corruption as a live P0; that was wrong, and the correction is recorded in §1.
- **Evidence:** `src/lib/inventory-import.ts:190-193` for the split; the absence of any caller for the reachability claim. Slash-bearing part numbers are routine in hydraulics, so the trap is a realistic one if the function is ever wired up.
- **Business impact:** None today. The risk is that the function looks like the ready-made bulk importer and is plausibly the one a future change would reach for.
- **Relevant files:** `src/lib/inventory-import.ts:157-249`.
- **Recommended fix:** Delete `parseInventoryExcelFile`. If a headless bulk path is wanted later, build it on `buildInventoryImportPreview` so there is one matching rule.
- **Regression test:** If the function is kept, assert that a row for `HOSE-1/2` does not modify `HOSE-1`.

### `IMP-002` · P2 · Inventory import — duplicate rows for one part silently keep only the last

- **Description:** When a spreadsheet contains more than one row for the same part, the values are neither summed nor rejected; each row overwrites the previous one field by field.
- **Actual:** `buildInventoryImportPreview` emits one `update` per input row, and `bulkUpdateParts` applies them in order with `overrides[u.id] = { ...overrides[u.id], ...patch }`. Three rows for one part with quantities 10, 7, and 3 therefore leave the part at **3** — the first two are silently discarded. The success toast reports `${updated}` from a counter incremented once per *row*, so the same part written three times is reported as "3 updated", implying three parts changed.
- **Expected:** Duplicate rows are either aggregated (the intuitive reading for a quantity column) or rejected with the duplicated codes named, and the result count reflects distinct parts.
- **Evidence:** `src/components/app/inventory-context.tsx:452-453` (shallow merge then `count += 1`), `src/lib/inventory-import.ts:86` (`rows.map`, one entry per row), `src/components/app/excel-import-dialog.tsx:99,105-107` (apply and report).
- **Reproduction:** Import a sheet with three rows for the same part code and different quantities. The final quantity is the last row's, and the toast reports three updates.
- **Business impact:** Moderate. The dry run does list every affected row, so an attentive operator can see the duplicates before applying — that visibility is what keeps this at P2. But nothing flags them as duplicates, and a merged supplier sheet with one line per delivery is exactly the case where summing is expected.
- **Relevant files:** `src/lib/inventory-import.ts`, `src/components/app/inventory-context.tsx`, `src/components/app/excel-import-dialog.tsx`.
- **Recommended fix:** Group preview rows by resolved part id, and either sum quantities or emit a `skip` with reason "duplicate row for <code>". Count distinct ids in the toast.
- **Regression test:** A three-row duplicate file must either total 20 or be rejected, and the reported count must be 1, never 3.

### `IMP-003` · P3 · Inventory import — the dry run lists only the first 30 rows

- **Description:** The preview that justifies the import shows at most 30 rows.
- **Actual:** `preview.slice(0, 30)` renders the per-row detail, with no "showing 30 of N" note. The summary line above it does give true totals (`{updates} updates · {creates} new parts · {skips} skipped`), so the operator knows how many rows exist — but for a 500-row supplier file, 470 rows are applied without their before→after values ever being visible.
- **Expected:** A scrollable or paginated full list, or an explicit "showing the first 30 of N rows" disclosure.
- **Evidence:** `src/components/app/excel-import-dialog.tsx:186`. The container is already `max-h-40 overflow-y-auto`, so the cap is not needed for layout.
- **Business impact:** Low. The >50% drop confirmation still fires for the dangerous cases regardless of position in the file, which is the main protection.
- **Relevant files:** `src/components/app/excel-import-dialog.tsx`.
- **Recommended fix:** Remove the `.slice(0, 30)` — the list already scrolls — or add the count disclosure.
- **Regression test:** Assert every preview row is reachable, or that the disclosure names the true total.

### `IMP-004` · **P1** · Inventory import — the dry run states values that are not the ones applied

- **Page/feature:** `/inventory` → *More* → *Upload Excel* → the "Dry run" panel → *Apply import*.
- **Description:** The preview is computed by `buildInventoryImportPreview`, which reports `after = value ?? existing`; the write is performed by `bulkUpdateParts`, which independently clamps with `Math.max(0, …)` and rounds with `Math.round`. The two never consult each other, so the panel the operator approves is not a statement of what will happen. The row count disagrees too: the preview counts every matched row, while the write skips rows whose fields are all unparseable.
- **Actual behaviour** — real `.xlsx` files uploaded through the dialog with `DOM.setFileInputFiles`, then the resulting overrides read back out of the store:

  | Sheet row | Dry run promised | Actually written | |
  |---|---|---|---|
  | `AS568-012`, qty `-5`, cost `-3`, price `-1` | `qty 0→-5 · cost 0→-3 · price 0→-1` | `quantity 0, cost 0, price 0` | clamped, not as shown |
  | `AS568-015`, qty `2.7` | `qty 3→2.7` | `quantity 3` | rounded, not as shown |
  | `AS568-013`, qty `abc`, cost `n/a`, price `1,234.56` | listed as an **UPDATE** | no override written at all | counted but not applied |
  | — summary — | `6 updates · 0 new parts · 1 skipped` | toast: `5 updated · 0 created · 1 skipped` | count disagrees |
- **The comma case is the one that will bite.** `Number("1,234.56")` is `NaN`, so `toNum` returns `undefined` and the price is left untouched. The row is still presented as an UPDATE with `price 0→0`, so nothing signals that the price column was discarded. Any supplier sheet using thousands separators — the default in Excel for most locales — imports its quantities and silently keeps the old prices.
- **Expected:** The preview is generated by the same function that performs the write, so `after` is literally what will be stored; unparseable cells are reported as skips with a reason naming the column; and the summary count matches the toast.
- **Evidence:** `src/lib/inventory-import.ts:101-105` (`after = quantity ?? existing.quantity`, unclamped and unrounded) versus `src/components/app/inventory-context.tsx:436-447` (`Math.max(0, Math.round(u.quantity))`); `:448` (`if (Object.keys(patch).length === 0) continue;` — the row that makes 6 become 5); `src/lib/inventory-import.ts:150-154` (`toNum` returns `undefined` for `NaN`). Harness: `/tmp/pv-audit3/results/import2.json`, `import3.json`; fixtures in `/tmp/pv-audit3/fixtures/`.
- **Reproduction:** Build a sheet with columns `Part Code, Name, Qty, Cost, Price` and rows `AS568-012 / -5 / -3 / -1`, `AS568-015 / 2.7 / … `, `AS568-013 / abc / n/a / 1,234.56`. Upload it, read the dry run, apply, then inspect the parts.
- **Business impact:** The dry run is the only safeguard before a bulk write over the whole catalogue, and the >50% drop confirmation quotes the same wrong numbers. An operator who reads the preview carefully and approves it still gets something else. The silently-dropped comma prices are the worst case, because the import reports success and the old prices stay in place — the shop then quotes from stale costs believing it just updated them.
- **Relevant files:** `src/lib/inventory-import.ts`, `src/components/app/inventory-context.tsx`, `src/components/app/excel-import-dialog.tsx`.
- **Recommended fix:** Have `buildInventoryImportPreview` apply the identical clamp/round rules (better: extract one `normalizePartPatch()` used by both), and turn an unparseable non-empty cell into a `skip` with reason `"Price 1,234.56 is not a number"` rather than a silent `undefined`. Strip thousands separators before `Number()`.
- **Regression test:** For a fixture covering negative, fractional, and comma-formatted cells, assert that every `after` value in the preview equals the value read back from the store after applying, and that the preview's update count equals the toast's.

### `IMP-005` · P2 · Inventory import — an unreadable workbook produces no error message at all

- **Description:** `onFile` wraps the parse in `try/catch` and shows `toast.error("Could not read that Excel file")` on throw. But `XLSX.read` does not throw for a file that is not a workbook — it returns a book with one empty sheet — so the catch never runs.
- **Actual:** A plain-text file renamed `.xlsx` was uploaded through the dialog. The filename appeared on the button, **no toast of any kind was shown**, no mapping controls rendered, no dry run appeared, and *Apply import* was left disabled. Confirmed directly: `XLSX.read(<plain text>)` returns `SheetNames: ["Sheet1"]` with zero rows rather than throwing.
- **Expected:** "That file has no readable rows" — distinguishing a corrupt file, an empty sheet, and a sheet whose headers could not be mapped.
- **Evidence:** `src/components/app/excel-import-dialog.tsx:45-60` (the unreachable catch), `:147` (`headers.length ? … : null`, which renders nothing when the parse yields no headers). Harness: `/tmp/pv-audit3/results/import.json`, case "Plain text renamed .xlsx".
- **Business impact:** Low-moderate. Nothing is corrupted — the disabled button is a real safeguard — but the operator gets a dead dialog with no explanation and no way to tell a bad file from a mapping problem.
- **Relevant files:** `src/components/app/excel-import-dialog.tsx`.
- **Recommended fix:** After parsing, branch on the result: no sheets or no rows → "No readable rows in that file"; rows but no recognisable part-code column → "Could not find a part code column — pick one below" with the mapping controls still shown.
- **Regression test:** Upload a non-workbook and assert a visible error message.

### `IMP-006` · P3 · Inventory import — no upper bound on imported quantity, cost, or price

- **Description:** `bulkUpdateParts` guards the lower bound (`Math.max(0, …)`) and rejects non-finite values, but has no ceiling. The >50% confirmation only inspects *drops*, so an implausible increase passes with no prompt at all.
- **Actual:** A row with quantity, cost, and price all set to `1e15` imported cleanly and wrote `quantity: 1000000000000000, cost: 1000000000000000, price: 1000000000000000` with no warning. A misplaced keystroke or a mis-parsed cell therefore lands directly in stock valuation, which `STK-008` already computes as an unrounded float across the whole catalogue.
- **Expected:** A plausibility ceiling that prompts the same way a large drop does — "quantity increases by more than 10×" is the symmetrical check.
- **Evidence:** `src/components/app/inventory-context.tsx:436-447` (no upper clamp); `src/components/app/excel-import-dialog.tsx:71-84` (`qtyDrop` / `costDrop` test `<` only). Harness: `/tmp/pv-audit3/results/import3.json`.
- **Business impact:** Low on its own, but it feeds the valuation and reorder figures, and there is no stock-movement trail (`STK-002`) to reconstruct what the value was before.
- **Relevant files:** `src/components/app/inventory-context.tsx`, `src/components/app/excel-import-dialog.tsx`.
- **Recommended fix:** Extend the existing confirmation to large increases as well as large drops, and reject absurd magnitudes outright.
- **Regression test:** Import a 1e15 quantity and assert a confirmation is required.

**The import path was driven with real files.** Four `.xlsx` fixtures were uploaded through the
actual dialog over CDP (`DOM.setFileInputFiles`) rather than reasoned about from source. What the
live path gets right, now runtime-confirmed: headers are detected and auto-mapped (`Part Code`,
`Name`, `Qty`, `Cost`, `Price`), a row with no part code is reported as `SKIP · — · Missing part
number`, new codes are offered as `CREATE`, blank cells leave existing values untouched, *Apply
import* stays disabled until a part-number column is mapped, and the **>50% drop confirmation fires
correctly** — the edge-case file triggered *"3 large drop(s) detected — Quantity or cost drops by
more than 50% (HOSE-1/2, AS568-012, AS568-015). Apply anyway?"*. A part code containing `/` matched
exactly as documented. Evidence: `/tmp/pv-audit3/results/import.json`, `import2.json`, `import3.json`.

**Still open from §8 for the import path:** the bulk write records no stock movement (`STK-002`),
fractional quantities are silently rounded (`STK-009`), and negative values are silently clamped
(`STK-010`). Those are properties of `bulkUpdateParts`, not of the importer, and are listed above —
`IMP-004` is what makes them dangerous, because the dry run does not disclose either behaviour.

---

## 9. Quotation issues

### `QUO-001` · P1 · Quotations have no expiry date, so "Expired" cannot exist

- **Description:** The quotation model has `date` but no `validUntil`/`expiresAt`.
- **Actual:** Statuses observed are `Draft` and `Sent`. Nothing computes or displays expiry. The dashboard's "follow-up" list is a proxy: `daysAgo(q.date) >= 7`.
- **Expected:** A validity period per quotation, an `Expired` status once passed, and expiry printed on the PDF.
- **Evidence:** `src/lib/shop-state-schema.ts` (no expiry field); `src/routes/index.tsx:92-101` (7-day proxy).
- **Business impact:** Old quotations remain apparently valid indefinitely, so customers can hold you to stale pricing on volatile parts.
- **Recommended fix:** Add `validUntil` (default +30 days), derive `Expired`, and show it on screen and in the PDF.
- **Regression test:** Back-date a quotation past its validity; assert status `Expired` and that conversion warns.

### `QUO-002` · P2 · Quotation statuses do not cover the documented lifecycle

- **Description:** The requested lifecycle is draft → sent → accepted → rejected → expired → converted. Only `Draft` and `Sent` exist, plus implicit deletion on conversion.
- **Actual:** No `Accepted`, `Rejected`, `Expired`, or `Converted`.
- **Expected:** The full set, with `Converted` set on conversion instead of deleting the record (see `FUN-001`).
- **Evidence:** `src/lib/shop-state-schema.ts`; `src/routes/documents.tsx` status filters.
- **Business impact:** No win/loss data; you cannot measure quote conversion rate or see why quotes were lost.
- **Recommended fix:** Extend the status enum and add the transitions to the UI.
- **Regression test:** Drive a quotation through every status and assert filters and reports agree.

### `QUO-003` · P2 · Quotations never reserve stock, with no warning

- **Description:** Quotations deliberately do not touch stock; stock is only deducted at conversion, and only if the operator confirms the second dialog.
- **Actual:** You can quote the same last unit to three customers with no indication of over-commitment. Whether this is intended is a business question (§18 Q3).
- **Expected:** Either soft reservation, or a visible "already quoted elsewhere" warning on the part.
- **Evidence:** `src/routes/documents.tsx:293-319`; no reservation logic anywhere.
- **Business impact:** Over-promising stock; the customer who accepts second cannot be fulfilled.
- **Recommended fix:** Show committed-vs-on-hand on the part, driven by open quotations.
- **Regression test:** Quote the same part on two open quotations; assert the part shows a committed quantity.

### `QUO-004` · P2 · "Deduct stock?" is a free choice on every conversion

- **Description:** The second confirmation lets the operator convert without deducting stock, recorded only as `invoice.stockDeducted = undefined`.
- **Actual:** Two invoices that look identical can have opposite stock effects depending on a dialog choice made days earlier; the invoice view does not prominently show which happened.
- **Expected:** A deliberate, policy-driven default, with the stock effect clearly visible on the invoice.
- **Evidence:** `src/routes/documents.tsx:293-298`; flag consumed at `documents-context.tsx:1636`.
- **Business impact:** Inconsistent stock accounting that depends on operator memory. Also drives `STK-004`'s restore logic.
- **Recommended fix:** Default to deducting; display a clear "stock deducted / not deducted" badge on the invoice.
- **Regression test:** Convert with and without deduction; assert the badge and the restore-on-revert behaviour match.

---

## 10. Invoice and payment issues

### `FIN-001` · **P0** · Deleting one receipt erases every payment on that invoice that has no receipt document

> **Corrected in the third runtime pass. The defect is real and stays P0, but the code path named in
> the first two passes was wrong.** Those passes said the erasure happens during a multi-device
> *merge*, on the strength of running `healDocumentsAmountPaid` directly in a harness. Driving the
> running app showed no such erasure on any merge — because that function never executes (see
> `FIN-009`). Hunting for the real path found it in receipt deletion, where it fires on a **single
> device with no concurrency at all**, which makes it easier to hit than originally described. The
> harness evidence for the merge claim is retained under `FIN-009`; the runtime-confirmed finding
> follows.

- **Description:** `deleteInvoicePayment` recomputes the invoice's `amountPaid` as the sum of the receipts that *remain* and writes that over whatever was stored — rather than subtracting the deleted receipt's own amount. Any portion of `amountPaid` that has no matching receipt document (a legacy record, a manual adjustment, an opening balance, a payment entered before receipts existed) is destroyed as a side effect of deleting an unrelated receipt.
- **Actual behaviour** — driven through the app's own *Delete* button on `/documents`:

  | Scenario | Before | Receipt deleted | `amountPaid` after | Should be |
  |---|---|---|---|---|
  | Every payment has a receipt | $150 paid = receipts $100 + $50 | $50 | **$100**, `Partial` | $100 ✔ |
  | $100 of paid is unbacked | $125 paid = $100 unbacked + receipt $25 | $25 | **$0**, `Unpaid` | $100 ✘ |

  The second row is a $100 loss caused by deleting a $25 receipt. The confirmation dialog the
  operator reads first says the opposite of what happens: *"This removes the payment and puts the
  amount back on the invoice balance"* — naming the $25.00 receipt — and then puts $125 back on the
  balance. The same behaviour appeared independently while testing ordinary payment entry: an
  invoice at $125 paid dropped to `$0 / Unpaid` on deleting a $25 receipt.
- **Expected:** Deleting a receipt reduces `amountPaid` by that receipt's amount. Money that is not backed by a receipt is either preserved or surfaced for reconciliation — never silently deleted by an unrelated action.
- **Evidence:** `src/components/app/documents-context.tsx:1107-1113` — `const paidAfter = affectingReceiptsPaid(invoice.id, next)` followed by `{ ...invoice, amountPaid: paidAfter, status }`, with no reference to `receipt.total` and no comparison against the previous value. Confirm text built by `deleteReceiptConfirmMessage` at `:199-203`. Delete buttons at `src/routes/documents.tsx:904` and `:952`, and `src/routes/clients.$clientId.tsx:963`. Harness: `/tmp/pv-audit3/results/receipt-delete.json`, `payments.json`.
- **Reproduction:** Open an invoice whose `amountPaid` is partly unbacked — seed `{total: 324, amountPaid: 100, status: "Partial"}` with no receipt, which is what a pre-receipts or hand-adjusted invoice looks like. Record a $25 payment through *Pay*; the invoice reads $125 paid. Delete that $25 receipt and confirm. The invoice reads **$0 paid, Unpaid**.
- **Business impact:** **Highest-severity finding.** A customer who has paid is re-invoiced and re-chased for money the business already holds; accounts receivable is overstated by the erased amount. It needs no concurrency and no second device — one operator correcting one mistyped receipt is enough. There is no audit trail (`STK-002` applies to money too), so the loss is silent and unattributable, and the confirmation text actively reassures the operator that only the named amount is affected.
- **Relevant files:** `src/components/app/documents-context.tsx` (`deleteInvoicePayment`, `affectingReceiptsPaid`, `invoiceAmountPaid`), `src/routes/documents.tsx`, `src/routes/clients.$clientId.tsx`.
- **Recommended fix:** Subtract the deleted receipt: `amountPaid = max(0, prevPaid − receipt.total)`. Where `prevPaid > Σ receipts`, keep the excess and flag the invoice for reconciliation rather than dropping it. The durable fix is to make receipts the single source of truth and remove the denormalised `amountPaid` — but only after backfilling receipts for every invoice that carries unbacked paid amounts, or that migration destroys the same money in one step.
- **Regression test:** Seed `{total: 324, amountPaid: 100}` with no receipts, add a $25 receipt, delete it, and assert `amountPaid === 100` and `status === "Partial"`. Separately assert the fully-backed case still resolves to $100.

### `FIN-002` · P1 · `roundMoney` is asymmetric for negatives and stops rounding above ~1e10

- **Description:** `roundMoney(n) = Math.round((n + Number.EPSILON) * 100) / 100`. `Number.EPSILON` is an *absolute* nudge (2.22e-16), so it only helps near magnitude 1 and biases in one direction.
- **Actual behaviour** (harness):
  ```
  roundMoney( 1.005) =  1.01   roundMoney(-1.005) = -1      ← 1 cent lost
  roundMoney( 2.675) =  2.68   roundMoney(-2.675) = -2.67   ← 1 cent lost
  roundMoney( 0.615) =  0.62   roundMoney(-0.615) = -0.61   ← 1 cent lost

  roundMoney(10000000000.005)  = 10000000000        ← half-cent silently dropped
  roundMoney(1000000000000000.5) = 1000000000000000.5 ← not cent-rounded at all
  ```
- **Expected:** Rounding is symmetric (`|round(-x)| === round(|x|)`) and the output is always a whole number of cents at any representable magnitude.
- **Evidence:** `src/lib/document-money.ts:4-7`; harness §11. The existing test only asserts `roundMoney(1.005) === 1.01` and non-finite handling — it never tests negatives or large values.
- **Business impact:** Credit notes, returns, and refunds are negative-going amounts. An invoice line rounding to 1.01 reverses to −1.00, leaving a one-cent residue per line that keeps invoices from ever reaching zero balance and shows customers a "0.01 outstanding". Accumulates across every return.
- **Recommended fix:** Work in integer cents throughout, or use symmetric rounding: `Math.sign(n) * Math.round(Math.abs(n) * 100) / 100` with a scaled (not absolute) epsilon.
- **Regression test:** Property test asserting `roundMoney(-x) === -roundMoney(x)` and cent-exactness across magnitudes 1e0…1e15.

### `FIN-003` · P1 · Invoices have no due date, so "Overdue" is not actually derivable

- **Description:** There is no `dueDate` field. `Overdue` exists as a status string but nothing computes it from payment terms.
- **Actual:** `resolveStatus` only ever returns `Paid`, `Partial`, or `Unpaid`, and *preserves* a pre-existing `Overdue` — it never sets it. AR aging buckets from the **invoice date**, not a due date.
- **Expected:** Payment terms per client/invoice, a stored `dueDate`, `Overdue` derived from it, and aging computed against it.
- **Evidence:** `src/lib/document-money-heal.ts:24-37` (`if (prev === "Overdue") return "Overdue"`); `src/lib/ar-statement.ts` (`invoiceAgeDays` from invoice date).
- **Business impact:** Aging reports are wrong for any customer not on immediate terms — a 30-day-terms invoice appears 30 days overdue the moment it is issued. Collections chase the wrong customers.
- **Recommended fix:** Add `paymentTermsDays` to the client, store `dueDate` on the invoice, derive `Overdue`, and age against `dueDate`.
- **Regression test:** Invoice on 30-day terms 10 days ago → status `Unpaid`, aging bucket `Current`, not `Overdue`.

### `FIN-004` · P2 · `invoiceDiscountRatio` uses a different subtotal definition from the UI and PDF

- **Description:** Two incompatible subtotal formulas coexist for the same document. The UI and PDF both use `roundMoney(Σ roundMoney(qty × price))` (sum of *rounded* lines). `invoiceDiscountRatio` uses `roundMoney(Σ qty × price)` (rounded sum of *raw* lines) **and additionally skips lines categorised `Payment` or `Discount`**.
- **Actual behaviour** (harness):
  ```
  12 lines of 1 × 0.005:
      UI / PDF subtotal              = 0.12
      invoiceDiscountRatio basis     = 0.06     ← 100% divergence

  lines [1×100, 1×-20 "Discount", 1×-50 "Payment"]:
      UI subtotal (all lines)        = 30
      invoiceDiscountRatio basis     = 100      ← skips 2 lines
  ```
- **Expected:** One subtotal function, used everywhere.
- **Evidence:** `src/lib/document-money.ts:76-92` vs `src/lib/document-export.ts:163,247,443` and `checkout-dialog.tsx:132-134`, `create-invoice-dialog.tsx:193-196`.
- **Business impact:** The ratio drives partial-return credit note values (`documents-context.tsx:1169-1172`), so credit notes can be wrong — badly so for invoices carrying `Payment`/`Discount` lines.
- **Recommended fix:** Export one `documentSubtotal(lines, kind)` and use it in the UI, the PDF, and the ratio. Decide deliberately whether `Payment`/`Discount` lines belong in the base and apply that everywhere.
- **Regression test:** For a set of documents including `Payment`/`Discount` lines and half-cent prices, assert UI subtotal === PDF subtotal === ratio basis.

### `FIN-005` · P2 · Tax is hardcoded to zero with no way to configure VAT

- **Description:** `DOCUMENT_TAX_RATE_PERCENT = 0`. The plumbing accepts a rate (`documentTaxAmount`, `documentGrandTotal(subtotal, discount, taxRatePercent)`) and the PDF renders a tax row, but nothing ever supplies a non-zero rate.
- **Actual:** Every document is untaxed. Harness confirms the mechanism works when a rate is passed explicitly: `documentGrandTotal(100, 10% discount, 11) = 99.9` (tax applied to the discounted net). There is no per-line tax and no tax-exempt flag.
- **Expected:** A configurable rate (Lebanon VAT is 11%), per-document override, per-line taxable flag, and a tax registration number on the PDF if registered.
- **Evidence:** `src/lib/document-money.ts:13,23-26,64-71`; `src/lib/document-export.ts:166`.
- **Business impact:** If the business is VAT-registered, every invoice issued is non-compliant and under-collects tax. See §18 Q1.
- **Recommended fix:** Move the rate into `prefs`, expose it in settings, add a per-line taxable flag, and store the rate *on each document* so historical documents keep the rate in force at issuance.
- **Regression test:** Set 11%, issue an invoice, assert screen, stored total, and PDF all show the same tax and grand total; assert a historical 0% invoice is unchanged.

### `FIN-006` · P2 · Currency is effectively hardcoded to USD

- **Description:** `currency()` in `src/lib/mock-data.ts` formats USD unconditionally. `src/lib/fx.ts` (`toUsd`, `formatMoneyWithUsd`) is display-only conversion.
- **Actual:** No currency field on documents, no per-document rate, no rate history. `roundMoney` is documented "Round to nearest cent (USD)" — 2-decimal rounding is assumed everywhere.
- **Expected:** If multi-currency is needed: a currency per document, the rate captured at issuance, and correct minor-unit handling (LBP has no cents).
- **Evidence:** `src/lib/mock-data.ts` (`currency`); `src/lib/fx.ts`; `src/lib/document-money.ts:3`.
- **Business impact:** In a Lebanon-based parts business, LBP/USD dual pricing is common. Storing only USD loses the actual transacted amount. See §18 Q2.
- **Recommended fix:** Add `currency` + `fxRate` to documents; keep totals in the document currency and convert only for reporting.
- **Regression test:** Issue an LBP invoice; assert stored, screen, and PDF amounts match and no cent-rounding is applied.

### `FIN-007` · P2 · `invoiceAmountPaid` masks corrupt data and infers payment from status

- **Description:** `invoiceAmountPaid` clamps negatives to zero and, when `amountPaid` is absent, infers `status === "Paid" ? total : 0`.
- **Actual:** `return Math.max(0, inv.amountPaid)` hides a negative (corrupt) value; the status fallback means an invoice manually marked `Paid` counts as fully paid revenue with **no payment record at all**.
- **Expected:** Negative `amountPaid` is an error to surface; paid amounts derive from receipts, not from a status string.
- **Evidence:** `src/components/app/documents-context.tsx:176-183`.
- **Business impact:** Revenue can be recognised with no payment evidence; combined with `FIN-001`, such invoices are exactly the ones whose unbacked balance is erased by an unrelated receipt deletion.
- **Recommended fix:** Remove the status fallback after backfilling receipts; log rather than clamp negatives.
- **Regression test:** Assert an invoice with `status:"Paid"` and no receipts reports `0` paid and is flagged for reconciliation.

### `FIN-008` · **P0** · A payment taken on a second device is merged in but never credited to the invoice

- **Description:** When two devices touch the `documents` blob at once, the three-way merge keeps **both** receipts but leaves the invoice's `amountPaid` at whatever the local device wrote. The incoming payment survives as paperwork and vanishes from the balance. The code that exists to prevent exactly this — `healDocumentsAmountPaid`, which recomputes `amountPaid` from the surviving receipts — is never reached on the real merge path (`FIN-009`).
- **Actual behaviour** — driven twice against the running app, device B writing straight to the backend while device A held a staged payment, then committing device A so the save had to merge:

  | | Device A | Device B | After merge |
  |---|---|---|---|
  | Receipts on `INV-AUDIT-0001` | $40 | $25 | **both present, $65 total** |
  | Invoice `amountPaid` | 40 | 25 | **40** |
  | Invoice status | — | — | `Partial` |
  | On screen | — | — | `$40.00 / $330.00` |

  The app confirmed the merge itself: *"Cloud updated — review payments / documents · Another device
  or tab changed shop data. Your edits were merged."* The customer's $25 is filed and not counted.
  The same run also carried two invoices with unbacked `amountPaid` (`Paid` with no receipt, and a
  manual `450`); both came through the merge **untouched**, which is the same absence of healing seen
  from the other side.
- **Expected:** After a merge, an invoice's recorded payment equals the sum of the receipts attached to it. A payment that survives as a document must be reflected in the balance.
- **Evidence:** `src/lib/cloud-store.ts:383` and `:466` call `mergeShopStateValue(base, local, remote)` with **no `fieldKey`**; `src/lib/shop-state-merge.ts:122` heals only `if (fieldKey === "documents")`, so on the array branch the merged documents are returned unhealed. The stored shape is a bare array — `documentsShopStateSchema = z.array(idRow)` (`src/lib/shop-state-schema.ts:25`) and `useCloudState<SavedDocument[]>("documents", …, [])` (`src/components/app/documents-context.tsx:371-376`) — so the object branch at `:126-131` never applies either. Harness: `/tmp/pv-audit3/results/heal-runtime.json`, `concurrent-pay.json`, `heal-reachability.json`.
- **Reproduction:** Open the same invoice on two devices. On A, open *Pay* and enter an amount but do not save yet. On B, record a different amount and let it sync. Save on A. Both receipts are listed; the invoice balance reflects only A's.
- **Business impact:** Under-recording cash in the one situation this shop is built for — a counter device and an office device open at once. The invoice shows an outstanding balance the customer has already settled, so they are chased for it, and the daily drawer reconciles against receipts that the invoice ledger does not agree with. Unlike `FIN-001` the money is still visible on the receipt, so it is recoverable by hand — but only if someone notices, and nothing points it out.
- **Relevant files:** `src/lib/cloud-store.ts`, `src/lib/shop-state-merge.ts`, `src/lib/document-money-heal.ts`, `src/lib/shop-state-schema.ts`.
- **Recommended fix:** Pass the key through — `mergeShopStateValue(base, local, remote, key)` at both call sites in `cloud-store.ts`. **Do not ship that one-liner on its own:** it activates a heal function that is destructive in the other direction and would erase every unbacked `amountPaid` in the database on the next merge (`FIN-009`). Make the heal non-lowering first, then wire it up.
- **Regression test:** Merge a documents array where local and remote each add a receipt to the same invoice; assert the invoice's `amountPaid` equals the sum of both. Run the assertion against a bare array, which is the shape the app stores.

### `FIN-009` · P2 · The merge's payment-healing code cannot run, and its unit test passes through a shape the app never stores

- **Description:** `healDocumentsAmountPaid` is written, wired into the merge at four points, and covered by a unit test — and none of it executes. `mergeShopStateValue` heals the array branch only when `fieldKey === "documents"`, but `cloud-store.ts` calls it with no `fieldKey`, and the object branch requires a wrapper object that the `documents` row is not. The project's own test asserts the healed result by constructing `{ documents: [...] }`, a shape that exists nowhere in the application, so the suite reports the protection as working.
- **Actual behaviour** — the same merge inputs (two receipts totalling $65 on one invoice) through both shapes:

  | Input shape | Used by | `amountPaid` after merge | Receipts after merge |
  |---|---|---|---|
  | `{ documents: [...] }` | `shop-state-merge.test.ts:36` | **65** — healed | $40 + $25 |
  | bare array | `shop_state.documents`, the real store | **40** — not healed | $40 + $25 |
  | bare array + `fieldKey: "documents"` | nothing | 65 — healed | $40 + $25 |

  The second row is what the application does. The first row is what the test suite checks.
- **Expected:** Safety code either runs or is deleted, and a test exercises the shape the code is deployed against.
- **Evidence:** `src/lib/shop-state-merge.ts:122,129,149-158`; `src/lib/cloud-store.ts:383,466`; `src/lib/shop-state-schema.ts:25`; `src/lib/shop-state-merge.test.ts:36-70`. Harness: `/tmp/pv-audit3/results/heal-reachability.json`. Confirmed at runtime three ways in one merge — receipts uncredited, a legacy `Paid` invoice with no receipt untouched, a manual `amountPaid: 450` untouched (`heal-runtime.json`).
- **Business impact:** Two ways. First, a false sense of safety: a green test suite reports that merged payments are reconciled when they are not, which is why `FIN-008` went unnoticed. Second, a trap in the obvious fix — the function is destructive by design (`{ ...item, amountPaid: paid, status }` with no floor at the previous value), so enabling it without changing it converts a live under-crediting bug into a live erasure bug across the entire document history at once. Running it over seeded data flips `{total: 1000, amountPaid: 750, status: "Partial"}` to `{amountPaid: 0, status: "Unpaid"}`, and a second pass reproduces the same result, so that loss would be permanent.
- **Relevant files:** `src/lib/shop-state-merge.ts`, `src/lib/document-money-heal.ts`, `src/lib/shop-state-merge.test.ts`, `src/lib/cloud-store.ts`.
- **Recommended fix:** Fix the function before reconnecting it. Make `healDocArray` raise `amountPaid` toward the receipt sum and never lower it, flagging `prevPaid > receiptSum` for review instead of overwriting; then pass the `fieldKey` through from `cloud-store.ts`. Rewrite the unit test to feed a bare array.
- **Regression test:** Assert the heal is invoked for the bare-array shape; assert `heal([{total: 1000, amountPaid: 750}])` leaves 750 in place and raises a reconciliation flag.

---

## 11. Calculation issues

I verified the money math by **executing the application's own `document-money.ts`** in a harness
rather than by reading it, so every number below is real output.

### Formula inventory (as implemented)

| Quantity | Formula | Location |
|---|---|---|
| Line total | `roundMoney(qty × unitPrice)` (inquiries use `unitCost`) | `document-export.ts:112-114` |
| Subtotal (UI + PDF) | `roundMoney(Σ lineTotal)` | `checkout-dialog.tsx:132`, `create-invoice-dialog.tsx:193`, `document-export.ts:163` |
| Subtotal (ratio path) | `roundMoney(Σ qty × unitPrice)`, skipping `Payment`/`Discount` lines | `document-money.ts:81-85` |
| Discount | percent: `roundMoney(subtotal × min(100, pct)/100)`; amount: `roundMoney(min(subtotal, value))` | `document-money.ts:29-39` |
| Net subtotal | `roundMoney(max(0, subtotal − discount))` | `document-money.ts:41-46` |
| Tax | `rate > 0 ? roundMoney(net × rate/100) : 0` — rate is always 0 | `document-money.ts:23-26` |
| Grand total | `roundMoney(net + tax)` | `document-money.ts:64-71` |
| Amount paid | `Σ receipts where affectsBalance`, else `max(0, amountPaid)`, else `status==="Paid" ? total : 0` | `documents-context.tsx:176-183`, `document-money-heal.ts:13-22` |
| Credits | `Σ credit_note.total where invoiceId matches` | `document-money-heal.ts:39-47` |
| Remaining | `max(0, roundMoney(total − paid − credits))` | `documents-context.tsx:670,886` |
| Status | `paid+credits ≥ total−0.005 → Paid`; `paid>0.005 ∨ credits>0.005 → Partial`; keeps `Overdue`; else `Unpaid` | `document-money-heal.ts:24-37` |

### Verified-correct behaviours ✅

These were tested and are right — worth recording so they are not "fixed" by mistake:

- Percent discount clamped to 100 (`documentDiscountAmount(100, 250%) = 100`).
- Fixed discount clamped to the subtotal (`documentDiscountAmount(100, $500) = 100`).
- Negative and zero discounts ignored.
- Negative subtotals floored to 0.
- Tax applied to the **discounted net**, not the gross.
- Screen total and PDF total use the **same** formula, so they agree (see `PDF-006` for the caveat).
- Reducing an invoice below payments already received is blocked with a clear message
  (`create-invoice-dialog.tsx:283-294`).
- Reverting an invoice with payments, receipts, or credit notes is blocked
  (`documents-context.tsx:1669-1681`).

### Confirmed calculation defects

| ID | Issue | Priority |
|---|---|---|
| `FIN-002` | `roundMoney` asymmetric for negatives; stops cent-rounding above ~1e10 | P1 |
| `FIN-004` | Two different subtotal definitions; 0.12 vs 0.06 divergence demonstrated | P2 |
| `FUN-005` | `NaN`/`Infinity` silently become `0` on import and programmatic paths | P2 |
| `RPT-001` | Dashboard "paid sales" mixes sources, ignores discounts and credits | P1 |
| `RPT-002` | Two different "low stock" definitions, and the dashboard count saturates at 8 | **P1** |
| `RPT-003` | Revenue grouped by client **name** rather than id | P2 |

**Now verified:** the rendered dashboard figures were scraped and reconciled by hand against the
seeded source records. That reconciliation is what turned `RPT-002` from a source-level observation
into a measured 8-versus-136 disagreement, and raised it to P1. Agreement between the screen total
and the PDF total is separately confirmed across five discount scenarios (§13).

### Dashboard and report formulas — every card documented

Phase 8 requires the formula behind every dashboard number. All are computed **client-side** in
`src/routes/index.tsx` from the full in-memory dataset.

| Card / report | Exact formula | Line | Concern |
|---|---|---|---|
| Paid sales | `Σ invoiceAmountPaid(invoice)` **+** `Σ (qty × unitPrice)` over `orders` with `status==="Paid"` not linked to any invoice | 74-85 | `RPT-001` — two sources; order branch ignores discounts and rounding; credit notes never subtracted |
| Active quotes | `count(quotations where status ∈ {Sent, Draft})` | 87-90 | No `Expired` status exists (`QUO-001`) |
| Follow-up quotes | `quotations where status ∈ {Sent, Draft} ∧ daysAgo(date) ≥ 7`, sorted desc, **top 8** | 92-101 | 7 days is a hardcoded proxy for expiry; silently capped at 8 |
| Stale inquiries | `inquiries where status==="Open" ∧ daysAgo(date) ≥ 7`, **top 8** | 103-111 | Capped at 8 with no total shown |
| Monthly sales (6 mo) | Buckets keyed `YYYY-MM` from `new Date()` local time; adds `receipt.total` where `receipt.date.slice(0,7)` matches and the receipt affects balance | 114-132 | Measures **cash received, not sales**; mixes local-time bucket keys with raw date-string slicing (`RPT-004`) |
| Top clients | `Σ invoiceAmountPaid` grouped by `invoice.partyName` **(string)**, `total > 0`, **top 6** | 134-145 | `RPT-003` — grouped by name, not id |
| Low stock | `parts where quantity > 0 ∧ quantity ≤ reorderAt`, **top 8** | 147-154 | `RPT-002` — **excludes out-of-stock parts**; disagrees with `/low-stock` |
| Cash drawer | `computeDrawerExpected(documents)` → `cash + omt + whish` | 156-157 | Unrounded float sum of three payment methods |
| AR total | `Σ arQueue[].statement.netDue` where `netDue = total − paid − credits` floored at 0 | 163-166 | Aging uses invoice date, not due date (`FIN-003`) |
| AR unapplied credits | `Σ arQueue[].statement.unappliedCredits` | 167-170 | |
| AR aging buckets | `bucketForAge(invoiceAgeDays(invoice))` — Current / 31-60 / 61-90 / 90+ | 171-… | Ages from **invoice date** (`FIN-003`) |
| Inventory value | `Σ (cost × quantity)` over **all** parts — no rounding, no clamping | 216 | `STK-008` — negative stock subtracts; unrounded |
| Average margin | `round( Σ((price − cost) × qty) / Σ(price × qty) × 100 )` over parts with `price > 0 ∧ qty > 0` | 217-224 | **Theoretical catalog margin, not realised margin** — no sales data involved despite the label |
| Margin radar | `buildMarginRadar(parts, invoices)` | 226 | Not independently verified |
| Price-book alerts | `parts where price + 0.005 < priceBooks[0].rows[].cost`, **top 8** | 228-253 | Only checks the newest price book |
| P&L (date-filtered) | Cash receipts in range **+** "legacy paid invoices" in range with no affecting receipt; `inRange` compares `YYYY-MM-DD` **strings** | 255-… | String date comparison; same dual-source problem as `RPT-001` |

### `RPT-001` · P1 · Dashboard — "Paid sales" mixes two data sources and ignores discounts and credits

- **Description:** `paidSales` sums `invoiceAmountPaid` over invoices **and then adds** the raw line totals of every `orders` record with `status === "Paid"` that is not linked to a known invoice.
- **Actual:** The `orders` branch computes `Σ qty × unitPrice` directly — it applies **no invoice-level discount** and **no rounding**. Neither branch subtracts credit notes or refunds, so a fully refunded sale still counts as paid revenue. `orders` is a zombie collection (§3) that conversions still write to.
- **Expected:** One authoritative source; discounts applied; credit notes and refunds deducted; rounded to cents.
- **Evidence:** `src/routes/index.tsx:74-85`; `addOrder` call in `src/routes/documents.tsx:330-344`; credit-note logic in `src/lib/document-money-heal.ts:39-47` (never referenced by `paidSales`).
- **Reproduction:** Issue a discounted invoice, pay it, then raise a full credit note. "Paid sales" continues to report the pre-discount, pre-credit figure.
- **Business impact:** The headline revenue number on the dashboard overstates income — by the discount amount and by the full value of every refund. It is the number most likely to be trusted and acted on.
- **Relevant files:** `src/routes/index.tsx`, `src/routes/documents.tsx`, `src/components/app/documents-context.tsx`.
- **Recommended fix:** Derive paid sales solely from receipts (`Σ receipt.total where affectsBalance`) minus credit notes, and retire the `orders` fallback (Q10).
- **Regression test:** Fixture with a discounted, paid, then fully-credited invoice; assert paid sales is `0`.

### `RPT-002` · **P1** · Dashboard "Low Stock Alerts" saturates at 8 and disagrees with `/low-stock` by 128

> **Priority raised from P2 to P1 in the second runtime pass**, and the root cause extended. The
> first pass identified two differing predicates. Running both screens against the same loaded
> catalogue showed something more serious: the dashboard's headline alert **number** is computed
> from an already-truncated list, so it can never exceed 8 no matter how many parts need reordering.

- **Description:** Two separate defects in the same feature. (a) The dashboard filters
  `quantity > 0 && quantity <= reorderAt` while `/low-stock` filters
  `reorderAt > 0 && quantity <= reorderAt`, so the dashboard **excludes parts that have run out
  entirely** — precisely the parts most urgently needing reorder. (b) The dashboard KPI prints the
  length of a list that has already had `.slice(0, 8)` applied, so the alert count is capped at 8.
- **Actual:** Measured on the same loaded catalogue at the same moment, with no edits between the
  two readings:

  | Screen | Figure shown | Source |
  |---|---|---|
  | Dashboard "LOW STOCK ALERTS" KPI | **8** | `index.tsx:373` → `String(lowStockParts.length)` |
  | `/low-stock` page header | **"136 parts at or below reorder"** | `low-stock.tsx:88` → `low.length` |

  The `/low-stock` figure is independently corroborated: scraping the rendered reorder queue found
  exactly **136** `Reorder at N` rows. The dashboard card listed 8 items, all catalogue couplings at
  "1 of 1 min", and omitted a seeded part sitting at **0 of 5** — which `/low-stock` placed at the
  very top of its queue.
- **Expected:** One shared predicate, including zero-quantity parts, and a count that reflects the
  true total (or an explicit "showing 8 of 136").
- **Evidence:** `src/routes/index.tsx:147-154` builds the list and truncates it:

  ```
  const lowStockParts = useMemo(() =>
    parts
      .filter((p) => p.quantity > 0 && p.quantity <= p.reorderAt)
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 8),                                  // <- display cap
    [parts]);
  ```

  and `src/routes/index.tsx:371-376` renders the KPI from that same truncated array:

  ```
  <MetricCard label="Low Stock Alerts" value={String(lowStockParts.length)} … />
  ```

  Compare `src/routes/low-stock.tsx:35-41`, which applies no cap.
- **Reproduction:** Load any catalogue with more than 8 parts at or below their reorder point. The
  dashboard reads "8"; `/low-stock` reads the true number. Separately, set a part to quantity 0 with
  `reorderAt = 5`: it appears on `/low-stock` but not on the dashboard card.
- **Business impact:** The dashboard is the operator's first screen and its low-stock badge is the
  trigger for reordering. It under-reported by **128 parts** in the measured case, and it stays at 8
  whether 9 parts or 900 need attention — so the number carries no information once the shop passes
  8 low items. Out-of-stock parts never raise the alert at all. Reordering is therefore driven by a
  figure that is both capped and systematically blind to the most urgent cases.
- **Relevant files:** `src/routes/index.tsx:147-154`, `:371-376`, `src/routes/low-stock.tsx:35-41`.
- **Recommended fix:** Extract `isLowStock(part)` into a shared module (including `quantity === 0`)
  and use it in both places. Keep the full filtered list for the count and slice only at render:
  `value={String(lowStockAll.length)}` with `lowStockAll.slice(0, 8).map(…)` for the card, labelled
  "showing 8 of N".
- **Regression test:** With 12 parts below their reorder point, assert the dashboard KPI reads 12,
  not 8; and assert a zero-quantity part with a reorder point appears in both views with matching
  counts.

### `RPT-003` · P2 · Dashboard — revenue grouped by customer **name** instead of id

- **Description:** `topClients` keys its aggregation map on `invoice.partyName || "Unknown"`.
- **Actual:** Renaming a customer splits their history into two rows; two distinct customers with the same name are merged into one. Invoices whose `partyName` is blank collapse into a single "Unknown" bucket.
- **Expected:** Group by `partyId` and resolve the display name from `parties`.
- **Evidence:** `src/routes/index.tsx:134-145`.
- **Reproduction:** Rename a client with existing paid invoices; they now appear twice in "Top clients".
- **Business impact:** Your best-customer ranking is wrong after any rename — and renames are routine (adding "SARL", fixing spelling).
- **Relevant files:** `src/routes/index.tsx`.
- **Recommended fix:** Aggregate by `partyId`, falling back to a normalised name only for legacy records with no id.
- **Regression test:** Rename a client and assert "Top clients" still shows one row with the combined total.

### `RPT-004` · P2 · Reports — date handling mixes local-time bucketing with raw string slicing

- **Description:** Monthly buckets are built from `new Date()` in the **browser's local timezone**, but assigned by slicing the stored date **string** (`receipt.date.slice(0, 7)`). The P&L filter compares `YYYY-MM-DD` strings with `>=` / `<=`.
- **Actual:** Bucket keys and record keys are derived from two different time bases. A document stored with a UTC timestamp near a month boundary can be attributed to the wrong month for an operator in a non-UTC zone. There is no timezone normalisation anywhere.
- **Expected:** One explicit business timezone; all bucketing and range filtering performed in it.
- **Evidence:** `src/routes/index.tsx:114-132` (bucket construction and `slice(0,7)`), `:256` (`inRange` string comparison).
- **Reproduction:** Create a receipt at 23:30 local on the last day of a month in a UTC+3 zone; check which month it lands in on the dashboard versus in the P&L.
- **Business impact:** Month-end figures can be misstated, and the dashboard and P&L can disagree on the same records — a real problem at reporting boundaries.
- **Relevant files:** `src/routes/index.tsx`, `src/lib/ar-statement.ts`.
- **Recommended fix:** Store timestamps as UTC ISO, define the business timezone in `prefs`, and convert once at the reporting boundary.
- **Regression test:** Fixtures either side of a month boundary in a non-UTC zone; assert consistent attribution across dashboard, P&L, and AR aging.

### `DAT-001` · P1 · Architecture — no transactional integrity or database-enforced constraints

- **Description:** All live business data is held in twelve JSONB blobs. There are no foreign keys, unique constraints, check constraints, triggers, transactions, or row-level locks on any of it.
- **Actual:** Multi-step business operations (deduct stock → create invoice → write order) are a sequence of independent client-side mutations to different blobs, each saved independently on a 400 ms debounce. A failure or refresh part-way through leaves a permanently inconsistent state. Concurrent edits are reconciled by a hand-written JSON merge whose per-field rules (numeric deltas for `quantity`/`reorderAt`, last-writer-wins elsewhere) are the only thing standing between two devices and data loss.
- **Expected:** Multi-step operations are atomic; invariants (unique part numbers, unique document ids, no orphan receipts, no dangling `partId`) are enforced by the database.
- **Evidence:** `supabase/migrations/20260719123000_online_shop_state.sql` (`key`/`value`/`updated_at` only); `src/lib/cloud-store.ts` (whole-blob upsert with `updated_at` optimistic concurrency); `src/lib/shop-state-merge.ts` (hand-written three-way merge); zero constraints beyond the `key` primary key.
- **Reproduction:** Begin a conversion and kill the tab between the stock deduction and the document save (`STK-001`); the stock change persists with no invoice.
- **Business impact:** This is the **root cause** of `FIN-001`, `STK-001`, `STK-004`, `STK-006`, `FUN-003`, `PERF-002`, and `PERF-003`. Each can be patched individually in client code, but the class of defect will keep recurring while the data model provides no invariants.
- **Relevant files:** `supabase/migrations/*`, `src/lib/cloud-store.ts`, `src/lib/shop-state-merge.ts`, all of `src/components/app/*-context.tsx`.
- **Recommended fix:** See Stage 6 in §19 — normalise the high-value collections into real tables, or at minimum move conversion, payment, and stock movement into server-side Postgres functions so they become atomic.
- **Regression test:** Interrupt each multi-step flow mid-way and assert no partial state persists; two-client integration tests asserting no lost writes.

---

## 12. Design and responsive issues

**This section is backed by browser measurements, not source reading.** I drove headless Chrome over
the DevTools Protocol against the local production build, unlocked the operator gate, and walked
**26 routes × 375 / 768 / 1440 px = 79 samples**, capturing a full-page screenshot of each (83
screenshots) plus, for every sample, measured layout geometry, colour contrast, accessible names,
heading structure, tap-target sizes, font scale, and console errors. Keyboard navigation, focus
rings, dialog behaviour, destructive-action confirmations, offline state, and the mobile navigation
drawer were then exercised with real key and click events.

> **Note on evidence artifacts.** The harness, raw JSON, and screenshots were written to a scratch
> directory (`/tmp/ux-audit/`) on the audit VM, which does not persist beyond the run. Every
> measurement is therefore reproduced inline below — ratios, pixel counts, tab-stop indices, element
> selectors — so each finding stands on its own without the file. Where a screenshot is named it
> records which sample the measurement came from, not a file you can open today.

One correction worth stating, because it changes what this section claims: my first contrast pass
reported **zero** failures. That was a false negative — this theme declares its colours in `oklch()`
and the probe only parsed `rgb()`. Re-running with every colour resolved to real sRGB (painted to a
canvas and read back) found systematic failures on the accent colour and on every control border.
The numbers below are from the corrected pass.

### What the running application gets right ✅

| Item | Measured result |
|---|---|
| **No page-level horizontal scroll** | `document.scrollWidth == innerWidth` on **all 26 routes at all three widths**. Zero sideways page scroll. |
| **Focus indicators exist** | Every focusable element receives `box-shadow: <accent> 0 0 0 2px` and correctly matches `:focus-visible`. |
| **Dialog behaviour is correct** | "Add part" modal: `role="dialog"`, `aria-labelledby` + `aria-describedby` present, focus moves into the dialog and lands on the first field, **focus trap held across 30 consecutive Tab presses**, Escape closes it, focus returns to the opener, body scroll is restored, and the dialog scrolls internally when taller than the viewport. All 14 fields have real `<label>` elements; numeric fields set `inputMode="numeric"`/`"decimal"`. |
| **Destructive confirmation is well built** | Client delete opens `role="alertdialog"`, default focus is on **Cancel**, and Delete carries destructive styling. Cancelling left the record intact. |
| **Offline behaviour works** | With the network forced offline, `/documents` showed "You are offline — Working from the last cached shop data. Edits save on this device until you reconnect." and the banner cleared automatically on reconnect. |
| **Bottom navigation does not cover content** | `mobile-nav-pad` applies `padding-bottom: 60px` below 768 px. Scrolled to the very bottom of `/clients`, `/documents`, `/shift`, and `/suppliers` at 375 px, **no** content element was overlapped by the fixed nav. |
| **Mobile drawer** | 320 px sheet over a 375 px viewport, 21 links, all fitting without inner scroll, has an accessible name, closes on Escape. |
| **Hamburger target size on phones** | 44 × 44 px at 375 px — meets the 44 px guideline. |
| **Zoom is not blocked** | `viewport` meta is `width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5` — pinch-zoom up to 5× is allowed. |
| **Document structure** | `<html lang="en">` on every route; a distinct, meaningful `<title>` per route (21 distinct titles); an `<h1>` on **27/27** samples; **zero** duplicate DOM ids; **zero** `<img>` without `alt`. |
| **404 handling** | An unknown route renders a proper "404 / Page not found / The page you're looking for doesn't exist or has been moved / Go home". |
| **Desktop layout** | At 1440 px, **0** elements overflow their container on any route except `/inventory` (which has a deliberate horizontal scroller). |

#### The accessibility tree as a screen reader sees it ✅

The checklist previously carried "screen-reader announcement order and phrasing" as NOT VERIFIED. No
screen reader was run — that remains true and no claim is made about phrasing — but Chrome's own
accessibility tree, which is the tree AT products consume, was captured in full
(`Accessibility.getFullAXTree`) on seven routes and audited structurally:

| Route | AX nodes | Interactive nodes | Unnamed interactive | `<h1>` | `main` landmark | Heading skips |
|---|---|---|---|---|---|---|
| `/` | 833 | — | **0** | ✅ | ✅ | none |
| `/inventory` | 1,138 | — | **0** | ✅ | ✅ | none |
| `/documents` | 339 | — | **0** | ✅ | ✅ | none |
| `/clients` | 324 | — | **0** | ✅ | ✅ | `h1 → h3` |
| `/insights` | 555 | — | **0** | ✅ | ✅ | none |
| `/daily-close` | 272 | — | **0** | ✅ | ✅ | none |
| `/counter` | 185 | — | **0** | ✅ | ✅ | none |

Every button, link, textbox, combobox, checkbox, tab, and menu item on all seven routes resolves to
a non-empty accessible name — there are no anonymous controls for a screen reader to read out as
"button". Note this does not contradict `UX-013`: Chrome falls back to the placeholder when no label
exists, so those inputs do get *a* name, just a fragile one. The single `h1 → h3` skip on `/clients`
is the `UX-014` instance.

**Focus visibility, measured by pixels rather than by CSS.** A computed-style check is unreliable
here because Tailwind paints the ring through `box-shadow`, so each control was screenshotted
unfocused, focused via a real keyboard path, and screenshotted again. The sidebar link changed 9.2%
of its pixels, a primary button 6.2%, and the search input 3.9% — all clearly visible amber rings.
Focus is genuinely visible (WCAG 2.4.7 is met); `UX-011` is about the ring's *contrast ratio*, which
is a separate and still-open question.

**What the tree confirms is missing** is error state. Submitting the *Add client* dialog empty was
correctly rejected — the dialog stayed open and no client was created — but the AX tree afterwards
contained **zero** `alert` nodes, **zero** nodes with `aria-invalid`, and **zero** nodes with
`aria-required`, and none of the seven inputs carried `required`, `aria-invalid`, or
`aria-describedby`. The only feedback was the toast "Enter a client name" in the polite
notifications region, which names the problem but is not associated with the field and does not
move focus. This is a second confirmed instance of `UX-007`, on a different form from the one
originally measured. Evidence: `/tmp/pv-audit3/results/a11y.json`, `a11y2.json`, `focus-pixels.json`.

### `UX-002` · **P0** · `/portal` — the customer-facing client portal crashes on every load

> **Priority raised from P1 to P0 in the second runtime pass.** The first pass confirmed the crash
> without a valid token, which left open the possibility that a correctly-tokenised link worked. A
> seeded client with a valid, unexpired `portalToken` was then requested directly, and it crashes
> identically. The feature has no working path at all, on the only surface this business exposes to
> its customers, so it is no longer a degraded feature — it is a total failure of a customer-facing
> function that also leaks internal developer text to that customer.

- **Description:** The client portal — the only externally-shared page, sent to customers as a tokenised account link — throws a React context error and renders the generic error boundary instead of the account statement.
- **Actual:** Every load at every width shows **"This page didn't load / Something went wrong on our end"** with the raw developer string **`useCart must be used within CartProvider`** printed on screen. No statement, no invoices, no quotations.
- **Expected:** The portal renders the client's aging summary, open invoices, and open quotations; or, for a bad link, the intended "This portal link is invalid or expired" message.
- **Root cause:** `portal.tsx` renders `<PageHeader>` in **all four** of its render branches (missing-link, loading, error, and success). `PageHeader` calls `useCart()` at `page-header.tsx:22` — and also `useSearch()` at `page-header.tsx:9`, so restoring only `CartProvider` would move the crash rather than fix it. `__root.tsx:176-180` deliberately — and correctly — renders the portal *outside* every provider (`isPortal ? <><Outlet /><Toaster /></> : …`), so the hook has no provider and throws. The failure is unconditional and independent of token validity.
- **Evidence:** Reproduced at 375, 768, and 1440 px against the local production build, and **confirmed on the live deployment** at `https://partsvillageapp.vercel.app/portal`. The production check was a read-only GET with **no token**, so the page short-circuits before any data fetch — the request log showed no Supabase call of any kind, only static assets. Console: `Error: useCart must be used within CartProvider`.

  Re-measured in the second runtime pass against a seeded client holding a valid token
  (`portalToken` set, `portalTokenExpiresAt` 30 days out). All four requests produced a body of
  exactly **158 characters** — the error boundary — and `h1` of **"This page didn't load"**:

  | Request | Width | `h1` | Error boundary | Client name rendered |
  |---|---|---|---|---|
  | `/portal` (no token) | 375 px | This page didn't load | yes | no |
  | `/portal` (no token) | 768 px | This page didn't load | yes | no |
  | `/portal` (no token) | 1440 px | This page didn't load | yes | no |
  | `/portal?client=cl-alpha&token=…` **(valid)** | 1440 px | This page didn't load | yes | **no** |

- **Reproduction:** Open `https://partsvillageapp.vercel.app/portal` in any browser. With no token, an invalid token, or a **valid** token, the error boundary renders.
- **Business impact:** Every customer who clicks their account link sees a broken page, and the internal React error text is shown to an external party. `SEC-004` already notes portal tokens travel in the URL; this finding means the feature they unlock does not work at all. Two features that depend on it — "Send account link" and the AR chase workflow — cannot deliver value.
- **Relevant files:** `src/routes/portal.tsx` (all four returns), `src/components/app/page-header.tsx:22`, `src/routes/__root.tsx:176-180`.
- **Recommended fix:** Give the portal its own lightweight header instead of the operator `PageHeader`, or split the cart-dependent part of `PageHeader` into a separate component that the portal does not render. Also stop rendering raw `error.message` in the error boundary for externally reachable routes.
- **Regression test:** Render `/portal` with no params, an invalid token, and a valid token, and assert the error boundary is absent in all three. Add a smoke check that no route outside `CartProvider` imports `PageHeader`.

### `UX-003` · **P2** · Content wider than its container is clipped and permanently unreachable

- **Description:** `overflow-x: clip` is applied at the page-container level, so anything wider than the container is cut off with **no scrollbar and no way to reach it** — not by page scroll, not by dragging, not by any scrollable ancestor.

> **Magnitude corrected in the second runtime pass.** The first pass reported 991 px lost on
> `/stock-map` and six affected route/width combinations. A full re-measurement — 21 operator routes
> × 3 widths = **63 samples**, walking every element and attempting a real programmatic scroll on
> each clipping ancestor — puts the true figure lower and the scope narrower. The mechanism is
> exactly as originally described; the numbers below supersede the earlier ones.

- **Actual:** Of 63 samples, **0** make the document itself scroll sideways (so the original goal of
  commit `2562f87` is met), **60** clip content inside some container, but only **3** clip content
  that is genuinely unreachable. The other 57 are Tailwind `truncate` elements
  (`overflow-x: hidden` + ellipsis) — intended text truncation, still programmatically scrollable,
  and not defects. The three real cases:

  | Route | Width | Unreachable | `overflow-x` | Clipping container |
  |---|---|---|---|---|
  | `/` (dashboard) | 375 px | **237 px** | `clip` | `div.flex-1.space-y-6.p-4.md:p-6` |
  | `/stock-map` | 375 px | **230 px** | `clip` | `div.flex-1.space-y-4.p-4.md:p-6` |
  | `/reorder` | 768 px | **159 px** | `clip` | page container |

  The distinguishing test is scrollability, not width: on these three the container reports
  `scrollWidth - clientWidth > 0` while `scrollLeft` refuses to move, which is the defining
  behaviour of `clip` as opposed to `hidden`. On all 57 `truncate` elements `scrollLeft` moves.
- **Expected:** Either the content reflows to fit, or the container scrolls horizontally so the content stays reachable.
- **Evidence:** For each case the full ancestor chain was walked and a programmatic `scrollLeft` attempted on every clipping ancestor; all refused to move. Example for `/documents` at 768 px — the chain from the clipped cell up to `<body>` is `table (overflow-x: visible) → div.relative.w-full.max-w-full.overflow-x-clip → div.p-0 → div.rounded-xl.border → main.flex-1 (clip) → main.relative (clip) → div.flex.min-h-dvh (clip) → body (clip)`; `pageScrolled: false, ancestorScrolled: false`.
- **Reproduction:** Open `/stock-map` at exactly 375 px wide. 230 px of shelf/bin content sits past the right edge with no scrollbar and cannot be scrolled to by any means.
- **Business impact:** Worse than a cosmetic overflow, though narrower than first reported. On `/stock-map` at phone width — the primary device for warehouse work — 230 px of shelf data is invisible, and because there is no scrollbar nothing indicates data is missing, so a partial reading looks like a complete one. The dashboard case hides the right-hand columns of the "Recent invoices" and "Low Stock" cards at phone width. `/documents` and `/counter`, named in the first pass, are **not** affected: their overflow is `hidden` on `truncate` elements and remains reachable.
- **Root cause note:** Commit `2562f87` ("Stop sideways page scrolling — stack tables and clip overflow on phones") removed the sideways-scroll symptom by switching to `clip`. `clip` differs from `hidden` in that it also disables programmatic scrolling, so the fix converted a visible annoyance into silent data loss on screen.
- **Relevant files:** `src/routes/__root.tsx:195,197`, `src/styles.css:200-204` (`.no-x-scroll`), `src/components/ui/table.tsx` (the `overflow-x-clip` wrapper), `src/routes/stock-map.tsx`, `src/routes/index.tsx`, `src/routes/reorder.tsx`.
- **Recommended fix:** Replace `overflow-x: clip` with `overflow-x: auto` on the *table/card wrappers* so wide content scrolls inside its own card, and keep the page itself from scrolling by constraining those wrappers to `max-width: 100%`. That gets the original goal (no sideways page scroll) without amputating content. For `/stock-map`, the card grid needs `min-w-0` on its items so they can shrink.
- **Regression test:** For each route at 375/768/1440, assert that no visible element's `getBoundingClientRect().right` exceeds its nearest scrollable-or-clipping ancestor's right edge; where it does, assert that ancestor can actually scroll.

### `UX-004` · **P2** · At 768 px the table layout expands at the exact width the sidebar takes 256 px

- **Description:** Two responsive decisions collide at the `md` (768 px) breakpoint. Below it, tables collapse to stacked cards and the sidebar is off-canvas. At and above it, tables render as real multi-column tables **and** the sidebar becomes permanently pinned at 256 px. So the table switches to its widest layout at the moment the content area shrinks to its narrowest usable value.
- **Actual:** At 768 px the content area is **512 px** (`main` starts at x=256). A `/documents` table needing 647 px and a `/reorder` table needing 705 px are squeezed into it. On `/documents` the effect is severe: the Parts column collapses to roughly 30 px, so every part number wraps onto its own line and a single quotation row becomes about 1000 px tall (one row listed AS568-100 through AS568-141 vertically).
- **Expected:** The content area should not be at its narrowest when the layout is at its widest. Either the sidebar should stay off-canvas until ~1024 px, or the table breakpoint should move up.
- **Evidence:** Measured `main` geometry per width: 375 px → content 375 px at x=0 (sidebar off-canvas); 768 px → content **512 px** at x=256; 1024 px → 768 px at x=256; 1440 px → 1184 px at x=256. Clipped-element counts on `/documents` at 768 px: **23**.
- **Workaround (verified):** Collapsing the sidebar with the toggle restores the content area to **720 px** and fixes it — `/documents` goes from 23 clipped elements to **0**, `/reorder` from 120 to 9 (worst residual overhang 10 px). This is what keeps the finding at P2 rather than P1. The operator has to know to do it, and the sidebar reopens by default.
- **Business impact:** Tablet portrait is a natural device for a parts counter. In that posture the documents list is both unreadable and unusable until the sidebar is manually collapsed.
- **Relevant files:** `src/components/ui/sidebar.tsx` (the `md:` pinning breakpoint), `src/components/ui/table.tsx` (`max-md:block` stacking), `src/routes/documents.tsx`, `src/routes/reorder.tsx`.
- **Recommended fix:** Move the sidebar's pinned breakpoint to `lg` (1024 px) so tablets get the off-canvas drawer and the full content width, or default the sidebar to collapsed between 768 px and 1024 px.
- **Regression test:** Assert the content area is at least ~700 px wide at every width where tables render un-stacked.

### `UX-005` · **P2** · The accent colour used for the most important financial figures fails WCAG AA

- **Description:** `--accent: oklch(0.72 0.19 48)` resolves to `rgb(255, 119, 22)`. Used as *text* on the app's white and near-white surfaces it measures **2.66:1** on `#ffffff` and **2.52:1** on the page background `rgb(247,249,250)`. WCAG 2.1 AA requires 4.5:1 for normal text and 3:1 for large text; these fail both.
- **Actual:** Measured failures, all of which are money or stock figures — the numbers the operator most needs to read accurately:

  | Route | Element | Ratio | Needs |
  |---|---|---|---|
  | `/clients/cl-alpha` | Client balance `$926.87` (16 px bold) | 2.66:1 | 4.5 |
  | `/insights` | Margin `$7,499,985.00` (14 px 600) | 2.66:1 | 4.5 |
  | `/insights` | `Open` status label (12 px) | 2.66:1 | 4.5 |
  | `/inventory` | Low-stock quantity (12 px 600) | 2.66:1 | 4.5 |
  | `/` (dashboard) | Accent KPI figure (14 px bold) | 2.52:1 | 4.5 |
  | `/clients` | `Owes $926.87` badge, `rgb(187,77,0)` on `rgb(255,240,217)` | 4.48:1 | 4.5 |

- **Expected:** At least 4.5:1 for these figures.
- **Evidence:** Corrected contrast pass over 23 routes at 375 px and 1440 px, 198–3260 text nodes measured per route, every colour resolved to sRGB by canvas paint. Note the theme is otherwise clean: `foreground`/`muted-foreground` on the standard surfaces pass, and most routes have **zero** text failures.
- **Business impact:** A parts counter is a bright, often sunlit environment and the app is used on phones. The single least legible colour in the palette is reserved for balances due and margins. Misreading those has direct financial consequence.
- **Relevant files:** `src/styles.css` (the `--accent` token), `src/routes/clients.$clientId.tsx`, `src/routes/insights.tsx`, `src/routes/index.tsx`, `src/components/app/*` using `text-accent`.
- **Recommended fix:** Keep `oklch(0.72 0.19 48)` for fills and borders where it works, and add a darker text-only variant (roughly `oklch(0.52 0.17 48)` reaches ~4.6:1 on white) bound to a `--accent-text` token used wherever the accent is applied to type.
- **Regression test:** A contrast assertion over the rendered theme that fails the build if any text token pair drops below 4.5:1 (3:1 for large text).

### `UX-006` · **P2** · Every input, button, and card border fails non-text contrast

- **Description:** `--border: oklch(0.9 0.01 250)` measures **1.27:1** against the page background, **1.28:1** against the banner background, and **1.34:1** against white cards. WCAG 2.1 AA (1.4.11 Non-text Contrast) requires **3:1** for the visual boundary of a UI component.
- **Actual:** Applies to `input`, `button`, `table`, `article`, and card borders across **23 routes** — effectively the whole application. Two accent-tinted borders at 40% alpha also fail (1.35:1 and 1.46:1). The only passing border measured was the primary button's own dark border at 14.65:1.
- **Expected:** ≥ 3:1 so field and control edges are perceivable.
- **Evidence:** Non-text contrast pass identified 13 distinct failing pairs. Visible in the "Add part" dialog sample, where the 14 field outlines are barely distinguishable from the dialog surface.
- **Business impact:** Form fields do not visually read as fields. On a phone in daylight, the operator cannot see where an input begins — which matters most on the numeric quantity and price fields.
- **Relevant files:** `src/styles.css` (`--border`, `--input`), `src/components/ui/input.tsx`, `src/components/ui/card.tsx`.
- **Recommended fix:** Darken the interactive border token to roughly `oklch(0.72 0.02 250)` (~3:1 on white) for inputs and controls; the lighter value is acceptable for purely decorative dividers.
- **Regression test:** Extend the contrast assertion above to cover `--border`/`--input` against `--background` and `--card`.

### `UX-007` · **P2** · Form validation is a transient toast with no inline error and no focus move

- **Description:** Submitting the 14-field "Add part" dialog with every field empty produces no inline validation of any kind.
- **Actual:** The dialog stays open; `aria-invalid` is set on nothing; no field is marked or highlighted; focus does not move; **no `required` attribute exists on any of the 14 fields**. The only feedback is a Sonner toast reading "Primary part number is required", which disappears on its own. On a form that scrolls internally, the offending field may not even be on screen when the toast appears.
- **Expected:** The invalid field is marked (`aria-invalid`, visible message adjacent to the field), focus moves to it, and the message persists until corrected.
- **Evidence:** Measured after a real click on **Create** with an empty form: `{ dialogStillOpen: true, inlineErrors: [], firstInvalidFocused: null, toasts: ["Primary part number is required"] }`. Field inventory confirms `required: false` on all 14.
- **Confirmed on a second form.** The *Add client* dialog behaves identically: clicking **Create client** with every field empty was correctly rejected (dialog stayed open, no client created), but the accessibility tree afterwards held **zero** `alert` nodes, **zero** nodes with `aria-invalid`, and **zero** nodes with `aria-required`, and none of its seven inputs carried `required` or `aria-describedby`. The sole feedback was the toast "Enter a client name" in the polite notifications region. The visible `Name *` marker is decoration — it is never exposed programmatically. Harness: `/tmp/pv-audit3/results/a11y2.json`.
- **Business impact:** WCAG 3.3.1 (Error Identification) and 3.3.2 (Labels or Instructions) are not met. Practically, the operator is told something is wrong but not where, and the notice vanishes.
- **Relevant files:** `src/components/app/part-detail-dialog.tsx`, `src/components/app/party-form-dialog.tsx`, and the other `*-dialog.tsx` forms (the project already depends on `react-hook-form` + `@hookform/resolvers` + `zod`, which are not used for this).
- **Recommended fix:** Wire these dialogs to the `react-hook-form` + `zod` stack already installed, and render `FormMessage` per field. Keep the toast as a summary if desired.
- **Regression test:** Submit each dialog empty and assert an inline message exists, `aria-invalid="true"` is set, and `document.activeElement` is the first invalid field.

### `UX-008` · **P2** · The stacked mobile table view drops all column labels

- **Description:** Below 768 px, tables switch from rows to stacked cards by hiding `thead` (`max-md:hidden`) — but the cells carry no substitute label, so the values stack with nothing identifying them.
- **Actual:** On `/documents` at 375 px a quotation renders as an unlabelled column of values: `Q-20260904-100000000-q001`, `Alpha Earthmoving SARL`, `2026-09-04`, a long run of part numbers, `$9,627.94`, a `Sent` dropdown, `Open`. Nothing says which is the date, which is the total, or what the number list is. The parts run is also cut mid-list with no ellipsis or "+38 more".
- **Expected:** Each value carries its field label in the stacked view, as the desktop header provides.
- **Evidence:** The 375 px `/documents` sample versus the 1440 px one, which shows the intended `# / Client / Date / Parts / Total / Status` headers. Affects every route using the shared stacked-table pattern (`/documents`, `/reorder`, `/collections`, `/insights`, `/pre-orders`, `/clients/$clientId`).
- **Business impact:** The phone is the primary device. An unlabelled stack of a document id, a date, and two numbers invites misreading a total as something else.
- **Relevant files:** `src/components/ui/table.tsx` (`max-md:block` / `max-md:hidden` classes), and each route's `TableCell` usage.
- **Recommended fix:** Emit a `data-label` on each `TableCell` and render it via `::before` in the stacked breakpoint, or give the mobile breakpoint a purpose-built card with explicit labels.
- **Regression test:** At 375 px assert every stacked cell has a non-empty visible label.

### `UX-009` · **P2** · No skip link, and 23 sidebar tab stops before reaching page content

- **Description:** Keyboard users must traverse the entire sidebar on every page before reaching the page itself.
- **Actual:** Measured with real Tab key events from a fresh load with no prior mouse click (a click moves the sequential focus navigation starting point and would understate the count). Stops **1–23 are all sidebar controls** — 21 page links plus `Backup` and `Lock` — so the first non-navigation stop is **24**. There is **no** skip link: `document.querySelectorAll("a[href^='#']")` returns an empty list on every route. The same 23 stops are re-traversed on every navigation.
- **Expected:** A "Skip to main content" link as the first focusable element.
- **Evidence:** Full tab trail recorded identically on `/`, `/inventory`, and `/documents`: `1:Dashboard … 23:Lock`, then `24:Later` and `25:Backup now` (the backup reminder, `UX-018`), then `26:Toggle Sidebar` — the first genuine page control. With the reminder dismissed, the first non-navigation stop is 24. Harness: `/tmp/pv-audit3/results/tabcount2.json`. An earlier pass recorded this as "tab stop 23"; the precise figure is 23 sidebar stops with the first non-navigation stop at 24.
- **Business impact:** WCAG 2.4.1 (Bypass Blocks). For a single-operator app this is efficiency rather than access, but it makes keyboard-only operation of the counter impractical.
- **Relevant files:** `src/routes/__root.tsx` (add the link before `<AppSidebar />`), `src/components/app/app-sidebar.tsx`.
- **Recommended fix:** Add a visually-hidden-until-focused `<a href="#main-content">Skip to main content</a>` as the first child of the layout, and `id="main-content"` on `SidebarInset`.
- **Regression test:** Assert the first Tab from a fresh load focuses the skip link, and activating it moves focus into `<main>`.

### `UX-010` · P3 · Controls are 32 px tall, below the 44 px touch guideline, and one is 16 px

- **Description:** The default control height is 32 px, which is under the 44 px target recommended for touch. A few controls are below even the WCAG 2.5.8 minimum of 24 × 24.
- **Actual:** At 1440 px the dominant button geometry is 32 px tall (495 instances). At 375 px, `/low-stock` has **416 of 424** interactive elements under 40 × 40, `/labels` 84 of 92, `/inventory` 26 of 106. Most are 32 px-tall buttons — acceptable under WCAG 2.5.8's 24 px floor but below the 44 px comfort guideline. The genuine failures are the **16 × 16 px** row-toggle buttons in the `/labels` table, which are under the 24 px minimum.
- **Expected:** 44 × 44 for primary touch targets; never below 24 × 24.
- **Evidence:** Tap-target census across all samples. Positive note: the mobile hamburger is correctly 44 × 44, and the bottom-nav items are 75 × 56.
- **Business impact:** The app is used on a phone in a workshop, plausibly with gloves or dirty hands. 16 px checkboxes on the label-printing table will be mis-tapped.
- **Relevant files:** `src/components/ui/button.tsx` (size variants), `src/routes/labels.tsx`.
- **Recommended fix:** Raise the 16 px toggles to at least 24 px with a 44 px hit area via padding, and consider a touch-sized variant for the phone breakpoint.
- **Regression test:** At 375 px assert no interactive element is smaller than 24 × 24.

### `UX-011` · P3 · The focus ring is the accent orange at 2.51:1, and its width is inconsistent

- **Description:** Focus indicators are present and correct in behaviour but marginal in visibility.
- **Actual:** The ring is `box-shadow: oklch(0.72 0.19 48) 0 0 0 Npx` — the same orange as `UX-005`, measuring **2.51:1** against the page background where WCAG 2.4.11 requires 3:1. Width is **2 px** on sidebar links but **1 px** on in-content controls.
- **Expected:** ≥ 3:1 against the adjacent background, at a consistent width of at least 2 px.
- **Evidence:** Computed `box-shadow` captured for a sidebar link (2 px) and the first main-content button (1 px). The 2.51:1 figure is the measured accent-on-background pair from the contrast pass.
- **Relevant files:** `src/styles.css` (`--ring`), `src/components/ui/button.tsx`, `src/components/ui/sidebar.tsx`.
- **Recommended fix:** Darken `--ring` to meet 3:1 and standardise on a 2 px ring with a 2 px offset.
- **Regression test:** Assert `--ring` against `--background` and `--card` is ≥ 3:1, and that ring width is uniform.

### `UX-012` · P3 · Body text is 12 px, with 10–11 px secondary labels

- **Description:** The typographic scale is small for a desktop business application and for a phone used at arm's length.
- **Actual:** Font-size census across all routes at 1440 px: **12 px is the dominant body size (3,863 nodes)**, then 14 px (2,253), then 10 px (335) and 11 px (169). 16 px appears 157 times, 24 px only 11. Specific 10–11 px cases: bottom-nav labels (`Home`, `Counter`, `Stock`) at 11 px, the inventory `Low` badge at 10 px, `Reorder at 2` on `/low-stock` at 11 px, `Qty` label at 10 px, `credit −$75.00` on `/clients` at 11 px, `Invoice AR $1,001.87` on `/clients/cl-alpha` at 11 px, `Partial pickup` and the part-number line on `/delivery-board` at 10–11 px.
- **Expected:** 14–16 px body text; 12 px as the floor for secondary text.
- **Evidence:** Font-size census over the full sweep. Zoom is not blocked (`maximum-scale=5`), which mitigates this.
- **Relevant files:** `src/styles.css`, `src/components/app/mobile-bottom-nav.tsx`, `src/routes/low-stock.tsx`, `src/routes/delivery-board.tsx`.
- **Recommended fix:** Shift the scale up one step (body 14 px, secondary 12 px) and remove the `text-[10px]` and `text-[11px]` one-offs.
- **Regression test:** Assert no rendered text node computes below 12 px.

### `UX-013` · P3 · Five search and date inputs have no accessible name

- **Description:** Several inputs are identifiable only by placeholder, and one has nothing at all.
- **Actual:** With no `<label>`, `aria-label`, `aria-labelledby`, or `title`: a bare `type="date"` input; `Find location or part #…` (`/stock-map`); `Search part #, name, box…` (`/labels`); `Part # or OEM #` (`/counter`); `Serial, make, model, or client…` (`/fleet`). A further five rely on placeholder text alone, including the global `Search part #, serial #, or client…` used on `/`, `/inventory`, `/low-stock`, `/stock-map`, `/stock-take`, and `/reorder`.
- **Expected:** A programmatic name on every field; placeholders should not be the only label, since they vanish on input.
- **Evidence:** Accessible-name census across all samples. For contrast, the "Add part" dialog does this correctly — all 14 fields have real `<label>` elements.
- **Relevant files:** `src/components/app/search-context.tsx`, `src/routes/stock-map.tsx`, `src/routes/labels.tsx`, `src/routes/counter.tsx`, `src/routes/fleet.tsx`.
- **Recommended fix:** Add `aria-label` to the icon-only search fields and a visible `<Label>` to the date input.
- **Regression test:** Assert every rendered form control has a non-empty accessible name.

### `UX-014` · P3 · Heading levels skip from `h1` to `h3`

- **Description:** The list pages jump a heading level.
- **Actual:** On `/clients` and `/suppliers` at all three widths, the page `h1` is followed directly by `h3` for each record name (`Alpha Earthmoving SARL`, `Ningbo Fluid Power Co., Ltd`) with no intervening `h2`.
- **Expected:** No skipped levels (WCAG 1.3.1 / 2.4.10).
- **Evidence:** Heading-structure census — 6 affected samples. Every other route's heading order is clean, and all 27 samples have an `h1`.
- **Relevant files:** `src/routes/clients.index.tsx`, `src/routes/suppliers.index.tsx`.
- **Recommended fix:** Use `h2` for record cards, or add a section `h2` above the list.
- **Regression test:** Assert heading levels never increase by more than one.

### `UX-015` · P3 · Modal background is not hidden from assistive technology

- **Description:** The modal traps keyboard focus and blocks the mouse, but does not mark the background as inert for screen readers.
- **Actual:** With the "Add part" dialog open, the dialog has **no `aria-modal`**, and the app shell (`div.group/sidebar-wrapper`, which holds the sidebar and all page content) has **neither `aria-hidden` nor `inert`**. `body` does get `pointer-events: none`, and the overlay is `aria-hidden="true"`.
- **Expected:** `aria-modal="true"` on the dialog, or `aria-hidden`/`inert` on the background, so a screen reader in browse mode cannot wander behind the modal.
- **Evidence:** `body` children snapshot with the dialog open: shell div `ariaHidden: null, inert: false`; dialog container `ariaHidden: null`; `aria-modal: null`. Keyboard containment was separately verified working across 30 tabs, so this is a browse-mode gap only.
- **Relevant files:** `src/components/ui/dialog.tsx`.
- **Recommended fix:** Set `aria-modal="true"` on `DialogContent` (or upgrade to a Radix version that applies `inert` to siblings).
- **Regression test:** With a dialog open, assert the app shell is `aria-hidden` or `inert`.

### `UX-016` · P3 · Date and money formatting are inconsistent across the app

- **Description:** Two date styles and two money formatters coexist.
- **Actual:** Dates render as raw ISO `YYYY-MM-DD` almost everywhere (`2026-09-06`, `2026-09-04`, 12 distinct values observed) because stored strings are printed directly. The exception is the backup reminder banner, which renders a browser-locale date — observed as `10/21/2026` on `/low-stock` — via `toLocaleString(undefined, …)`. Three PDF builders use a third style (`toLocaleDateString()` / `toLocaleString()` with no locale). Separately, two money formatters exist: `currency()` (`mock-data.ts:184`) forces exactly 2 decimals, while `formatMoneyWithUsd()` (`fx.ts:18`) sets `maximumFractionDigits: 2` with **no minimum**, so it renders `$55` rather than `$55.00`.
- **Expected:** One date formatter and one money formatter used everywhere.
- **Evidence:** Slash-date detection isolated to the backup banner (`span.text-xs.text-muted-foreground`, confirmed by DOM walk on `/low-stock`). Money decimal census across the sweep: 166 amounts with 2 decimals, 12 with 0. **Now confirmed on screen** (it was source-only in the first pass): with China shipments seeded, `/china-shipments` renders `$1,200` and `$69.93` **side by side on the same page** — the first through `formatMoneyWithUsd` with the cents omitted, the second only showing cents because the RMB conversion happened to produce them. Evidence: `/tmp/pv-audit2/results/routes-xss.log`, finding `R3`. Note also that `misc-inventory.ts:10,17,24,31` embeds prices as free text inside description and notes fields ("FOB cost USD 55 · Sell USD 270"), which will drift from the real price fields when either is edited.
- **Relevant files:** `src/lib/fx.ts:18`, `src/lib/mock-data.ts:184`, `src/components/app/backup-reminder-banner.tsx:29`, `src/lib/ar-statement.ts:279`, `src/lib/z-report.ts:38`, `src/lib/packing-slip.ts:32`, `src/lib/misc-inventory.ts`.
- **Recommended fix:** Export one `formatDate`/`formatMoney` pair and use them everywhere, including the PDF builders; give `formatMoneyWithUsd` a `minimumFractionDigits: 2`.
- **Regression test:** Unit-test both formatters for 0, 0.5, 55, and 1234.5; lint against direct `toLocaleString` use in components.

### `UX-017` · P3 · Button geometry is inconsistent

- **Description:** Buttons come in many unrelated sizes and corner radii.
- **Actual:** At 1440 px across all routes there are **17 distinct height/font-size/radius combinations**, spanning **11 distinct heights** (16, 20, 28, 32, 36, 38, 44, 48, 54, 86, 120 px) and **4 distinct radii** (0, 4, 6, 8 px). Two of those heights account for most instances (32 px ×495 and 20 px ×203), so the tail is a long list of one-offs — `h38`, `h44`, `h54` each appear once.
- **Expected:** A small, deliberate set of sizes from the design system.
- **Evidence:** Button-geometry census over the full sweep.
- **Relevant files:** `src/components/ui/button.tsx` and the routes that override its classes inline.
- **Recommended fix:** Restrict to the `Button` component's declared size variants and remove ad-hoc height/radius overrides.
- **Regression test:** A lint rule against `h-[…]` and `rounded-[…]` overrides on `Button`.

### `UX-018` · P3 · The "Weekly backup reminder" banner appears on every page

- **Description:** A dismissible-but-recurring banner occupies the top of every route.
- **Actual:** "Weekly backup reminder — One-click weekly backup keeps your shop recoverable without a login. No backup downloaded yet. [Later] [Backup now]" renders above the page header on all 26 routes at all three widths, and is the **first tab stop inside the content area** on every page (see `UX-009`). It is the leading text on every page for a screen reader, and on a 375 px viewport it consumes roughly 100 px of the 812 px viewport.
- **Expected:** Surface a backup reminder once per session, or as a badge on a single Backup control.
- **Evidence:** Present in every one of the 83 screenshots; on the 375 px `/documents` sample it takes about an eighth of the phone viewport.
- **Relevant files:** `src/components/app/backup-reminder-banner.tsx`, `src/routes/__root.tsx:199`.
- **Recommended fix:** Show it on the dashboard only, or once per session with a longer snooze than "Later" appears to give.
- **Regression test:** Assert the banner renders at most once per session after "Later".

### `UX-019` · P3 · Empty states are inconsistent, and some offer no way forward

- **Description:** Pages with no records vary in whether they suggest an action.
- **Actual:** `/fleet` shows "No machines yet" with **no create action anywhere on the page** — `fleet.tsx` imports `EmptyState` and no `Button` at all, so the only buttons present are the backup banner's and the sidebar toggle. Its description text does at least say where to go ("Add machines from a client page, then find them here by serial"), but there is nothing to click. `/pre-orders` and `/share-inbox` do it properly, offering "New pre-order" / "Generate Supplier Order List" and "Upload photo / PDF".
- **Correction to an earlier version of this finding.** I previously reported that `/china-shipments` also had no create action. **That was wrong.** Re-checking the source shows the "New shipment" button is rendered unconditionally in the page toolbar inside `<main>`, and the empty state even names it — "Add one when you place an order with New shipment." The second runtime pass confirmed the button is present. The first pass's button inventory on that route missed it. `/china-shipments` is therefore an example of an empty state done *correctly*, and the finding now applies to `/fleet` only.
- **Expected:** A consistent empty state: what this page is for, and the primary action to populate it.
- **Evidence:** `src/routes/fleet.tsx:64-74` (no `Button` import, no action prop on `EmptyState`); contrast `src/routes/china-shipments.tsx:279-290` (unconditional "New shipment") and `:379-399` (empty state naming it).
- **Relevant files:** `src/components/app/empty-state.tsx` (exists but is not used consistently), `src/routes/fleet.tsx`.
- **Recommended fix:** Give `/fleet` a primary action — either an "Add machine" button that opens the client picker, or a link to the client page. Consider making the `action` prop on `EmptyState` required so this cannot recur.
- **Regression test:** Assert every empty state renders a primary action.

### `UX-020` · P3 · There are no loading states anywhere

- **Description:** No skeletons or spinners appear on any page after the initial unlock.
- **Actual:** Across all 26 routes: `skeleton: 0`, `spinner: 0`. The only spinner in the application is on the operator unlock gate. This follows from the architecture — the whole dataset is loaded once as a single blob (`DAT-001`, `PERF-002`), so individual pages have nothing to wait for. The consequence is that the *first* load has no progressive feedback, and any future per-page fetch would have no pattern to follow.
- **Expected:** At least a skeleton for the initial blob load, which is the slow one.
- **Evidence:** Skeleton/spinner census over the full sweep.
- **Relevant files:** `src/components/ui/skeleton.tsx` (present, unused), `src/components/app/cloud-gate.tsx`.
- **Recommended fix:** Render skeletons in `CloudGate` while the initial state loads.
- **Regression test:** Assert a skeleton or spinner is visible while the initial load is pending.

### `UX-021` · P3 · The public portal downloads the entire internal application bundle

- **Description:** The unauthenticated, customer-facing portal pulls the operator app's internal modules.
- **Actual:** Loading `https://partsvillageapp.vercel.app/portal` with no token fetched, among others, `inventory-context`, `inventory-categories`, `hydraulic-subcategories`, `seal-subcategories`, `bearings-subcategories`, `filters-inventory`, `invoice-order-sync`, `mock-data`, `confirm-dialog`, and **`jspdf.es.min`** — 34 asset requests in total for a page that shows a read-only statement.
- **Expected:** The portal should ship only what it renders.
- **Evidence:** Full request list captured during the production portal check. No Supabase request was made, so no customer data was involved.
- **Business impact:** Wasted bandwidth on a customer's phone, and the internal catalog taxonomy is shipped to external parties. Minor disclosure rather than a breach — the modules contain code and category structure, not customer records.
- **Relevant files:** `src/routes/portal.tsx` (its imports pull `PageHeader`, which pulls the cart and inventory graph), `src/routes/__root.tsx`.
- **Recommended fix:** Fixing `UX-002` by giving the portal a standalone header removes most of this graph at the same time.
- **Regression test:** Assert the portal's asset manifest excludes inventory, cart, and PDF modules.

### `UX-001` · P3 · `dangerouslySetInnerHTML` in the chart component

- **Description:** `ChartStyle` injects a `<style>` block built from chart config colours.
- **Actual:** Colour values are interpolated into CSS without sanitisation.
- **Assessment:** **Not currently exploitable** — the config is developer-authored (this is the stock shadcn/ui chart), not user- or customer-supplied. Recorded because it becomes a CSS-injection vector the moment any chart config accepts stored data.
- **Evidence:** `src/components/ui/chart.tsx:71-90`.
- **Recommended fix:** Validate colour strings against a strict pattern before interpolation.
- **Regression test:** Assert a config colour of `red; } body { display:none } .x {` cannot escape the declaration.

---

## 13. PDF and printing issues

**This section is now backed by rendered output, not source reading.** I loaded the application's own
`buildPdf()` (`src/lib/document-export.ts`) and `downloadStatementPdf()` (`src/lib/ar-statement.ts`)
through Vite's SSR module loader — so the real code, the real money functions, and the real layout
constants — rendered 16 document fixtures plus a 350-shape sweep of AR statements, and parsed the
resulting PDF content streams to recover the position, font size, and text of every drawn string.
That makes it possible to state overflow and page-break behaviour in millimetres rather than by
inspection. The harness lives outside the repository (`/tmp/pdf-audit/`) and generated PDFs are in
`/tmp/pdf-audit/out/`.

### What the rendered output confirms is correct ✅

| Item | Result |
|---|---|
| **A4 page size** | ✅ 210 × 297 mm on every document from every builder (`MediaBox [0 0 595.28 841.89]`). |
| **Margins** | ✅ Consistent 14 mm left/right; footer rule at y = 281 mm. |
| **Repeated table headers** | ✅ Verified. A 40-line invoice renders 3 pages and the `Part # / Description / Size / Qty / Price / Total` header appears on **pages 1, 2 and 3**. |
| **Page breaks do not split rows** | ✅ No row straddles a page boundary in any fixture. |
| **Long descriptions** | ✅ A 210-character description wraps inside the auto-width column; no clipping. |
| **Long part numbers** | ✅ A 75-character part number wraps inside the fixed 28 mm column; no clipping. |
| **Special characters** | ✅ `Ø26.5×3 «Ürün» — 50% <b>test</b> & 'quote' "dq" \ / ; DROP TABLE parts;--` renders as **literal text**. No markup interpretation, no PDF-syntax escape (parentheses and backslashes are correctly escaped in the content stream). |
| **Screen total = PDF total** | ✅ Verified across no discount, 12.5% percent discount, $33.33 amount discount, discount exceeding subtotal, and a 150% discount clamped to 100%. In all five the figure produced by the app's own `documentGrandTotal()` is the exact string printed in the totals box. |
| **Zero-priced documents** | ✅ Print `TBD` rather than `$0.00`, which is the sensible choice for an un-priced quotation. |
| **Supplier inquiry without costs** | ✅ Correctly omits all money columns and prints no total. |

The screen-versus-PDF total agreement is worth calling out: it is the single most important
requirement in this section and it holds. Most defects below are **layout** defects — the numbers
are right, but on some documents they are printed where nobody can read them. The exception is
`PDF-016`, where the barcode on the part label encodes something other than the part number printed
beside it.

**The three remaining document types were rendered from the running app and parsed.** All three
were previously NOT VERIFIED:

| Document | Result |
|---|---|
| **Packing slip** (`/documents` → *Packing slip*) | ✅ 6,956 bytes, 1 page, A4 (210 × 297 mm). Carries the invoice number, date, customer, and the `Part # / Description / Box / Size / Qty / Status` grid, plus *Picked by / Checked by / Customer sign* lines. Correctly prints **no money at all** — the right choice for a warehouse document. |
| **Part label** (`/labels` → *Print*) | ⚠️ Geometry is correct: **57.0 × 32.0 mm**, 1 page, matching the stated label stock, with shop name, part number, and price (`TBD` when unpriced). The **barcode content is wrong** — see `PDF-016`. |
| **Z-report** (`/daily-close` → *Print Z-report*) | ✅ 6,180 bytes, 1 page, A4. Business day, receipt count, and a `Method / Expected / Counted / Variance` table over Cash, OMT, and Whish with a TOTAL row, plus cashier and manager signature lines. Figures matched the (empty) drawer state at the time of printing. |

Evidence: `/tmp/pv-audit3/results/pdfs.json`, `labels3.json`, `labels-seal.json`.

### `PDF-005` · **P1** · AR statement — "Net due" can be printed off the bottom of the page

- **Page/feature:** Client detail → *Download statement* (`downloadStatementPdf`).
- **Description:** The statement's closing total block is drawn at `y = finalY + 12`, then subsequent lines at `+6` each, with **no page-height check and no `addPage()`**. When the invoice table happens to end low on the page, the last line of the block is placed beyond the 297 mm page and simply never appears.
- **Actual:** With 26 open invoices and one unapplied credit note, the block renders as `Invoice total: $14,787.50` at y = 291 mm, `Unapplied credit: −$25.00` at y = 297 mm, and **`Net due: $14,762.50` at y = 303 mm — 6 mm past the bottom edge of the paper.** The customer receives a statement that lists what they were invoiced but omits what they actually owe.
- **Expected:** The total block is measured before drawing and moved to a new page if it does not fit, exactly as `buildPdf` already does for its own totals box.
- **Evidence:** `src/lib/ar-statement.ts:355-367`. Swept 350 statement shapes (1–70 invoices × {0,1,5,15,30} credit notes); **8 shapes place `Net due` off the page** — at nInv/nCred = 12/15, 22/5, 26/1, 31/30, 46/15, 56/5, 60/1, 65/30 — landing at y = 303–304 mm. Reproducer PDF: `/tmp/pdf-audit/out/ar-statement-netdue-offpage.pdf`.
- **Reproduction:** Give a client 26 open invoices and one standalone credit note (no `invoiceId`), open the client page, and download the statement. Compare the on-screen net due against the PDF.
- **Business impact:** This is the worst kind of document defect: the figure is computed correctly, the screen shows it correctly, and the customer-facing PDF silently omits it. It only triggers on the three-line branch — which is selected precisely when unapplied credits exist, i.e. exactly the statements a customer is most likely to query. A statement that shows a $14,787.50 invoice total and no net due invites either an overpayment or a dispute.
- **Relevant files:** `src/lib/ar-statement.ts`.
- **Recommended fix:** Before drawing, compute the block height (`lines × 6 + 12`) and call `pdf.addPage()` when `y + height > pageH - bottomMargin`. Better, reuse the guard already written in `document-export.ts:587-594`.
- **Regression test:** Assert that for 1–80 invoices × 0–30 credit notes, every line of the total block has `y <= pageHeight - bottomMargin`.

### `PDF-006` · P2 · Long client names escape the "Bill to" card and run across the page

- **Page/feature:** All quotation / invoice / credit-note PDFs.
- **Description:** `pdfDrawText()` accepts a `maxWidthMm` option and the call site passes one — but the function **ignores it for non-Arabic text**. The Latin branch calls `pdf.text(text, x, y)` with no `maxWidth` and no wrapping; only the Arabic branch (which renders through a canvas) honours the constraint.
- **Actual:** A 78-character client name is drawn as one unwrapped run 187.1 mm wide starting at x = 19 mm, so its right edge lands at **206.1 mm on a 210 mm page** — 10.1 mm past the 196 mm right margin and 3.9 mm from the paper edge. It overruns its own 89 mm "Bill to" card and prints straight through the "DOCUMENT" card that holds the reference and date.
- **Expected:** The name wraps or truncates within the card, as the passed `maxWidthMm` implies.
- **Evidence:** `src/lib/pdf-fonts.ts:117-119` (the early return that drops `maxWidthMm`); call site `src/lib/document-export.ts:356-360`. Measured with jsPDF's own Helvetica metrics; see `/tmp/pdf-audit/out/03-invoice-long-party-name.pdf`.
- **Reproduction:** Create a client named `Al Mashreq General Trading & Heavy Equipment Spare Parts Company SARL Offshore`, invoice them, and download the PDF.
- **Business impact:** Company names of this length are normal in the Gulf and Levant trading sector. The document looks broken to the customer, and the overlapping text can obscure the invoice reference. The bug is easy to miss in review because the call site *looks* correct — the width limit is right there in the arguments.
- **Relevant files:** `src/lib/pdf-fonts.ts`, `src/lib/document-export.ts`, `src/lib/ar-statement.ts:274-278` (same call pattern).
- **Recommended fix:** In the Latin branch, use `pdf.splitTextToSize(text, maxWidthMm)` and draw the resulting lines, or pass `{ maxWidth }` through to `pdf.text`.
- **Regression test:** Render a 78-character party name and assert every drawn run ends at or before the card's right edge.

### `PDF-007` · P2 · A long customer note prints past the footer and off the paper

- **Page/feature:** Quotation / invoice / credit-note PDFs with a customer note.
- **Description:** The note block reserves a **fixed 16 mm** (`noteBlockH = 16`) regardless of how many lines the text actually wraps to, and the wrapped lines are emitted with a single `pdf.text(lines, …)` call that never paginates.
- **Actual:** Measured lowest text position on the last page:

| Table rows | Note length | Lowest text | Verdict |
|---|---|---|---|
| 6 | 200 chars | 217.0 mm | ok |
| 6 | 600 chars | 242.6 mm | ok |
| 6 | 1200 chars | 275.5 mm | ok |
| 6 | 2400 chars | **341.2 mm** | off the paper |
| **12** | **600 chars** | **301.7 mm** | **off the paper** |
| 12 | 1200 chars | 334.5 mm | off the paper |
| 22 | 2400 chars | 291.8 mm | overlaps the footer |

  A 12-line invoice with a 600-character note — roughly 90 words of ordinary payment terms — already pushes text beyond the page.
- **Expected:** The note's real height is measured and it is moved to a new page, or paginated, when it does not fit.
- **Evidence:** `src/lib/document-export.ts:651-690` (`noteBlockH = 16`, then `pdf.text(wrapped, margin, noteY + 6)`).
- **Reproduction:** Create a 12-line invoice, paste ~600 characters of terms into the customer note, download the PDF, and read the last page.
- **Business impact:** The customer silently loses the terms and conditions the business intended to attach — including payment, warranty, and return terms, which are the terms most likely to matter in a dispute. Because the on-screen preview is the same PDF, the operator can only notice by scrolling to the bottom of the last page.
- **Relevant files:** `src/lib/document-export.ts`.
- **Recommended fix:** Compute `wrapped.length × lineHeight` and paginate; add the same `footerY` guard used for the totals box.
- **Regression test:** For 1–30 table rows × note lengths up to 4000 characters, assert no drawn text exceeds `pageHeight − footerReserve`.

### `PDF-008` · P2 · Continuation pages carry no client, no document number, and no date

- **Page/feature:** All multi-page PDFs (document exports and AR statements).
- **Description:** `didDrawPage` redraws only the two thin accent bars at the top of continuation pages. The logo, the "BILL TO" card, the "DOCUMENT" card, the reference, and the date are drawn once, imperatively, before the table.
- **Actual:** Verified on a 40-line invoice (3 pages) and a 40-invoice statement (2 pages):

| | Client name | BILL TO card | DOCUMENT card | Date | Table header | Page number |
|---|---|---|---|---|---|---|
| Invoice p1 | yes | yes | yes | yes | yes | no |
| Invoice p2 | **no** | **no** | **no** | **no** | yes | no |
| Invoice p3 | **no** | **no** | **no** | **no** | yes | no |
| Statement p1 | yes | — | — | yes | yes | no |
| Statement p2 | **no** | — | — | **no** | yes | no |

  The only identifying mark on page 2 of an invoice is the document reference in the 7.5 pt footer. An AR statement's page 2 has **no footer at all**, so it carries nothing identifying whatsoever.
- **Expected:** Every page repeats at minimum the document number, the customer, the date, and "Page X of Y".
- **Evidence:** `src/lib/document-export.ts:533-538` (`didDrawPage` draws bars only), `:692-706` (footer loop, no statement equivalent); `src/lib/ar-statement.ts:266-332`.
- **Reproduction:** Invoice 40 line items, download the PDF, and look at page 2 in isolation.
- **Business impact:** Combined with the absence of page numbers (`PDF-001`), a detached or mis-collated page cannot be matched back to its document, and neither the customer nor an auditor can tell whether pages are missing. For a statement page 2 there is literally no way to identify the account.
- **Relevant files:** `src/lib/document-export.ts`, `src/lib/ar-statement.ts`.
- **Recommended fix:** Move the header into `didDrawPage` (or a `drawHeader(pageNo)` helper) and extend the footer loop to the statement builder.
- **Regression test:** Assert every page of a 3-page invoice contains the reference, the customer name, and a page number.

### `PDF-009` · P2 · Invoice PDF silently truncates payment history to 12 entries

- **Page/feature:** Invoice PDF, PAYMENTS block.
- **Description:** `doc.paymentHistory.slice(0, 12)` caps the printed history with no indication that entries were dropped.
- **Actual:** Supplied 20 receipt lines; **12 printed, 8 silently discarded.** No "and N more" marker.
- **Expected:** Print all payments (paginating if needed), or state explicitly how many are not shown.
- **Evidence:** `src/lib/document-export.ts:409`; harness reports `payment-history lines supplied=20, printed=12`.
- **Reproduction:** Record 20 partial payments against one invoice and export it.
- **Business impact:** An invoice paid in many small instalments — normal for the counter-sales pattern this app supports — shows a payment list that does not add up to the paid total. A customer reconciling the document will conclude the business has lost their payments.
- **Relevant files:** `src/lib/document-export.ts`.
- **Recommended fix:** Remove the cap and paginate the block, or append `+ N earlier payments`.
- **Regression test:** With 20 receipts, assert the printed lines sum to the invoice's `amountPaid`.

### `PDF-001` · P2 · No page numbers on any generated PDF

- **Description:** No PDF builder emits "Page X of Y".
- **Actual:** **Verified by rendering.** A 40-line invoice produces 3 pages and a 40-invoice statement produces 2 pages; no page in any of the 16 rendered fixtures contains a page-number string. The document footer prints only `PARTS VILLAGE · Heavy Equipment Parts` and the reference; the AR statement has no footer at all.
- **Expected:** "Page X of Y" on every page — required to prove a multi-page invoice is complete.
- **Evidence:** `src/lib/document-export.ts:692-706` (footer loop stamps branding and reference only); regex scan for `/Page\s*\d/i` across every rendered page returns no match.
- **Business impact:** A customer or auditor cannot tell whether a page is missing. Compounded by `PDF-008`, page 2 of a document is completely anonymous.
- **Recommended fix:** The footer loop already iterates `pdf.getNumberOfPages()` — add `Page ${p} of ${pageCount}` to it. This is a two-line change for the document builder.
- **Regression test:** Generate a 40-line invoice; assert every page carries a correct "Page X of Y".

### `PDF-010` · P3 · No signature area and no structured terms block on any document

- **Description:** Neither builder draws a signature line, a "received by" area, or a terms-and-conditions block. Terms can only be typed by hand into the free-text customer note of each individual document — which is also the field that overflows (`PDF-007`).
- **Actual:** **Verified by rendering.** A case-insensitive scan for `signature`, `signed`, `received by`, `terms`, and `conditions` across all 16 fixtures matched only where I had deliberately typed the word "terms" into a note.
- **Expected:** A signature/acknowledgement area on quotations, delivery-relevant invoices, and credit notes, plus reusable standing terms configured once rather than retyped per document.
- **Evidence:** `src/lib/document-export.ts:692-706`; `src/lib/ar-statement.ts:355-368`.
- **Business impact:** A quotation with no signature block cannot be returned as a signed acceptance, which is the normal way this business would evidence an order. Retyping terms per document guarantees they will be inconsistent or forgotten.
- **Relevant files:** `src/lib/document-export.ts`, `src/lib/ar-statement.ts`.
- **Recommended fix:** Add a signature area above the footer, and a settings-level standing-terms string appended to every document.
- **Regression test:** Assert a quotation PDF contains a signature area and the configured standing terms.
- **Business decision needed:** see question 13 in §18 — the wording of standing terms is a business decision, not a technical one.

### `PDF-011` · P3 · The document reference is drawn unwrapped and can run off the paper

- **Description:** The reference in the "DOCUMENT" card is drawn with raw `pdf.text(id, …)` — no width limit, no wrapping.
- **Actual:** **Verified by rendering.** The app's own generated ids are 27 characters and measure 50.0 mm from x = 112 mm (right edge 162 mm) — comfortably inside the card. A 60-character reference measures 122.7 mm, ending at **234.7 mm on a 210 mm page**, i.e. off the paper entirely.
- **Expected:** The reference is wrapped, shrunk, or truncated to the card width.
- **Evidence:** `src/lib/document-export.ts:378`; measured widths above.
- **Assessment:** **P3 because generated ids are safe.** `resolveDocId` prefers `doc.id` when set, so this only bites if a reference arrives from an import or is set manually. It is a latent defect rather than a live one, and worth fixing at the same time as `PDF-006` since the cause is identical.
- **Recommended fix:** Use `pdf.splitTextToSize` or reduce the font size to fit the card.
- **Regression test:** Assert a 60-character reference stays within the card.

### `PDF-012` · P3 · The totals box overflows for astronomically large totals

- **Description:** The grand total is drawn at 18 pt inside a 78 mm navy box with no fit check.
- **Actual:** **Verified by rendering.** `$987,653,332,345.68` (≈$9.9 × 10¹¹) fits, ending at 192 mm inside the box's 196 mm edge. `$987,654,311,123,456.80` ends at **197.8 mm**, escaping both the box and the right margin.
- **Expected:** Font size reduces to fit, or the amount is formatted more compactly.
- **Evidence:** `src/lib/document-export.ts:624-627`.
- **Assessment:** Not reachable with realistic parts-trading figures, and `roundMoney` already loses cent precision well below this magnitude (`FIN-002`), so the money defect bites first. Recorded for completeness.
- **Recommended fix:** Measure with `getTextWidth` and step the font size down until it fits.
- **Regression test:** Assert the total string always ends within the box.

### `PDF-002` · P2 · Downloaded filename has no date and no customer

- **Description:** Filenames derive from the document id only, and the AR statement's filename has no date at all.
- **Actual:** Document exports save as `${id}.pdf` — unique, because the id embeds a timestamp, but long and machine-oriented. **The AR statement is worse:** `downloadStatementPdf` saves `statement-<slugified-client-name>.pdf` with **no date**, so every statement for the same client collides. Verified by intercepting the app's `save()` call: 7 different statements for one client all requested the identical filename `statement-beirut-heavy-equipment.pdf`.
- **Expected:** `Invoice_INV-2026-0001_Alpha-Earthmoving_2026-08-20.pdf`, and a dated statement filename.
- **Evidence:** download calls in `src/lib/document-export.ts:712-716`; `src/lib/ar-statement.ts:368`.
- **Business impact:** A folder of saved PDFs is hard to browse or search by customer or date. For statements, re-downloading either overwrites the previous month's file or accumulates `(1)`, `(2)` suffixes, so the operator cannot tell which statement was actually sent to the customer.
- **Recommended fix:** Compose the filename from type, number, sanitised customer name, and date.
- **Regression test:** Assert the filename matches the expected pattern, includes the date, and is filesystem-safe for the Unicode/quote-bearing customer name in the seed data.

### `PDF-003` · P3 · Three near-duplicate PDF builders

- **Description:** Three separate blocks each recompute subtotal, discount, tax, and total with the same expressions (`document-export.ts:163-171`, `247-252`, `443-446`).
- **Expected:** One shared totals block.
- **Business impact:** A fix applied to one layout silently misses the other two — a latent source of screen/PDF divergence.
- **Recommended fix:** Extract one `documentTotals(doc)` helper and use it in all three.
- **Regression test:** Assert all three layouts report identical totals for the same document.

### `PDF-004` · P3 · 709 KB of base64 assets embedded in source

- **Description:** `pdf-arabic-font-base64.ts` (475.5 KB) and `parts-village-logo-base64.ts` (233.8 KB) are base64 string literals in TypeScript.
- **Actual:** Base64 inflates binaries ~33%, cannot be cached separately, and must be parsed as JavaScript.
- **Expected:** Real asset files fetched on demand, cached by the browser, and loaded only when a PDF is generated.
- **Evidence:** file sizes above; both land in the client bundle.
- **Recommended fix:** Move to `public/`, `fetch()` lazily on first PDF generation.
- **Regression test:** Assert the initial bundle excludes them and PDF generation still embeds the font/logo.

### `PDF-013` · P3 · Description column is right-aligned under a left-aligned header

- **Description:** The table's description column sets `halign: "right"` while the header row is `halign: "left"`.
- **Actual:** Part descriptions are pushed to the right edge of their column, so the text does not line up with the "Description" header above it and reads as ragged-left down the page. Adjacent columns mix alignments: part number left, description right, size left-bold-orange, quantity centre, price right, total right.
- **Expected:** Text columns left-aligned under left-aligned headers; numeric columns right-aligned.
- **Evidence:** `src/lib/document-export.ts:524-531` (`1: { cellWidth: "auto", halign: "right" }`) versus `:515-522` (`headStyles … halign: "left"`).
- **Business impact:** Cosmetic, but it is the most visible typographic inconsistency on the customer-facing document, and it makes long wrapped descriptions harder to scan.
- **Recommended fix:** Left-align the description column, or right-align the header to match.
- **Regression test:** Visual snapshot of a rendered invoice.

### `PDF-016` · **P1** · `/labels` — the printed barcode encodes a different part number than the text beside it, and the app's own scanner cannot read it

- **Page/feature:** Label print station (`/labels`) → *Print*, producing the 57 × 32 mm part label.
- **Description:** `drawCode39` strips every character outside `[A-Z0-9\-.\s]` from the part number before encoding, then truncates to 14 characters — while the human-readable line on the same label prints the part number in full. The two therefore disagree. The stripping is not a Code 39 limitation: `/` is a standard Code 39 character that the app's own `CODE39` table simply omits.
- **Actual behaviour** — a label was printed from the running app and the bars in the generated PDF were decoded back to characters:
  ```
  seal-label.pdf   57.0 × 32.0 mm, 1 page
  printed text  : ["PARTS VILLAGE", "WR70*64*20", "TBD"]
  decoded bars  : *WR706420*   ->  payload "WR706420"
  ```
  The same mismatch on the audit's custom part: text `HOSE-1/2`, bars decode to `HOSE-12`.
- **Blast radius:** Across the eight shipped catalogue modules, **229 of 1,760 part numbers (13%) print a barcode that differs from their own label text** — 179 from `*` used as a dimension separator throughout the seals catalogue (`WR70*64*20`), 3 from `/`, 4 from parentheses, and 53 from the 14-character truncation. No two catalogue parts collapse onto the same payload, so a scan cannot resolve to the *wrong* part; it resolves to *nothing*.
- **The scanner cannot read the app's own label.** `PartScanDialog.handleCode` resolves a scanned code by **exact** case-insensitive match against `partNumbersOf(part)`, falling back to a substring filter for typed input. `WR706420` is neither an exact match nor a substring of `wr70*64*20`, so scanning the printed label opens nothing. Driven through the real UI, typing each barcode payload into inventory search found the part in **0 of 3** affected cases and 1 of 1 control cases:

  | Part number | Barcode payload | Scanning the label finds it? | Typing the part number finds it? |
  |---|---|---|---|
  | `WR70*64*20` | `WR706420` | ❌ | ✅ |
  | `WR75*70*10` | `WR757010` | ❌ | ✅ |
  | `HOSE-1/2` | `HOSE-12` | ❌ | ✅ |
  | `AS568-010` (control) | `AS568-010` | ✅ | ✅ |
- **Expected:** The barcode encodes exactly what is printed beside it, or — where a character genuinely cannot be encoded — the label refuses to print rather than shipping a mismatch.
- **Evidence:** `src/lib/part-label.ts:59` (`text.toUpperCase().replace(/[^A-Z0-9\-.\s]/g, "").slice(0, 14)`), `:8-49` (the `CODE39` table, missing `$ / + %`), `:110` (`drawCode39(pdf, part.partNumber, …)`); `src/components/app/part-scan-dialog.tsx:57-68` (exact-match resolution). Harness: `/tmp/pv-audit3/results/labels-seal.json`, `barcode-blast.json`, `barcode-collide.json`, `barcode-scan.json`, and the decoded PDFs `seal-label.pdf` / `part-label.pdf`.
- **Reproduction:** Go to `/labels`, search `WR70*64*20`, tick it, press *Print*. The label shows `WR70*64*20` under a barcode that encodes `WR706420`. Scan that barcode into the part scan dialog — nothing opens.
- **Business impact:** The label station exists to make parts scannable ("Barcode + box # + price"), and for 13% of the catalogue — including most of the seals range — it produces a label that the shop's own software rejects. Staff fall back to typing, which is the workflow the barcode was meant to replace, and the failure is invisible until someone is at the shelf with a scanner.
- **Relevant files:** `src/lib/part-label.ts`, `src/components/app/part-scan-dialog.tsx`.
- **Recommended fix:** Add `$ / + %` to the `CODE39` table so the standard's full character set is available, and encode the part number unmodified. For anything still unencodable, either switch that label to Code 128 (which covers all of ASCII and is denser) or fail loudly. Raise or remove the 14-character cap — 53 catalogue parts exceed it today. Independently, make the scanner's lookup tolerant so a legacy label still resolves.
- **Regression test:** For every catalogue part number, assert `decode(barcodeOf(pn)) === pn.toUpperCase()`; and assert the scan dialog resolves each part from its own printed payload.

### Arabic PDF output — now verified in a real browser ✅

The two items previously listed here as NOT VERIFIED have since been exercised in a headless Chrome
session driving the shipped build. A quotation was seeded with three Arabic runs — party name
`شركة بيتا للمحاجر`, a line description `خرطوم هيدروليكي ١/٢ انش`, and a mixed Arabic/Latin customer
note — then *Share PDF* was clicked in the app's own document dialog and the downloaded file was
parsed byte by byte.

| Item | Result |
|---|---|
| **PDF is produced at all from the Arabic document** | ✅ `QUO-AUDIT-AR.pdf`, 585,433 bytes, `%PDF-1.3`, 1 page, terminated with `%%EOF`. |
| **Arabic runs are rasterised, not dropped** | ✅ 8 image XObjects, of which **3 are Arabic rasters** (285×76, 321×50, 1037×53 px) — exactly one per seeded Arabic run. |
| **Rasters contain real glyph ink, not blank or solid canvases** | ✅ Each `DeviceGray` soft mask carries 9–10% ink spread over 76–83% of its columns with 7, 16, and 72 ink/blank transitions respectively — the signature of drawn glyphs. A blank canvas scores 0; a solid block scores 0 transitions. |
| **Shaping and right-to-left order are correct** | ✅ The masks were decoded and written out as PNGs and read back: `شركة بيتا للمحاجر` and `خرطوم هيدروليكي ١/٢ انش` render with correct cursive joining, correct letter forms, and correct RTL order. Arabic-Indic digits `١/٢` and `٣٠` render correctly. |
| **Mixed Arabic/Latin in one run** | ✅ The customer note renders both scripts in one raster with the Latin segment `delivery ex-works` left-to-right inside the RTL line. |
| **`maxWidthMm` is honoured on the Arabic path** | ✅ Confirmed — as predicted in `PDF-006`, the constraint the Latin path ignores is respected here (`ctx.fillText(…, maxWidthPx)`). |

Evidence: `/tmp/pv-audit2/results/arabic3.{log,json}`, the decoded rasters
`/tmp/pv-audit2/results/pdfimg-{3,5,7}-*-DeviceGray.png`, and `/tmp/pv-audit2/results/pdf.log`.

One new defect did fall out of this pass, plus one measured cost:

### `PDF-014` · P2 · Arabic diacritics are shaved off the top of every rasterised line

- **Page/feature:** Every Arabic string in every PDF and AR statement (`renderArabicPng`, used by `pdfDrawText`, the autoTable `didDrawCell` hook, and `ar-statement.ts`).
- **Description:** The canvas is allocated as `height = ceil(fontPx × 1.45)` and the text is drawn with `textBaseline = "middle"` at `y = height / 2`, so exactly `height / 2` is available above the centre line. Amiri's Arabic glyphs need more than that once hamza, madda, and shadda sit above the letter body, so the top of the mark is cut off at the canvas edge. Nothing warns; the raster is simply short.
- **Actual:** In the shipped `QUO-AUDIT-AR.pdf`, the customer-note raster is 1037×53 px and the glyph box needs 32.89 px above the centre line against the 26.5 px available — **6.39 px (0.56 mm) of ink lost at the top and a further 1.52 px at the bottom.** Row 0 of the mask carries 16 inked pixels and the last row carries 2, which is the direct signature of clipping. The `Bill to` party name clips likewise (11 inked pixels on row 0, plus 2 on the left edge because the allocated width comes from `measureText().width`, an advance width that excludes overhanging glyph parts).
- **Expected:** The canvas is sized from `actualBoundingBoxAscent` + `actualBoundingBoxDescent` (and `actualBoundingBoxLeft/Right` for width), with the baseline placed accordingly, so no glyph touches the edge.
- **Evidence:** `src/lib/pdf-fonts.ts:82-94`. Measured two ways that agree exactly: (a) the mask streams extracted straight out of the downloaded PDF, and (b) the same strings re-rendered in the browser with the app's own registered Amiri face and the app's own geometry, which reproduces the identical 1037×53 canvas and the identical per-edge ink counts. 2 of 5 representative strings clip. Side-by-side magnification of the app's allocation against a correctly sized one: `/tmp/pv-audit2/results/arabic-note-compare.png` — the hamza over the alif in `الأسعار` is visibly flattened in the app's version and intact in the corrected one. Raw numbers in `/tmp/pv-audit2/results/arabic-clip.json`.
- **Reproduction:** Create a quotation for a client whose name is written in Arabic, add an Arabic customer note, download the PDF, and magnify the Arabic lines. Compare the tops of `أ`, `آ`, and any shadda against the same text on screen.
- **Business impact:** Arabic is a primary customer-facing language for this business, and hamza is not decorative — it distinguishes words. A quotation whose Arabic looks clipped reads as sloppy at best and ambiguous at worst, on precisely the document a customer keeps. It is cosmetic rather than numeric, which is why it is P2 and not higher.
- **Relevant files:** `src/lib/pdf-fonts.ts`.
- **Recommended fix:** Replace the `fontPx * 1.45` heuristic with the measured box: allocate `ceil(ascent + descent) + 2` in height, draw at `y = ceil(ascent) + 1`, and widen by `actualBoundingBoxLeft - advanceWidth` when positive. This is a self-contained change to one function and every caller benefits.
- **Regression test:** Render a fixture set of Arabic strings and assert that the outermost row and column of each mask carry zero ink.

### `PDF-015` · P3 · Arabic documents are 2.7× larger than equivalent Latin ones

- **Page/feature:** PDF generation for any document containing Arabic.
- **Description:** Each Arabic run embeds **two** image XObjects: a `DeviceGray` soft mask holding the glyph shapes, and a full-size `DeviceRGB` colour plane that is a single flat colour in every pixel. The colour plane carries no information beyond that one colour, and neither image is compressed — `/Filter` is absent on all six Arabic streams.
- **Actual:** Measured on two documents of comparable length from the same seed: the Latin-only `QUO-AUDIT-0001.pdf` is **213,635 bytes** with 2 image XObjects and 0 unfiltered images; the Arabic `QUO-AUDIT-AR.pdf` is **585,433 bytes** — 2.7×. Of that, **278,013 bytes are solid-colour RGB planes and 92,671 bytes are masks**, so 370,684 of 585,433 bytes (63%) is uncompressed raster for three short lines of text.
- **Expected:** Either a compressed single-channel image, or real embedded-font text.
- **Evidence:** `/tmp/pv-audit2/results/perf-offline.log`, finding `PDF1`.
- **Business impact:** Low but not zero. These documents are shared over WhatsApp and email from a phone; a half-megabyte quotation for three Arabic lines is slow on a weak connection and the Arabic text is not selectable or searchable in the resulting PDF. It scales with the number of Arabic lines, so a long Arabic invoice is considerably worse.
- **Relevant files:** `src/lib/pdf-fonts.ts`, `src/lib/document-export.ts`.
- **Recommended fix:** The clean fix is to stop rasterising: the Amiri TTF is already embedded in the bundle (`PDF_ARABIC_FONT_REGULAR_BASE64`), so registering it with jsPDF and drawing shaped text would give selectable Arabic at a fraction of the size. Failing that, draw the mask as a single grayscale channel and let jsPDF Flate-compress it.
- **Regression test:** Assert that a fixture Arabic invoice stays under a byte budget.

### `PRN-001` · P2 · There is no print stylesheet, so Ctrl+P prints the app furniture

- **Page/feature:** Every operator route, browser print.
- **Description:** `src/styles.css` contains **no `@media print` block anywhere**, and the app never calls `window.print()`. Printing is therefore entirely a PDF-generation feature; if an operator reaches for the browser's own print command, they get a screenshot of the application.
- **Actual:** Printing `/documents` through the browser's print pipeline produced a **2-page, 378,411-byte** document whose first page begins `PARTS VILLAGE / HEAVY EQUIPMENT PARTS / Operations / Dashboard / Search / Inventory / Stock take / …` — the entire left-hand navigation sidebar, printed. 0 print media rules were found; the sidebar was still visible in print emulation.
- **Expected:** Either a minimal print stylesheet that hides the sidebar, header, and toasts so Ctrl+P yields something usable, or — a legitimate alternative — an explicit in-app statement that printing goes through *Download PDF*.
- **Evidence:** `/tmp/pv-audit2/results/pdf.log`, finding `P3`. Confirmed in source: no match for `@media print` in `src/styles.css`, no match for `window.print` in `src/`.
- **Reproduction:** Open any operator page and press Ctrl+P.
- **Business impact:** Operators reach for Ctrl+P by habit, and the failure is silent and wasteful rather than dangerous — paper and a confused customer, not a wrong number. The real documents all have a working PDF path, which is why this is P2.
- **Relevant files:** `src/styles.css`.
- **Recommended fix:** Add a short `@media print` block hiding `[data-sidebar]`, the sticky header, and the toast region, and setting `@page { margin: 12mm }`.
- **Regression test:** Assert that a print-emulated snapshot of `/documents` does not contain the sidebar navigation text.

**Physical paper margins remain unverified** and are the one Phase 10 item that cannot be closed here: it needs a real printer. Everything else in Phase 10 — A4 sizing, margins, logo and company block placement, customer block, document number and date, table alignment, long-description and long-part-number wrapping, repeated table headers on continuation pages, page breaks not splitting rows, totals block placement, notes, signature area, clipped/overlapping content, screen-versus-PDF total agreement, short-versus-multi-page comparison, the downloaded filename, and now the whole Arabic path and browser print — **was rendered and measured**, and is recorded above either as a confirmed defect (`PDF-001`, `PDF-002`, `PDF-005`–`PDF-015`, `PRN-001`) or in the verified-correct tables in this section.

---

## 14. Security issues

### `SEC-001` · **P0** · Operator PIN lockout is completely bypassable via `X-Forwarded-For`

- **Description:** `rateLimitKeyFromHeaders` derives the throttle bucket from the **leftmost** value of the client-supplied `X-Forwarded-For` header (falling back to `X-Real-IP`), with no trusted-proxy validation. The leftmost value is the least trustworthy part of that header — it is whatever the client wrote.
- **Actual behaviour** — measured against the running production build:
  ```
  CONTROL — 8 wrong PINs, one fixed X-Forwarded-For   (limit: 5 per 15 min)
    attempts 1-4  -> Invalid PIN (attempt counted)
    attempts 5-8  -> RATE LIMITED                     ← throttle works as designed

  ATTACK — 12 wrong PINs, a different X-Forwarded-For each time
    attempts 1-12 -> Invalid PIN (attempt counted)    ← never throttled

  Correct PIN from a fresh spoofed IP -> ACCEPTED (session issued)

  RESULT: 0 of 12 rotated-IP attempts were rate limited.
  ```
- **Expected:** Throttling keyed on an identifier the client cannot choose, so the 5-attempt lockout actually holds.
- **Evidence:** `src/lib/operator-auth-server.ts:79-86` (`headers.get("x-forwarded-for")?.split(",")[0]`), `:74-75` (`RATE_MAX_FAILURES = 5`), `:210-234` (`unlockOperator`). Reproduced against `POST /_serverFn/<unlockOperator>` on the local production build.
- **Reproduction:** POST the unlock server function repeatedly with wrong PINs, setting a distinct `X-Forwarded-For` each time; no request is ever throttled.
- **Business impact:** The operator PIN is the **only** gate on the entire application, and behind it sits an `operator`-role Supabase session with full read/write over every business record. A short numeric PIN is exhaustible in at most 10,000 unthrottled requests — minutes of scripted traffic. This is a complete authentication bypass leading to total business-data compromise.
- **Deployment caveat, stated honestly:** on Vercel the edge sets `X-Forwarded-For` itself, which *may* blunt this depending on whether the platform overwrites the header or appends to it. Because the code takes the **leftmost** entry, appending behaviour leaves it fully exploitable. This must be verified against the live deployment (§18 Q6) — but the code is wrong regardless of platform, and depending on undocumented proxy behaviour for the app's only authentication control is not an acceptable control.
- **Relevant files:** `src/lib/operator-auth-server.ts`, `src/lib/durable-rate-limit.ts`.
- **Recommended fix:** Do not trust `X-Forwarded-For`. Use the platform's verified client IP (on Vercel, `x-vercel-forwarded-for` / the request's resolved IP), or take the **rightmost** untrusted-boundary entry. Additionally: maintain a **global** counter alongside the per-IP one so total failures are capped regardless of claimed IP; add exponential backoff; lengthen the PIN; and alert on repeated failures.
- **Regression test:** Assert 12 failed unlocks with 12 distinct `X-Forwarded-For` values result in a lockout.

### `SEC-002` · **P0** · `syncTitusOrders` is an unauthenticated public endpoint that relays credentials to a third party

- **Description:** `syncTitusOrders` is a `createServerFn({ method: "POST" })` whose validator accepts only `{ username, password }`. There is **no session check, no token, and no operator assertion** — structurally impossible, since no credential parameter exists in its schema. The handler immediately performs outbound HTTPS requests to `https://login.titus-logistics.com`, POSTing the supplied username and password to that site's login form.
- **Actual:** `POST /_serverFn/ebe99b87…` with no cookie, session, or token is accepted and dispatched to the handler. It is not rejected with 401/403 — it fails inside the handler's own logic. Contrast the WebAuthn endpoints, which do gate on `requireOperatorAccessToken`.
- **Expected:** Every server function that acts on behalf of the business requires a valid operator session.
- **Evidence:** `src/lib/titus-sync.ts:32-34` (schema is username/password only), `:103-140` (handler starts with outbound `fetchText` calls), `TITUS_ORIGIN` at `:14`. Function id confirmed in the built server manifest `__23tanstack-start-server-fn-resolver-*.mjs`. Compare `src/lib/operator-webauthn-server.ts:231-251`.
- **Reproduction:** POST to the server-function URL with no credentials of any kind; the request reaches the handler.
- **Business impact:** Three distinct exposures. (1) **Open relay / SSRF-adjacent:** anyone on the internet can make *your* server issue authenticated-looking traffic to a third-party logistics site, so abuse traces back to your infrastructure and IP. (2) **Credential-stuffing proxy:** an attacker can test arbitrary username/password pairs against Titus through your server, laundering their origin. (3) **Unmetered compute:** each call triggers several outbound requests plus HTML parsing, giving an unauthenticated attacker a cheap way to burn your serverless budget.
- **Audit note:** I deliberately did **not** complete a credential relay to the live third-party host. Reachability was confirmed with a request that fails validation before any outbound call; the absence of an auth gate is established conclusively from the code.
- **Relevant files:** `src/lib/titus-sync.ts`, `src/lib/operator-webauthn-server.ts` (the correct pattern to copy).
- **Recommended fix:** Require an operator access token in the validator and verify it via `requireOperatorAccessToken` before any outbound call, exactly as the WebAuthn endpoints do. Add rate limiting.
- **Regression test:** Assert an unauthenticated call returns 401 and performs **zero** outbound requests.

### `SEC-003` · P1 · Rate limiter fails open and updates non-atomically

- **Description:** Three compounding weaknesses in `checkDurableRateLimit`, independent of `SEC-001`.
- **Actual:**
  1. **Fails open** — the whole body is wrapped in `try/catch` returning `{ ok: true }` on *any* error, with the comment "Fail open on store errors so unlock isn't bricked". If Supabase is unreachable or the service-role key is misconfigured, throttling silently disappears while PIN checking continues.
  2. **Non-atomic** — `loadStore()` → mutate → `saveStore()` with no locking or compare-and-set. N concurrent attempts all read the same count and overwrite each other, so a burst counts as roughly one failure.
  3. **Read-modify-write on a shared blob** — the counter lives in `shop_state.operator_rate_limits`, so it inherits the whole-blob concurrency model.
- **Expected:** Throttling **fails closed**, and counters increment atomically.
- **Evidence:** `src/lib/durable-rate-limit.ts:81-85` (fail-open), `:61-80` and `:88-105` (load-then-save).
- **Business impact:** The brute-force protection can be neutralised by making the store unavailable, or simply outrun by parallel requests. Directly amplifies `SEC-001`.
- **Recommended fix:** Fail closed with a short grace period, and implement the counter as an atomic Postgres function (`increment_and_check`) or a conditional update, not read-modify-write.
- **Regression test:** With the store stubbed to throw, assert unlock is refused; fire 20 parallel failures and assert all 20 are counted.

### `SEC-004` · P2 · Portal tokens travel in URL query parameters and expiry fails open

- **Description:** Client portal access is `?c=<clientId>&t=<token>`. Three separate weaknesses.
- **Actual:**
  1. Tokens in the query string leak into browser history, `Referer` headers, server/CDN access logs, and anything the customer forwards or pastes.
  2. `isPortalTokenExpired` returns `false` (not expired) when `expiresAt` is missing *or* unparseable — so a legacy or malformed token **never expires**.
  3. `mintPortalToken` falls back to `Math.random()` when `crypto.getRandomValues` is unavailable, which would produce predictable, guessable tokens.
- **Expected:** Tokens delivered in a path segment or exchanged for a cookie; missing/unparseable expiry treated as expired; no non-CSPRNG fallback.
- **Evidence:** `src/lib/portal-token.ts:31-38` (fail-open expiry), `:7-17` (`Math.random()` fallback), `:71-75` (`portalPath`).
- **Assessment:** Token entropy is otherwise adequate (128 bits) and comparison is timing-safe (`verifyPortalToken` → `timingSafeEqualString`). The server-side portal design is sound: it uses the service role, returns **only** the matching client's summary, and is rate-limited (40 per 15 min).
- **Business impact:** A leaked link exposes one customer's full statement and open documents, indefinitely if expiry is absent.
- **Recommended fix:** Treat unparseable/missing expiry as expired; remove the `Math.random()` fallback (throw instead); move the token out of the query string; add per-token revocation from the client page.
- **Regression test:** Assert a token with missing and with malformed `expiresAt` is rejected; assert minting throws without a CSPRNG.

### `SEC-005` · P2 · `part-photos` storage bucket is world-readable

- **Description:** The bucket is created with `public = true` plus a `Public read part-photos` policy granted `to public`. The later hardening migration tightens insert/update/delete to the operator role but **leaves public read in place**.
- **Actual:** Any part photo is retrievable by anyone who knows or guesses its object URL, with no authentication.
- **Expected:** For a private single-operator business app, images served via short-lived signed URLs.
- **Evidence:** `supabase/migrations/20260903090200_part_photos_bucket.sql` (bucket `public = true`; `create policy "Public read part-photos" … to public`); `20260903120000_operator_app_metadata_only.sql` (re-creates write policies, does not drop public read).
- **Business impact:** Directly contradicts the "must not expose business data publicly" requirement. Photos can reveal stock levels, shelf layout, supplier labelling, and part markings.
- **Recommended fix:** Set the bucket private, drop the public-read policy, and serve via `createSignedUrl`.
- **Regression test:** Assert an unauthenticated GET of a known object path returns 403.

### `SEC-006` · P2 · Third-party logistics password stored in plaintext browser storage

- **Description:** Titus portal credentials are kept in `sessionStorage` as plain JSON.
- **Actual:** `saveTitusCreds` writes `{ username, password }` unencrypted. (Credit where due: the code actively migrates any legacy `localStorage` copy into `sessionStorage` and deletes it, which is a real improvement.)
- **Expected:** Third-party credentials held server-side, encrypted at rest, never exposed to the browser.
- **Evidence:** `src/lib/titus-sync.ts:272-290` (`saveTitusCreds`), `:252-270` (`loadTitusCreds`).
- **Business impact:** Any XSS, malicious extension, or shared-device access yields the logistics portal password.
- **Recommended fix:** Store server-side keyed to the operator; never return the password to the client.
- **Regression test:** Assert no credential material appears in `localStorage`/`sessionStorage` after a sync.

### `SEC-007` · P2 · Share target accepts arbitrary file types and sizes with no validation

- **Description:** The service worker's `handleSharePost` accepts every entry in `formData.getAll("files")` with no type or size check, defaulting unknown types to `application/octet-stream`.
- **Actual:** Any file of any size is stored in the Cache API and surfaced in `/share-inbox`. `/share` itself has no authentication.
- **Expected:** Allow-list image MIME types and cap size, matching the `part-photos` bucket (which correctly restricts to jpeg/png/webp at 5 MB).
- **Evidence:** `public/sw.js:57-97`; contrast `supabase/migrations/20260903090200_part_photos_bucket.sql` (`allowed_mime_types`, `file_size_limit`).
- **Assessment:** Client-side only — nothing is uploaded to a server at this stage, so severity is limited to local storage exhaustion and the risk of later attaching an unexpected file type to a part.
- **Recommended fix:** Validate MIME type and size in the service worker before caching; reject the rest.
- **Regression test:** Share a 100 MB `.exe`; assert rejection.

### `SEC-008` · P2 · Service worker cache is never versioned or purged

- **Description:** `CACHE = "pv-shell-v1"` is a fixed name; `activate` only calls `clients.claim()` and never deletes old caches. `networkThenCache` caches **every** successful same-origin navigation and static asset with no bound.
- **Actual:** Cache grows without limit and stale HTML/assets can be served indefinitely after a deploy.
- **Expected:** Version the cache name per release and delete non-matching caches on `activate`; bound what is cached.
- **Evidence:** `public/sw.js:2,11-13,38-55`.
- **Business impact:** Operators can run a stale build after a fix ships — including after the P0 fixes in this report.
- **Recommended fix:** Derive the cache name from the build hash, purge others on `activate`, and restrict caching to the shell plus hashed assets.
- **Regression test:** Deploy twice; assert only the current cache survives and the new shell is served.

### Verified-secure findings ✅

Genuinely good, and worth protecting during remediation:

| Check | Result |
|---|---|
| **Row Level Security on `shop_state`** | ✅ Correct. All four operations require `authenticated` **and** `(auth.jwt() -> 'app_metadata' ->> 'role') = 'operator'`. Migration `20260903120000` deliberately moved off `user_metadata` because it is client-writable — exactly the right call. |
| **Legacy relational tables** | ✅ Locked down. All policies dropped and `revoke all … from anon, authenticated` applied (`20260903090100`). |
| **Secrets in the client bundle** | ✅ Clean. Scanned the built client for `OPERATOR_PIN`, `SUPABASE_SERVICE_ROLE_KEY`, `TITUS_ORIGIN`, `ensureOperatorUser`, and `operator-auth-server` — **no matches**. Only the `VITE_`-prefixed anon key ships, which is by design and safe under RLS. |
| **SQL injection** | ✅ Not applicable to the live path. All access goes through PostgREST/`supabase-js` with parameterised filters; no raw SQL is built from user input. The seeded `; DROP TABLE parts;--` customer name is stored and handled as ordinary JSON text. |
| **XSS sinks** | ✅ Only one `dangerouslySetInnerHTML` (developer-controlled chart CSS — `UX-001`). No `innerHTML`, `eval`, or `new Function` anywhere in `src/`. React escapes by default. *Rendered* confirmation of the XSS-payload customer name remains in §17. |
| **PIN comparison** | ✅ Constant-time via `timingSafeEqualString`. |
| **Supabase auth password** | ✅ Not the raw PIN — derived as `sha256("parts-village-operator-v1:" + pin)` so a direct password grant cannot reuse the shop PIN. |
| **Operator role source** | ✅ Set in `app_metadata` server-side using the service role; the client cannot self-elevate. |
| **Portal data scoping** | ✅ Server-side with the service role, returning only the matching client's AR summary — never the whole `shop_state` blob. |
| **Signup** | ✅ Disabled (`enable_signup = false` in `config.toml`). |
| **`.env` handling** | ✅ Gitignored; no credential files committed. |

### WebAuthn / Face ID unlock — now exercised against a virtual authenticator ✅

Previously NOT VERIFIED because it needs biometric hardware. Driven end to end with a CDP virtual
authenticator (`WebAuthn.addVirtualAuthenticator`, CTAP2.1, internal transport, resident key, user
verification on), against the shipped build:

| Step | Result |
|---|---|
| **Platform authenticator detected** | ✅ `isUserVerifyingPlatformAuthenticatorAvailable()` → `true`, and the gate offered biometric unlock. |
| **Enrolment requires an existing operator session** | ✅ The prompt appears only after a successful PIN unlock, and `beginFaceIdRegister` rejects any call without a valid operator access token. |
| **Registration** | ✅ A resident credential was created for `rpId: localhost` with `signCount: 1`, and the app reported *"Biometrics enabled for this device"*. |
| **Unlock with the passkey** | ✅ Succeeded; the gate cleared and the credential's signature counter advanced 1 → 2. |
| **Replay of a captured assertion** | ✅ **Rejected.** The `finishFaceIdUnlock` HTTP request was captured verbatim off the wire and re-POSTed. The server returned `{ ok: false, error: "Face ID challenge expired — try again" }` and **no `access_token`** — `takeChallenge` deletes the challenge on first use, so the second presentation finds nothing. |
| **Unknown credential** | ✅ `finishFaceIdUnlock` looks the credential up by `response.id` and returns "Unknown Face ID credential" when it is not in the store. |
| **Counter tracking** | ✅ The stored counter is advanced from `verification.authenticationInfo.newCounter` after each success, which is what SimpleWebAuthn needs to detect a cloned authenticator. |

The origin/RP handling is also sound: `rpFromHeaders` pins to `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN`
when both are set, and otherwise falls back to the production host rather than trusting an arbitrary
`x-forwarded-host` — the correct default, and notably **not** the mistake made in `SEC-001`, where
`x-forwarded-for` *is* trusted. Evidence: `/tmp/pv-audit3/results/webauthn2.json`.

One cosmetic note rather than a finding: enrolment is offered through a native `window.confirm()`
(`operator-unlock-gate.tsx:253`) rather than the app's own dialog, so it is unstyled and is
suppressed outright in some embedded browser contexts, where the operator would never be offered
biometric unlock at all.

### Dependency vulnerabilities (catalogued as `DEP-001` in §15)

`npm audit` (read-only; nothing upgraded): **5 high, 2 moderate, 0 critical** across 549 dependencies.

| Package | Severity | Issue | Fix available |
|---|---|---|---|
| `xlsx` | **high** | Prototype pollution (GHSA-4r6h-8v6p-xvw6) + ReDoS (GHSA-5pgg-2g8v-p4x9) | ❌ **No fix** — direct dependency |
| `brace-expansion` | high | DoS via unbounded expansion | ✅ |
| `browserslist` | high | Unbounded memory growth; prototype write | ✅ |
| `js-yaml` | high | Quadratic CPU in `!!omap` | ✅ |
| `nanoid` | high | Infinite loop when size is 0 | ✅ |
| `dompurify` | moderate | XSS via `IN_PLACE` hook removal | ✅ |
| `postcss` | moderate | Arbitrary `.map` read via `sourceMappingURL` | ✅ |

`xlsx` is the notable one: it is a **direct** dependency with **no fixed version**, and it parses
untrusted spreadsheets during inventory import — precisely the attack path prototype pollution
needs. Recommend migrating to the maintained `xlsx` distribution from SheetJS's own CDN or replacing
it with `exceljs`. Treat `dompurify` and `postcss` as build-time only.

### Backup and recovery

**No backup or recovery capability exists in the application.** There is no export-all, no snapshot,
no point-in-time restore hook, and no integrity check. Recovery depends entirely on the Supabase
project's own backup tier, which is outside the repository and unverified (§18 Q5). Given `FIN-001`
can silently destroy payment data and `STK-002` means stock damage is untraceable, the absence of a
verified restore path materially raises the severity of both.

---

## 15. Performance issues

### `PERF-001` · P2 · 4.48 MB of client JavaScript, with a 1.35 MB main chunk

- **Description:** Total client JS is 4481.8 KB uncompressed; the main `index-*.js` chunk alone is 1348.8 KB.
- **Contributors:** static inventory catalogs compiled into JS (`orings-inventory` 309.9 KB source → 225.9 KB chunk, `seals-inventory` 201.9 KB, `couplings-inventory` 43.9 KB, `hydraulics-inventory` 37.4 KB), base64 font and logo (709 KB combined, `PDF-004`), plus `jspdf` (390 KB), `html2canvas` (194.9 KB), `xlsx`, `recharts`, and `@zxing`.
- **Expected:** A lean initial bundle with heavy, rarely-used libraries loaded on demand.
- **Business impact:** Slow first load on the phone-and-mobile-data usage this app is clearly designed for (share target, barcode scanning, shop-floor pages).
- **Recommended fix:** Dynamic-`import()` `jspdf`/`html2canvas` at first PDF generation, `xlsx` at first import/export, `@zxing` at first scan; move catalogs to data files fetched and cached on demand; move base64 assets to `public/`.
- **Regression test:** Budget assertion — initial JS under an agreed ceiling; assert PDF/scan/import still work when their chunks load lazily.

### `PERF-002` · P1 · Whole-blob read/write amplification with no pagination at the data layer

- **Description:** Each `shop_state` key is one row holding one JSON document. Any change to any document rewrites the **entire** `documents` blob; reading one invoice loads **all** of them.
- **Actual:** The browser holds the complete business dataset in memory. Writes are whole-blob upserts debounced at 400 ms. There is no server-side filtering, projection, or pagination — those concepts do not exist in this model. **Now measured:** a single navigation to `/inventory` issues **11 `shop_state` reads** covering 10 distinct keys (`inventory`, `documents`, `parties`, `fleet`, `shipments`, `kits`, `cart`, `pre-orders`, `share-inbox`, `prefs`), each one fetching a whole blob — plus a preflight `OPTIONS` for every one of them, for 24 requests to that one table per page load. The `inventory` key was fetched **twice** in the same navigation, which is the only genuinely duplicated request on the page.
- **Expected:** Query and write only the rows involved.
- **Evidence:** `src/lib/cloud-store.ts` (`useCloudState`, `saveShopState`); `supabase/migrations/20260719123000_online_shop_state.sql`. Request census in `/tmp/pv-audit2/results/final-gaps2.json` (`S7`, `S8`): 70 GETs on a fresh `/inventory` load, 69 distinct URLs, the one repeat being `key=eq.inventory`.
- **Business impact:** Cost grows with total history, not with what is on screen. After a few years of documents, every page load transfers and parses the entire ledger and every keystroke-triggered save rewrites it. The measured 11-reads-per-navigation makes the scaling concrete: each of those reads grows with the size of its blob, so the cost of opening *any* page rises with the total volume of business ever done, regardless of what that page shows. Also the root cause of `PERF-003` and of the merge-based data loss in `FIN-001`.
- **Recommended fix:** Normalise the high-growth collections (`documents`, `inventory`) into real tables with indexes and pagination. If the blob model is retained, at minimum shard `documents` by period (e.g. `documents-2026-08`) to bound each blob.
- **Regression test:** Seed 10,000 documents; assert page load transfer and time stay within budget.

### `PERF-003` · P2 · Every index in the database is on a dead table

- **Description:** All 18 indexes target the legacy relational tables, which have had all privileges revoked and are unused. The live `shop_state` table has only its `key` primary key.
- **Actual:** No index supports any live query, because there are no live queries to index — filtering and sorting happen in JavaScript after transferring everything.
- **Expected:** Indexes on the columns the application actually filters and sorts by.
- **Evidence:** `20260718190000_init_schema.sql:83-88`, `20260725020000_relational_indexes.sql:3-12`, `20260718200000_parts_oring_fields.sql:16-17`; `shop_state` definition.
- **Business impact:** Postgres does no useful work for this app; it is a JSON file store. Search and report performance are bounded by client CPU and network.
- **Recommended fix:** Resolve with `PERF-002`. Either normalise and index properly, or drop the dead tables and their indexes to stop implying a schema that is not in use.
- **Regression test:** After normalisation, assert filtered document queries use an index scan.

### `PERF-004` · P2 · 35 `exhaustive-deps` warnings concentrated in the data layer

- **Description:** React Hook dependency warnings cluster in exactly the contexts that own business data: `documents-context` 6, `parties-context` 6, `fleet-context` 5, `inventory-context` 5, `prefs-context` 5, `cart-context` 4.
- **Actual:** Stale-closure risk in save/merge paths — a callback capturing an outdated snapshot can write back old data and undo a concurrent change.
- **Expected:** Clean dependency arrays, or explicit justification per suppression.
- **Evidence:** `npm run lint` (`react-hooks/exhaustive-deps` × 35).
- **Business impact:** A plausible mechanism for "my edit disappeared" reports, which are near-impossible to diagnose without an audit trail (`STK-002`).
- **Recommended fix:** Fix them in the six context files first; prefer functional `setState` updaters and refs over captured values.
- **Regression test:** Lint gate at zero `exhaustive-deps` warnings in `src/components/app/*-context.tsx`.

### `PERF-005` · P3 · Optimistic-concurrency retry loop can thrash

- **Description:** On a version conflict, `cloud-store` fetches the remote value, merges, and retries the save. If the save still races, it leaves the state dirty for the next debounce to retry, with no backoff or attempt ceiling.
- **Actual:** Two actively-used devices can ping-pong merge-and-save cycles, each rewriting the whole blob — and each cycle runs `healDocumentsAmountPaid` (`FIN-001`).
- **Expected:** Exponential backoff with a retry cap and a clear "unsynced" state.
- **Evidence:** `src/lib/cloud-store.ts:375-420` (`else` branch: "Still racing — leave dirty").
- **Recommended fix:** Add jittered exponential backoff and surface a persistent conflict to the operator.
- **Regression test:** Force sustained conflict; assert bounded retries and a visible unsynced indicator.

### `SYN-001` · **P0** · An edit the app says is "saved offline" is destroyed by its own Retry button and by a reload

- **Description:** When a write fails, the app keeps the edit on screen, writes it to `localStorage`, and shows a toast reading **"Cloud sync issue · 1 waiting — Failed to save inventory — saved offline; will sync when connection returns."** with a **Retry sync** action. That promise does not hold. `retryCloudSync()` does not re-send anything: it increments `retryToken`, which is a dependency of the *load* effect, so the app re-reads the cloud and then unconditionally overwrites the local state with what the server has — discarding the pending edit and clearing the dirty flag that was the only record of it. A reload does the same thing, because the load effect also runs on mount and the pending map is in-memory only.
- **Actual behaviour** — one part (`AS568-010` / `oring-0002`), cloud quantity **4444**, writes rejected with 503 mid-flight, then each recovery path exercised in turn:

  | Recovery path | On screen while failing | After recovery — UI | After recovery — cloud | Outcome |
  |---|---|---|---|---|
  | Press **Retry sync** | 5,555 | **4,444** | 4444 | edit destroyed |
  | **Reload** the tab | 6,666 | **4,444** | 4444 | edit destroyed |
  | Keep editing the same blob | 7,777 | 7,778 | 7778 | survives, incidentally |

  The third row is the only path that works, and it works by accident: the next edit re-runs the save effect and ships the whole blob, which happens to carry the earlier change. Nothing is flushed by reconnecting alone — after the network returned with no further action, the cloud still held 4444.
- **Expected:** "Will sync when connection returns" must mean a pending write is durably queued and replayed. At minimum, Retry must *push* pending local edits rather than pull over them, and a reload must not silently discard unsynced work.
- **Evidence:** `src/lib/cloud-store.ts:105-112` (`retryCloudSync` only bumps `retryToken`); `:236` (`const retry = useCloudRetryToken()`); `:339` (load effect deps `[key, retry]`); `:286-303` — on every load it runs `dirtyRef.current = false; setPendingKey(key, false); setValueState(accepted); localStorage.setItem(localStorageKey, JSON.stringify(accepted))` with **no check of `dirtyRef.current`**; `:36` (`const pendingByKey = new Map()` — in-memory, so a reload starts with zero pending); `:430-432` (the "saved offline; will sync when connection returns" string). Harness: `/tmp/pv-audit3/results/resilience5.json`, `resilience3.json`.
- **Reproduction:** Open `/inventory`, search `AS568-010`, note the quantity. Make the server reject writes. Edit the quantity and press Enter — the new value stays on screen and the offline toast appears. Restore the network, then either press **Retry sync** or reload the page. The quantity reverts to the old value and the edit is gone, with no warning.
- **Business impact:** Silent loss of operator work with an explicit false assurance of durability, which is worse than an honest failure — the operator is told to stop worrying and then loses a stock count, a cost, or a price. The affordance most likely to be used after a connection problem (the app's own Retry button) is the one that destroys the data. Closing the tab at the end of a shift does the same. Because there is no stock-movement audit trail (`STK-002`), the loss leaves no trace.
- **Relevant files:** `src/lib/cloud-store.ts`, `src/components/app/cloud-sync-banner.tsx`, `src/components/app/cloud-conflict-toaster.tsx`.
- **Recommended fix:** Persist pending writes (key → value → base `updated_at`) to `localStorage` or IndexedDB at the moment a save fails, and replay that queue on load and on Retry **before** accepting a cloud value. Guard the load effect with `if (dirtyRef.current) return;` so a refetch can never overwrite unsaved local state. Until a durable queue exists, change the message to the truth — "not saved; keep this tab open" — so the operator is not misled.
- **Regression test:** Fail a write, assert the pending edit is in persistent storage; reload; assert the edit is still present and is pushed once the network returns. Separately assert that clicking Retry with a dirty state issues a **save** request, not a load.

### Runtime performance — now measured ✅

Measured in headless Chrome against the shipped build with the full seeded catalogue of **2,344
parts**. Absolute numbers are machine-specific and are recorded for the record, not as a production
claim; the point is the *shape*, and the shape is good.

| Route | First contentful paint | `load` event | JS requests |
|---|---|---|---|
| `/` (dashboard) | 152 ms | 2056 ms | 38 |
| `/inventory` | 164 ms | 2076 ms | 47 |
| `/documents` | 160 ms | 2061 ms | 45 |
| `/clients` | 204 ms | 2093 ms | 38 |
| `/low-stock` | 232 ms | 2150 ms | 34 |
| `/china-shipments` | 204 ms | 2024 ms | 40 |
| `/insights` | 252 ms | 2071 ms | 33 |
| `/counter` | 216 ms | 2140 ms | 35 |

First paint lands in 150–250 ms on every route. The ~2 s `load` event is the tail of the 33–47
separate JS requests, which is the observable cost of `PERF-001` — on a fast local connection it is
invisible, but each of those is a round trip on a phone.

**Search latency over 2,344 parts** — time from the last keystroke to the filtered result:

| Query | Latency |
|---|---|
| `O-RING` (broad, many matches) | 46.9 ms |
| `ISO-00` | 58.2 ms |
| `HOSE` | 61.2 ms |
| `CF-A-050` (specific) | 50.0 ms |
| `zzz-no-match` (no matches) | 48.4 ms |

All under 62 ms, including the worst case. Typing stays responsive on the full catalogue and the
virtualised table holds up. No performance defect was found here.

**Offline and reconnect behaviour: works only if you keep editing.** With the network cut at the
protocol level, a quantity edit (`oring-0004` → 123) was applied in the UI, the app surfaced an
offline state, and the write reached the cloud after the network returned, carrying the correct
value — nothing lost, nothing double-applied (`/tmp/pv-audit2/results/perf-offline.log`, finding
`N1`).

A second pass established **why** that worked, and it is narrower than it looked. The write is not
queued and replayed; it is carried along by the *next* save of the same blob. Continue editing and
the pending change ships with the following write. Stop, and it never ships: after reconnecting with
no further action the cloud still held the pre-edit value. Take either recovery action the app
offers — its **Retry sync** button, or a reload — and the pending edit is **destroyed**. That is
`SYN-001` above, and it is the more important half of this result.

Two positives previously established from source also hold up in the browser: the inventory table is
**virtualised** (`VirtualInventoryTable`), and saves are **debounced** at 400 ms rather than fired
per keystroke.

**Memory over a long session: no leak found.** 48 client-side navigations across seven routes plus
six dialog open/close cycles in a single page lifetime, forcing garbage collection before each
sample:

| After | JS heap | DOM nodes | Event listeners | Documents |
|---|---|---|---|---|
| 8 navigations | 15.70 MB | 765 | 501 | 2 |
| 24 navigations | 15.98 MB | 765 | 502 | 2 |
| 48 navigations | 16.81 MB | 765 | 505 | 2 |

The heap grew 1.11 MB (7.1%) and flattened; DOM node count did not move at all; listeners grew by
four across 48 navigations; no detached documents accumulated. Nothing here suggests a leak.
Evidence: `/tmp/pv-audit3/results/memory.json`.

Still not measured: a genuinely multi-hour session (this is a ~70-second proxy), and timings against
real production data volumes rather than the seeded catalogue.

---

## 15b. Build, tooling, and dependency issues

### `BLD-001` · P1 · Tooling — nothing in the project type-checks, and a real type error ships

- **Description:** `package.json` has `dev`, `build`, `build:dev`, `preview`, `lint`, `format`, and `test` — but **no `typecheck`**. Vite/Rolldown transpile TypeScript without type-checking, so `npm run build` succeeds with type errors present.
- **Actual:** `npx tsc --noEmit` reports `src/routes/delivery-board.tsx(246,32): error TS2741` — a `<Link to="/documents">` missing the route's required `search` prop (see `FUN-004`). The build passes anyway, and no project command would ever surface it.
- **Expected:** A `typecheck` script run in CI and before deployment, with zero errors.
- **Evidence:** `package.json` scripts; `tsc --noEmit` output; successful `vite build` despite the error.
- **Reproduction:** `npm run build` → succeeds. `npx tsc --noEmit` → 1 error.
- **Business impact:** `strict: true` is configured, so the team is paying the cost of strict typing while getting none of the safety at the gate. Type errors reach production silently; this one is a real navigation defect.
- **Relevant files:** `package.json`, `tsconfig.json`, `src/routes/delivery-board.tsx`.
- **Recommended fix:** Add `"typecheck": "tsc --noEmit"` and run it in CI alongside lint and test. Consider enabling `noUnusedLocals`/`noUnusedParameters` (currently `false`).
- **Regression test:** CI job failing the build on any `tsc --noEmit` error.

### `BLD-002` · P3 · Dev server — a server-only module is pulled into the browser graph

- **Description:** In `vite dev`, the client repeatedly logs: `Module "node:crypto" has been externalized for browser compatibility. Cannot access "node:crypto.createHash" in client code` pointing at `src/lib/operator-auth-server.ts`.
- **Actual:** The server-only auth module is reachable from the client module graph in development, so its `node:crypto` import resolves to a browser stub and throws on access.
- **Expected:** Server-only modules never enter the client graph.
- **Evidence:** `vite dev` output; `src/lib/operator-auth-server.ts:1` (imports `createHash` from `node:crypto` at module scope).
- **Assessment:** **No secret leaks.** I scanned the production client bundle for `OPERATOR_PIN`, `SUPABASE_SERVICE_ROLE_KEY`, `ensureOperatorUser`, `TITUS_ORIGIN`, and `operator-auth-server` — none are present, so the production build tree-shakes it correctly. Impact is limited to console noise and a misleading error while developing.
- **Recommended fix:** Split the shared types/constants out of `operator-auth-server.ts` so client code imports only from a client-safe module, or add a `server-only` guard.
- **Regression test:** Assert the dev console is free of `externalized for browser compatibility` errors, and keep the production bundle secret-scan as a CI check.

### `DEP-001` · P2 · Dependencies — seven advisories, one unfixable, in the spreadsheet parser

- **Description:** `npm audit` reports 5 high and 2 moderate advisories across 549 dependencies (full table in §14).
- **Actual:** `xlsx` is a **direct** dependency with **no fixed version available**, carrying prototype pollution (GHSA-4r6h-8v6p-xvw6) and ReDoS (GHSA-5pgg-2g8v-p4x9). It is used for inventory import/export, so it parses files the operator may receive from suppliers.
- **Expected:** No known-vulnerable package in the path that parses externally-supplied files.
- **Evidence:** `npm audit --json`; `xlsx` in `package.json` dependencies; `xlsx.mjs` 711 KB in the build output.
- **Reproduction:** `npm audit`. (No package was upgraded during this audit, per the safety rules.)
- **Business impact:** A malicious or malformed supplier spreadsheet is the realistic attack path for prototype pollution. The remaining six advisories are mostly build-time or DoS-class and lower risk here.
- **Relevant files:** `package.json`, `package-lock.json`.
- **Recommended fix:** Replace `xlsx` with `exceljs`, or move to SheetJS's own maintained distribution (the npm `xlsx` package is no longer the upstream release channel). Patch the six fixable advisories in a separate, reviewed change.
- **Regression test:** Import a crafted spreadsheet with a `__proto__` key and assert `Object.prototype` is untouched.

### `DEP-002` · P3 · Dependencies — `package-lock.json` is out of sync, so `npm ci` fails

- **Description:** A clean, reproducible install is not currently possible.
- **Actual:** `npm ci` fails with `` `npm ci` can only install packages when your package.json and package-lock.json … are in sync `` and `Missing: lru-cache@11.5.2 from lock file`. It also emits `EBADENGINE` because `@zxing/library` requires Node `>=24.0.0` while the project runs Node 22.
- **Expected:** `npm ci` installs cleanly on a fresh checkout.
- **Evidence:** `npm ci` output. (Per the safety rules I did **not** regenerate the lockfile; I hardlinked a scratch `node_modules` instead and verified the lockfile's checksum was unchanged.)
- **Business impact:** CI cannot be added until this is fixed, and deployments may resolve different dependency versions than any developer machine. The `@zxing` engine mismatch means barcode scanning runs on an unsupported Node version.
- **Relevant files:** `package.json`, `package-lock.json`.
- **Recommended fix:** Run `npm install` once to resync the lockfile and commit it as an isolated, reviewed change. Decide on the `@zxing` requirement: pin an older version or move the project to Node 24.
- **Regression test:** CI runs `npm ci` on a clean checkout.

### `DEP-003` · P3 · Repository — two package managers implied

- **Description:** `bunfig.toml` sits alongside `package-lock.json`.
- **Actual:** Bun and npm configuration coexist with no documented policy on which to use.
- **Expected:** One package manager, declared (e.g. via `packageManager` in `package.json`).
- **Evidence:** `bunfig.toml`; `package-lock.json`.
- **Business impact:** Installing with the "wrong" tool yields a different dependency tree than production — a classic source of works-locally-fails-deployed.
- **Recommended fix:** Pick one, delete the other's config, and add a `packageManager` field plus a note in the README.
- **Regression test:** CI asserts the expected lockfile exists and no foreign lockfile/config is present.

### `DEP-004` · P3 · Repository — committed `routeTree.gen.ts` is stale

- **Description:** The committed generated route tree differs from what the current toolchain emits.
- **Actual:** Running the build regenerates the file, adding a 10-line `declare module "@tanstack/react-start"` register block that is missing from the committed version. This shows as an unexpected dirty file after any build.
- **Expected:** The committed artifact matches generator output, or it is gitignored and generated on demand.
- **Evidence:** `git diff src/routeTree.gen.ts` after a build. *(Reverted during this audit so the branch contains only the two report files.)*
- **Business impact:** Noise in every diff and a real risk of committing an unrelated generated change alongside a feature.
- **Recommended fix:** Regenerate and commit once, then either keep it in sync via a pre-commit hook or gitignore it and generate in CI.
- **Regression test:** CI asserts `git diff --exit-code src/routeTree.gen.ts` after a build.

### `LNT-001` · P3 · Lint — 985 errors drown the eight that matter

- **Description:** `npm run lint` reports 985 errors and 75 warnings across 120 of 241 files.
- **Actual:** 977 errors are `prettier/prettier` formatting. The genuinely actionable items are 8 `no-useless-escape` errors (benign `\-` in regex character classes in `titus-import.ts` and `titus-scrape.ts`) and 35 `react-hooks/exhaustive-deps` warnings (`PERF-004`).
- **Expected:** A clean lint run, so new problems are visible.
- **Evidence:** `npm run lint`; rule breakdown in §6.
- **Business impact:** At this volume nobody reads lint output, so the `exhaustive-deps` warnings sitting in the data layer — the most defect-prone code in the app — go unnoticed.
- **Relevant files:** repository-wide; `eslint.config.js`.
- **Recommended fix:** Run `npm run format` once (mechanical, zero behaviour change), commit it separately from any logic change, then enforce lint in CI so the count stays at zero.
- **Regression test:** CI fails on any lint error.

---

## 16. Missing tests

18 tests across 4 files for 226 source files. Existing tests cover `roundMoney` (2), invoice
credits/remaining (4), phone normalisation (5), and shop-state merge (7). Nothing covers any P0 area.

| Area | Current | Needed |
|---|---|---|
| Stock movements | **none** | Every one of the 14 mutation sites; movement-sum equals on-hand; no change without a record (`STK-002`) |
| Quote → invoice conversion | **none** | Rollback on failure; double-click/concurrent idempotency; quotation preserved; stock delta exactly once (`STK-001`, `FUN-001`) |
| Invoice revert | **none** | Guards for payments/receipts/credits; stock restore only after commit (`STK-004`) |
| Payment healing | 1, and it tests a shape the app never stores | Heal the **bare array** the app actually stores, not a `{documents: […]}` wrapper; `amountPaid` never reduced; legacy `Paid` invoices survive; idempotency (`FIN-008`, `FIN-009`) |
| Receipt deletion | **none** | Deleting a receipt subtracts that receipt only; unbacked `amountPaid` is preserved (`FIN-001`) |
| `roundMoney` | 2 | Negative symmetry; large magnitudes; cent-exactness (`FIN-002`) |
| Subtotal consistency | **none** | UI === PDF === ratio basis, incl. `Payment`/`Discount` lines (`FIN-004`) |
| Discounts and tax | **none** | Percent/amount, clamping, tax on discounted net, historical rate (`FIN-005`) |
| AR statement / aging | **none** | Bucket boundaries; due-date vs invoice-date; credit application (`FIN-003`) |
| Dashboard formulas | **none** | Every card against hand-computed fixtures (`RPT-001`…`RPT-003`) |
| Authentication | **none** | Rate-limit lockout incl. spoofed `X-Forwarded-For`; fail-closed (`SEC-001`, `SEC-003`) |
| Server-function authorisation | **none** | Every `createServerFn` rejects unauthenticated calls (`SEC-002`) |
| Portal tokens | **none** | Expiry incl. missing/malformed; revocation; cross-client isolation (`SEC-004`) |
| Part uniqueness | **none** | Create and **update** paths; concurrent create (`STK-005`, `STK-006`) |
| PDF generation | **none** | Totals match screen; page numbers; repeated headers (`PDF-001`, `PDF-006`) |
| Import/export | **none** | Malformed spreadsheets; prototype-pollution payloads (`DEP-001`) |
| Concurrency | 7 (merge unit) | Two-client integration tests for the merge/save loop |

There is also **no CI configuration** in the repository, so even the 18 passing tests, the lint rules,
and the type error are not enforced on any change.

---

## 17. Unverified areas

Stated plainly, as required. These were **not** confirmed and no claim in this report depends on them.

### Closed in the second runtime pass — previously listed here as unverified

Recorded explicitly so the change is visible. Each of these was an open item in the first version of
this report and has since been driven in a real browser against the shipped build:

1. **Arabic text in PDFs.** Closed. Three Arabic runs were seeded, the app's own *Share PDF* button was clicked, and the downloaded file was parsed: 3 Arabic rasters, correct shaping, correct RTL order, correct Arabic-Indic digits, mixed Arabic/Latin in one line. Two new findings fell out: `PDF-014` (diacritics clipped) and `PDF-015` (2.7× file-size inflation). §13.
2. **Browser print output.** Closed. Printing `/documents` through the browser print pipeline yields a 2-page document that begins with the whole navigation sidebar; there is no `@media print` rule anywhere in `src/styles.css`. `PRN-001`.
3. **Interactive CRUD edge cases.** Closed for the inventory form: empty submit, three rapid duplicate submits, duplicate part number, negative quantity, negative cost, fractional quantity, 10¹⁵ price, non-numeric input, refresh-after-save, and browser back/forward were each driven through the real dialog. Results in §4 and §6 — `FUN-007`, `STK-009`, `STK-010`, and the verified-correct validation table.
4. **XSS payload in the browser DOM.** Closed. Asserted on four routes plus `/search` and the part-detail dialog that the payload renders **HTML-escaped as text**, that **zero** matching elements exist in the DOM (`img[src=x]`, `[onerror]`, `script`, `b`), and that none of the three execution probes fired. §14.
5. **Dashboard figures reconciled by hand.** Closed. Every KPI was scraped from the rendered dashboard and compared against figures computed independently from the seeded records. That reconciliation is what produced `RPT-002`, upgraded to P1.
6. **Negative and fractional stock through the UI.** Closed. The Add/Edit dialog **correctly rejects** negatives and non-numerics with a clear message; the inline quantity editor silently discards them (`STK-010`), and fractional quantities are silently rounded by two different rules depending on the path (`STK-009`).
7. **Zero-decimal money rendering.** Closed. With China shipments now seeded, `/china-shipments` renders `$1,200` alongside `$69.93` on the same screen — `formatMoneyWithUsd` omits the cents that `currency()` always prints. `UX-016` is now an observed defect, not a source-only one.
8. **`/fleet/$machineId`.** Closed, and it is broken: the parent route renders no `<Outlet />`, so the machine-history page can never mount. `FUN-006`, P1.
9. **Offline and reconnect.** Closed, and the result changed on re-examination. An edit made with the network cut does reach the cloud — but only if you keep editing the same data. Neither of the app's recovery affordances works, and both destroy the edit. `SYN-001`, P0. §15.
10. **Runtime page-load and search timings.** Closed. First paint 152–252 ms across 8 routes; search over 2,344 parts completes in under 62 ms in every sample. §15.
11. **Horizontal overflow magnitude.** Closed with corrected figures: all 21 operator routes at 3 widths, separating genuinely unreachable `overflow-x: clip` content (3 route/width combinations) from intentional `truncate` ellipsis. `UX-003` was rewritten accordingly.

### Closed in the third runtime pass — previously listed here as unverified

12. **Packing slip, part label, and Z-report PDFs.** Closed. All three were generated from the running app and parsed. The packing slip and Z-report are correct; the part label is the right physical size but its barcode encodes the wrong value — `PDF-016`, P1. §13.
13. **Excel import driven with real files.** Closed. Four `.xlsx` fixtures were uploaded through the actual dialog over CDP. The dry run is shown to misstate what will be applied (`IMP-004`, P1), an unreadable workbook produces no error (`IMP-005`), and there is no upper bound on imported values (`IMP-006`). §8.
14. **WebAuthn / Face ID.** Closed with a CDP virtual authenticator. Enrolment, unlock, and counter tracking all work; a captured assertion replayed verbatim is correctly refused. §14.
15. **Mid-write network failure.** Closed. The write was held open for 3 s and then failed with the request in flight. This is what produced `SYN-001`. §15.
16. **Memory over a long session.** Closed as far as a short harness can. 48 navigations plus 6 dialog cycles: heap +7.1% and flattening, DOM nodes unchanged, +4 listeners, no detached documents. No leak indicated. §15.
17. **Accessibility tree.** Closed structurally. The full Chrome AX tree was captured on seven routes: zero unnamed interactive controls, an `h1` and a `main` landmark everywhere, one `h1 → h3` skip. Focus visibility was confirmed by pixel diff rather than by CSS inspection. §12.
18. **Payment entry edge cases.** Closed. Partial, multiple, overpayment, zero, negative, double-submit, method recording, and receipt deletion were each driven through the real *Record payment* dialog. Seven of the eight behave correctly; deleting a receipt does not, which is what relocated `FIN-001` to its real code path. §10.
19. **Two devices editing the same record simultaneously.** Closed. A second writer was driven straight against the backend while the browser held a staged payment, so committing forced a genuine three-way merge — confirmed by the app's own "Your edits were merged" notice. This produced `FIN-008` and the reachability evidence for `FIN-009`. §10.
20. **Quotation and invoice CRUD through the UI.** Closed. Create, edit, line-level and document-level discounts, persistence across a reload, zero-value and negative lines, very large totals, duplicate submit, and back/forward with an editor open were all driven. Most pass; the gap found is that **no document can be deleted or voided at all** (`FUN-008`). §7.
21. **Client CRUD, search, and validation.** Closed. Create, edit-and-persist, email-format validation, the clients-page filters, and the `/search` route were driven. Email validation works. The phone field rewrites what the operator typed (`CUS-003`). §7.

### Still not verified

18. **Physical paper margins.** Needs a real printer and real paper. The generated PDF geometry is fully measured; what a specific printer driver does with it is not.
19. **Scanning a printed label with real hardware, and photo upload to a real bucket.** The label's barcode payload was decoded from the PDF and shown not to resolve in the app's own lookup (`PDF-016`); whether a given physical scanner reads those bars at 0.28 mm module width is a separate question needing hardware.
20. **`/share`.** A server action reached only by the Web Share Target, which needs a real installed PWA.
21. **Screen-reader announcement quality.** The accessibility tree is now measured (§12), but no actual screen reader was run, so announcement *order and phrasing* remain unverified.
22. **Two devices editing the same record simultaneously.** The merge function was exercised directly, but a genuine two-browser race was not driven.
23. **A genuinely multi-hour session.** The memory result above is a ~70-second proxy.

### Not verifiable in this environment

24. **Production Supabase state.** Whether the migrations in the repository are actually applied to the live project, whether the `part-photos` bucket is public in production, and whether other keys or policies exist. Everything in §14 is derived from repository migrations.
25. **Whether Vercel sanitises `X-Forwarded-For`.** Determines the live exploitability of `SEC-001` (§18 Q6). The code defect stands regardless.
26. **Backup and restore.** Supabase backup tier and whether a restore has ever been tested (§18 Q5).
27. **Real-world data volume.** The timings in §15 are against a seeded 2,344-part catalogue on this machine, not production telemetry.
28. **Titus integration end-to-end.** Deliberately not exercised: it posts credentials to a live third-party site.
29. **Production behaviour beyond the portal.** The only production request this audit made was a read-only, token-less GET of `/portal` to confirm `UX-002` (34 static-asset requests, zero Supabase calls). Everything else in this report was measured against the local build and the mock backend.

---

## 18. Questions requiring your business decision

I have not assumed answers to any of these, and no finding above depends on guessing them.

**Q1 — VAT.** Is the business VAT-registered? `DOCUMENT_TAX_RATE_PERCENT` is hardcoded `0`, so every
invoice ever issued is untaxed (`FIN-005`). If you are registered, this is a compliance problem
needing a decision on the rate, whether prices are tax-inclusive, and how already-issued invoices
are treated.

**Q2 — Currency.** Is USD-only correct, or do you transact in LBP too (`FIN-006`)? If both: which
currency is authoritative on an invoice, should the FX rate be frozen at issuance, and should
customers see both?

**Q3 — Do quotations commit stock?** Today they never touch stock; a part can be quoted to several
customers at once (`QUO-003`). Should quoting soft-reserve stock, warn, or continue to ignore it?

**Q4 — Payment terms.** There is no due date at all (`FIN-003`). What are your standard terms
(immediate, 30 days, per-customer)? Aging and collections cannot be correct until this is defined.

**Q5 — Backups.** What Supabase plan is the project on, what is the backup retention, and has a
restore ever been tested? Nothing in the app provides backup or export-all, and `FIN-001` can
destroy payment data.

**Q6 — Deployment header handling.** Does the Vercel deployment overwrite or append
`X-Forwarded-For`? This determines whether `SEC-001` is live-exploitable today. I recommend fixing
the code regardless, but the answer sets the urgency.

**Q7 — Invoice numbering.** Do you need gapless sequential invoice numbers for your accountant or
tax authority (`FUN-002`)? Current ids are timestamp-plus-random and develop gaps.

**Q8 — Keep the quotation after conversion?** I propose retaining it with status `Converted`
(`FUN-001`). Confirm that matches how you work, and whether converted quotations should stay visible
in the default Documents list.

**Q9 — Multi-device use.** How many devices/tabs realistically run this at once? Concurrency drives
`FIN-001`, `STK-001`, `SEC-003`, and `PERF-005`. If it is genuinely one device at a time, the risk is
lower — but `FIN-001` still fires whenever two tabs are open.

**Q10 — Legacy `orders` collection.** The dashboard still reads it as a fallback (`RPT-001`). Is any
historical data in there that must be preserved, or can it be retired?

**Q11 — Titus integration.** Is it still in use? If not, deleting `titus-sync.ts` removes `SEC-002`
outright, which is far better than adding an auth check.

**Q12 — Part photo privacy.** Are part photos acceptable to expose publicly (`SEC-005`)? Making the
bucket private and using signed URLs is straightforward if not.

**Q13 — Standing terms and signature.** There is no terms-and-conditions block and no signature area
on any document (`PDF-010`); terms can only be retyped into each document's note field. What standing
terms should print on quotations and invoices (payment, warranty, returns, title), and do you want a
signature/acceptance area on quotations so a signed copy can come back as the order confirmation?

---

## 19. Recommended repair plan, in priority order

Ordered so that each stage is independently shippable and low-risk, and so that the traceability
needed to verify later stages exists first. **No code has been changed. Awaiting your approval.**

### Stage 0 — Contain the security exposure (do first; small and self-contained)

1. **`SEC-002`** — Delete `titus-sync.ts` if the integration is unused (Q11); otherwise require and
   verify an operator access token before any outbound call, copying the WebAuthn pattern.
   *Smallest possible change with the largest security payoff.*
2. **`SEC-001`** — Stop trusting client-supplied `X-Forwarded-For`. Use the platform's verified
   client IP, add a **global** failure counter independent of claimed IP, and add exponential backoff.
3. **`SEC-003`** — Make the rate limiter **fail closed** and increment atomically via a Postgres
   function.
4. **`SEC-005`** — Make `part-photos` private and serve signed URLs (pending Q12).
4a. **`UX-002`** — Fix the portal crash, and do it here rather than in Stage 3c where it originally
   sat. It is a P0, the fix is small (wrap the portal branch of `__root.tsx` in the providers its
   tree already requires, or stop `PageHeader` from calling `useCart` on the portal), and until it
   ships the only page you share with the outside world hands every visitor a React stack trace.
   Pair it with **`SEC-004`** from Stage 3c, since a portal nobody can open is also a portal whose
   token handling has never been exercised, and add an error boundary so the next failure shows a
   message instead of a trace.

*Verify:* re-run the rate-limit probe from §14 and confirm rotated-IP attempts now lock out; confirm
unauthenticated server-function calls return 401; load `/portal` with no params, an invalid token,
and a valid token and confirm all three render something a customer can read.

### Stage 1 — Stop financial and stock data loss (no schema change required)

5. **`FIN-001`, `FIN-008`, `FIN-009` — do these three together, in this order.** They are one
   tangle and fixing any one alone makes another worse.
   - First, **`FIN-009`**: make `healDocumentsAmountPaid` non-destructive — raise `amountPaid`
     toward the receipt sum, never lower it, and flag `prevPaid > receiptSum` for review. Rewrite
     its unit test to feed the **bare array** the app actually stores, so the suite stops passing on
     a shape that never occurs.
   - Then **`FIN-008`**: pass the key through at both `mergeShopStateValue` call sites in
     `cloud-store.ts`, so merged receipts are finally credited. *Do not do this before the step
     above* — wiring up the current function would erase every unbacked `amountPaid` in the
     database on the next merge.
   - Then **`FIN-001`**: change `deleteInvoicePayment` to subtract the deleted receipt
     (`max(0, prevPaid − receipt.total)`) instead of overwriting with the remaining sum, and correct
     the confirmation wording so it matches what the action does.
   - **Back up the `documents` blob before deploying**, then audit for invoices whose `amountPaid`
     already disagrees with their receipts — those are the ones damaged so far.
6. **`STK-001`** — Reorder `convertQuoteToInvoice` to commit the document *before* deducting stock,
   make the deduction idempotent on `invoice.stockDeducted`, and add a re-entrancy guard.
7. **`STK-004`** — Move revert validation ahead of the stock restore.
8. **`FIN-002`** — Make `roundMoney` symmetric and correct at large magnitudes.
8a. **`SYN-001`** — Two changes, both small and independent. First, guard the load effect with
   `if (dirtyRef.current) return;` so a refetch can never overwrite unsaved local state — that alone
   stops both the Retry and the reload data loss. Second, persist the pending write (key, value,
   base `updated_at`) when a save fails and replay it on load and on Retry, so the message the app
   already shows becomes true. Until the queue exists, change the wording to match reality rather
   than promising a sync that does not happen. *Belongs in this stage because it is silent loss of
   operator work triggered by ordinary use, and the first half is a one-line change.*

*Verify:* add the regression tests from §16 for each; these five are the highest-value tests in the
codebase.

### Stage 2 — Establish traceability (prerequisite for trusting anything else)

9. **`STK-002`** — Add an append-only stock movement log. Route all 14 sites through one
   `recordMovement()` helper and make `adjustPartQuantity` private. Surface history on the part page.
10. **`STK-003`** — Record phantom/document-created stock as an explicit goods-in movement.
11. Add a **document/payment audit log** on the same pattern, so `FIN-001`-class events are visible.
    Give it a `void` entry as well, so `FUN-008` can be fixed by voiding rather than deleting.

*Why here:* without this, you cannot confirm the Stage 1 fixes actually worked in production.

### Stage 3 — Correctness of what the business sees

12. **`RPT-001`** — Rebuild "paid sales" from one source; subtract credit notes; stop reading the
    zombie `orders` collection (pending Q10).
13. **`FIN-004`** — Consolidate on one subtotal function used by UI, PDF, and ratio.
14. **`RPT-002`** — Single low-stock definition shared by the dashboard and `/low-stock`, and remove
    the `.slice(0, 8)` that makes the dashboard count saturate. This moved from P2 to P1 once the
    figures were reconciled by hand: the dashboard said 8 where the data held 136, and a
    reorder decision made from the dashboard alone would miss 128 parts.
15. **`RPT-003`** — Group revenue by client id, not name.
16. **`FIN-003`** — Add payment terms and `dueDate`; derive `Overdue`; age against due date (Q4).
17. **`FIN-007`** — Backfill receipts, then remove the status-based paid fallback.
18. **`FUN-005`** — Reject `NaN`/`Infinity` on the import and programmatic boundaries. The part form
    itself is already guarded, so this is narrower than first thought.
18aa. **`FUN-006`** — Add the missing `<Outlet />` to `fleet.tsx`. One line, and it restores a whole
    page that is currently written, bundled, and unreachable. Worth doing early precisely because it
    is so cheap relative to the functionality it returns.
18a. **`CUS-001`** — Refuse to delete a client with unpaid invoices; add an `archived` flag for the
    tidy-up case so the receivable stays on the books. Before shipping, **check production for
    clients already deleted this way** — orphaned invoices are detectable by scanning the documents
    blob for `partyId` values with no matching client.
18b. **`CUS-002`** — Split create from upsert so a duplicate name prompts instead of overwriting, and
    stop the Excel importer writing empty contact fields over populated ones.
18b-i. **`FUN-008`** — Add a `Void` action for quotations and invoices that sets `voidedAt` and a
    reason, excludes the document from AR, revenue, and statements, and keeps it listed and numbered.
    Block voiding an invoice that carries payments until those are reversed, and warn about linked
    receipts and credit notes. Delete the unused `removeDocument` or point it at the void path.
    *Sequenced here because it depends on the audit log from Stage 2 to be worth having, but it is a
    genuine functional gap today: a mistaken invoice cannot be taken off the books by any means.*
18c. **`IMP-004`** — Make the dry run tell the truth. Extract one `normalizePartPatch()` applying the
    clamp and rounding rules, and have both the preview and `bulkUpdateParts` call it, so `after` is
    literally what gets stored. Turn an unparseable non-empty cell into a skip with a reason naming
    the column, and strip thousands separators before `Number()` so comma-formatted prices stop being
    silently discarded. *This is the P1 of the import group: the dry run is the only safeguard before
    a bulk write over the whole catalogue, and today it shows values that are not the ones applied.*
18d. **`IMP-002`** — Group import preview rows by resolved part id so duplicate rows are either summed
    or rejected by name, and count distinct parts in the result toast rather than rows. Pair this with
    **`IMP-001`** (delete the unreachable `parseInventoryExcelFile` so there is only one matching rule
    in the codebase), **`IMP-003`** (drop the 30-row preview cap — the container already scrolls),
    **`IMP-005`** (branch on the parse result so an unreadable file says so instead of rendering a
    dead dialog), and **`IMP-006`** (extend the existing >50% confirmation to cover large increases).
    All of these are small and confined to three files.

### Stage 3b — Customer-facing documents (small, self-contained, high visibility)

These are all in two files and are independent of everything above, so they can ship on their own.

19. **`PDF-005`** — Add the missing page-fit guard to the AR statement's total block. This is the one
    P1 in the group: a customer-facing statement can omit the net due entirely.
20. **`PDF-007`** — Measure the customer note's real height and paginate it.
21. **`PDF-006`** / **`PDF-011`** — Honour `maxWidthMm` in `pdfDrawText`'s Latin branch; one fix
    resolves both the overflowing client name and the overflowing reference.
22. **`PDF-008`** / **`PDF-001`** — Move the document header into `didDrawPage`, extend the footer
    loop to the statement builder, and stamp "Page X of Y".
23. **`PDF-009`** — Remove the 12-entry payment-history cap.
24. **`PDF-002`** — Add the date and customer to download filenames, including the statement's.
25. **`PDF-010`** / **`PDF-013`** — Signature area, standing terms (Q13), and column alignment.
25a. **`PDF-014`** — Size the Arabic canvas from the measured glyph box instead of the
    `fontPx × 1.45` heuristic. One function (`renderArabicPng`), and every Arabic document benefits.
25b. **`PDF-015`** — Stop rasterising Arabic if you can: the Amiri TTF is already in the bundle, so
    registering it with jsPDF gives selectable Arabic at a fraction of the size, and makes `PDF-014`
    moot. If rasterising stays, drop the redundant solid-colour RGB plane and let jsPDF compress the
    mask.
25c. **`PRN-001`** — Add a short `@media print` block, or state in the UI that printing goes through
    *Download PDF*. Either is acceptable; silently printing the sidebar is not.
25d. **`PDF-016`** — Make the label barcode encode the part number it prints. Add the four missing
    standard Code 39 characters (`$ / + %`) to the table, remove the character filter, and raise or
    drop the 14-character cap that silently truncates 53 catalogue parts. For anything still
    unencodable in Code 39 — `*` is the start/stop guard and genuinely cannot appear in the payload,
    which is what breaks the 179 seal part numbers — switch the label to Code 128, which covers all
    of ASCII and is denser at the same physical width. Separately, make the scan lookup tolerant so
    labels already printed and stuck on bins still resolve. *This is the P1 of the group: 13% of the
    catalogue currently carries a label the shop's own scanner rejects.*

*Verify:* re-run the rendering harness described in §13 and assert no drawn text exceeds the page or
the footer reserve; assert every Arabic raster has zero ink on its outermost row and column; assert a
print-emulated `/documents` snapshot contains no sidebar navigation text; and decode the bars of a
generated label for every catalogue part, asserting the payload equals the printed part number.

### Stage 3c — Customer-facing portal, and on-screen readability

`UX-002` and `SEC-004` have moved up to Stage 0, since the portal is a P0. What is left here is
on-screen readability, which is almost all single-line theme or utility-class changes.

26a. **`UX-005`** / **`UX-006`** / **`UX-011`** — Darken the accent colour used for money and stock
    figures to reach 4.5:1, raise border tokens to 3:1, and give the focus ring its own high-contrast
    colour at a consistent 2 px. These are token edits in one theme file and fix the largest number
    of measured samples per line changed.
26b. **`UX-003`** — Replace `overflow-x: clip` with `auto` on the scroll containers. `clip` is what
    makes 230 px of `/stock-map` and 237 px of the dashboard permanently unreachable at phone width
    rather than merely off-screen. Scope this to the three measured route/width cases; the other 57
    clipping samples are intentional `truncate` ellipsis and should be left alone.
26c. **`UX-004`** / **`UX-008`** — Move the table un-stack breakpoint above 768 px, and keep column
    labels in the stacked view. This, not `UX-003`, is what makes `/documents` unusable on a tablet.
26d. **`UX-007`** — Give form validation an inline message, `aria-invalid`, and focus movement, rather
    than a toast that disappears. This is the one item in this stage that is more than a token change,
    and it is also the one that most affects daily data entry. Fold in **`FUN-007`** while you are
    there: an `isSubmitting` guard on the same dialogs stops three clicks producing three success
    messages.
26e. **`UX-009`** / **`UX-018`** — Add a skip link and make the backup reminder dismissible, which
    together remove most of the 23 tab stops standing before the first in-content control.
26f. **`STK-010`** / **`STK-009`** — Route the inline quantity cell through the same validation the
    Add/Edit dialog already gets right, so negative and non-numeric input is rejected with a visible
    message rather than silently discarded, and so a fraction resolves the same way in both controls.
26g. **`STK-011`** / **`STK-012`** — Require a full-token match before a part enters the search
    results and label the 500-row cap honestly; make the inventory column headers real `<th>`
    buttons that sort, for every category rather than only O-Rings.
26h. **`UX-019`** — Give `/fleet` a primary action in its empty state.
26i. **`CUS-003`** — Keep the phone number as the operator typed it and derive the `wa.me` digits at
    the point each link is built, which is what three of the four call sites already do.

*Verify:* re-run the measurement pass from §12 at 375 / 768 / 1440 px and confirm the contrast ratios,
the reachable width on `/stock-map` and the dashboard, and the tab-stop count before first content.

### Stage 4 — Quality gates (cheap, prevents regression)

27. **`BLD-001`** — Add a `typecheck` script and fix the `delivery-board.tsx` error (`FUN-004`).
28. Run `npm run format` once to clear 977 formatting errors, then enforce it.
29. **`PERF-004`** — Fix the 35 `exhaustive-deps` warnings, starting with the six context files.
30. **Add CI** running typecheck, lint, and tests. Nothing is currently enforced.
31. **`DEP-002`** — Resync `package-lock.json` so `npm ci` works; resolve the `@zxing` Node-24 engine
    requirement.
32. **`DEP-001`** — Patch the six fixable advisories; decide on `xlsx`, which has no fix and parses
    untrusted files.

### Stage 5 — Close the remaining verification gaps

33. Most of what this stage originally called for has since been done: the interactive CRUD
    edge-case matrix, Arabic PDF rendering, browser print output, XSS in the DOM, offline and
    reconnect, runtime timings, and the dashboard reconciliation are all now measured (§17). What
    remains genuinely needs hardware or a live environment — physical paper margins, barcode
    scanning, label printing, photo upload, WebAuthn, the Web Share Target, and a screen-reader
    pass. Schedule those against a real device before committing to Stage 6.

### Stage 6 — The architectural decision (largest change; needs your call)

34. **`PERF-002` / `PERF-003` / `DAT-001`** — Decide whether to normalise `documents` and `inventory`
    into real tables with foreign keys, unique constraints, indexes, transactions, and pagination.
    The measurement that makes this concrete: one navigation to `/inventory` costs **11 whole-blob
    reads over 10 keys**, so the cost of opening any page already scales with total business history
    rather than with what the page shows.

    This is invasive: it touches every data context, every route that reads them, the merge layer,
    and the migration history, and it needs a careful data migration out of the JSON blobs. But
    `FIN-001`, `FIN-008`, `STK-001`, `STK-006`, `FUN-003`, `PERF-002`, and `PERF-003` are all
    symptoms of the current model, and client-side patches to each will keep regressing. `FIN-008`
    is the clearest illustration: a hand-written JSON merge is being asked to preserve a financial
    invariant that a `sum(receipts)` view or a trigger would maintain for free. A middle path, if a full
    migration is too much: keep the blob model but shard `documents` by period and move the
    genuinely transactional operations (conversion, payment, stock movement) into server-side
    Postgres functions so they become atomic.

**Sequencing note:** Stages 0–2 are contained, individually shippable, and address every P0. I would
not start Stage 6 until Stage 2 is in place, because the movement log is what lets you prove a data
migration preserved reality.

---

## Appendix A — Coverage report

Required for completion: every discovered page, route, table, endpoint, document type, and major
flow appears below with its verification status.

### Routes — 27/27 discovered and mapped

All 27 routes are inventoried in §3. **Static analysis: 27/27.** **Runtime exercise: 26/27** — every
route except `/fleet/$machineId` was loaded in a real browser at 375, 768, and 1440 px, screenshotted
full-page, and measured (79 samples, 83 screenshots; §12). `/fleet/$machineId` could not be rendered
because the seeded fleet contained no machines. `/share` is a server action reachable only through the
Web Share Target and was reviewed in source only. An unknown route was also loaded to verify the 404
page. `/portal` was additionally loaded against the live deployment (read-only, no token).

### `shop_state` keys — 12/12

`inventory`, `parties`, `documents`, `fleet`, `cart`, `kits`, `prefs`, `shipments`, `share-inbox`,
`pre-orders`, `operator_rate_limits`, `operator_webauthn` — all mapped in §4. Legacy relational
tables (8) confirmed dead and revoked.

### Server functions — 7/7 authorisation-reviewed

| Endpoint | Auth | Verified |
|---|---|---|
| `unlockOperator` | PIN + rate limit | ✅ Runtime probe — **rate limit bypassable** (`SEC-001`); also driven through the real unlock UI |
| `fetchPortalStatement` | Portal token + rate limit | ✅ Source review (`SEC-004`); **never reached at runtime — its only caller crashes first** (`UX-002`) |
| `beginFaceIdRegister` | `requireOperatorAccessToken` | ✅ Runtime — enrolment driven against a CDP virtual authenticator |
| `finishFaceIdRegister` | `requireOperatorAccessToken` | ✅ Runtime — a resident credential was registered and stored |
| `beginFaceIdUnlock` | Pre-auth by design | ✅ Runtime — options issued, unlock succeeded |
| `finishFaceIdUnlock` | Pre-auth by design | ✅ Runtime — unlock succeeded; **a captured assertion replayed verbatim was correctly refused** |
| `syncTitusOrders` | **none** | ❌ Runtime probe — **unauthenticated** (`SEC-002`) |

### Document types — 5/5

`quotation`, `invoice`, `receipt`, `credit_note`, `inquiry` — all mapped, with seeded fixtures for
each; money and status logic verified by harness.

### Major flows

| Flow | Status |
|---|---|
| Quotation → invoice conversion | ✅ Source-verified; **2 defects** (`STK-001`, `FUN-001`) |
| Invoice → quotation revert | ✅ Source-verified; **1 race** (`STK-004`) |
| Payment / receipt → balance and status | ✅ Runtime-verified through the real *Record payment* and *Delete receipt* dialogs; 7 behaviours correct, **1 P0** (`FIN-001`) |
| Credit note / return → stock and balance | ✅ Source-verified; **1 defect** (`FIN-002` residue) |
| Stock deduction and restoration | ✅ Source-verified; **2 P0** (`STK-001`, `STK-002`) |
| Multi-device merge and conflict resolution | ✅ Runtime-verified with a genuine two-writer race; **1 P0 + 1 P2** (`FIN-008`, `FIN-009`) |
| Document lifecycle (create, edit, convert, delete) | ✅ Runtime-verified through the real dialogs; create/edit/convert correct, **deletion does not exist** (`FUN-008`, P1) |
| Operator unlock | ✅ Runtime-verified through the real UI; **1 P0** (`SEC-001`) |
| Client portal | ✅ Runtime-verified locally **and on production**; **completely broken** (`UX-002`) plus `SEC-004` |
| Dashboard and report calculations | ✅ Formulas documented (§11); **3 defects** (`RPT-001`…`003`) |
| PDF generation | ✅ Rendered and measured (§13), now including the packing slip, part label, and Z-report; **14 defects** |
| Import / export | ✅ Driven with real `.xlsx` uploads through the actual dialog (§8); 7 behaviours correct, **1 P1 + 2 P2 + 3 P3** (`IMP-001`…`006`) |
| Offline behaviour and recovery | ✅ Runtime-verified, including a write failed in flight; the banner is correct but **both recovery paths destroy the edit** (`SYN-001`, P0) |
| Biometric unlock (WebAuthn) | ✅ Runtime-verified against a virtual authenticator — enrol, unlock, counter tracking, and replay refusal all correct |
| Share target | ⚠️ Source-verified; needs an installed PWA to exercise |
| Responsive layout, contrast, keyboard, modals | ✅ Runtime-measured at 3 widths (§12); **20 findings**, 12 behaviours verified correct |
| Accessibility tree | ✅ Full Chrome AX tree captured on 7 routes; 0 unnamed controls, `h1` + `main` everywhere, focus visibility confirmed by pixel diff |
| Long-session memory | ✅ 48 navigations + 6 dialog cycles; no leak indicated |

### Honest scorecard by phase

| Phase | Coverage |
|---|---|
| 1 — Project understanding | ✅ Complete |
| 2 — Technical verification | ✅ Complete |
| 3 — Feature testing | ✅ Complete — logic verified by harness; dialogs, validation, confirmations, offline/reconnect, duplicate submit, refresh-after-save, back/forward, and the full numeric edge-case matrix all driven in a real browser |
| 4 — Inventory | ✅ Complete — 11 findings including import/export; both numeric editing paths driven, negative input confirmed rejected by the form and silently discarded by the inline editor |
| 5 — Quotations | ✅ Complete — create, edit, discounts, persistence, and conversion all driven through the real dialogs; 4 findings plus `FUN-008` |
| 6 — Invoices and payments | ✅ Complete — the payment dialog's full matrix and a genuine two-device race driven at runtime; 9 findings, 2 of them P0 |
| 7 — Customers and suppliers | ✅ Complete — create, edit, email validation, and search driven at runtime; delete protection and duplicate handling verified (`CUS-001`, `CUS-002`, `CUS-003`) |
| 8 — Reports and dashboard | ✅ Complete — all formulas documented and every rendered KPI reconciled by hand against seeded records, which produced `RPT-002` |
| 9 — Design and UX | ✅ Complete — 79 measured samples, 83 screenshots, 20 findings, 12 verified-correct behaviours; overflow re-measured across 21 routes × 3 widths |
| 10 — Printing and PDF | ✅ Complete — every document type rendered and measured, including the packing slip, part label, and Z-report; Arabic rasters decoded; label barcode decoded back to characters (`PDF-016`); only physical paper margins remain unverified |
| 11 — Security | ✅ Complete — 8 findings, 2 confirmed by live probe, 11 controls verified sound, stored XSS confirmed inert in the DOM, WebAuthn exercised end to end against a virtual authenticator including a refused replay |
| 12 — Performance and reliability | ✅ Complete — build and architecture analysed; page-load, search latency, long-session memory, and a write failed mid-flight all measured against a 2,344-part catalogue. The mid-flight test produced `SYN-001`, the pass's only P0 |

---

## Appendix B — Full findings index

| ID | P | Area | Summary |
|---|---|---|---|
| `SEC-001` | **P0** | Auth | PIN lockout bypassed by spoofing `X-Forwarded-For` — demonstrated |
| `SEC-002` | **P0** | Auth | `syncTitusOrders` unauthenticated; relays credentials to a third party |
| `FIN-001` | **P0** | Payments | Deleting a receipt overwrites `amountPaid` with the remaining receipt sum, erasing every unbacked payment — $125 paid became $0 on deleting a $25 receipt |
| `FIN-008` | **P0** | Payments | A payment taken on a second device merges in as a receipt but is never credited — $65 of receipts against an invoice recording $40 paid |
| `STK-001` | **P0** | Stock | Stock deducted before conversion commits; no rollback; double-deduct on retry |
| `STK-002` | **P0** | Stock | No stock movement audit trail across 14 mutation sites |
| `UX-002` | **P0** | Portal | The customer-facing portal crashes on every load — confirmed on production, in the local build at all three widths, and in the server-side render |
| `SYN-001` | **P0** | Sync | An edit the app reports as "saved offline; will sync when connection returns" is destroyed by its own *Retry sync* button and by a reload |
| `SEC-003` | P1 | Auth | Rate limiter fails open and updates non-atomically |
| `FIN-002` | P1 | Money | `roundMoney` asymmetric for negatives; stops cent-rounding above ~1e10 |
| `FIN-003` | P1 | Invoices | No due date, so `Overdue` and aging are not derivable |
| `FUN-001` | P1 | Quotations | Conversion permanently deletes the quotation |
| `STK-003` | P1 | Stock | Phantom stock invented for document-created parts |
| `STK-004` | P1 | Stock | Revert restores stock before validating the revert |
| `RPT-001` | P1 | Reports | "Paid sales" mixes sources, ignores discounts and credits |
| `PERF-002` | P1 | Performance | Whole-blob read/write amplification; no data-layer pagination |
| `BLD-001` | P1 | Build | No `typecheck` script; a real type error ships undetected |
| `DAT-001` | P1 | Architecture | No transactional integrity or database-enforced constraints (root cause of many below) |
| `PDF-005` | P1 | PDF | AR statement prints "Net due" off the bottom of the page — 8 of 350 shapes |
| `CUS-001` | P1 | Customers | Deleting a client removes $6,000 of demonstrated AR from the dashboard and collections queue |
| `CUS-002` | P1 | Customers | Re-adding an existing name silently wipes phone/email/address; the Excel importer triggers it |
| `FUN-006` | P1 | Navigation | `/fleet/$machineId` can never render — the parent route renders no `<Outlet />`, so the machine-history page is unreachable |
| `RPT-002` | P1 | Reports | Dashboard "Low Stock Alerts" saturates at 8 and disagreed with `/low-stock` by 128 in the seeded run |
| `PDF-016` | P1 | Labels | The printed barcode encodes a different part number than the text beside it, for 229 of 1,760 catalogue parts; the app's own scanner cannot resolve it |
| `IMP-004` | P1 | Import | The dry run states values that are not the ones applied, and comma-formatted prices are silently discarded |
| `FUN-008` | P1 | Documents | Nothing in the app can delete or void a document; `removeDocument` is exported and never called |
| `FIN-004` | P2 | Money | Two different subtotal definitions (0.12 vs 0.06 demonstrated) |
| `FIN-005` | P2 | Money | Tax hardcoded to 0; no VAT configuration |
| `FIN-006` | P2 | Money | Currency effectively hardcoded to USD |
| `FIN-007` | P2 | Payments | `invoiceAmountPaid` masks corruption; infers payment from status |
| `FUN-002` | P2 | Documents | No structured numbering; ids double as customer-facing numbers |
| `FUN-003` | P2 | Documents | Duplicate document ids possible by construction |
| `FUN-004` | P2 | Navigation | `/documents` link omits required search params |
| `FUN-005` | P2 | Global | `NaN`/`Infinity` silently coerced to 0 on import and programmatic paths (the part form itself is guarded) |
| `FUN-007` | P2 | Forms | Three rapid Create clicks create one part but show three success toasts (Add-part dialog only; the invoice form is clean) |
| `FIN-009` | P2 | Payments | The merge's payment-healing code cannot run, and its unit test passes through a `{documents: […]}` shape the app never stores |
| `QUO-001` | P1 | Quotations | No expiry date, so `Expired` cannot exist |
| `QUO-002` | P2 | Quotations | Status set does not cover the lifecycle |
| `QUO-003` | P2 | Quotations | Quotations never reserve stock, with no warning |
| `QUO-004` | P2 | Quotations | "Deduct stock?" is a free choice per conversion |
| `STK-005` | P2 | Inventory | Part-number uniqueness enforced on create but not update |
| `STK-006` | P2 | Inventory | Concurrent creates can duplicate a part number |
| `STK-007` | P2 | Inventory | `removePart` silently resets quantity and pricing |
| `STK-009` | P2 | Inventory | Quantities silently rounded to whole units by two different rules — the dialog rounds 2.5 to 3, the inline editor floors 7.5 to 7 |
| `IMP-002` | P2 | Import | Duplicate rows for one part keep only the last, and the count reports rows not parts |
| `IMP-005` | P2 | Import | An unreadable workbook produces no error at all — the catch is unreachable because `XLSX.read` does not throw |
| `RPT-003` | P2 | Reports | Revenue grouped by client name, not id |
| `RPT-004` | P2 | Reports | Date handling mixes local-time bucketing with raw string slicing |
| `SEC-004` | P2 | Portal | Tokens in query params; expiry fails open; `Math.random()` fallback |
| `SEC-005` | P2 | Storage | `part-photos` bucket world-readable |
| `SEC-006` | P2 | Secrets | Third-party password in plaintext browser storage |
| `SEC-007` | P2 | Uploads | Share target accepts arbitrary file types and sizes |
| `SEC-008` | P2 | PWA | Service worker cache never versioned or purged |
| `DEP-001` | P2 | Deps | 7 advisories (5 high); `xlsx` has no fix and parses untrusted files |
| `PERF-001` | P2 | Performance | 4.48 MB client JS; 1.35 MB main chunk |
| `PERF-003` | P2 | Database | Every index is on a dead table |
| `PERF-004` | P2 | Reliability | 35 `exhaustive-deps` warnings in the data layer |
| `PDF-001` | P2 | PDF | No page numbers on any document — verified across 16 rendered fixtures |
| `PDF-002` | P2 | PDF | Filename lacks date and customer; statement filenames collide |
| `PDF-006` | P2 | PDF | Long client name escapes the Bill-to card to 206 mm on a 210 mm page |
| `PDF-007` | P2 | PDF | Long customer note prints past the footer and off the paper |
| `PDF-008` | P2 | PDF | Continuation pages carry no client, reference, or date |
| `PDF-009` | P2 | PDF | Payment history silently truncated to 12 entries |
| `PDF-014` | P2 | PDF | Arabic diacritics shaved off the top of every rasterised line — 0.56 mm of ink lost, measured in the shipped PDF |
| `PRN-001` | P2 | Printing | No `@media print` rule anywhere, so Ctrl+P prints the navigation sidebar |
| `UX-003` | P2 | Layout | `overflow-x: clip` makes content unreachable on 3 of 63 route/width combinations tested |
| `UX-004` | P2 | Layout | Tables un-stack at 768 px, exactly where the sidebar squeezes content to 512 px |
| `UX-005` | P2 | A11y | Accent colour on money and stock figures measures 2.52–2.66:1 against a 4.5:1 requirement |
| `UX-006` | P2 | A11y | Every input, button, and card border measures 1.27–1.34:1 against a 3:1 requirement |
| `UX-007` | P2 | Forms | Validation is a transient toast — no inline error, no `aria-invalid`, no focus move, no `required` |
| `UX-008` | P2 | Layout | Stacked mobile table view drops every column label |
| `UX-009` | P2 | A11y | No skip link, and 23 tab stops before the first in-content control |
| `UX-001` | P3 | UI | `dangerouslySetInnerHTML` in chart CSS (not currently exploitable) |
| `UX-010` | P3 | A11y | 32 px default control height; 16 × 16 px row toggles on `/labels` |
| `UX-011` | P3 | A11y | Focus ring is the accent orange at 2.51:1, and 1 px in content vs 2 px in the sidebar |
| `UX-012` | P3 | Typography | 12 px dominant body text, with 10–11 px secondary labels |
| `UX-013` | P3 | A11y | Five inputs have no accessible name; five more rely on placeholder alone |
| `UX-014` | P3 | A11y | `/clients` and `/suppliers` skip `h1` → `h3` |
| `UX-015` | P3 | A11y | Modal sets no `aria-modal` and leaves the app shell non-inert |
| `UX-016` | P3 | Consistency | Two date styles and two money formatters coexist — `$1,200` and `$69.93` now observed side by side on `/china-shipments` |
| `UX-017` | P3 | Consistency | 17 distinct button height/font/radius combinations |
| `UX-018` | P3 | UX | Backup reminder banner renders on all 26 routes and is the first in-content tab stop |
| `UX-019` | P3 | UX | `/fleet` has no create action at all (corrected: `/china-shipments` does, and was wrongly listed here in the first pass) |
| `UX-020` | P3 | UX | No skeleton or spinner anywhere after unlock |
| `UX-021` | P3 | Performance | Public portal downloads inventory, cart, and PDF modules — 34 asset requests |
| `PDF-003` | P3 | PDF | Three near-duplicate PDF total blocks |
| `PDF-004` | P3 | PDF | 709 KB of base64 assets in source |
| `PDF-010` | P3 | PDF | No signature area and no standing terms block |
| `PDF-011` | P3 | PDF | Document reference drawn unwrapped; a long id leaves the paper |
| `PDF-012` | P3 | PDF | Totals box overflows for astronomically large amounts |
| `PDF-013` | P3 | PDF | Description column right-aligned under a left-aligned header |
| `PDF-015` | P3 | PDF | Arabic documents are 2.7× larger than Latin ones — 63% of the file is uncompressed raster |
| `CUS-003` | P3 | Customers | The phone number the operator types is replaced with an unformatted digit string — `+961 3 424 242` is stored and displayed as `9613424242` |
| `STK-008` | P3 | Inventory | Inventory valuation is an unrounded float over the whole catalog |
| `STK-010` | P3 | Inventory | The inline quantity editor discards negative and invalid input with no message (the Add/Edit dialog correctly rejects it) |
| `STK-011` | P3 | Inventory | Search reports a 500-row cap as if it were the match count; `HOSE-1/2` shows "500 of 2344" for one real match |
| `STK-012` | P3 | Inventory | No `<th>`, no `aria-sort`, no clickable headers — the catalogue cannot be sorted by Qty, Cost, Price, or Code |
| `IMP-001` | P3 | Import | Dead `parseInventoryExcelFile` truncates part codes at separators — unreachable, so latent |
| `IMP-003` | P3 | Import | Import dry run lists only the first 30 rows, with no "30 of N" disclosure |
| `IMP-006` | P3 | Import | No upper bound on imported quantity, cost, or price; the >50% guard checks drops only |
| `PERF-005` | P3 | Reliability | Conflict retry loop has no backoff or ceiling |
| `BLD-002` | P3 | Build | Dev server logs `node:crypto` externalisation error from a server module |
| `DEP-002` | P3 | Deps | `package-lock.json` out of sync; `npm ci` fails |
| `DEP-003` | P3 | Repo | Stray `bunfig.toml` alongside `package-lock.json` |
| `DEP-004` | P3 | Repo | Committed `routeTree.gen.ts` is stale |
| `LNT-001` | P3 | Lint | 985 lint errors (977 formatting); 8 `no-useless-escape` |
