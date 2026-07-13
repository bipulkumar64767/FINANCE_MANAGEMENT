# Database Schema — Electronic Asset Finance Management System

> Complete schema documentation for all 11 tables in the Electronic Asset Finance Management System
> (EAFMS). Includes columns, types, constraints, relationships, indexes, and database functions.

**Database**: Supabase PostgreSQL
**Schema**: `public`
**Tables**: 11 (all with RLS enabled)
**Migrations**: 3

---

## Table of Contents

1. [Migration History](#migration-history)
2. [Entity-Relationship Diagram](#entity-relationship-diagram)
3. [Tables](#tables)
   - [3.1 `profiles`](#31-profiles)
   - [3.2 `asset_categories`](#32-asset_categories)
   - [3.3 `assets`](#33-assets)
   - [3.4 `finance_applications`](#34-finance_applications)
   - [3.5 `approvals`](#35-approvals)
   - [3.6 `guarantors`](#36-guarantors)
   - [3.7 `documents`](#37-documents)
   - [3.8 `emi_schedules`](#38-emi_schedules)
   - [3.9 `payments`](#39-payments)
   - [3.10 `notifications`](#310-notifications)
   - [3.11 `audit_logs`](#311-audit_logs)
4. [Database Functions](#database-functions)
5. [Triggers](#triggers)
6. [Indexes](#indexes)
7. [Sequences](#sequences)
8. [Enums & Check Constraints](#enums--check-constraints)

---

## Migration History

| #  | Filename                                        | Description                                                              |
| -- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| 1  | `20260712174227_001_finance_core_schema.sql`    | Creates all 11 tables, RLS policies, indexes, and `update_updated_at` trigger |
| 2  | `20260712174245_002_db_functions.sql`           | Creates `generate_application_number()` and `generate_emi_schedule()` functions + `app_number_seq` sequence |
| 3  | `20260712174429_003_fix_emi_function.sql`       | Fixes `generate_emi_schedule()` variable naming conflict (adds `v_` prefix) |

---

## Entity-Relationship Diagram

```
┌───────────────────┐         ┌───────────────────┐
│    auth.users     │         │  asset_categories  │
│   (Supabase Auth) │         │                   │
└────────┬──────────┘         └─────────┬─────────┘
         │ 1:1 CASCADE                   │ 1:N SET NULL
         ▼                               ▼
┌──────────────────┐           ┌───────────────────┐
│     profiles     │◄──────────│      assets       │
│  (id = auth uid) │           │                   │
└────────┬─────────┘           └─────────┬─────────┘
         │                               │ N:1 SET NULL
         │ customer_id/retailer_id       │
         ├───────────────────────────────┤
         │                               │
         ▼                               ▼
┌────────────────────────────────────────────────────┐
│              finance_applications                  │
│  (customer_id, retailer_id, asset_id → FKs)       │
└──────┬──────────┬──────────┬──────────┬────────────┘
       │          │          │          │
       │ CASCADE  │ CASCADE  │ CASCADE  │ CASCADE
       ▼          ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│approvals │ │guarantors│ │documents │ │ emi_schedules│
└──────────┘ └──────────┘ └──────────┘ └──────┬───────┘
                                              │ CASCADE
                                              ▼
                                        ┌──────────┐
                                        │ payments │
                                        └──────────┘

profiles ──(user_id)──► notifications
profiles ──(user_id)──► audit_logs
```

---

## Tables

---

### 3.1 `profiles`

Extended user information linked to Supabase Auth. Each row corresponds 1:1 to an `auth.users` row.
Stores the user's role, contact details, and retailer linkage.

#### Columns

| Column        | Type        | Nullable | Default     | Constraints                              |
| ------------- | ----------- |:--------:| ----------- | ---------------------------------------- |
| `id`          | uuid        | NO       | —           | **PK**, FK → `auth.users(id)` ON DELETE CASCADE |
| `email`       | text        | NO       | —           |                                          |
| `full_name`   | text        | NO       | —           |                                          |
| `role`        | text        | NO       | `'CUSTOMER'`| CHECK: `SUPER_ADMIN`, `ADMIN`, `RETAILER`, `CUSTOMER` |
| `phone`       | text        | YES      | —           |                                          |
| `status`      | text        | NO       | `'ACTIVE'`  | CHECK: `ACTIVE`, `INACTIVE`, `SUSPENDED` |
| `retailer_id` | uuid        | YES      | —           | Self-referential (retailer's own profile ID) |
| `created_at`  | timestamptz | YES      | `now()`     |                                          |
| `updated_at`  | timestamptz | YES      | `now()`     | Auto-updated by `profiles_updated` trigger |

#### Primary Key

- `id` (uuid)

#### Foreign Keys

| Column  | References          | On Delete |
| ------- | ------------------- | --------- |
| `id`    | `auth.users(id)`    | CASCADE   |

#### Check Constraints

- `role IN ('SUPER_ADMIN', 'ADMIN', 'RETAILER', 'CUSTOMER')`
- `status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')`

#### Indexes

- `idx_profiles_role` on `role`

#### Triggers

- `profiles_updated` — BEFORE UPDATE → `update_updated_at()`

#### RLS

Enabled. See [RLS_POLICIES.md — profiles](RLS_POLICIES.md#profiles).

---

### 3.2 `asset_categories`

Catalog of asset type classifications (e.g., Mobile, Laptop, TV, Home Appliance).

#### Columns

| Column        | Type        | Nullable | Default     | Constraints    |
| ------------- | ----------- |:--------:| ----------- | -------------- |
| `id`          | uuid        | NO       | `gen_random_uuid()` | **PK** |
| `name`        | text        | NO       | —           | **UNIQUE**     |
| `description` | text        | YES      | —           |                |
| `icon`        | text        | YES      | —           |                |
| `created_at`  | timestamptz | YES      | `now()`     |                |

#### Primary Key

- `id` (uuid)

#### Unique Constraints

- `name` (UNIQUE)

#### RLS

Enabled. See [RLS_POLICIES.md — asset_categories](RLS_POLICIES.md#asset_categories).

---

### 3.3 `assets`

Individual asset models available for financing, with pricing and finance parameters.

#### Columns

| Column              | Type         | Nullable | Default     | Constraints                          |
| ------------------- | ------------ |:--------:| ----------- | ------------------------------------ |
| `id`                | uuid         | NO       | `gen_random_uuid()` | **PK**                    |
| `category_id`       | uuid         | YES      | —           | FK → `asset_categories(id)` ON DELETE SET NULL |
| `name`              | text         | NO       | —           |                                      |
| `brand`             | text         | NO       | —           |                                      |
| `model`             | text         | YES      | —           |                                      |
| `description`       | text         | YES      | —           |                                      |
| `price`             | numeric(12,2)| NO       | `0`         |                                      |
| `finance_min`       | numeric(12,2)| NO       | `0`         |                                      |
| `finance_max`       | numeric(12,2)| NO       | `0`         |                                      |
| `interest_rate`     | numeric(5,2) | NO       | `12.0`      |                                      |
| `max_tenure_months` | int          | NO       | `24`        |                                      |
| `image_url`         | text         | YES      | —           |                                      |
| `status`            | text         | NO       | `'AVAILABLE'`| CHECK: `AVAILABLE`, `DISCONTINUED` |
| `created_at`        | timestamptz  | YES      | `now()`     |                                      |
| `updated_at`        | timestamptz  | YES      | `now()`     | Auto-updated by `assets_updated` trigger |

#### Primary Key

- `id` (uuid)

#### Foreign Keys

| Column        | References               | On Delete |
| ------------- | ------------------------ | --------- |
| `category_id` | `asset_categories(id)`   | SET NULL  |

#### Check Constraints

- `status IN ('AVAILABLE', 'DISCONTINUED')`

#### Indexes

- `idx_assets_category` on `category_id`

#### Triggers

- `assets_updated` — BEFORE UPDATE → `update_updated_at()`

#### RLS

Enabled. See [RLS_POLICIES.md — assets](RLS_POLICIES.md#assets).

---

### 3.4 `finance_applications`

Customer loan applications for assets. The core entity of the system — tracks the application
through its workflow states from DRAFT to DISBURSED.

#### Columns

| Column             | Type         | Nullable | Default     | Constraints                          |
| ------------------ | ------------ |:--------:| ----------- | ------------------------------------ |
| `id`               | uuid         | NO       | `gen_random_uuid()` | **PK**                    |
| `application_number` | text       | NO       | —           | **UNIQUE**                           |
| `customer_id`      | uuid         | NO       | —           | FK → `profiles(id)` ON DELETE CASCADE |
| `retailer_id`      | uuid         | YES      | —           | FK → `profiles(id)` ON DELETE SET NULL |
| `asset_id`         | uuid         | YES      | —           | FK → `assets(id)` ON DELETE SET NULL |
| `asset_name`       | text         | YES      | —           | Denormalized asset name snapshot     |
| `asset_price`      | numeric(12,2)| NO       | `0`         |                                      |
| `finance_amount`   | numeric(12,2)| NO       | `0`         | The principal (loan amount)          |
| `down_payment`     | numeric(12,2)| NO       | `0`         |                                      |
| `interest_rate`    | numeric(5,2) | NO       | `12.0`      | Annual interest rate (%)             |
| `tenure_months`    | int          | NO       | `12`        | Loan tenure in months                |
| `monthly_emi`      | numeric(12,2)| NO       | `0`         | Calculated monthly EMI               |
| `total_payable`    | numeric(12,2)| NO       | `0`         | Sum of all EMIs (set by `generate_emi_schedule`) |
| `status`           | text         | NO       | `'DRAFT'`   | CHECK: see Workflow States below     |
| `employment_type`  | text         | YES      | —           |                                      |
| `monthly_income`   | numeric(12,2)| YES      | —           |                                      |
| `rejection_reason` | text         | YES      | —           | Set when status = REJECTED           |
| `submitted_at`     | timestamptz  | YES      | —           | Set on SUBMIT transition             |
| `approved_at`      | timestamptz  | YES      | —           | Set on APPROVE transition            |
| `disbursed_at`     | timestamptz  | YES      | —           | Set on DISBURSE transition           |
| `created_at`       | timestamptz  | YES      | `now()`     |                                      |
| `updated_at`       | timestamptz  | YES      | `now()`     | Auto-updated by `apps_updated` trigger |

#### Primary Key

- `id` (uuid)

#### Unique Constraints

- `application_number` (UNIQUE)

#### Foreign Keys

| Column        | References        | On Delete |
| ------------- | ----------------- | --------- |
| `customer_id` | `profiles(id)`    | CASCADE   |
| `retailer_id` | `profiles(id)`    | SET NULL  |
| `asset_id`    | `assets(id)`      | SET NULL  |

#### Check Constraints

- `status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'DISBURSED', 'CLOSED')`

#### Workflow States

| State          | Description                                      |
| -------------- | ------------------------------------------------ |
| `DRAFT`        | Application created, not yet submitted           |
| `SUBMITTED`    | Submitted for review                             |
| `UNDER_REVIEW` | Being evaluated by finance team                  |
| `APPROVED`     | Approved; EMI schedule generated                 |
| `REJECTED`     | Rejected (terminal)                              |
| `DISBURSED`    | Loan disbursed; EMI repayment active             |
| `CLOSED`       | Loan fully repaid (terminal)                     |

#### Indexes

- `idx_apps_customer` on `customer_id`
- `idx_apps_status` on `status`

#### Triggers

- `apps_updated` — BEFORE UPDATE → `update_updated_at()`

#### RLS

Enabled. See [RLS_POLICIES.md — finance_applications](RLS_POLICIES.md#finance_applications).

---

### 3.5 `approvals`

Approval workflow history records. Each row represents one transition action performed on an
application, creating an append-only audit trail of who did what and when.

#### Columns

| Column            | Type        | Nullable | Default     | Constraints                          |
| ----------------- | ----------- |:--------:| ----------- | ------------------------------------ |
| `id`              | uuid        | NO       | `gen_random_uuid()` | **PK**                    |
| `application_id`  | uuid        | NO       | —           | FK → `finance_applications(id)` ON DELETE CASCADE |
| `approver_id`     | uuid        | YES      | —           | FK → `profiles(id)` ON DELETE SET NULL |
| `approver_name`   | text        | YES      | —           | Denormalized approver name snapshot  |
| `action`          | text        | NO       | —           | CHECK: `SUBMIT`, `REVIEW`, `APPROVE`, `REJECT`, `DISBURSE` |
| `comments`        | text        | YES      | —           |                                      |
| `previous_status` | text        | YES      | —           | Status before this action            |
| `new_status`      | text        | YES      | —           | Status after this action             |
| `created_at`      | timestamptz | YES      | `now()`     |                                      |

#### Primary Key

- `id` (uuid)

#### Foreign Keys

| Column           | References                  | On Delete |
| ---------------- | --------------------------- | --------- |
| `application_id` | `finance_applications(id)`  | CASCADE   |
| `approver_id`    | `profiles(id)`              | SET NULL  |

#### Check Constraints

- `action IN ('SUBMIT', 'REVIEW', 'APPROVE', 'REJECT', 'DISBURSE')`

#### Indexes

- `idx_approvals_app` on `application_id`

#### RLS

Enabled. See [RLS_POLICIES.md — approvals](RLS_POLICIES.md#approvals).

---

### 3.6 `guarantors`

Guarantor records tied to finance applications. A guarantor is a person who guarantees repayment
of the loan if the primary borrower defaults.

#### Columns

| Column            | Type         | Nullable | Default     | Constraints                          |
| ----------------- | ------------ |:--------:| ----------- | ------------------------------------ |
| `id`              | uuid         | NO       | `gen_random_uuid()` | **PK**                    |
| `application_id`  | uuid         | NO       | —           | FK → `finance_applications(id)` ON DELETE CASCADE |
| `full_name`       | text         | NO       | —           |                                      |
| `relationship`    | text         | YES      | —           | Relationship to the borrower         |
| `phone`           | text         | YES      | —           |                                      |
| `email`           | text         | YES      | —           |                                      |
| `aadhaar_number`  | text         | YES      | —           | Indian national ID number            |
| `monthly_income`  | numeric(12,2)| YES      | —           |                                      |
| `created_at`      | timestamptz  | YES      | `now()`     |                                      |

#### Primary Key

- `id` (uuid)

#### Foreign Keys

| Column           | References                  | On Delete |
| ---------------- | --------------------------- | --------- |
| `application_id` | `finance_applications(id)`  | CASCADE   |

#### Indexes

- `idx_guarantors_app` on `application_id`

#### RLS

Enabled. See [RLS_POLICIES.md — guarantors](RLS_POLICIES.md#guarantors).

---

### 3.7 `documents`

Metadata for uploaded documents (KYC, income proof, etc.). The actual file content is stored in
Supabase Storage; this table tracks the metadata, storage path, and verification status.

#### Columns

| Column           | Type        | Nullable | Default              | Constraints                          |
| ---------------- | ----------- |:--------:| -------------------- | ------------------------------------ |
| `id`             | uuid        | NO       | `gen_random_uuid()`  | **PK**                               |
| `application_id` | uuid        | YES      | —                    | FK → `finance_applications(id)` ON DELETE CASCADE |
| `customer_id`    | uuid        | YES      | —                    | FK → `profiles(id)` ON DELETE CASCADE |
| `document_type`  | text        | NO       | —                    | CHECK: see Document Types below      |
| `file_name`      | text        | NO       | —                    |                                      |
| `file_size`      | bigint      | NO       | `0`                  | Size in bytes                        |
| `mime_type`      | text        | NO       | —                    |                                      |
| `object_key`     | text        | NO       | —                    | Storage object key/path              |
| `bucket_name`    | text        | NO       | `'demo-finance-docs'`| Storage bucket name                  |
| `storage_url`    | text        | YES      | —                    | Full storage URL (optional)          |
| `checksum`       | text        | YES      | —                    | File integrity hash                  |
| `uploaded_by`    | uuid        | YES      | —                    | FK → `profiles(id)` ON DELETE SET NULL |
| `status`         | text        | NO       | `'UPLOADED'`         | CHECK: `UPLOADED`, `VERIFIED`, `REJECTED` |
| `created_at`     | timestamptz | YES      | `now()`              |                                      |

#### Primary Key

- `id` (uuid)

#### Foreign Keys

| Column           | References                  | On Delete |
| ---------------- | --------------------------- | --------- |
| `application_id` | `finance_applications(id)`  | CASCADE   |
| `customer_id`    | `profiles(id)`              | CASCADE   |
| `uploaded_by`    | `profiles(id)`              | SET NULL  |

#### Check Constraints

- `document_type IN ('KYC_AADHAAR', 'KYC_PAN', 'INCOME_PROOF', 'ADDRESS_PROOF', 'PHOTO', 'BANK_STATEMENT', 'OTHER')`
- `status IN ('UPLOADED', 'VERIFIED', 'REJECTED')`

#### Document Types

| Value            | Description                          |
| ---------------- | ------------------------------------ |
| `KYC_AADHAAR`    | Aadhaar card (Indian national ID)    |
| `KYC_PAN`        | PAN card (tax ID)                    |
| `INCOME_PROOF`   | Salary slip / income certificate     |
| `ADDRESS_PROOF`  | Utility bill / rental agreement      |
| `PHOTO`          | Passport-size photograph             |
| `BANK_STATEMENT` | Bank account statement               |
| `OTHER`          | Any other document type              |

#### Indexes

- `idx_docs_app` on `application_id`

#### RLS

Enabled. See [RLS_POLICIES.md — documents](RLS_POLICIES.md#documents).

---

### 3.8 `emi_schedules`

Generated EMI installment schedules per application. Created by the `generate_emi_schedule()`
function when an application is approved. Each row represents one monthly installment.

#### Columns

| Column              | Type         | Nullable | Default     | Constraints                          |
| ------------------- | ------------ |:--------:| ----------- | ------------------------------------ |
| `id`                | uuid         | NO       | `gen_random_uuid()` | **PK**                    |
| `application_id`    | uuid         | NO       | —           | FK → `finance_applications(id)` ON DELETE CASCADE |
| `installment_number`| int          | NO       | —           | Sequence number (1 to tenure)        |
| `due_date`          | date         | NO       | —           | Due date for this installment        |
| `amount`            | numeric(12,2)| NO       | —           | Total EMI amount (principal + interest) |
| `principal`         | numeric(12,2)| NO       | —           | Principal component                  |
| `interest`          | numeric(12,2)| NO       | —           | Interest component                   |
| `balance`           | numeric(12,2)| NO       | —           | Outstanding principal after this installment |
| `status`            | text         | NO       | `'PENDING'` | CHECK: `PENDING`, `PAID`, `OVERDUE`, `CANCELLED` |
| `paid_at`           | timestamptz  | YES      | —           | Set when status = PAID               |
| `created_at`        | timestamptz  | YES      | `now()`     |                                      |

#### Primary Key

- `id` (uuid)

#### Foreign Keys

| Column           | References                  | On Delete |
| ---------------- | --------------------------- | --------- |
| `application_id` | `finance_applications(id)`  | CASCADE   |

#### Check Constraints

- `status IN ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED')`

#### Indexes

- `idx_emi_app` on `application_id`

#### RLS

Enabled. See [RLS_POLICIES.md — emi_schedules](RLS_POLICIES.md#emi_schedules).

---

### 3.9 `payments`

Payment records against EMI installments. Each payment is linked to both the EMI schedule entry
and the parent application.

#### Columns

| Column           | Type         | Nullable | Default     | Constraints                          |
| ---------------- | ------------ |:--------:| ----------- | ------------------------------------ |
| `id`             | uuid         | NO       | `gen_random_uuid()` | **PK**                    |
| `emi_id`         | uuid         | NO       | —           | FK → `emi_schedules(id)` ON DELETE CASCADE |
| `application_id` | uuid         | NO       | —           | FK → `finance_applications(id)` ON DELETE CASCADE |
| `customer_id`    | uuid         | YES      | —           | FK → `profiles(id)` ON DELETE SET NULL |
| `amount`         | numeric(12,2)| NO       | —           | Payment amount                       |
| `payment_method` | text         | NO       | `'UPI'`     | CHECK: see Payment Methods below     |
| `transaction_id` | text         | YES      | —           | External transaction reference       |
| `status`         | text         | NO       | `'SUCCESS'` | CHECK: `SUCCESS`, `FAILED`, `PENDING`, `REFUNDED` |
| `created_at`     | timestamptz  | YES      | `now()`     |                                      |

#### Primary Key

- `id` (uuid)

#### Foreign Keys

| Column           | References                  | On Delete |
| ---------------- | --------------------------- | --------- |
| `emi_id`         | `emi_schedules(id)`         | CASCADE   |
| `application_id` | `finance_applications(id)`  | CASCADE   |
| `customer_id`    | `profiles(id)`              | SET NULL  |

#### Check Constraints

- `payment_method IN ('UPI', 'BANK_TRANSFER', 'CASH', 'CARD', 'CHEQUE')`
- `status IN ('SUCCESS', 'FAILED', 'PENDING', 'REFUNDED')`

#### Payment Methods

| Value            | Description                  |
| ---------------- | ---------------------------- |
| `UPI`            | Unified Payments Interface   |
| `BANK_TRANSFER`  | Bank account transfer        |
| `CASH`           | Cash payment                 |
| `CARD`           | Debit/credit card            |
| `CHEQUE`         | Cheque payment               |

#### Indexes

- `idx_payments_emi` on `emi_id`

#### RLS

Enabled. See [RLS_POLICIES.md — payments](RLS_POLICIES.md#payments).

---

### 3.10 `notifications`

In-app notification messages for users. Created by edge functions to inform users of application
status changes and other events.

#### Columns

| Column       | Type        | Nullable | Default     | Constraints                          |
| ------------ | ----------- |:--------:| ----------- | ------------------------------------ |
| `id`         | uuid        | NO       | `gen_random_uuid()` | **PK**                    |
| `user_id`    | uuid        | NO       | —           | FK → `profiles(id)` ON DELETE CASCADE |
| `title`      | text        | NO       | —           |                                      |
| `message`    | text        | NO       | —           |                                      |
| `type`       | text        | NO       | `'INFO'`    | CHECK: `INFO`, `SUCCESS`, `WARNING`, `ERROR` |
| `read`       | boolean     | NO       | `false`     | Whether the user has read it         |
| `link`       | text        | YES      | —           | Deep link to the related resource    |
| `created_at` | timestamptz | YES      | `now()`     |                                      |

#### Primary Key

- `id` (uuid)

#### Foreign Keys

| Column    | References     | On Delete |
| --------- | -------------- | --------- |
| `user_id` | `profiles(id)` | CASCADE   |

#### Check Constraints

- `type IN ('INFO', 'SUCCESS', 'WARNING', 'ERROR')`

#### Notification Types

| Value     | Description                    |
| --------- | ------------------------------ |
| `INFO`    | Informational notification     |
| `SUCCESS` | Successful action notification |
| `WARNING` | Warning notification           |
| `ERROR`   | Error/failure notification     |

#### Indexes

- `idx_notifications_user` on `user_id`

#### RLS

Enabled. See [RLS_POLICIES.md — notifications](RLS_POLICIES.md#notifications).

---

### 3.11 `audit_logs`

Immutable audit trail of significant user actions. Append-only — no UPDATE or DELETE policies
exist. Entries are inserted by edge functions using the service-role key.

#### Columns

| Column         | Type        | Nullable | Default     | Constraints                          |
| -------------- | ----------- |:--------:| ----------- | ------------------------------------ |
| `id`           | uuid        | NO       | `gen_random_uuid()` | **PK**                    |
| `user_id`      | uuid        | YES      | —           | FK → `profiles(id)` ON DELETE SET NULL |
| `user_email`   | text        | YES      | —           | Denormalized email snapshot          |
| `user_role`    | text        | YES      | —           | Denormalized role snapshot           |
| `action`       | text        | NO       | —           | Action identifier (e.g., `APPLICATION_APPROVE`) |
| `entity_type`  | text        | YES      | —           | Type of entity affected              |
| `entity_id`    | uuid        | YES      | —           | ID of the affected entity            |
| `details`      | jsonb       | YES      | —           | Flexible JSON context payload        |
| `ip_address`   | text        | YES      | —           | Request IP (when available)          |
| `created_at`   | timestamptz | YES      | `now()`     |                                      |

#### Primary Key

- `id` (uuid)

#### Foreign Keys

| Column    | References     | On Delete |
| --------- | -------------- | --------- |
| `user_id` | `profiles(id)` | SET NULL  |

#### Check Constraints

None (all columns except `id` and `action` are nullable, and `action` has no CHECK constraint —
it accepts any text value to accommodate future action types).

#### Indexes

- `idx_audit_user` on `user_id`

#### RLS

Enabled. See [RLS_POLICIES.md — audit_logs](RLS_POLICIES.md#audit_logs).

---

## Database Functions

### `generate_application_number()`

Generates a unique, sequential application number in the format `APP-YYYY-NNNNNN`.

```sql
SELECT generate_application_number();
-- Result: 'APP-2026-000001'
```

| Attribute      | Value                    |
| -------------- | ------------------------ |
| Return type    | `text`                   |
| Language       | `plpgsql`                |
| Sequence       | `app_number_seq`         |
| Format         | `APP-{year}-{6-digit padded sequence}` |

**Logic**:
1. Gets next value from `app_number_seq`.
2. Extracts the current year.
3. Concatenates `APP-`, year, and zero-padded sequence number (6 digits).

---

### `generate_emi_schedule(app_id uuid)`

Generates the complete EMI installment schedule for an application using the reducing balance
method. Deletes any existing schedule for the application first (idempotent), then inserts one
row per installment and updates `finance_applications.total_payable`.

```sql
SELECT generate_emi_schedule('f5e4d3c2-b1a0-4e2f-9d8c-7b6a5f4e3d2c');
```

| Attribute      | Value                              |
| -------------- | ---------------------------------- |
| Parameters     | `app_id uuid`                      |
| Return type    | `void`                             |
| Language       | `plpgsql`                          |

**Logic**:
1. Loads the application record by `app_id`. Returns early if not found.
2. Deletes any existing `emi_schedules` rows for this application (idempotent regeneration).
3. Calculates monthly rate: `r = interest_rate / 12.0 / 100.0`.
4. Calculates EMI using the amortization formula:
   - If `r = 0`: `EMI = finance_amount / tenure_months`
   - Else: `EMI = P × r × (1+r)^n / ((1+r)^n − 1)`
5. For each installment `i` from 1 to `tenure_months`:
   - `interest = balance × r`
   - `principal = EMI − interest`
   - On last installment: `principal = balance` (exact payoff), `EMI = principal + interest`
   - `balance = balance − principal`
   - Inserts row into `emi_schedules` with rounded values (2 decimals).
   - Advances `due_date` by 1 month (first due date = `now() + 1 month`).
6. Updates `finance_applications.total_payable` with the sum of all EMI amounts.

---

### `update_updated_at()`

Trigger function that automatically sets `updated_at = now()` on row modification.

```sql
-- Used by triggers:
-- profiles_updated  (BEFORE UPDATE ON profiles)
-- assets_updated    (BEFORE UPDATE ON assets)
-- apps_updated      (BEFORE UPDATE ON finance_applications)
```

| Attribute      | Value      |
| -------------- | ---------- |
| Return type    | `trigger`  |
| Language       | `plpgsql`  |

**Logic**:
1. Sets `NEW.updated_at = now()`.
2. Returns `NEW`.

---

## Triggers

| Trigger           | Table                  | Timing        | Event  | Function             |
| ----------------- | ---------------------- |:-------------:|:------:| -------------------- |
| `profiles_updated`| `profiles`             | BEFORE        | UPDATE | `update_updated_at()`|
| `assets_updated`  | `assets`               | BEFORE        | UPDATE | `update_updated_at()`|
| `apps_updated`    | `finance_applications` | BEFORE        | UPDATE | `update_updated_at()`|

---

## Indexes

| Index Name               | Table                  | Column(s)       | Type   |
| ------------------------ | ---------------------- | --------------- | ------ |
| `idx_profiles_role`      | `profiles`             | `role`          | B-tree |
| `idx_assets_category`    | `assets`               | `category_id`   | B-tree |
| `idx_apps_customer`      | `finance_applications` | `customer_id`   | B-tree |
| `idx_apps_status`        | `finance_applications` | `status`        | B-tree |
| `idx_guarantors_app`     | `guarantors`           | `application_id`| B-tree |
| `idx_approvals_app`      | `approvals`            | `application_id`| B-tree |
| `idx_docs_app`           | `documents`            | `application_id`| B-tree |
| `idx_emi_app`            | `emi_schedules`        | `application_id`| B-tree |
| `idx_payments_emi`       | `payments`             | `emi_id`        | B-tree |
| `idx_notifications_user` | `notifications`        | `user_id`       | B-tree |
| `idx_audit_user`         | `audit_logs`           | `user_id`       | B-tree |

All indexes are created with `IF NOT EXISTS` for idempotent migration re-runs.

---

## Sequences

| Sequence           | Start | Purpose                                              |
| ------------------ |:-----:| ---------------------------------------------------- |
| `app_number_seq`   | 1     | Sequential counter for `generate_application_number()` |

---

## Enums & Check Constraints

The schema uses TEXT columns with CHECK constraints instead of native PostgreSQL ENUM types.
This allows easier modification of allowed values via migration without the overhead of
ALTER TYPE operations.

### `profiles.role`

| Allowed Value   | Description          |
| --------------- | -------------------- |
| `SUPER_ADMIN`   | Super administrator  |
| `ADMIN`         | Finance admin        |
| `RETAILER`      | Partner retailer     |
| `CUSTOMER`      | End borrower         |

### `profiles.status`

| Allowed Value | Description         |
| ------------- | ------------------- |
| `ACTIVE`      | Active account      |
| `INACTIVE`    | Inactive account    |
| `SUSPENDED`   | Suspended account   |

### `assets.status`

| Allowed Value    | Description              |
| ---------------- | ------------------------ |
| `AVAILABLE`      | Available for financing  |
| `DISCONTINUED`   | Discontinued product     |

### `finance_applications.status`

| Allowed Value    | Description                       |
| ---------------- | --------------------------------- |
| `DRAFT`          | Created, not submitted            |
| `SUBMITTED`      | Submitted for review              |
| `UNDER_REVIEW`   | Under evaluation                  |
| `APPROVED`       | Approved, EMI generated           |
| `REJECTED`       | Rejected (terminal)               |
| `DISBURSED`      | Loan disbursed (terminal path)    |
| `CLOSED`         | Fully repaid (terminal)           |

### `approvals.action`

| Allowed Value | Description              |
| ------------- | ------------------------ |
| `SUBMIT`      | Submit application       |
| `REVIEW`      | Mark under review        |
| `APPROVE`     | Approve application      |
| `REJECT`      | Reject application       |
| `DISBURSE`    | Disburse loan            |

### `documents.document_type`

| Allowed Value     | Description              |
| ----------------- | ------------------------ |
| `KYC_AADHAAR`     | Aadhaar card             |
| `KYC_PAN`         | PAN card                 |
| `INCOME_PROOF`    | Income proof             |
| `ADDRESS_PROOF`   | Address proof            |
| `PHOTO`           | Photograph               |
| `BANK_STATEMENT`  | Bank statement           |
| `OTHER`           | Other document           |

### `documents.status`

| Allowed Value | Description             |
| ------------- | ----------------------- |
| `UPLOADED`    | Uploaded, pending review|
| `VERIFIED`    | Verified by staff       |
| `REJECTED`    | Rejected by staff       |

### `emi_schedules.status`

| Allowed Value | Description                    |
| ------------- | ------------------------------ |
| `PENDING`     | Payment due, not yet paid      |
| `PAID`        | Payment completed              |
| `OVERDUE`     | Payment past due date          |
| `CANCELLED`   | Installment cancelled          |

### `payments.payment_method`

| Allowed Value    | Description          |
| ---------------- | -------------------- |
| `UPI`            | UPI payment          |
| `BANK_TRANSFER`  | Bank transfer        |
| `CASH`           | Cash                 |
| `CARD`           | Card payment         |
| `CHEQUE`         | Cheque               |

### `payments.status`

| Allowed Value | Description              |
| ------------- | ------------------------ |
| `SUCCESS`     | Payment successful       |
| `FAILED`      | Payment failed           |
| `PENDING`     | Payment pending          |
| `REFUNDED`    | Payment refunded         |

### `notifications.type`

| Allowed Value | Description          |
| ------------- | -------------------- |
| `INFO`        | Informational        |
| `SUCCESS`     | Success message      |
| `WARNING`     | Warning              |
| `ERROR`       | Error message        |

---

*This schema documentation reflects the current database state. Update it when migrations are applied.*
