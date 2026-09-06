# Parts Village — Full Application Audit Report

**Audit type:** Read-only audit. No application code, schema, or production data was modified.
**Audit date:** 2026-09-06
**Commit audited:** `08f2a09` ("Remove all Kafu supplier, catalog leftovers, and data files.")
**Branch:** `cursor/full-application-audit-33f7`
**Live deployment:** https://partsvillageapp.vercel.app

> **Safety statement.** Production Supabase was never contacted. All runtime testing ran against a
> throwaway **mock Supabase** on localhost seeded with synthetic data, created purely for this audit
> outside the repository. No environment-variable values, keys, PINs, or connection strings appear in
> this report. Only `APP_AUDIT_REPORT.md` and `QA_TEST_CHECKLIST.md` were created. `package.json`,
> `package-lock.json`, and all application code are byte-for-byte unchanged.

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

However, the audit found **five P0 issues** that put financial and stock data at risk, and the root
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
2. **Recorded payments can be silently erased.** A merge function recomputes every invoice's
   `amountPaid` from linked receipt documents and overwrites whatever was there. Running the app's
   real function over seeded data flipped a fully-paid invoice to `amountPaid: 0, status: "Unpaid"`,
   permanently and without warning. (`FIN-001`)
3. **Stock is deducted before the quotation→invoice conversion commits, and is never rolled back
   if the conversion fails.** A repeated or concurrent conversion deducts stock twice while creating
   only one invoice. Combined with `STK-002` — there is **no stock movement audit trail anywhere in
   the codebase** across 14 stock-mutation call sites — a wrong quantity is undetectable and
   untraceable after the fact. (`STK-001`, `STK-002`)

**Recommendation.** Do not treat this as a list of bugs to patch individually. Fix the four
contained P0s first (they are small, local changes), then decide on the architectural question in
§18, because roughly half of the P1/P2 findings are symptoms of the JSON-blob data model and will
keep reappearing until that is addressed.

### Findings by priority

| Priority | Count | Meaning |
|---|---|---|
| **P0 — Critical** | 5 | Data loss, major security exposure, or incorrect financial/stock data |
| **P1 — High** | 11 | Core feature broken or serious business risk |
| **P2 — Medium** | 29 | Important defect with a workaround |
| **P3 — Low** | 9 | Minor defect, visual inconsistency, or improvement |
| **Total** | **54** | Plus 11 controls verified sound (§14) and a `NOT VERIFIED` list (§17) |

Note that the count is not a measure of quality on its own: 977 of the 985 lint errors are pure
formatting, and roughly a third of the P2 findings are consequences of the single architectural
decision described in `DAT-001`.

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
- **Business impact:** A corrupted quantity produces a plausible zero-total invoice rather than an error, so the corruption is invisible.
- **Recommended fix:** Validate at input/parse time with Zod; make `roundMoney` throw (or return `null`) on non-finite input.
- **Regression test:** Assert that constructing a document with `NaN` qty throws rather than producing `total: 0`.

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

### `STK-008` · P2 · Inventory — inventory valuation is unrounded and reduced by negative stock

- **Description:** `inventoryValue = parts.reduce((s, p) => s + p.cost * p.quantity, 0)` — no rounding, no clamping, no exclusion of never-stocked catalog rows.
- **Actual:** Raw float accumulation over the entire catalog. Any part with negative on-hand (which the app permits — see §13 `NOT VERIFIED`) *subtracts* from total inventory value.
- **Expected:** Valuation rounded to cents, computed over stocked parts only, with negative on-hand either impossible or surfaced rather than netted away.
- **Evidence:** `src/routes/index.tsx:216`.
- **Business impact:** A negative-stock part hides real inventory value; the figure is also a long float rather than a currency amount.
- **Recommended fix:** `roundMoney(Σ cost × max(0, qty))` and report negative-stock parts as an exception list.
- **Regression test:** Set one part to −5; assert valuation does not decrease and an exception is raised.

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

### `FIN-001` · **P0** · Payments recorded without a receipt document are silently and permanently erased

