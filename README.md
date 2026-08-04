# QuickTrack — AI-Powered Expense & Receipt Ledger

A personal finance tracker that goes beyond basic expense logging: snap a photo
of a receipt and AI fills in the details, set monthly budgets per category with
overspend alerts, and ask your ledger plain-English questions about your own
spending.

Built for the DevOps Internship Session 3 assignment — a full production
deployment, not just a local demo.

**Live app:** https://quicktrackexpenses.duckdns.org/
**Demo video:** https://YOUR-LINKEDIN-POST-HERE

---

## Why I built this

Manually tracking expenses is tedious enough that most people give up on it
within a week. QuickTrack removes the friction at the two points people quit:
typing every line item by hand (solved with AI receipt scanning) and having no
idea if they're overspending until the bill arrives (solved with live budget
alerts).

## Features

- **Email/password authentication** — each user's data is private, enforced
  at the database level with Supabase Row Level Security (not just hidden in
  the UI).
- **AI receipt scanning** — upload a photo of a receipt; Gemini's vision model
  extracts the merchant, amount, and category automatically.
- **Smart category auto-suggest** — typing "Uber to work" suggests
  "Transport" instantly, no API call needed.
- **Monthly budgets with visual alerts** — set a Rs. limit per category; the
  progress bar shifts from green → amber → red as you approach/exceed it.
- **Ask-your-ledger AI assistant** — ask questions like "how much did I spend
  on food this week?" and get an answer grounded in your real data.
- **Editable, receipt-styled ledger** — every entry can be edited or voided;
  the whole layout is styled like an actual paper receipt (dashed line items,
  torn edges, monospace amounts).
- **Dark / light mode** — persisted across sessions.
- **File uploads** — receipt images stored in Supabase Storage.

## Tech stack

| Layer          | Choice                                   |
|----------------|-------------------------------------------|
| Framework      | Next.js 14 (App Router)                  |
| Styling        | Plain CSS with theme variables (no UI kit)|
| Database       | Supabase (Postgres + Row Level Security) |
| File storage   | Supabase Storage                         |
| Auth           | Supabase Auth (email/password)           |
| AI             | Google Gemini API (vision + text)        |
| Hosting        | AWS EC2 (Ubuntu) + PM2 + Nginx           |
| SSL            | Let's Encrypt via Certbot                |

## Project structure

```
app/
  layout.js            root layout, fonts, theme bootstrap
  globals.css           theme variables + all styling
  page.js               main ledger (protected route)
  login/page.js          sign in / sign up
  api/ask/route.js       AI assistant endpoint
  api/scan-receipt/route.js   AI receipt-scanning endpoint
lib/
  supabaseClient.js     Supabase client init
```

## Running locally

```bash
npm install
```

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
GEMINI_API_KEY=your-gemini-api-key   # optional — AI features degrade gracefully without it
```

```bash
npm run dev
```
Open http://localhost:3000.

## Database schema

See `supabase/schema.sql` for the full setup (expenses table, budgets table,
Row Level Security policies, and storage bucket policies).

## Deployment

Deployed on an AWS EC2 Ubuntu instance, process-managed with PM2, served
through an Nginx reverse proxy, secured with a free Let's Encrypt SSL
certificate via Certbot.

---

Built as part of the DevOps Internship at Dafi Labs.
