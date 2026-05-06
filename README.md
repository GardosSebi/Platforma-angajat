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
4. Run apps:
   - `pnpm dev`