- **Description:** `healDocumentsAmountPaid` runs on **every** three-way merge of the `documents` blob and unconditionally overwrites each invoice's `amountPaid` with the sum of linked receipts, and recomputes `status` from that.
- **Actual behaviour** — output of the app's real function over seeded data:
  ```
  [REWRITTEN] INV-20260610-100000000-dddd  total=33
              amountPaid: undefined -> 0        <<< CHANGED
              status:     "Paid"     -> "Unpaid" <<< CHANGED

  Targeted demo — manual amountPaid with no receipt document:
    before: {"total":1000,"amountPaid":750,"status":"Partial"}
    after : {"total":1000,"amountPaid":0,"status":"Unpaid"}
  ```
  A second merge produces an identical result, so **the loss is permanent, not transient**. The user
  sees a generic sync-conflict notice, never "a payment was removed".
- **Expected:** A merge must never destroy financial data. Divergence between `amountPaid` and the receipt sum should be surfaced for reconciliation, never silently resolved by deleting the payment.
- **Evidence:** `src/lib/document-money-heal.ts:60-76` (unconditional `{ ...item, amountPaid: paid, status }`); invoked from `src/lib/shop-state-merge.ts:122,129,150,157`; merge triggered at `src/lib/cloud-store.ts:383` on the "remote moved ahead" path.
- **Reproduction:** Take any invoice whose `amountPaid` is not backed by receipt documents (a legacy record, a manual adjustment, or a receipt deleted while keeping the paid amount). Open the app on two devices, edit on both to force a merge. The invoice returns as `amountPaid: 0, status: "Unpaid"`.
- **Business impact:** **Highest-severity finding.** Customers who have paid are re-invoiced and re-chased; accounts receivable is overstated; there is no audit trail (`STK-002` applies to money too) so the loss is unattributable. Any invoice migrated from before receipts existed is destroyed on first concurrent edit.
- **Relevant files:** `src/lib/document-money-heal.ts`, `src/lib/shop-state-merge.ts`, `src/lib/cloud-store.ts`, `src/components/app/documents-context.tsx` (`invoiceAmountPaid`).
- **Recommended fix:** Make healing **non-destructive**: only ever *raise* `amountPaid` toward the receipt sum, never lower it. When `prevPaid > receiptSum`, keep the stored value and flag the invoice for review. Better: make receipts the single source of truth and remove the denormalised `amountPaid` entirely, backfilling receipts for legacy paid invoices first.
- **Regression test:** `heal([{total:1000, amountPaid:750, status:"Partial"}])` must not reduce `amountPaid`; and a legacy `status:"Paid"` invoice with no receipts must not become `Unpaid`.

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
- **Business impact:** Revenue can be recognised with no payment evidence; combined with `FIN-001`, such invoices are exactly the ones silently reset to `Unpaid` later.
- **Recommended fix:** Remove the status fallback after backfilling receipts; log rather than clamp negatives.
- **Regression test:** Assert an invoice with `status:"Paid"` and no receipts reports `0` paid and is flagged for reconciliation.

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
| `FUN-005` | `NaN`/`Infinity` silently become `0` | P2 |
| `RPT-001` | Dashboard "paid sales" mixes sources, ignores discounts and credits | P1 |
| `RPT-002` | Two different "low stock" definitions | P2 |
| `RPT-003` | Revenue grouped by client **name** rather than id | P2 |

**Not verified:** three-way agreement between database, screen, printed page, and PDF for a document
containing a discount **and** decimal quantities. The formulas match by inspection; end-to-end
confirmation with a real document is listed in §17.

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

### `RPT-002` · P2 · Dashboard vs `/low-stock` — two different definitions of "low stock"

