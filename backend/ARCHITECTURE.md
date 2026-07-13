# Architecture — Electronic Asset Finance Management System

> Backend architecture documentation for the Electronic Asset Finance Management System (EAFMS),
> a role-based digital lending platform for financing electronic assets (mobiles, laptops, TVs, etc.).
> Built on Supabase (PostgreSQL + Auth + Edge Functions) with a React frontend.

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Database Design](#2-database-design)
3. [Role-Based Access Control](#3-role-based-access-control-rbac)
4. [Row-Level Security Strategy](#4-row-level-security-strategy)
5. [Edge Functions Architecture](#5-edge-functions-architecture)
6. [Application Workflow States](#6-application-workflow-states)
7. [EMI Calculation Methodology](#7-emi-calculation-methodology)
8. [Audit Logging Strategy](#8-audit-logging-strategy)

---

## 1. High-Level Architecture

The system follows a serverless, BaaS (Backend-as-a-Service) architecture using **Supabase** as the
unified backend. There is no traditional application server — business logic is split between
PostgreSQL database functions, Row-Level Security (RLS) policies, and a small set of Deno-based
Edge Functions for operations that require server-side privileges or orchestration.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         React Frontend (SPA)                        │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────────┐   │
│  │ Auth     │  │ Dashboard│  │ Application│  │ EMI & Payments   │   │
│  │ Context  │  │ & Reports│  │ Workflow   │  │ Scheduler        │   │
│  └────┬─────┘  └────┬─────┘  └─────┬──────┘  └────────┬──────────┘   │
│       │             │              │                  │              │
│       └─────────────┴──────────────┴──────────────────┘              │
│                              │ supabase-js                           │
└──────────────────────────────┼───────────────────────────────────────┘
                               │  HTTPS (JWT in Authorization header)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Supabase Backend                           │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Supabase Auth   │  │  Edge Functions  │  │  Storage (S3)    │  │
│  │  (GoTrue JWT)    │  │  (Deno Runtime)  │  │  Document Files  │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────────────┘  │
│           │                     │ service-role key                  │
│           ▼                     ▼                                   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              PostgreSQL Database                              │   │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │   │
│  │  │ 11 Tables│ │ RLS      │ │ DB Funcs │ │ Triggers         │  │   │
│  │  │ + Indexes│ │ Policies │ │ (EMI, #) │ │ (updated_at)     │  │   │
│  │  └─────────┘ └──────────┘ └──────────┘ └──────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer            | Technology                                    | Purpose                                                              |
| ---------------- | --------------------------------------------- | -------------------------------------------------------------------- |
| Frontend         | React + TypeScript + Vite + Tailwind CSS      | Single-page application, role-based dashboards                       |
| Auth             | Supabase Auth (GoTrue)                        | Email/password authentication, JWT session management                |
| Database         | Supabase PostgreSQL                           | Relational storage, RLS, server-side functions, triggers             |
| Edge Functions   | Deno Runtime (Supabase Edge Functions)        | Server-side orchestration, privileged operations, external services |
| File Storage     | Supabase Storage                              | KYC documents, income proof, asset images                            |
| Client SDK       | `@supabase/supabase-js`                       | Frontend database/auth/storage client                                |

### Communication Patterns

- **Frontend → Database**: Direct queries via `supabase-js` using the anon key + JWT. RLS policies enforce all authorization at the database layer.
- **Frontend → Edge Functions**: `fetch()` calls with `Authorization: Bearer <JWT>` header. Functions verify the user, then use the service-role key to perform privileged operations.
- **Edge Functions → Database**: Service-role key bypasses RLS for administrative operations (status transitions, EMI generation, audit logging, notifications).
- **Edge Functions → Auth**: Admin API for user creation (`seed-demo-users`).

### Design Principles

1. **Thin client, smart database**: The frontend performs simple CRUD through RLS-protected views; complex logic lives in DB functions and edge functions.
2. **RLS as the security boundary**: Every table has RLS enabled. Authorization is enforced at the row level — even if a client constructs a query, they cannot read or modify data they don't own.
3. **Edge functions for orchestration**: Multi-step operations (status transition + approval record + EMI generation + notification + audit log) are handled atomically in edge functions using the service-role key.
4. **Stateless edge functions**: No in-memory state persists across requests. All durable state lives in PostgreSQL tables.
5. **Idempotent migrations**: All schema changes use `IF NOT EXISTS` / `DROP POLICY IF EXISTS` patterns for safe re-application.

---

## 2. Database Design

The database contains **11 tables** organized into four logical domains: **Identity & Catalog**, **Applications**, **Financial**, and **Operational**.

### Entity-Relationship Overview

```
IDENTITY & CATALOG                    APPLICATIONS
┌───────────┐    ┌───────────────┐    ┌────────────────────┐    ┌─────────────┐
│  profiles │◄───│ asset_categ.  │    │ finance_application│───►│  approvals  │
│           │    └───────┬───────┘    │     s              │    └─────────────┘
│ (users)   │            │            └────────┬───────────┘    ┌─────────────┐
└─────┬─────┘     ┌───────▼───────┐           │                │ guarantors  │
      │           │    assets     │◄──────────┘                └─────────────┘
      │           └───────────────┘           │                ┌─────────────┐
      │                                       │                │  documents  │
      │                                       │                └─────────────┘
      │                                       ▼
      │                              ┌────────────────┐
      │                              │  emi_schedules │
      │                              └───────┬────────┘
      │                                      │
      │                                      ▼
      │                              ┌────────────────┐
      │                              │   payments     │
      │                              └────────────────┘
      │
      │                       OPERATIONAL
      │                       ┌────────────────┐  ┌──────────────┐
      └──────────────────────►│ notifications  │  │ audit_logs   │
                              └────────────────┘  └──────────────┘
```

### Table Summary

| #   | Table                  | Domain        | Purpose                                                        | RLS  |
| --- | ---------------------- | ------------- | -------------------------------------------------------------- | ---- |
| 1   | `profiles`             | Identity      | Extended user data linked to `auth.users`; stores role + org   | ✅   |
| 2   | `asset_categories`     | Catalog       | Asset type classifications (Mobile, Laptop, TV)               | ✅   |
| 3   | `assets`               | Catalog       | Individual asset models with pricing and finance limits        | ✅   |
| 4   | `finance_applications` | Applications  | Customer loan applications for assets                          | ✅   |
| 5   | `approvals`            | Applications  | Approval workflow history records per application              | ✅   |
| 6   | `guarantors`           | Applications  | Guarantor records tied to applications                         | ✅   |
| 7   | `documents`            | Applications  | Metadata for uploaded KYC/income documents                     | ✅   |
| 8   | `emi_schedules`        | Financial     | Generated EMI installment schedules per application            | ✅   |
| 9   | `payments`             | Financial     | Payment records against EMI installments                       | ✅   |
| 10  | `notifications`        | Operational   | In-app notification messages for users                         | ✅   |
| 11  | `audit_logs`           | Operational   | Immutable audit trail of user actions                          | ✅   |

### Key Relationships

| From (Table.Column)                | To (Table.Column)        | Type    | On Delete    |
| ----------------------------------- | ------------------------ | ------- | ------------ |
| `profiles.id`                       | `auth.users.id`          | 1:1     | CASCADE      |
| `assets.category_id`                | `asset_categories.id`    | N:1     | SET NULL     |
| `finance_applications.customer_id`  | `profiles.id`            | N:1     | CASCADE      |
| `finance_applications.retailer_id`  | `profiles.id`            | N:1     | SET NULL     |
| `finance_applications.asset_id`     | `assets.id`              | N:1     | SET NULL     |
| `approvals.application_id`          | `finance_applications.id`| N:1     | CASCADE      |
| `approvals.approver_id`             | `profiles.id`            | N:1     | SET NULL     |
| `guarantors.application_id`         | `finance_applications.id`| N:1     | CASCADE      |
| `documents.application_id`          | `finance_applications.id`| N:1     | CASCADE      |
| `documents.customer_id`             | `profiles.id`            | N:1     | CASCADE      |
| `documents.uploaded_by`             | `profiles.id`            | N:1     | SET NULL     |
| `emi_schedules.application_id`      | `finance_applications.id`| N:1     | CASCADE      |
| `payments.emi_id`                   | `emi_schedules.id`       | N:1     | CASCADE      |
| `payments.application_id`           | `finance_applications.id`| N:1     | CASCADE      |
| `payments.customer_id`              | `profiles.id`            | N:1     | SET NULL     |
| `notifications.user_id`             | `profiles.id`            | N:1     | CASCADE      |
| `audit_logs.user_id`                | `profiles.id`            | N:1     | SET NULL     |

### Database Functions & Triggers

| Object                          | Type     | Purpose                                                                                |
| ------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `generate_application_number()` | Function | Returns unique sequential number `APP-YYYY-NNNNNN` using `app_number_seq` sequence    |
| `generate_emi_schedule(uuid)`   | Function | Generates the full reducing-balance EMI schedule for an application; updates `total_payable` |
| `update_updated_at()`           | Trigger  | Auto-updates `updated_at` on row modification (profiles, assets, finance_applications) |

### Performance Indexes

| Index                    | Table                | Column(s)       | Purpose                              |
| ------------------------ | -------------------- | --------------- | ------------------------------------ |
| `idx_profiles_role`      | `profiles`           | `role`          | Filter users by role                 |
| `idx_assets_category`    | `assets`             | `category_id`   | Join assets to categories            |
| `idx_apps_customer`      | `finance_applications` | `customer_id`   | Customer's application lookup        |
| `idx_apps_status`        | `finance_applications` | `status`        | Filter applications by workflow state|
| `idx_guarantors_app`     | `guarantors`         | `application_id`| Guarantors per application           |
| `idx_approvals_app`      | `approvals`          | `application_id`| Approval history per application     |
| `idx_docs_app`           | `documents`          | `application_id`| Documents per application            |
| `idx_emi_app`            | `emi_schedules`      | `application_id`| EMI schedule per application         |
| `idx_payments_emi`       | `payments`           | `emi_id`        | Payments per EMI installment         |
| `idx_notifications_user` | `notifications`      | `user_id`       | User's notification inbox            |
| `idx_audit_user`         | `audit_logs`         | `user_id`       | Audit trail per user                 |

---

## 3. Role-Based Access Control (RBAC)

The system implements four hierarchical roles stored in `profiles.role` with a CHECK constraint.
Roles are assigned at profile creation and stored in the database (not in JWT custom claims) —
RLS policies and edge functions read the role from the `profiles` table at query time.

### Role Hierarchy

```
SUPER_ADMIN  (highest privilege)
    │
    ├── ADMIN
    │     │
    │     ├── RETAILER
    │     │     │
    │     │     └── CUSTOMER  (lowest privilege)
    │     │
    │     └── CUSTOMER
    │
    └── CUSTOMER
```

### Role Definitions

| Role          | Code         | Description                                                       | Typical User           |
| ------------- | ------------ | ----------------------------------------------------------------- | ---------------------- |
| Super Admin   | `SUPER_ADMIN`| Full system access. Manages all users, categories, assets, applications, approvals, audit logs. | Platform owner / IT    |
| Admin         | `ADMIN`      | Operational access. Manages assets, applications, approvals, EMI, payments, audit logs. Cannot manage SUPER_ADMIN users. | Finance manager / loan officer |
| Retailer      | `RETAILER`   | Partner electronics dealer. Creates applications on behalf of customers, manages their customers' applications, uploads documents. | Electronics store partner |
| Customer      | `CUSTOMER`   | End borrower. Creates own applications, views own EMI schedules, makes payments, manages own documents. | Loan applicant         |

### Permission Matrix

| Capability                              | SUPER_ADMIN | ADMIN | RETAILER | CUSTOMER |
| --------------------------------------- |:-----------:|:-----:|:--------:|:--------:|
| View own profile                        | ✅          | ✅    | ✅       | ✅       |
| View all profiles                       | ✅          | ✅    | ✅ (limited) | ❌   |
| Manage asset categories                 | ✅          | ✅    | ❌       | ❌       |
| View asset categories                   | ✅          | ✅    | ✅       | ✅       |
| Manage assets                           | ✅          | ✅    | ✅       | ❌       |
| View assets                             | ✅          | ✅    | ✅       | ✅       |
| Create application (self)               | ✅          | ✅    | ✅       | ✅       |
| Create application (for customer)       | ✅          | ✅    | ✅       | ❌       |
| View own applications                   | ✅          | ✅    | ✅       | ✅       |
| View all applications                   | ✅          | ✅    | ❌       | ❌       |
| View retailer-linked applications       | ✅          | ✅    | ✅       | ❌       |
| Submit application                      | ✅          | ✅    | ✅       | ✅       |
| Review / Approve / Reject / Disburse    | ✅          | ✅    | ❌       | ❌       |
| View guarantors (own app)               | ✅          | ✅    | ✅       | ✅       |
| Manage guarantors (own app)             | ✅          | ✅    | ✅       | ✅       |
| Upload documents                        | ✅          | ✅    | ✅       | ✅       |
| Verify / reject documents               | ✅          | ✅    | ❌       | ❌       |
| View EMI schedules                      | ✅          | ✅    | ✅       | ✅       |
| Update EMI status                       | ✅          | ✅    | ❌       | ❌       |
| Record payments                         | ✅          | ✅    | ✅       | ✅       |
| View payments                           | ✅          | ✅    | ✅ (linked) | ✅ (own) |
| View own notifications                  | ✅          | ✅    | ✅       | ✅       |
| Manage own notifications                | ✅          | ✅    | ✅       | ✅       |
| View audit logs                         | ✅          | ✅    | ❌       | ❌       |
| Insert audit log entries                | ✅          | ✅    | ✅       | ✅       |

### Role Storage & Enforcement

- **Storage**: `profiles.role` column, `TEXT NOT NULL DEFAULT 'CUSTOMER'` with `CHECK (role IN ('SUPER_ADMIN','ADMIN','RETAILER','CUSTOMER'))`.
- **Enforcement layer 1 (RLS)**: Policies use `EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN (...))` to gate row access by role.
- **Enforcement layer 2 (Edge Functions)**: `manage-application` validates `profile.role` against an allowed-roles list per action before performing state transitions.
- **Enforcement layer 3 (Frontend)**: The React UI hides/shows controls based on the authenticated user's role. This is a UX concern only — the backend always re-validates.

---

## 4. Row-Level Security Strategy

Row-Level Security (RLS) is enabled on **every table** in the system. After enabling RLS, a table
is locked down — no rows are visible or writable until explicit policies are added. This is the
primary data-access control mechanism; the frontend's anon key + JWT can only access what RLS permits.

### Strategy Patterns

The system uses three policy patterns depending on the data sensitivity:

#### Pattern A: Owner-Scoped (Self Data)

Used for: `profiles`, `notifications`

```sql
-- User can only see/modify their own rows
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid())
```

#### Pattern B: Owner + Staff-Scoped (Application Data)

Used for: `finance_applications`, `guarantors`, `approvals`, `documents`, `emi_schedules`, `payments`

The owner (customer) can access their own data; staff (admin/super_admin) can access all data;
retailers can access data for applications they are linked to.

```sql
USING (
  customer_id = auth.uid()                                       -- owner
  OR retailer_id = auth.uid()                                    -- linked retailer
  OR EXISTS (SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
             AND p.role IN ('SUPER_ADMIN','ADMIN'))              -- staff
)
```

#### Pattern C: Public-Read + Staff-Write (Catalog Data)

Used for: `asset_categories`, `assets`

All authenticated users can read catalog data; only staff can modify it.

```sql
-- SELECT: all authenticated users
USING (true)

-- INSERT/UPDATE/DELETE: staff only
USING (EXISTS (SELECT 1 FROM profiles p
               WHERE p.id = auth.uid()
               AND p.role IN ('SUPER_ADMIN','ADMIN')))
```

#### Pattern D: Staff-Read + Any-Write (Audit Logs)

Used for: `audit_logs`

Only staff can read audit logs; any authenticated user can insert audit entries (edge functions
insert on behalf of the user).

```sql
-- SELECT: staff only
USING (EXISTS (SELECT 1 FROM profiles p
               WHERE p.id = auth.uid()
               AND p.role IN ('SUPER_ADMIN','ADMIN')))

-- INSERT: any authenticated user
WITH CHECK (auth.uid() IS NOT NULL)
```

### RLS Implementation Rules

1. **All policies are scoped to `authenticated`** — the `anon` role has no access to any table (the app requires sign-in).
2. **`auth.uid()` is used exclusively** — never `current_user`.
3. **Policies are separated by command** — `SELECT`, `INSERT`, `UPDATE`, `DELETE` each have dedicated policies (no `FOR ALL` except on catalog modify).
4. **Parent-child traversal** — child tables (guarantors, approvals, EMI, payments) check access through the parent `finance_applications` row using `EXISTS` subqueries.
5. **Role checks via subquery** — role-based gating uses `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN (...))`.

> **Full policy reference**: See [`docs/RLS_POLICIES.md`](docs/RLS_POLICIES.md) for every policy with its exact SQL expression.

---

## 5. Edge Functions Architecture

The system deploys **4 Edge Functions** on the Supabase Deno runtime. Edge functions handle
operations that cannot be done directly from the client due to RLS restrictions or that require
multi-step orchestration with the service-role key.

### Function Inventory

| #  | Function               | JWT Required | HTTP Method | Purpose                                                          |
| -- | ---------------------- |:------------:|:-----------:| ---------------------------------------------------------------- |
| 1  | `seed-demo-users`      | ❌           | POST        | Provision demo users (1 per role) with auth accounts + profiles  |
| 2  | `dashboard-stats`      | ✅           | GET         | Return role-specific dashboard statistics                        |
| 3  | `manage-application`   | ✅           | POST        | Execute application workflow transitions (submit/review/approve/reject/disburse) |
| 4  | `calculate-emi`        | ✅           | POST        | Calculate EMI + generate full amortization schedule (stateless)  |

### Architecture Pattern

All edge functions follow a consistent pattern:

```
┌─────────────────────────────────────────────────────┐
│                 Edge Function                        │
│                                                     │
│  1. CORS preflight (OPTIONS) → 200                  │
│  2. Verify JWT (auth.getUser) — except seed-demo    │
│  3. Load profile from DB (service-role key)         │
│  4. Role-based authorization check                  │
│  5. Business logic / DB operations                  │
│  6. Return JSON response (always with CORS headers) │
│                                                     │
│  Error handling: try/catch → 500 with error message │
└─────────────────────────────────────────────────────┘
```

### Dual-Client Pattern

Functions that need to both verify the user and perform privileged operations use a dual-client approach:

```typescript
// Client 1: user-scoped — respects RLS, used to verify the JWT
const userClient = createClient(supabaseUrl, anonKey, {
  global: { headers: { Authorization: authHeader } },
});
const { data: { user } } = await userClient.auth.getUser();

// Client 2: service-role — bypasses RLS, used for privileged operations
const supabase = createClient(supabaseUrl, serviceRoleKey);
```

### Function Details

#### 5.1 `seed-demo-users`

- **Auth**: JWT verification **disabled** (`verify_jwt: false`). This is a setup/bootstrap function.
- **Purpose**: Creates 4 demo users — one per role — with auth accounts and corresponding `profiles` rows.
- **Idempotent**: Checks if a profile with the email already exists before creating. Returns `already_exists` for existing users.
- **Admin API**: Uses `supabase.auth.admin.createUser()` with the service-role key to create auth users with `email_confirm: true`.

#### 5.2 `dashboard-stats`

- **Auth**: JWT required. Verifies user and loads profile to determine role.
- **Purpose**: Returns a role-specific statistics payload for the dashboard.
- **Role branching**:
  - **SUPER_ADMIN / ADMIN**: Global stats — total applications, pending approvals, total customers/retailers/assets, total disbursed amount, total receivable, applications grouped by status.
  - **RETAILER**: Partner-scoped stats — applications linked to the retailer, unique customers, total finance amount, applications grouped by status.
  - **CUSTOMER**: Personal stats — total applications, active loans, pending applications, total borrowed, monthly EMI total, next EMI due date/amount, applications grouped by status.
- **Implementation**: Uses `Promise.all` to run multiple queries in parallel for performance.

#### 5.3 `manage-application`

- **Auth**: JWT required.
- **Purpose**: The workflow engine. Executes application state transitions with role authorization, records approval history, generates EMI schedules on approval, sends notifications, and logs audit entries — all in one orchestrated call.
- **Transition table**: A static map of `action → { newStatus, allowedRoles[] }` defines the valid transitions and which roles can perform them.
- **Side effects per transition**:
  - Updates `finance_applications` status + timestamp fields (`submitted_at`, `approved_at`, `disbursed_at`, `rejection_reason`).
  - Inserts an `approvals` record with previous/new status and approver info.
  - On `APPROVE`: Calls `generate_emi_schedule(app_id)` RPC to create the EMI schedule.
  - Inserts a `notifications` row for the customer with a context-appropriate title/message/type.
  - Inserts an `audit_logs` row with action, entity reference, and details JSON.

#### 5.4 `calculate-emi`

- **Auth**: JWT required (though the function is stateless and does not access the database).
- **Purpose**: Pure calculation function. Given a principal, annual interest rate, and tenure, returns the monthly EMI, total payable, total interest, and a full installment-by-installment amortization schedule.
- **Stateless**: Does not read from or write to the database. Used by the frontend's loan calculator UI for preview before application submission.

### CORS Handling

All functions use a fixed CORS header set required for Supabase client compatibility:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
```

Every response — preflight (OPTIONS), success (2xx), and error (4xx/5xx) — includes these headers.

> **Full API reference**: See [`API.md`](API.md) for endpoint URLs, request/response schemas, and examples.

---

## 6. Application Workflow States

Each `finance_applications` row progresses through a finite state machine. The `status` column
has a CHECK constraint limiting it to the defined states. Transitions are executed exclusively
through the `manage-application` edge function, which enforces role authorization per transition.

### State Machine

```
                        ┌─────────┐
                        │  DRAFT  │  ← Application created, not yet submitted
                        └────┬────┘
                             │ SUBMIT (CUSTOMER, RETAILER, ADMIN, SUPER_ADMIN)
                             ▼
                        ┌──────────┐
                ┌──────►│ SUBMITTED │  ← Application sent for review
                │       └─────┬────┘
                │             │ REVIEW (ADMIN, SUPER_ADMIN)
                │             ▼
                │       ┌──────────────┐
                │       │ UNDER_REVIEW  │  ← Being evaluated by finance team
                │       └───────┬──────┘
                │               │
                │       ┌───────┴───────┐
                │       │               │
                │       │ APPROVE       │ REJECT (ADMIN, SUPER_ADMIN)
                │       │ (ADMIN,       │
                │       │  SUPER_ADMIN) ▼
                │       ▼         ┌──────────┐
                │  ┌────────┐     │ REJECTED │  ← Terminal state
                │  │APPROVED│     └──────────┘
                │  └───┬────┘
                │      │ DISBURSE (ADMIN, SUPER_ADMIN)
                │      ▼
                │  ┌──────────┐
                │  │DISBURSED │  ← Loan disbursed, EMI schedule active
                │  └────┬─────┘
                │      │ (all EMIs paid → CLOSED — manual/future)
                │      ▼
                │  ┌────────┐
                └──┤ CLOSED │  ← Terminal state (loan fully repaid)
                   └────────┘
```

### State Definitions

| State         | Description                                      | Next Valid States                  |
| ------------- | ------------------------------------------------ | ---------------------------------- |
| `DRAFT`       | Application created but not yet submitted        | `SUBMITTED`                        |
| `SUBMITTED`   | Application submitted, awaiting review           | `UNDER_REVIEW`                     |
| `UNDER_REVIEW`| Finance team is evaluating the application       | `APPROVED`, `REJECTED`             |
| `APPROVED`    | Application approved; EMI schedule generated     | `DISBURSED`                        |
| `REJECTED`    | Application rejected (terminal)                  | — (none)                           |
| `DISBURSED`   | Loan amount disbursed; EMI repayment active      | `CLOSED`                           |
| `CLOSED`      | Loan fully repaid (terminal)                     | — (none)                           |

### Transition Authorization

| Action     | From State(s)             | To State       | Allowed Roles                           |
| ---------- | ------------------------- | -------------- | --------------------------------------- |
| `SUBMIT`   | `DRAFT`                   | `SUBMITTED`    | CUSTOMER, RETAILER, ADMIN, SUPER_ADMIN  |
| `REVIEW`   | `SUBMITTED`               | `UNDER_REVIEW` | ADMIN, SUPER_ADMIN                      |
| `APPROVE`  | `UNDER_REVIEW`            | `APPROVED`     | ADMIN, SUPER_ADMIN                      |
| `REJECT`   | `SUBMITTED`, `UNDER_REVIEW`| `REJECTED`    | ADMIN, SUPER_ADMIN                      |
| `DISBURSE` | `APPROVED`                | `DISBURSED`    | ADMIN, SUPER_ADMIN                      |

### Transition Side Effects

Each transition executed by `manage-application` performs the following:

| Action     | Status Field Update       | Approval Record | EMI Schedule | Notification to Customer | Audit Log |
| ---------- | ------------------------- |:---------------:|:------------:|:------------------------:|:---------:|
| `SUBMIT`   | `submitted_at = now()`    | ✅              | —            | ✅ "Application Submitted"    | ✅        |
| `REVIEW`   | —                         | ✅              | —            | ✅ "Under Review"             | ✅        |
| `APPROVE`  | `approved_at = now()`     | ✅              | ✅ Generated | ✅ "Application Approved!"    | ✅        |
| `REJECT`   | `rejection_reason = ...`  | ✅              | —            | ✅ "Application Rejected"     | ✅        |
| `DISBURSE` | `disbursed_at = now()`    | ✅              | —            | ✅ "Loan Disbursed"           | ✅        |

---

## 7. EMI Calculation Methodology

The system uses the **reducing balance method** (also known as the *flat-to-reducing* or
*amortized* method) for EMI calculation. Interest is charged on the outstanding principal balance,
which decreases with each payment. This is the standard method used by banks and NBFCs for
consumer durable loans.

### Formula

The monthly EMI is calculated using the standard amortization formula:

```
                    P × r × (1 + r)^n
        EMI  =  ─────────────────────────
                     (1 + r)^n − 1

    where:
        P   = Principal (finance amount)
        r   = Monthly interest rate  =  annual_rate / 12 / 100
        n   = Tenure in months
```

#### Edge Case: Zero Interest Rate

When `r = 0` (interest-free financing), the formula degenerates to simple division:

```
        EMI  =  P / n
```

### Installment Breakdown

For each installment `i` (1 to `n`):

```
    Interest_i    =  Outstanding_Balance × r
    Principal_i   =  EMI − Interest_i
    New_Balance   =  Outstanding_Balance − Principal_i
```

The interest component decreases and the principal component increases with each subsequent
installment — this is the defining characteristic of the reducing balance method.

### Last Installment Adjustment

Due to floating-point rounding, the final installment's principal may not exactly zero out the
balance. The system adjusts the last installment:

```
    Principal_n   =  Outstanding_Balance      (exact payoff)
    EMI_n         =  Principal_n + Interest_n (adjusted final EMI)
```

This guarantees the balance reaches exactly `0.00` after the final installment.

### Rounding

All monetary values are rounded to **2 decimal places** (paise-level precision):

- `amount` (EMI per installment): `round(emi, 2)`
- `principal`: `round(principal_component, 2)`
- `interest`: `round(interest_component, 2)`
- `balance`: `round(max(0, balance), 2)`

### Implementation

The EMI calculation exists in **two places** with identical logic:

| Location                          | Type        | Purpose                                              |
| --------------------------------- | ----------- | ---------------------------------------------------- |
| `generate_emi_schedule()` SQL fn  | PL/pgSQL    | Persists the schedule to `emi_schedules` table on approval |
| `calculate-emi` Edge Function     | TypeScript  | Stateless preview for the loan calculator UI         |

### Example Calculation

**Input**: Principal = ₹50,000, Annual Rate = 12%, Tenure = 12 months

```
    r = 12 / 12 / 100 = 0.01
    EMI = 50000 × 0.01 × (1.01)^12 / ((1.01)^12 − 1)
        = 50000 × 0.01 × 1.12683 / 0.12683
        = 50000 × 0.08885
        ≈ ₹4,442.42/month

    Total Payable  ≈ ₹53,309.04
    Total Interest ≈ ₹3,309.04
```

**Schedule (first 3 installments)**:

| # | Due Date   | EMI (₹)  | Principal (₹) | Interest (₹) | Balance (₹) |
| - | ---------- | -------- | ------------- | ------------ | ----------- |
| 1 | Month +1   | 4,442.42 | 3,942.42      | 500.00       | 46,057.58   |
| 2 | Month +2   | 4,442.42 | 3,981.84      | 460.58       | 42,075.74   |
| 3 | Month +3   | 4,442.42 | 4,021.66      | 420.76       | 38,054.08   |
| … | …          | …        | …             | …            | …           |
| 12| Month +12  | 4,442.42 | ~4,441.05     | ~1.37        | 0.00        |

### Due Dates

The first installment is due **one month** from the schedule generation date (the approval date).
Each subsequent installment is due one month after the previous:

```sql
v_due_date := (now() + interval '1 month')::date;   -- first installment
-- each loop iteration:
v_due_date := (v_due_date + interval '1 month')::date;
```

---

## 8. Audit Logging Strategy

The `audit_logs` table provides an immutable, append-only audit trail of significant user actions
across the system. Audit logging is performed server-side by edge functions using the service-role
key, ensuring that audit entries cannot be tampered with or bypassed by the client.

### Audit Log Table

| Column         | Type        | Description                                            |
| -------------- | ----------- | ------------------------------------------------------ |
| `id`           | uuid        | Primary key                                            |
| `user_id`      | uuid        | The user who performed the action (FK → profiles, SET NULL on delete) |
| `user_email`   | text        | Denormalized email snapshot at time of action         |
| `user_role`    | text        | Denormalized role snapshot at time of action           |
| `action`       | text        | Action identifier (e.g., `APPLICATION_APPROVE`)       |
| `entity_type`  | text        | Type of entity affected (e.g., `finance_application`)  |
| `entity_id`    | uuid        | ID of the affected entity                              |
| `details`      | jsonb       | Flexible JSON payload with action-specific context     |
| `ip_address`   | text        | Request IP (when available)                            |
| `created_at`   | timestamptz | Timestamp of the action (defaults to `now()`)         |

### What Gets Audited

Currently, the `manage-application` edge function logs every application workflow transition:

| Action                   | `action` value              | `details` payload                                          |
| ------------------------ | ---------------------------- | --------------------------------------------------------- |
| Submit application       | `APPLICATION_SUBMIT`         | `{ application_number, previous_status, new_status, comments }` |
| Review application       | `APPLICATION_REVIEW`         | `{ application_number, previous_status, new_status, comments }` |
| Approve application      | `APPLICATION_APPROVE`        | `{ application_number, previous_status, new_status, comments }` |
| Reject application       | `APPLICATION_REJECT`         | `{ application_number, previous_status, new_status, comments }` |
| Disburse loan            | `APPLICATION_DISBURSE`       | `{ application_number, previous_status, new_status, comments }` |

### Audit Log Example

```json
{
  "id": "a1b2c3d4-...",
  "user_id": "9e7e2db3-...",
  "user_email": "manager@demo.com",
  "user_role": "ADMIN",
  "action": "APPLICATION_APPROVE",
  "entity_type": "finance_application",
  "entity_id": "f5e4d3c2-...",
  "details": {
    "application_number": "APP-2026-000001",
    "previous_status": "UNDER_REVIEW",
    "new_status": "APPROVED",
    "comments": "All KYC verified. Income meets criteria."
  },
  "ip_address": null,
  "created_at": "2026-07-12T17:50:00.000Z"
}
```

### Access Control

- **Read**: Only `SUPER_ADMIN` and `ADMIN` roles can view audit logs (RLS policy `audit_select_staff`).
- **Write**: Any authenticated user can insert audit log entries (RLS policy `audit_insert_any`).
  In practice, inserts are performed by edge functions using the service-role key.
- **Update/Delete**: No policies exist for UPDATE or DELETE — audit logs are **append-only** and cannot be modified or removed through the standard client.

### Design Rationale

| Decision | Rationale |
| -------- | --------- |
| Denormalized `user_email` and `user_role` | Preserves the snapshot of who performed the action even if the user's profile is later changed or deleted (`user_id` is SET NULL on delete, but the email/role text remains). |
| JSONB `details` column | Allows flexible, action-specific context without schema changes for new audit event types. |
| Append-only (no UPDATE/DELETE policies) | Ensures the audit trail cannot be tampered with after the fact. |
| Server-side insertion | Edge functions insert audit entries using the service-role key, so the client cannot forge or skip audit logging. |
| `entity_type` + `entity_id` pattern | Allows the audit system to track any entity type without a separate table per entity. |

### Future Extensibility

The audit log schema is designed to accommodate additional auditable actions without schema changes:

- Document verification (`DOCUMENT_VERIFY`, `DOCUMENT_REJECT`)
- Payment recording (`PAYMENT_RECORD`, `PAYMENT_REFUND`)
- EMI status changes (`EMI_MARK_PAID`, `EMI_MARK_OVERDUE`)
- User management actions (`USER_SUSPEND`, `USER_ROLE_CHANGE`)
- Profile updates (`PROFILE_UPDATE`)

Each new action would simply use a new `action` string and a contextually appropriate `details` JSON payload.

---

*This architecture document is a living reference. Update it when schema, roles, edge functions, or workflow states change.*
