# Larkspur Learning Studio — sample appointment-booking app

> **Sample project.** Larkspur Learning Studio is a fictional tutoring business made for a freelance portfolio. All people, emails and prices are invented, and bookings are not real.

A small full-stack booking app: list services, pick a day and an open time slot, book, get a confirmation page, and manage bookings from a password-protected admin page.

**Live:** _pending first deploy_ (see [Deployment](#deployment))

## Stack

Next.js (App Router, server actions) · TypeScript · Tailwind CSS v4 · Prisma 7 · Postgres (Neon) · zod · Luxon · Resend (optional) · Vitest · Playwright + axe-core · GitHub Actions · Vercel

## Features

- **Services** loaded from the database; **date picker** (next 14 days, closed days disabled) and **time-slot grid** showing only genuinely open slots
- **Booking form** with server-side zod validation, honeypot, and per-IP rate limiting; **confirmation page** with an unguessable reference and an `.ics` calendar download
- **No double booking, enforced by the database.** A Postgres GiST exclusion constraint (`bookings_no_overlap`) rejects any two `CONFIRMED` bookings whose time ranges overlap, even if two requests race past the app-level check. The loser sees "that time was just taken". Cancelled bookings don't count, so their slot reopens. See [`prisma/migrations/*_init/migration.sql`](./prisma/migrations)
- **Timezone-correct availability.** Opening hours are interpreted in the business time zone (America/New_York). Slots are stored as UTC instants. DST gaps are skipped and durations are measured in real elapsed time
- **Admin** (`/admin`, password from `ADMIN_PASSWORD`): HMAC-signed httpOnly session cookie, constant-time password check, login rate limit; list, filter (status, date range, name/email/reference) and cancel bookings (two-step confirm)
- **Email** via Resend when `RESEND_API_KEY` is set; otherwise skipped and logged, and the UI says so honestly
- No secrets client-side; every input (query params, form fields, admin filters, reference) goes through zod

## Run locally

```bash
npm install                      # also runs `prisma generate`
docker run -d --name booking-pg -p 54329:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=booking postgres:16-alpine
cp .env.example .env.local       # set ADMIN_PASSWORD and SESSION_SECRET
npx prisma migrate deploy        # applies migrations incl. the exclusion constraint
npm run db:seed                  # 6 services + ~20 realistic sample bookings
npm run dev
```

| Script                           | What it does                                                   |
| -------------------------------- | -------------------------------------------------------------- |
| `npm run lint` / `typecheck`     | ESLint / `tsc --noEmit`                                        |
| `npm test`                       | Unit tests (slots, schemas, auth, rate limit) + DB integration |
| `npm run test:e2e`               | Playwright at 390px and 1440px (booking + admin flows, axe)    |
| `npm run db:seed`                | Reset bookings and load sample data                            |
| `sh scripts/lighthouse.sh <dir>` | Lighthouse mobile on every page (needs `npm start -p 3418`)    |

`npm test` and `npm run test:e2e` **wipe the database named by `TEST_DATABASE_URL`**. Never point it at real data.