- **Description:** The dashboard filters `quantity > 0 && quantity <= reorderAt`. The `/low-stock` route filters `reorderAt > 0 && quantity <= reorderAt`.
- **Actual:** The dashboard **excludes parts that have run out entirely** (`quantity === 0`) — precisely the parts most urgently needing reorder — while `/low-stock` includes them. The two screens disagree. The dashboard card is also silently capped at 8 rows with no total count.
- **Expected:** One shared predicate, including zero-quantity parts, with the full count shown.
- **Evidence:** `src/routes/index.tsx:147-154` vs `src/routes/low-stock.tsx`.
- **Reproduction:** Set a part's quantity to 0 with `reorderAt = 5`. It appears on `/low-stock` but **not** on the dashboard card.
- **Business impact:** Out-of-stock parts are invisible on the main screen, so reordering is delayed exactly when it matters most; and the two screens showing different counts erodes trust in both.
- **Relevant files:** `src/routes/index.tsx`, `src/routes/low-stock.tsx`.
- **Recommended fix:** Extract `isLowStock(part)` into a shared module and use it in both places; show "showing 8 of N".
- **Regression test:** Assert a zero-quantity part with a reorder point appears in both views and that both counts match.

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

> **Status: NOT VERIFIED — the most significant gap in this audit.**

Phase 9 explicitly requires visually inspecting the running application at 375 px, 768 px, and
1440 px rather than reading source. A browser-driven pass over every page at all three widths did
not complete within this audit run, so I am **not** reporting design findings I cannot evidence with
a screenshot. Claiming otherwise would violate the "no unverified claims" requirement.

What was established from the running build and source, and what remains:

| Item | Status |
|---|---|
| Production build serves and responds (HTTP 200, 6 ms) | ✅ Verified |
| Operator gate blocks the app until unlock | ✅ Verified (code + server probe) |
| Prior work in this repo addressed phone-width horizontal scroll (commit `2562f87` "Stop sideways page scrolling — stack tables and clip overflow on phones") | ℹ️ Indicates known past problems in this area |
| Inventory table is virtualised (`VirtualInventoryTable`) rather than rendering all rows | ✅ Verified in source — good for large catalogs |
| Per-page appearance, spacing, typography, contrast, focus indicators, empty/loading/error states at 3 widths | ❌ **NOT VERIFIED** |
| Long part numbers / 300-character descriptions overflow behaviour | ❌ **NOT VERIFIED** |
| Mobile menu and sidebar behaviour | ❌ **NOT VERIFIED** |
| Keyboard navigation, focus trapping, Escape-to-close on modals | ❌ **NOT VERIFIED** |
| Colour contrast and accessibility labels | ❌ **NOT VERIFIED** |

### `UX-001` · P3 · `dangerouslySetInnerHTML` in the chart component

- **Description:** `ChartStyle` injects a `<style>` block built from chart config colours.
- **Actual:** Colour values are interpolated into CSS without sanitisation.
- **Assessment:** **Not currently exploitable** — the config is developer-authored (this is the stock shadcn/ui chart), not user- or customer-supplied. Recorded because it becomes a CSS-injection vector the moment any chart config accepts stored data.
- **Evidence:** `src/components/ui/chart.tsx:71-90`.
- **Recommended fix:** Validate colour strings against a strict pattern before interpolation.
- **Regression test:** Assert a config colour of `red; } body { display:none } .x {` cannot escape the declaration.

---

## 13. PDF and printing issues

Reviewed by reading `src/lib/document-export.ts` (three separate PDF builders at lines ~163, ~247,
~443) and the AR statement exporter in `src/lib/ar-statement.ts`. **Rendered output was not opened**,
so page-break, clipping, and multi-page behaviour are marked `NOT VERIFIED` below.

### `PDF-001` · P2 · No page numbers on any generated PDF

- **Description:** No PDF builder emits "Page X of Y".
- **Actual:** A 42-line quotation spans multiple pages with no pagination markers.
- **Expected:** "Page X of Y" on every page — required to prove a multi-page invoice is complete.
- **Evidence:** No `getNumberOfPages`/page-footer logic in `src/lib/document-export.ts`.
- **Business impact:** A customer or auditor cannot tell whether a page is missing.
- **Recommended fix:** After building, loop `pdf.getNumberOfPages()` and stamp a footer.
- **Regression test:** Generate a 42-line quotation; assert every page carries a correct "Page X of Y".

### `PDF-002` · P2 · Downloaded filename has no date and no customer

