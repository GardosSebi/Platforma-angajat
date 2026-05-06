# AGENTS.md

## Project Overview

This is an enterprise internal platform for employee management, including:

- SSM (Health & Safety)
- Chatbot & Communication
- Surveys
- Ticketing (Helpdesk)

The system is multi-tenant and integrates with SAP Business One.

---

## Tech Stack (STRICT)

- Language: TypeScript ONLY
- Backend: Node.js + NestJS
- Frontend: React + TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Auth: JWT (+ optional SSO)
- Mobile: PWA

---

## Architecture

We follow a modular Clean Architecture approach.

### Backend Layers

- Domain
- Application
- Infrastructure
- API

---

## Folder Structure

/apps
  /api
  /web

/packages
  /shared

---

## Coding Rules

- TypeScript everywhere (strict mode)
- No 'any' unless necessary
- Keep logic out of controllers
- Use services/use-cases

---

## Multi-Tenancy

- Every entity must include tenantId
- Enforce isolation via middleware/guards

---

## Security

- JWT authentication
- RBAC
- Optional SSO

---

## Logging & Auditing

- Log userId, tenantId, timestamp, action

---

## API Standards

- RESTful
- Versioned: /api/v1

---

## Example Entity

export interface Employee {
  id: string;
  tenantId: string;
  fullName: string;
  email: string;
  isActive: boolean;
}
