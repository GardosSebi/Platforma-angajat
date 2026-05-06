# Employee Platform Monorepo

Enterprise-ready TypeScript monorepo for an internal employee platform.

## Stack

- Backend: Node.js + NestJS + Prisma + PostgreSQL
- Frontend: React SPA + PWA foundation
- Auth: JWT (+ optional SSO extension point)
- Architecture: API-first, modular monolith, multi-tenant

## Modules

- SSM
- Chatbot & Communication
- Surveys
- Ticketing

## Quick start

1. Copy `.env.example` into `.env`.
2. Install dependencies:
   - `pnpm install`
3. Generate Prisma client:
   - `pnpm --filter @apps/api prisma:generate`
4. Apply migrations and seed (14 tenants `e01`–`e14` + admin pe `e01`):
   - `pnpm --filter @apps/api prisma:migrate`
   - `pnpm --filter @apps/api prisma:seed`
5. Run apps:
   - `pnpm dev`

## Part A – fundație API

- `GET /api/v1/health/live` – liveness
- `GET /api/v1/health/ready` – DB ready
- `POST /api/v1/auth/login` – header `x-tenant-id` (ex. `e01`), body `{ "email", "password" }`
- `POST /api/v1/files/upload` – multipart `file`, JWT + `x-tenant-id`, permisiune `files:upload`

Utilizator seed (implicit): `admin@company.local` pe tenant `e01`, parolă din `SEED_ADMIN_PASSWORD`.

## Part B – master data (fără SAP)

Structură organizațională per tenant: **puncte de lucru**, **departamente**, **posturi (fișă post)**, **angajați** (cu istoric plasament), **grupuri**, **responsabili SSM**.

- `GET/POST /api/v1/master-data/worksites`
- `GET/POST /api/v1/master-data/departments`
- `GET/POST /api/v1/master-data/job-positions`
- `GET/PATCH /api/v1/master-data/employees`, `PATCH .../placement`
- `GET/POST /api/v1/master-data/groups`, `POST/DELETE .../groups/:groupId/members/:employeeId`
- `GET/POST /api/v1/master-data/ssm-responsibles`
- `POST /api/v1/master-data/import/employees` – body JSON `{ "csv": "..." }` (header: `email,fullName` + opțional `cnp,worksiteCode,departmentCode,jobCode,hireDate,leaveDate,active`)

Permisiuni: `master-data:read`, `master-data:write`, `master-data:import`. CNP stocat criptat (AES); afișare clară doar cu `master-data:write`.

Seed creează pe `e01` coduri exemplu: worksite `HQ`, departament `ADMIN`, post `MGR`.