- **Description:** Filenames derive from the document id only.
- **Actual:** Since the id embeds a timestamp the name is unique, but it is long and machine-oriented.
- **Expected:** `Invoice_INV-2026-0001_Alpha-Earthmoving_2026-08-20.pdf`.
- **Evidence:** download calls in `src/lib/document-export.ts`.
- **Business impact:** A folder of saved PDFs is hard to browse or search by customer or date.
- **Recommended fix:** Compose the filename from type, number, sanitised customer name, and date.
- **Regression test:** Assert the filename matches the expected pattern and is filesystem-safe for the Unicode/quote-bearing customer name in the seed data.
- **Status:** filename construction reviewed in source; **actual downloaded name NOT VERIFIED**.

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

### PDF items requiring rendered output — NOT VERIFIED

A4 sizing and margins · logo and company details placement · customer block · document number and
date · table alignment · long-description wrapping · **repeated table headers on pages 2+** · page
breaks not splitting rows · totals block placement · notes and terms · **signature area** · absence
of clipped or overlapping content · **PDF grand total exactly matching the screen** ·
short-vs-multi-page comparison.

`PDF-005` (P2) is reserved for repeated-header behaviour and `PDF-006` (P2) for screen/PDF total
agreement, pending the rendered check in §17.

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

### `DEP-001` · P2 · Seven known dependency vulnerabilities, one with no fix

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
- **Actual:** The browser holds the complete business dataset in memory. Writes are whole-blob upserts debounced at 400 ms. There is no server-side filtering, projection, or pagination — those concepts do not exist in this model.
- **Expected:** Query and write only the rows involved.
- **Evidence:** `src/lib/cloud-store.ts` (`useCloudState`, `saveShopState`); `supabase/migrations/20260719123000_online_shop_state.sql`.
- **Business impact:** Cost grows with total history, not with what is on screen. After a few years of documents, every page load transfers and parses the entire ledger and every keystroke-triggered save rewrites it. Also the root cause of `PERF-003` and of the merge-based data loss in `FIN-001`.
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

### Performance items NOT VERIFIED

Real page-load timings, search responsiveness with a full catalog, memory-leak behaviour over a long
session, duplicate network requests, and offline/unstable-network recovery — all require the browser
session in §17. Two positives were established from source: the inventory table is **virtualised**
(`VirtualInventoryTable`), and saves are **debounced** at 400 ms rather than fired per keystroke.

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
| Payment healing | 1 (happy path) | `amountPaid` never reduced; legacy `Paid` invoices survive; idempotency (`FIN-001`) |
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

### Not verified because browser-driven testing did not complete

1. **All of Phase 9 (design and UX).** No page was visually inspected at 375/768/1440 px. No findings on appearance, brand consistency, typography, spacing, button hierarchy, icons, cards, tables, forms, modals, navigation, sidebar/mobile-menu behaviour, responsive layout, horizontal overflow, long-text handling, empty/loading/error states, success messages, disabled controls, confirmation dialogs, destructive warnings, validation messages, keyboard navigation, focus indicators, colour contrast, accessibility labels, terminology, or date/currency/number formatting consistency.
2. **Rendered PDF inspection (most of Phase 10).** A4 sizing, margins, logo placement, table alignment, long-description wrapping, multi-page behaviour, repeated headers, page breaks, signature area, clipping, the actual downloaded filename, and exact screen-vs-PDF total agreement.
3. **Interactive CRUD edge cases (much of Phase 3).** Duplicate submission, refresh-after-save, browser back/forward, invalid data, empty required fields, very long text, special characters in forms, decimal/zero/negative inputs, and simulated network failure — per form, through the UI.
4. **Runtime confirmation of the XSS payload rendering.** React escaping makes this near-certainly safe and there is only one benign `dangerouslySetInnerHTML`, but I did not visually confirm that the `<b>test</b>` customer name renders as literal text on screen and in the PDF.
5. **Observed dashboard figures.** Every formula in §11 was read from source and the calculation harness exercised the money functions directly, but I did not transcribe the rendered dashboard cards and reconcile them against source records by hand.
6. **Negative stock behaviour in the UI.** Whether the app blocks, warns, or silently accepts a negative quantity. `confirmOversell` and `stockShortagesForQty` exist and imply a warning on oversell, but the manual-edit path was not tested. `STK-008` describes the consequence if negatives are permitted.
7. **Delete protection for clients/suppliers with transactions.** Whether deleting a customer who has invoices is blocked, warned, or orphans the documents. No referential integrity exists in the data model, so orphaning is structurally possible.
8. **Import/export round-trip.** Inventory import from spreadsheet/CSV, export accuracy, and malformed-file handling.
9. **Offline behaviour.** The service worker and `/counter` ("Offline — counter still works") imply offline support; neither offline operation nor reconnect-and-sync was exercised.
10. **Barcode scanning, label printing, photo upload.** Require physical devices or a real Storage bucket.
11. **WebAuthn / Face ID.** Requires a platform authenticator; only reviewed in source (and it correctly gates on `requireOperatorAccessToken`).

