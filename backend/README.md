# Electronic Asset Finance Management System — Backend

## Overview

The backend is powered by **Supabase** (PostgreSQL + Auth + Edge Functions + Storage).
All schema, RLS policies, edge functions, and seed data are managed here.

## Architecture

```
backend/
├── README.md                  ← this file
├── ARCHITECTURE.md            ← system architecture & design decisions
├── API.md                     ← edge function API reference
├── docs/
│   ├── SCHEMA.md              ← full database schema documentation
│   ├── RLS_POLICIES.md        ← row-level security policy reference
│   └── EDGE_FUNCTIONS.md      ← edge function deployment guide
└── (functions live in /supabase/functions/ — deployed via Supabase MCP)
```

## Tech Stack

| Component         | Technology                          |
|-------------------|-------------------------------------|
| Database          | PostgreSQL (Supabase)               |
| Auth              | Supabase Auth (email/password)      |
| Edge Functions    | Deno + TypeScript (Supabase)        |
| Storage           | Supabase Storage (for documents)    |
| Row-Level Security| Enabled on all tables               |

## Database Tables (11)

| Table                  | Purpose                                        |
|------------------------|------------------------------------------------|
| profiles               | User profiles with role (4 roles)              |
| asset_categories       | Product categories (Mobile, Laptop, TV, etc.)  |
| assets                 | Asset catalog with pricing & finance limits    |
| finance_applications   | Customer loan applications                     |
| approvals              | Approval workflow history per application      |
| guarantors             | Guarantor records per application              |
| documents              | KYC & income document metadata                 |
| emi_schedules          | EMI installment schedules (auto-generated)     |
| payments               | Payment records against EMI installments       |
| notifications          | In-app user notifications                      |
| audit_logs             | Audit trail of all user actions                |

## Roles & Permissions

| Role         | Capabilities                                                |
|--------------|-------------------------------------------------------------|
| SUPER_ADMIN  | Full system access, user management, all approvals, audit   |
| ADMIN        | Approve/reject applications, manage catalog, view audit     |
| RETAILER     | Submit applications for customers, view own pipeline         |
| CUSTOMER     | Apply for finance, view own applications & EMI schedule      |

## Edge Functions (4)

1. **seed-demo-users** — One-time setup: creates 4 demo accounts
2. **dashboard-stats** — Role-based dashboard statistics
3. **manage-application** — Application workflow (submit/review/approve/reject/disburse)
4. **calculate-emi** — EMI calculation with full amortization schedule

## Demo Credentials

| Role         | Email              | Password   |
|--------------|--------------------|------------|
| Super Admin  | admin@demo.com     | demo1234   |
| Admin        | manager@demo.com   | demo1234   |
| Retailer     | retailer@demo.com  | demo1234   |
| Customer     | customer@demo.com  | demo1234   |

## Setup

The Supabase project is pre-provisioned. Migrations and edge functions are deployed
via the Supabase MCP tools. See `docs/` for detailed documentation.
