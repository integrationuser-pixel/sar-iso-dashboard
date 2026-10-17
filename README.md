# SAR ISO Tank SG — Dashboard

Next.js app that reads the SARFD data synced into MongoDB (`sar_iso_dashboard`) by `../sarfd_sync.py`.

Pages: **Sales Performance** (`/sales`). M&R Operations, Admin and the weekly-call views come next.

## Sales Performance — how numbers are computed

- **Source:** `tblInvoice` charge lines (`recordType = "C"`) for sales vouchers only:
  PSI (Principal Sales Invoice), SLI (Sub Lease), SDI (Sundry), MRI (M&R Sales), DN (Debit Note Agency), CN (Credit Note).
  Purchase vouchers and proforma invoices are excluded.
- **Amount:** `chargeTotalAmountHc` (home currency, USD). Credit notes are subtracted, so every figure is net.
- **Period:** by `invoiceDate`. Default view is the trailing 12 months.
- **Category:** `chargeName` is looked up in the `chargeMappings` collection (Lease / Detention / EXIM / M&R); unmapped charges count as Other.
  Seed defaults with `npm run seed:mappings`, then edit the collection.
- **Agent:** `billingPartyName`. **Trade lane:** `polName → podName`. Sundry invoices and lines with no BL are left out of the lane chart.
- **INR:** USD × the rate typed in the filter bar (default 88, remembered per browser).

## Speed

The Atlas cluster downloads slowly (~100 KB/s), so the built sales data is stored gzipped in the
`dashboardCache` collection and only rebuilt after a new `tblInvoice` sync or a mapping change.
The first page load after a sync takes ~15 s; later loads take ~1 s.

## Run locally

```bash
cp .env.example .env.local   # then fill in MONGODB_URI
npm install
npm run dev                  # http://localhost:3000
```

## Deploy to Vercel

1. Import this folder as a Vercel project (framework: Next.js).
2. Set environment variables: `MONGODB_URI`, `MONGODB_DB=sar_iso_dashboard`, `DASHBOARD_USER`, `DASHBOARD_PASSWORD`.
   Without the last two, the deployed site refuses all access.
3. In MongoDB Atlas → Network Access, allow Vercel to connect (Vercel has no fixed IPs on the Hobby plan, so this usually means `0.0.0.0/0`).