### Not verifiable in this environment

12. **Production Supabase state.** Whether the migrations in the repository are actually applied to the live project, whether the `part-photos` bucket is public in production, and whether other keys or policies exist. Everything in §14 is derived from repository migrations.
13. **Whether Vercel sanitises `X-Forwarded-For`.** Determines the live exploitability of `SEC-001` (§18 Q6). The code defect stands regardless.
14. **Backup and restore.** Supabase backup tier and whether a restore has ever been tested (§18 Q5).
15. **Real-world data volume and timings.** All performance figures are from build output and source analysis, not production telemetry.
16. **Titus integration end-to-end.** Deliberately not exercised: it posts credentials to a live third-party site.

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

*Verify:* re-run the rate-limit probe from §14 and confirm rotated-IP attempts now lock out; confirm
unauthenticated server-function calls return 401.

### Stage 1 — Stop financial and stock data loss (no schema change required)

5. **`FIN-001`** — Make `healDocumentsAmountPaid` non-destructive: never lower `amountPaid`; flag
   divergence for review instead. **Back up the `documents` blob before deploying**, then audit for
   invoices already damaged by past merges.
6. **`STK-001`** — Reorder `convertQuoteToInvoice` to commit the document *before* deducting stock,
   make the deduction idempotent on `invoice.stockDeducted`, and add a re-entrancy guard.
7. **`STK-004`** — Move revert validation ahead of the stock restore.
8. **`FIN-002`** — Make `roundMoney` symmetric and correct at large magnitudes.

*Verify:* add the regression tests from §16 for each; these four are the highest-value tests in the
codebase.

### Stage 2 — Establish traceability (prerequisite for trusting anything else)

9. **`STK-002`** — Add an append-only stock movement log. Route all 14 sites through one
   `recordMovement()` helper and make `adjustPartQuantity` private. Surface history on the part page.
10. **`STK-003`** — Record phantom/document-created stock as an explicit goods-in movement.
11. Add a **document/payment audit log** on the same pattern, so `FIN-001`-class events are visible.

*Why here:* without this, you cannot confirm the Stage 1 fixes actually worked in production.

### Stage 3 — Correctness of what the business sees

12. **`RPT-001`** — Rebuild "paid sales" from one source; subtract credit notes; stop reading the
    zombie `orders` collection (pending Q10).
13. **`FIN-004`** — Consolidate on one subtotal function used by UI, PDF, and ratio.
14. **`RPT-002`** — Single low-stock definition shared by the dashboard and `/low-stock`.
15. **`RPT-003`** — Group revenue by client id, not name.
16. **`FIN-003`** — Add payment terms and `dueDate`; derive `Overdue`; age against due date (Q4).
17. **`FIN-007`** — Backfill receipts, then remove the status-based paid fallback.
18. **`FUN-005`** — Reject `NaN`/`Infinity` at input boundaries instead of coercing to 0.

### Stage 4 — Quality gates (cheap, prevents regression)

19. **`BLD-001`** — Add a `typecheck` script and fix the `delivery-board.tsx` error (`FUN-004`).
20. Run `npm run format` once to clear 977 formatting errors, then enforce it.
21. **`PERF-004`** — Fix the 35 `exhaustive-deps` warnings, starting with the six context files.
22. **Add CI** running typecheck, lint, and tests. Nothing is currently enforced.
23. **`DEP-002`** — Resync `package-lock.json` so `npm ci` works; resolve the `@zxing` Node-24 engine
    requirement.
