# Grand Mayfair website and CRM

A complete hospitality and holiday membership website, with a database-backed customer portal, employee workspace, and administrator CRM.

## Features

- Public pages: home, hotels/property details, India/international, destinations, packages, activities, travel desk, membership, experiences, company story, contact, customer care, account access, payment information and policy guidance.
- Searchable reference catalogue: 488 properties, 251 destinations, six holiday ideas and 12 activities. Hotel enquiries preserve the property and destination in the CRM.
- Public motion: atmospheric hero, image parallax, staggered reveals, catalogue counters, reading progress and page transitions, with reduced-motion support.
- Real enquiry submission with reference numbers and downloadable summaries.
- Customers: their own enquiries, memberships, booking records, and profile.
- Employees: assigned enquiries/customers, internal notes, travel proposals, and follow-ups.
- Administrators: customer/staff accounts, enquiry assignment, approved memberships and entitlement, booking confirmation, manual receipts, tasks, destination content, contact settings, reports, activity log, and scoped read-only role previews.
- Search, filters, server pagination, CSV export of the current authorised page, responsive layouts, and native accessible dialogs.

## Hosting and authentication

The deployment uses a Worker and the `DB` D1 binding declared in `.openai/hosting.json`. The platform applies the tracked Drizzle SQL migrations; no runtime schema changes occur. Keep the Site’s existing identity when deploying an update.

Set the secret runtime environment variable `CRM_OWNER_EMAIL` to the Site owner's verified sign-in email. That account is the protected administrator. New authenticated users start as customers. An administrator can add an employee account using that person's verified email before their first sign-in. This creates an invitation record; it does not send email.

Authentication is handled by the platform's `/signin-with-chatgpt` and `/signout-with-chatgpt` endpoints. The Worker trusts only verified identity headers supplied by the hosting dispatcher. Deploy behind that dispatcher; do not expose this Worker through a separate origin that permits clients to spoof those headers. Role and record permissions are checked on every API request. Anonymous enquiries are never automatically claimed by matching an email; administrators link verified customer accounts explicitly.

The Site's audience remains private for review. Hosting audience access and CRM account roles are separate: a staff/customer role does not itself give someone access to a private Site.

## Run and verify locally

Use Node 26 or later and install the pinned dependencies with `npm ci`.

```
npm run build
npm run validate
npm run dev
```

Preview: `http://127.0.0.1:4173`. The loopback-only development server uses a local SQLite file under ignored `.sites-runtime/` and test personas selected with `?persona=admin`, `?persona=employee`, or `?persona=customer`. These simulated identities exist only in the development server; they are not deployed. Production contains no preview customers, memberships, bookings, or payments.

The verification script applies the real SQL migration to an in-memory SQLite database and checks permissions, invitation claims, stale edits, customer ownership, membership/booking consistency, amount validation, disabled accounts, role preview, public routes, and assets.

## Client details to replace

Contact email is `info@grandmayfair.example`; the address and office hours are illustrative. Update them from Admin → Contact settings. Destination photography illustrates travel inspiration and does not claim a supplier partnership or live inventory. Membership amounts and terms are entered from approved client information; no fabricated packages or prices are shown on the marketing website.

Receipts are manual accounting records. Online payments, external email delivery, SMS/WhatsApp delivery, and supplier inventory integrations are not connected. Confirmed bookings are entered by an administrator after their separate business confirmation process.

## Source layout

- `public/`: shared styling, client interactions, portal UI, and photography.
- `content/home.html`, `scripts/pages.mjs`, `scripts/marketing.mjs` and `scripts/catalog-*.mjs`: source templates for the public pages.
- `public/data/`: searchable catalogues. `content/reference/`: source facts and provenance; the reference company's commercial offers are retained separately from Grand Mayfair's approved terms.
- `worker/`: API, verified identity and permissions, data helpers, and static asset routing.
- `db/schema.ts`, `drizzle.config.ts`, `drizzle/`: Drizzle schema and generated migrations.
- `scripts/build.mjs`: generates pages and the deployable Worker under `dist/server/`.
- `scripts/verify.mjs`, `scripts/verify-public-ui.mjs`, `scripts/verify-hero.mjs` and `scripts/verify-catalogue.mjs`: API permissions, public routes, catalogue integrity, enquiry prefills and motion checks.

Generate future schema-only migrations with `npm run db:generate`; retain Drizzle snapshots and journal. Never commit `.env`, `.sites-runtime`, credentials, or real customer records.
