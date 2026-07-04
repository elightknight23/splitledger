# SplitLedger

A Splitwise-style group expense splitter, built fundamentals-first: every piece of logic — auth, money math, the settlement algorithm — is hand-rolled and explainable, not outsourced to a library.

Split expenses with a group, see live-computed balances, and settle up with the minimum number of payments.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS v4 |
| Backend | Node.js + Express + TypeScript |
| ORM / DB | Prisma + PostgreSQL (Docker for local dev) |
| Auth | JWT access + refresh tokens, bcrypt — rolled by hand |

## Features

- **Groups** — create a group, invite members by email (they must accept the invite to join), leave a group once your balance is settled, delete a group if you created it
- **Currencies** — each group is denominated in one currency chosen at creation (USD, EUR, GBP, INR, CAD, AUD, SGD); every amount in the group displays in it
- **Expenses** — equal or custom splits (plus percent/shares modes in the UI), edit/delete your own entries
- **Balances** — every member's net position, computed live from the ledger on every read; there is no stored balance column to drift out of sync
- **Settle up** — a minimum-transaction algorithm suggests who pays whom; one click records the settlement and balances update immediately
- **Activity** — a unified chronological feed of expenses and settlements, filterable by member

## Design decisions worth knowing

- **Balances are always derived, never stored.** Each `GET /groups/:id/balances` recomputes from `Expense` + `ExpenseSplit` + `Settlement`. Costs a little on every read, guarantees the number can never disagree with the ledger.
- **All money math is integer cents.** Floats never touch amounts (`0.1 + 0.2 !== 0.3`); parsing, split validation, and remainder distribution all happen in cents, and Postgres stores `Decimal(10,2)`.
- **Currency is per-group and immutable.** Set at creation, never converted — a later change would silently re-denominate historical expenses. The allowlist is limited to 2-decimal ISO 4217 currencies because the cents-based math assumes a minor unit of 100 (so no JPY).
- **The settlement algorithm is a pure function** (`backend/src/services/settlement.service.ts`): net every balance, then greedily match the largest creditor with the largest debtor until everything zeroes out. DB-free, unit-testable, and deliberately written in its "obviously correct" form.
- **Refresh tokens live in an httpOnly cookie** scoped to `/auth/refresh`; access tokens live only in frontend memory (never localStorage). A silent refresh on page load restores the session.
- **Business logic lives in `services/`**, routes stay thin and only parse/validate/translate errors to status codes.

## Getting started

Prerequisites: Node 22+, Docker.

### 1. Database

```bash
cp .env.example .env          # then edit values (especially the password)
docker compose up -d          # starts Postgres 16 with a named volume
```

### 2. Backend

```bash
cd backend
cp .env.example .env          # set DATABASE_URL + two JWT secrets
npm install
npx prisma migrate dev        # create schema
npm run dev                   # http://localhost:4000
```

Generate strong JWT secrets, e.g. `openssl rand -hex 32` for each of `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

The frontend reads `VITE_API_URL` (defaults to `http://localhost:4000`); the backend's `FRONTEND_URL` env var must match the frontend origin for CORS.

## API overview

```
POST   /auth/register            POST   /auth/login
POST   /auth/refresh             POST   /auth/logout

POST   /groups                   GET    /groups
GET    /groups/:id               DELETE /groups/:id        # creator only
POST   /groups/:id/invites       POST   /groups/:id/leave  # leave requires zero balance

GET    /invites                  # pending invites for the current user
POST   /invites/:id/accept       POST   /invites/:id/decline

POST   /groups/:id/expenses      GET    /groups/:id/expenses
PUT    /groups/:id/expenses/:eid DELETE /groups/:id/expenses/:eid

GET    /groups/:id/balances      # includes suggested settlements
POST   /groups/:id/settlements   GET    /groups/:id/settlements
```

All routes except `/auth/*` require a Bearer access token; group routes verify membership and return 403 for non-members.

## Project structure

```
backend/
  prisma/schema.prisma      # 6 tables: User, Group, GroupMember,
  src/                      #   Expense, ExpenseSplit, Settlement
    routes/                 # thin HTTP layer
    services/               # business logic (settlement algorithm lives here)
    middleware/             # JWT auth
    lib/money.ts            # integer-cents money math
frontend/
  src/
    pages/                  # Login, Register, Dashboard, GroupDetail
    components/             # tabs, modals, cards
    api/client.ts           # fetch wrapper, in-memory access token
    context/AuthContext.tsx # session state + silent refresh
```