24. **`DEP-001`** — Patch the six fixable advisories; decide on `xlsx`, which has no fix and parses
    untrusted files.

### Stage 5 — Complete the audit (I recommend this before Stage 6)

25. Finish Phases 9 and 10 — the browser-driven design, responsive, and rendered-PDF passes listed
    in §17. Roughly a third of the original scope is still `NOT VERIFIED`, and design defects are
    cheap to fix but only findable by looking.

### Stage 6 — The architectural decision (largest change; needs your call)

26. **`PERF-002` / `PERF-003` / `DAT-001`** — Decide whether to normalise `documents` and `inventory`
    into real tables with foreign keys, unique constraints, indexes, transactions, and pagination.

    This is invasive: it touches every data context, every route that reads them, the merge layer,
    and the migration history, and it needs a careful data migration out of the JSON blobs. But
    `FIN-001`, `STK-001`, `STK-006`, `FUN-003`, `PERF-002`, and `PERF-003` are all symptoms of the
    current model, and client-side patches to each will keep regressing. A middle path, if a full
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

All 27 routes are inventoried in §3. **Static analysis: 27/27.** **Runtime exercise: partial** —
`/` and the operator gate were exercised via the running build and server probes; the remaining
pages were mapped from source but not individually driven through a browser (§17).

### `shop_state` keys — 12/12

`inventory`, `parties`, `documents`, `fleet`, `cart`, `kits`, `prefs`, `shipments`, `share-inbox`,
`pre-orders`, `operator_rate_limits`, `operator_webauthn` — all mapped in §4. Legacy relational
tables (8) confirmed dead and revoked.

### Server functions — 7/7 authorisation-reviewed

| Endpoint | Auth | Verified |
|---|---|---|
| `unlockOperator` | PIN + rate limit | ✅ Runtime probe — **rate limit bypassable** (`SEC-001`) |
| `fetchPortalStatement` | Portal token + rate limit | ✅ Source review (`SEC-004`) |
| `beginFaceIdRegister` | `requireOperatorAccessToken` | ✅ Source review |
| `finishFaceIdRegister` | `requireOperatorAccessToken` | ✅ Source review |
| `beginFaceIdUnlock` | Pre-auth by design | ✅ Source review |
| `finishFaceIdUnlock` | Pre-auth by design | ✅ Source review |
| `syncTitusOrders` | **none** | ❌ Runtime probe — **unauthenticated** (`SEC-002`) |

### Document types — 5/5

`quotation`, `invoice`, `receipt`, `credit_note`, `inquiry` — all mapped, with seeded fixtures for
each; money and status logic verified by harness.

### Major flows

| Flow | Status |
|---|---|
| Quotation → invoice conversion | ✅ Source-verified; **2 defects** (`STK-001`, `FUN-001`) |
| Invoice → quotation revert | ✅ Source-verified; **1 race** (`STK-004`) |
| Payment / receipt → balance and status | ✅ Harness-verified; **1 P0** (`FIN-001`) |
| Credit note / return → stock and balance | ✅ Source-verified; **1 defect** (`FIN-002` residue) |
| Stock deduction and restoration | ✅ Source-verified; **2 P0** (`STK-001`, `STK-002`) |
| Multi-device merge and conflict resolution | ✅ Harness-verified; **1 P0** (`FIN-001`) |
| Operator unlock | ✅ Runtime-verified; **1 P0** (`SEC-001`) |
| Client portal | ✅ Source-verified; **1 defect** (`SEC-004`) |
| Dashboard and report calculations | ✅ Formulas documented (§11); **3 defects** (`RPT-001`…`003`) |
| PDF generation | ⚠️ Source-verified; **rendered output NOT VERIFIED** |
| Import / export | ❌ **NOT VERIFIED** |
| Offline / share target | ⚠️ Source-verified; **runtime NOT VERIFIED** |

### Honest scorecard by phase

