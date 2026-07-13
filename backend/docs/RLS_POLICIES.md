# Row-Level Security Policies — Electronic Asset Finance Management System

> Complete reference for every Row-Level Security (RLS) policy on every table in the Electronic
> Asset Finance Management System (EAFMS). RLS is enabled on all 11 tables. Policies are the
> primary data-access control mechanism — the frontend's anon key + JWT can only access what
> RLS permits.

---

## Table of Contents

1. [Overview](#overview)
2. [Policy Patterns](#policy-patterns)
3. [Policies by Table](#policies-by-table)
   - [profiles](#profiles)
   - [asset_categories](#asset_categories)
   - [assets](#assets)
   - [finance_applications](#finance_applications)
   - [approvals](#approvals)
   - [guarantors](#guarantors)
   - [documents](#documents)
   - [emi_schedules](#emi_schedules)
   - [payments](#payments)
   - [notifications](#notifications)
   - [audit_logs](#audit_logs)
4. [Policy Summary Matrix](#policy-summary-matrix)
5. [RLS Helper Functions](#rls-helper-functions)

---

## Overview

### Principles

1. **RLS is enabled on every table** — `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` is run on all 11 tables.
2. **All policies are scoped to `authenticated`** — the `anon` role has no direct access (the app requires sign-in).
3. **`auth.uid()` is used exclusively** for user identity checks — never `current_user`.
4. **Policies are separated by command** — SELECT, INSERT, UPDATE, DELETE each have dedicated policies (with a few `FOR ALL` exceptions on catalog tables).
5. **Role checks use subqueries** — `EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN (...))`.
6. **Parent-child traversal** — child tables check access through the parent `finance_applications` row.
7. **No `USING (true)` fallback** — except on catalog tables (`asset_categories`, `assets`) where all authenticated users are intentionally allowed to read.

### Enforcement Flow

```
Frontend request (anon key + JWT)
        │
        ▼
Supabase API gateway
        │  verifies JWT signature
        ▼
PostgreSQL (RLS active)
        │  evaluates policies for the authenticated user
        │  auth.uid() returns the user's UUID
        │  policies filter rows based on ownership / role
        ▼
Returns only permitted rows
```

---

## Policy Patterns

The system uses four policy patterns depending on data sensitivity:

### Pattern A — Owner-Scoped (Self Data)

The user can only access rows where they are the direct owner.

```sql
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid())
```

**Used by**: `profiles`, `notifications`

---

### Pattern B — Owner + Staff-Scoped (Application Data)

The owner (customer), linked retailer, or staff (admin/super_admin) can access the row. This is
the most common pattern for application-related data.

```sql
USING (
  customer_id = auth.uid()
  OR retailer_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
             AND p.role IN ('SUPER_ADMIN', 'ADMIN'))
)
```

**Used by**: `finance_applications`, `approvals`, `guarantors`, `documents`, `emi_schedules`, `payments`

---

### Pattern C — Public-Read + Staff-Write (Catalog Data)

All authenticated users can read; only staff can modify.

```sql
-- SELECT
USING (true)

-- INSERT / UPDATE / DELETE (FOR ALL)
USING (EXISTS (SELECT 1 FROM profiles p
               WHERE p.id = auth.uid()
               AND p.role IN ('SUPER_ADMIN', 'ADMIN')))
WITH CHECK (EXISTS (SELECT 1 FROM profiles p
               WHERE p.id = auth.uid()
               AND p.role IN ('SUPER_ADMIN', 'ADMIN')))
```

**Used by**: `asset_categories`, `assets`

---

### Pattern D — Staff-Read + Any-Write (Audit Logs)

Only staff can read; any authenticated user can insert (edge functions insert on behalf of users).

```sql
-- SELECT
USING (EXISTS (SELECT 1 FROM profiles p
               WHERE p.id = auth.uid()
               AND p.role IN ('SUPER_ADMIN', 'ADMIN')))

-- INSERT
WITH CHECK (auth.uid() IS NOT NULL)
```

**Used by**: `audit_logs`

---

## Policies by Table

---

### profiles

Extended user data linked to `auth.users`. Users can view/edit their own profile; staff and
retailers can view other profiles for operational purposes.

#### `profiles_select_own`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | SELECT                                      |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| USING       | See below                                   |

```sql
USING (
  auth.uid() = id
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('SUPER_ADMIN', 'ADMIN', 'RETAILER')
  )
)
```

**Access**: A user can view their own profile. SUPER_ADMIN, ADMIN, and RETAILER can view all profiles.

---

#### `profiles_insert_own`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | INSERT                                      |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| WITH CHECK  | See below                                   |

```sql
WITH CHECK (auth.uid() = id)
```

**Access**: A user can only insert a profile row with their own `auth.uid()` as the `id`. This is
used when a new user signs up and the profile row is created (typically via a trigger or the
`seed-demo-users` edge function using the service-role key).

---

#### `profiles_update_own`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | UPDATE                                      |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| USING       | See below                                   |
| WITH CHECK  | See below                                   |

```sql
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id)
```

**Access**: A user can only update their own profile. Staff cannot update other users' profiles
through the standard client (this would require the service-role key via an edge function).

---

### asset_categories

Catalog data. All authenticated users can read; only SUPER_ADMIN and ADMIN can modify.

#### `categories_select_all`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | SELECT                                      |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| USING       | `true`                                      |

```sql
USING (true)
```

**Access**: All authenticated users can view all asset categories. This is intentional — catalog
data is shared reference data needed by all roles.

---

#### `categories_modify_staff`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | ALL (INSERT, UPDATE, DELETE)                |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| USING       | See below                                   |
| WITH CHECK  | See below                                   |

```sql
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('SUPER_ADMIN', 'ADMIN')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('SUPER_ADMIN', 'ADMIN')
  )
)
```

**Access**: Only SUPER_ADMIN and ADMIN can create, update, or delete asset categories.

---

### assets

Asset catalog. All authenticated users can read; SUPER_ADMIN, ADMIN, and RETAILER can modify
(retailers can add assets they sell).

#### `assets_select_all`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | SELECT                                      |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| USING       | `true`                                      |

```sql
USING (true)
```

**Access**: All authenticated users can view all assets.

---

#### `assets_modify_staff`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | ALL (INSERT, UPDATE, DELETE)                |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| USING       | See below                                   |
| WITH CHECK  | See below                                   |

```sql
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('SUPER_ADMIN', 'ADMIN', 'RETAILER')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('SUPER_ADMIN', 'ADMIN', 'RETAILER')
  )
)
```

**Access**: SUPER_ADMIN, ADMIN, and RETAILER can create, update, or delete assets.

---

### finance_applications

The core application entity. Customers see their own applications; retailers see applications
linked to them; staff (SUPER_ADMIN, ADMIN) see all applications.

#### `apps_select_own_or_staff`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | SELECT                                      |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| USING       | See below                                   |

```sql
USING (
  customer_id = auth.uid()
  OR retailer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('SUPER_ADMIN', 'ADMIN')
  )
)
```

**Access**: A customer can view their own applications. A retailer can view applications where
they are the `retailer_id`. SUPER_ADMIN and ADMIN can view all applications.

---

#### `apps_insert_own`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | INSERT                                      |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| WITH CHECK  | See below                                   |

```sql
WITH CHECK (
  customer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('SUPER_ADMIN', 'ADMIN', 'RETAILER')
  )
)
```

**Access**: A customer can create applications with themselves as the `customer_id`. Staff
(SUPER_ADMIN, ADMIN) and retailers can create applications for any customer (by setting the
`customer_id` to the customer's UUID).

---

#### `apps_update_own_or_staff`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | UPDATE                                      |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| USING       | See below                                   |
| WITH CHECK  | See below                                   |

```sql
USING (
  customer_id = auth.uid()
  OR retailer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('SUPER_ADMIN', 'ADMIN')
  )
)
WITH CHECK (
  customer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('SUPER_ADMIN', 'ADMIN', 'RETAILER')
  )
)
```

**Access**: A customer can update their own applications (e.g., edit a DRAFT). A retailer can
update applications linked to them. SUPER_ADMIN and ADMIN can update any application. The
`WITH CHECK` ensures that after update, the `customer_id` still belongs to the user or the user
is staff/retailer.

---

### approvals

Approval workflow history records. Access is derived from the parent `finance_applications` row.

#### `approvals_select_via_app`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | SELECT                                      |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| USING       | See below                                   |

```sql
USING (
  EXISTS (
    SELECT 1 FROM finance_applications fa
    WHERE fa.id = approvals.application_id
    AND (
      fa.customer_id = auth.uid()
      OR fa.retailer_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('SUPER_ADMIN', 'ADMIN')
      )
    )
  )
)
```

**Access**: A user can view approval records for applications they can see (as customer, linked
retailer, or staff).

---

#### `approvals_insert_staff`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | INSERT                                      |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| WITH CHECK  | See below                                   |

```sql
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM finance_applications fa
    WHERE fa.id = approvals.application_id
    AND (
      fa.customer_id = auth.uid()
      OR fa.retailer_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('SUPER_ADMIN', 'ADMIN')
      )
    )
  )
)
```

**Access**: Any authenticated user can insert an approval record, but only for applications they
can access (as customer, linked retailer, or staff). In practice, approval records are primarily
inserted by the `manage-application` edge function using the service-role key.

---

### guarantors

Guarantor records tied to applications. Access is derived from the parent `finance_applications` row.

#### `guarantors_select_via_app`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | SELECT                                      |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| USING       | See below                                   |

```sql
USING (
  EXISTS (
    SELECT 1 FROM finance_applications fa
    WHERE fa.id = guarantors.application_id
    AND (
      fa.customer_id = auth.uid()
      OR fa.retailer_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('SUPER_ADMIN', 'ADMIN')
      )
    )
  )
)
```

**Access**: A user can view guarantors for applications they can access (as customer, linked
retailer, or staff).

---

#### `guarantors_modify_via_app`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | ALL (INSERT, UPDATE, DELETE)                |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| USING       | See below                                   |
| WITH CHECK  | See below                                   |

```sql
USING (
  EXISTS (
    SELECT 1 FROM finance_applications fa
    WHERE fa.id = guarantors.application_id
    AND (
      fa.customer_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('SUPER_ADMIN', 'ADMIN', 'RETAILER')
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM finance_applications fa
    WHERE fa.id = guarantors.application_id
    AND (
      fa.customer_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('SUPER_ADMIN', 'ADMIN', 'RETAILER')
      )
    )
  )
)
```

**Access**: A customer can manage guarantors for their own applications. Staff (SUPER_ADMIN,
ADMIN) and retailers can manage guarantors for any application. Note: the retailer check here
does not verify `retailer_id = auth.uid()` — retailers can manage guarantors on any application,
not just those linked to them.

---

### documents

Document metadata for uploaded files. Customers see their own documents; retailers see documents
for applications linked to them; staff see all documents. Only staff can update document
verification status.

#### `docs_select_own_or_staff`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | SELECT                                      |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| USING       | See below                                   |

```sql
USING (
  customer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM finance_applications fa
    WHERE fa.id = documents.application_id
    AND (
      fa.retailer_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('SUPER_ADMIN', 'ADMIN')
      )
    )
  )
)
```

**Access**: A customer can view documents where they are the `customer_id`. A retailer can view
documents for applications linked to them. SUPER_ADMIN and ADMIN can view all documents.

---

#### `docs_insert_own`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | INSERT                                      |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| WITH CHECK  | See below                                   |

```sql
WITH CHECK (
  customer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('SUPER_ADMIN', 'ADMIN', 'RETAILER')
  )
)
```

**Access**: A customer can upload documents for themselves (as `customer_id`). Staff
(SUPER_ADMIN, ADMIN) and retailers can upload documents for any customer.

---

#### `docs_update_staff`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | UPDATE                                      |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| USING       | See below                                   |
| WITH CHECK  | See below                                   |

```sql
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('SUPER_ADMIN', 'ADMIN')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('SUPER_ADMIN', 'ADMIN')
  )
)
```

**Access**: Only SUPER_ADMIN and ADMIN can update documents (e.g., to change `status` from
`UPLOADED` to `VERIFIED` or `REJECTED`). Customers and retailers cannot modify document metadata
after upload.

---

### emi_schedules

EMI installment schedules. Access is derived from the parent `finance_applications` row. Only
staff can update EMI status (e.g., mark as PAID).

#### `emi_select_via_app`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | SELECT                                      |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| USING       | See below                                   |

```sql
USING (
  EXISTS (
    SELECT 1 FROM finance_applications fa
    WHERE fa.id = emi_schedules.application_id
    AND (
      fa.customer_id = auth.uid()
      OR fa.retailer_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('SUPER_ADMIN', 'ADMIN')
      )
    )
  )
)
```

**Access**: A user can view EMI schedules for applications they can access (as customer, linked
retailer, or staff).

---

#### `emi_update_staff`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | UPDATE                                      |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| USING       | See below                                   |
| WITH CHECK  | See below                                   |

```sql
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('SUPER_ADMIN', 'ADMIN')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('SUPER_ADMIN', 'ADMIN')
  )
)
```

**Access**: Only SUPER_ADMIN and ADMIN can update EMI schedule entries (e.g., mark an installment
as `PAID` or `OVERDUE`). Customers and retailers have read-only access to EMI schedules. There
is no INSERT or DELETE policy — EMI schedules are created exclusively by the
`generate_emi_schedule()` database function (called via the `manage-application` edge function
with the service-role key).

---

### payments

Payment records. Customers see their own payments; retailers see payments for applications linked
to them; staff see all payments. Customers, staff, and retailers can record payments.

#### `payments_select_via_app`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | SELECT                                      |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| USING       | See below                                   |

```sql
USING (
  customer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM finance_applications fa
    WHERE fa.id = payments.application_id
    AND (
      fa.retailer_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('SUPER_ADMIN', 'ADMIN')
      )
    )
  )
)
```

**Access**: A customer can view their own payments (`customer_id = auth.uid()`). A retailer can
view payments for applications linked to them. SUPER_ADMIN and ADMIN can view all payments.

---

#### `payments_insert_own_or_staff`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | INSERT                                      |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| WITH CHECK  | See below                                   |

```sql
WITH CHECK (
  customer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('SUPER_ADMIN', 'ADMIN', 'RETAILER')
  )
)
```

**Access**: A customer can record payments for themselves (`customer_id = auth.uid()`). Staff
(SUPER_ADMIN, ADMIN) and retailers can record payments for any customer. There is no UPDATE or
DELETE policy — payments are effectively append-only through the standard client (corrections
would require the service-role key via an edge function).

---

### notifications

User notification messages. Users have full control over their own notifications (read, mark as
read, delete). Staff and retailers can insert notifications for other users (used by edge
functions to notify customers of application events).

#### `notifications_select_own`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | SELECT                                      |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| USING       | See below                                   |

```sql
USING (user_id = auth.uid())
```

**Access**: A user can only view notifications addressed to them.

---

#### `notifications_insert_own_or_staff`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | INSERT                                      |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| WITH CHECK  | See below                                   |

```sql
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('SUPER_ADMIN', 'ADMIN', 'RETAILER')
  )
)
```

**Access**: A user can create notifications for themselves. Staff (SUPER_ADMIN, ADMIN) and
retailers can create notifications for any user (e.g., the `manage-application` edge function
creates notifications for the customer when an application status changes).

---

#### `notifications_update_own`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | UPDATE                                      |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| USING       | See below                                   |
| WITH CHECK  | See below                                   |

```sql
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid())
```

**Access**: A user can only update their own notifications (e.g., mark as read by setting
`read = true`). The `WITH CHECK` ensures they cannot reassign a notification to another user.

---

#### `notifications_delete_own`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | DELETE                                      |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| USING       | See below                                   |

```sql
USING (user_id = auth.uid())
```

**Access**: A user can only delete their own notifications.

---

### audit_logs

Immutable audit trail. Only staff can read. Any authenticated user can insert (edge functions
insert on behalf of users). No UPDATE or DELETE policies exist — audit logs are append-only.

#### `audit_select_staff`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | SELECT                                      |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| USING       | See below                                   |

```sql
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('SUPER_ADMIN', 'ADMIN')
  )
)
```

**Access**: Only SUPER_ADMIN and ADMIN can view audit logs.

---

#### `audit_insert_any`

| Attribute   | Value                                       |
| ----------- | ------------------------------------------- |
| Command     | INSERT                                      |
| Roles       | `authenticated`                             |
| Permissive  | PERMISSIVE                                  |
| WITH CHECK  | See below                                   |

```sql
WITH CHECK (auth.uid() IS NOT NULL)
```

**Access**: Any authenticated user can insert audit log entries. In practice, audit entries are
inserted by edge functions (e.g., `manage-application`) using the service-role key, which
bypasses RLS entirely. This policy allows direct client inserts if needed, as long as the user
is authenticated.

**No UPDATE or DELETE policies**: Audit logs cannot be modified or deleted through the standard
client. This makes the audit trail effectively append-only and tamper-proof at the RLS level.

---

## Policy Summary Matrix

| Table                  | SELECT                                        | INSERT                                         | UPDATE                                         | DELETE                                         |
| ---------------------- | --------------------------------------------- | ---------------------------------------------- | ---------------------------------------------- | ---------------------------------------------- |
| `profiles`             | Owner + staff + retailer                      | Own ID only                                    | Own only                                       | —                                              |
| `asset_categories`     | All authenticated                             | Staff only (ALL)                               | Staff only (ALL)                               | Staff only (ALL)                               |
| `assets`               | All authenticated                             | Staff + retailer (ALL)                         | Staff + retailer (ALL)                         | Staff + retailer (ALL)                         |
| `finance_applications` | Owner + retailer + staff                      | Owner + staff + retailer                       | Owner + retailer + staff                       | —                                              |
| `approvals`            | Via parent app (owner + retailer + staff)     | Via parent app (owner + retailer + staff)      | —                                              | —                                              |
| `guarantors`           | Via parent app (owner + retailer + staff)     | Via parent app (owner + staff + retailer) (ALL)| Via parent app (owner + staff + retailer) (ALL)| Via parent app (owner + staff + retailer) (ALL)|
| `documents`            | Owner + retailer via app + staff              | Owner + staff + retailer                       | Staff only                                     | —                                              |
| `emi_schedules`        | Via parent app (owner + retailer + staff)     | —                                              | Staff only                                     | —                                              |
| `payments`             | Owner + retailer via app + staff              | Owner + staff + retailer                       | —                                              | —                                              |
| `notifications`        | Own only                                      | Own + staff + retailer                         | Own only                                       | Own only                                       |
| `audit_logs`           | Staff only                                    | Any authenticated                              | —                                              | —                                              |

**Legend**:
- **Owner** = `customer_id = auth.uid()` or `user_id = auth.uid()`
- **Retailer** = `retailer_id = auth.uid()` or via parent app's `retailer_id`
- **Staff** = `SUPER_ADMIN` and/or `ADMIN` (and/or `RETAILER` — see individual policies)
- **—** = No policy for this command (operation is blocked for the standard client)
- **(ALL)** = Policy uses `FOR ALL` (covers INSERT + UPDATE + DELETE)

---

## RLS Helper Functions

These Supabase built-in functions are used in policy expressions:

### `auth.uid()`

Returns the UUID of the currently authenticated user (from the JWT). Returns `NULL` for
unauthenticated requests.

```sql
-- Example: check if the current user owns a row
USING (user_id = auth.uid())
```

### `auth.jwt()`

Returns the full JWT payload of the authenticated user. Used for advanced claims-based checks.
Authorization data (like roles) should live in `raw_app_meta_data` (user-immutable), not
`raw_user_meta_data` (user-mutable).

> **Note**: This system stores roles in the `profiles` table (not in JWT custom claims). Policies
> read the role via a subquery: `EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN (...))`.
> This ensures role changes take effect immediately without requiring a JWT refresh.

---

*This RLS policy reference reflects the current database state. Update it when policies are added, modified, or removed via migrations.*
