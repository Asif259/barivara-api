# BariVara Backend API (বাড়িভাড়া)

> **Bangla-First Rental & Property Management Backend REST API**  
> Built with **NestJS**, **TypeScript**, **Prisma ORM**, **PostgreSQL**, and **JWT Authentication**.

---

## 🌟 Key Features & Architectural Guarantees

1. **Dual Language Support (বাংলা & English)**:
   - Request with `Accept-Language: bn` (default) or `Accept-Language: en` (or query param `?lang=en|bn`).
   - Standardized error codes and user-facing messages translated across both languages.
2. **Precision Financial Arithmetic**:
   - PostgreSQL `Decimal(12, 2)` and `Decimal.js` calculations prevent JavaScript floating-point errors.
3. **Atomic Financial Transactions**:
   - Payment creation, payment reversals, and rental agreements execute in atomic Prisma transactions (`prisma.$transaction`).
4. **Multi-Tenant Ownership & Scope Isolation**:
   - Every property, unit, tenant, agreement, rent bill, and payment is verified against the authenticated user's ownership.
5. **Standard API Response Format**:
   - **Success**: `{ success: true, message: "...", data: {...}, meta?: {...} }`
   - **Error**: `{ success: false, message: "...", errorCode: "...", details?: [...] }`
6. **OpenAPI / Swagger Documentation**:
   - Interactive docs with Bearer auth available at `http://localhost:3000/api/docs`.

---

## 🏗️ Architecture & Modules

```text
src/
├── auth/                 # Register, Login (email/phone), Refresh Token, Logout, Me
├── users/                # User profile & lookup
├── properties/           # Property CRUD, summaries, soft-delete
├── units/                # Unit CRUD, status transitions (VACANT, OCCUPIED, MAINTENANCE, INACTIVE)
├── tenants/              # Tenant CRUD, NID privacy, profile & ledger
├── rental-agreements/    # Agreement creation, overlap prevention, unit occupancy, termination
├── monthly-rents/        # Rent generation engine, due-date clamping (Feb 28/29), lazy overdue check
├── payments/             # Atomic payments, append-only history, reversal flow
├── expenses/             # Property expense tracking & categories
├── reminders/            # Due-date & custom in-app notifications
├── dashboard/            # High-level metrics: occupancy, expected, collected, outstanding
├── reports/              # Monthly reports, tenant statements, CSV export
├── health/               # /api/v1/health check
├── audit-logs/           # Activity auditing for financial and security events
└── common/               # Filters, interceptors, guards, decorators, error codes, utils
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v24)
- **PostgreSQL**: Local PostgreSQL or Supabase / Docker

### 2. Installation
```bash
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env` and set your PostgreSQL database URL:
```bash
cp .env.example .env
```

```env
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/barivara?schema=public"
JWT_ACCESS_SECRET="your-access-secret"
JWT_REFRESH_SECRET="your-refresh-secret"
```

### 4. Database Setup & Seeding
```bash
# Start PostgreSQL via Docker (if using Docker)
docker-compose up -d

# Push schema to database
npx prisma db push

# Generate Prisma Client
npx prisma generate

# Seed sample development fixtures
npx prisma db seed
```

### 5. Running the Application
```bash
# Development mode with hot-reload
npm run start:dev

# Production build
npm run build
npm run start:prod
```

### 6. Interactive API Documentation
Open your browser and navigate to:
```text
http://localhost:3000/api/docs
```

---

## 🧪 Testing

```bash
# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch
```

---

## 📋 Standard API Endpoints (`/api/v1`)

| Module | Method | Endpoint | Description |
|---|---|---|---|
| **Health** | `GET` | `/api/v1/health` | System health check |
| **Auth** | `POST` | `/api/v1/auth/register` | Register new user |
| **Auth** | `POST` | `/api/v1/auth/login` | Login with email or phone |
| **Auth** | `POST` | `/api/v1/auth/refresh` | Refresh JWT access token |
| **Auth** | `POST` | `/api/v1/auth/logout` | Logout |
| **Auth** | `GET` | `/api/v1/auth/me` | Current user profile |
| **Properties** | `POST` | `/api/v1/properties` | Create property |
| **Properties** | `GET` | `/api/v1/properties` | List properties (paginated) |
| **Properties** | `GET` | `/api/v1/properties/:id/summary` | Property monthly financial & unit summary |
| **Units** | `POST` | `/api/v1/properties/:propertyId/units` | Create unit under property |
| **Units** | `GET` | `/api/v1/properties/:propertyId/units` | List units under property |
| **Tenants** | `POST` | `/api/v1/tenants` | Create tenant |
| **Tenants** | `GET` | `/api/v1/tenants` | List tenants |
| **Tenants** | `GET` | `/api/v1/tenants/:id` | Tenant detailed profile & statement |
| **Agreements** | `POST` | `/api/v1/rental-agreements` | Create rental agreement |
| **Agreements** | `POST` | `/api/v1/rental-agreements/:id/end` | End agreement |
| **Monthly Rent** | `POST` | `/api/v1/monthly-rents/generate` | Idempotent monthly rent generator |
| **Monthly Rent** | `GET` | `/api/v1/monthly-rents/outstanding` | Outstanding / overdue rent bills |
| **Payments** | `POST` | `/api/v1/payments` | Record payment (transaction safe) |
| **Payments** | `POST` | `/api/v1/payments/:id/reverse` | Reverse payment |
| **Expenses** | `POST` | `/api/v1/expenses` | Add property expense |
| **Reminders** | `POST` | `/api/v1/reminders` | Create reminder |
| **Dashboard** | `GET` | `/api/v1/dashboard/overview` | Overall dashboard metrics |
| **Reports** | `GET` | `/api/v1/reports/monthly` | Monthly income / expense report |
| **Reports** | `GET` | `/api/v1/reports/monthly/export?format=csv` | Export monthly report to CSV |

---

## 🌐 Bilingual Language Switching

Clients can send the language header or query parameter:
- Header: `Accept-Language: bn` (default) $\to$ Messages in Bangla (বাংলা)
- Header: `Accept-Language: en` $\to$ Messages in English
- Query: `?lang=en` or `?lang=bn`