| Phase | Coverage |
|---|---|
| 1 — Project understanding | ✅ Complete |
| 2 — Technical verification | ✅ Complete |
| 3 — Feature testing | ⚠️ Partial — logic verified by harness; interactive UI edge cases not driven |
| 4 — Inventory | ⚠️ Mostly — 8 findings; negative-stock UI behaviour and import/export unverified |
| 5 — Quotations | ✅ Logic complete — 4 findings |
| 6 — Invoices and payments | ✅ Logic complete — 7 findings |
| 7 — Customers and suppliers | ⚠️ Partial — model reviewed; delete protection unverified |
| 8 — Reports and dashboard | ✅ All formulas documented — 3 findings; rendered figures not transcribed |
| 9 — Design and UX | ❌ **NOT VERIFIED** |
| 10 — Printing and PDF | ⚠️ Partial — source reviewed; rendered output not inspected |
| 11 — Security | ✅ Complete — 8 findings, 2 confirmed by live probe, 11 controls verified sound |
| 12 — Performance | ⚠️ Mostly — build/architecture analysed; runtime timings not measured |

---

## Appendix B — Full findings index

| ID | P | Area | Summary |
|---|---|---|---|
| `SEC-001` | **P0** | Auth | PIN lockout bypassed by spoofing `X-Forwarded-For` — demonstrated |
| `SEC-002` | **P0** | Auth | `syncTitusOrders` unauthenticated; relays credentials to a third party |
| `FIN-001` | **P0** | Payments | Payments without receipt documents silently and permanently erased on merge |
| `STK-001` | **P0** | Stock | Stock deducted before conversion commits; no rollback; double-deduct on retry |
| `STK-002` | **P0** | Stock | No stock movement audit trail across 14 mutation sites |
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
| `FIN-004` | P2 | Money | Two different subtotal definitions (0.12 vs 0.06 demonstrated) |
| `FIN-005` | P2 | Money | Tax hardcoded to 0; no VAT configuration |
| `FIN-006` | P2 | Money | Currency effectively hardcoded to USD |
| `FIN-007` | P2 | Payments | `invoiceAmountPaid` masks corruption; infers payment from status |
| `FUN-002` | P2 | Documents | No structured numbering; ids double as customer-facing numbers |
| `FUN-003` | P2 | Documents | Duplicate document ids possible by construction |
| `FUN-004` | P2 | Navigation | `/documents` link omits required search params |
| `FUN-005` | P2 | Global | `NaN`/`Infinity` silently coerced to 0 |
| `QUO-001` | P1 | Quotations | No expiry date, so `Expired` cannot exist |
| `QUO-002` | P2 | Quotations | Status set does not cover the lifecycle |
| `QUO-003` | P2 | Quotations | Quotations never reserve stock, with no warning |
| `QUO-004` | P2 | Quotations | "Deduct stock?" is a free choice per conversion |
| `STK-005` | P2 | Inventory | Part-number uniqueness enforced on create but not update |
| `STK-006` | P2 | Inventory | Concurrent creates can duplicate a part number |
| `STK-007` | P2 | Inventory | `removePart` silently resets quantity and pricing |
| `STK-008` | P2 | Inventory | Valuation unrounded and reduced by negative stock |
| `RPT-002` | P2 | Reports | Two different low-stock definitions |
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
| `PDF-001` | P2 | PDF | No page numbers |
| `PDF-002` | P2 | PDF | Filename lacks date and customer |
| `UX-001` | P3 | UI | `dangerouslySetInnerHTML` in chart CSS (not currently exploitable) |
| `PDF-003` | P3 | PDF | Three near-duplicate PDF total blocks |
| `PDF-004` | P3 | PDF | 709 KB of base64 assets in source |
| `PERF-005` | P3 | Reliability | Conflict retry loop has no backoff or ceiling |
| `BLD-002` | P3 | Build | Dev server logs `node:crypto` externalisation error from a server module |
| `DEP-002` | P3 | Deps | `package-lock.json` out of sync; `npm ci` fails |
| `DEP-003` | P3 | Repo | Stray `bunfig.toml` alongside `package-lock.json` |
| `DEP-004` | P3 | Repo | Committed `routeTree.gen.ts` is stale |
| `LNT-001` | P3 | Lint | 985 lint errors (977 formatting); 8 `no-useless-escape` |
