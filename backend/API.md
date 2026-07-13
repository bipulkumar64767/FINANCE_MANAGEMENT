# Edge Function API Reference — Electronic Asset Finance Management System

> Complete API reference for the 4 Supabase Edge Functions powering the Electronic Asset Finance
> Management System (EAFMS). All functions are deployed on the Supabase Deno runtime and accessed
> via the project's function endpoint base URL.

**Base URL**: `https://ntnoszvldvycrszjsrbw.supabase.co/functions/v1`

---

## Table of Contents

1. [Authentication & Conventions](#authentication--conventions)
2. [CORS Headers](#cors-headers)
3. [Error Handling](#error-handling)
4. [Functions](#functions)
   - [4.1 `seed-demo-users`](#41-seed-demo-users)
   - [4.2 `dashboard-stats`](#42-dashboard-stats)
   - [4.3 `manage-application`](#43-manage-application)
   - [4.4 `calculate-emi`](#44-calculate-emi)

---

## Authentication & Conventions

### Authentication

| Function             | JWT Required | Verification Method                              |
| -------------------- |:------------:| ------------------------------------------------ |
| `seed-demo-users`    | ❌ No        | None — bootstrap function (`verify_jwt: false`)  |
| `dashboard-stats`    | ✅ Yes       | `supabase.auth.getUser()` with user's JWT         |
| `manage-application` | ✅ Yes       | `supabase.auth.getUser()` with user's JWT         |
| `calculate-emi`      | ✅ Yes       | Supabase gateway JWT verification (`verify_jwt: true`) |

All authenticated functions require a valid Supabase JWT in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

The `access_token` is obtained from `supabase.auth.signInWithPassword()` or
`supabase.auth.getSession()` on the frontend.

### Request Conventions

| Convention         | Value                                              |
| ------------------ | -------------------------------------------------- |
| Protocol           | HTTPS only                                          |
| Request body       | JSON (`Content-Type: application/json`)            |
| Response body      | JSON (`Content-Type: application/json`)            |
| Character encoding | UTF-8                                               |
| Date format        | ISO 8601 (`YYYY-MM-DDTHH:mm:ss.sssZ`)              |
| Currency           | INR (₹), stored as `numeric(12,2)` — paise precision |

### HTTP Status Codes

| Code | Meaning                  | When Used                                      |
| ---- | ------------------------ | ---------------------------------------------- |
| 200  | OK                       | Successful request (all success responses)     |
| 400  | Bad Request              | Missing required fields, invalid action         |
| 401  | Unauthorized             | Missing or invalid JWT, user not found          |
| 403  | Forbidden                | Authenticated but role not authorized for action |
| 404  | Not Found                | Profile or application not found                |
| 500  | Internal Server Error    | Unexpected error, database failure              |

---

## CORS Headers

All edge functions return a fixed set of CORS headers on **every response** — preflight, success,
and error. These are mandatory for Supabase client compatibility.

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Client-Info, Apikey
```

### Preflight (OPTIONS) Handling

Every function responds to `OPTIONS` requests with a `200` and the CORS headers (no body):

```http
OPTIONS /functions/v1/dashboard-stats HTTP/1.1
Host: ntnoszvldvycrszjsrbw.supabase.co

HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Client-Info, Apikey
Content-Length: 0
```

---

## Error Handling

### Error Response Format

All errors are returned as JSON with an `error` field containing a human-readable message:

```json
{
  "error": "Unauthorized"
}
```

### Common Error Scenarios

| Scenario                          | Status | Response Body                                          |
| --------------------------------- |:------:| ------------------------------------------------------ |
| No JWT / invalid JWT              | 401    | `{"error": "Unauthorized"}`                           |
| Valid JWT but no profile row      | 404    | `{"error": "Profile not found"}`                      |
| Missing required request fields   | 400    | `{"error": "Missing required fields: ..."}`           |
| Invalid workflow action           | 400    | `{"error": "Invalid action"}`                         |
| Role not authorized for action    | 403    | `{"error": "Not authorized for this action"}`         |
| Application ID not found          | 404    | `{"error": "Application not found"}`                  |
| Database error                    | 500    | `{"error": "<supabase error message>"}`               |
| Unexpected exception              | 500    | `{"error": "<exception message>"}`                    |

### Try/Catch Pattern

Every function wraps its body in a `try/catch`. Unhandled exceptions return a 500 with the
error message — they never produce a non-JSON response or an unhandled promise rejection.

---

## Functions

---

### 4.1 `seed-demo-users`

Provisions 4 demo users (one per role: SUPER_ADMIN, ADMIN, RETAILER, CUSTOMER) with auth
accounts and corresponding `profiles` rows. This is a **bootstrap/setup function** — it does
not require authentication and is intended to be called once during initial project setup.

#### Endpoint

```
POST https://ntnoszvldvycrszjsrbw.supabase.co/functions/v1/seed-demo-users
```

#### Authentication

**None.** JWT verification is disabled (`verify_jwt: false`). The function uses the
service-role key internally to create auth users and profiles.

#### Request

No request body required. The function uses a hardcoded list of demo users.

```http
POST /functions/v1/seed-demo-users HTTP/1.1
Host: ntnoszvldvycrszjsrbw.supabase.co
Content-Type: application/json
Authorization: Bearer <anon_key>
```

> The `Authorization` header is not validated but should be included as the Supabase gateway
> may require it depending on project settings.

#### Demo Users Created

| Email             | Password   | Full Name          | Role         | Phone              |
| ----------------- | ---------- | ------------------ | ------------ | ------------------ |
| `admin@demo.com`  | `demo1234` | System Admin       | `SUPER_ADMIN`| `+91 90000 00001`  |
| `manager@demo.com`| `demo1234` | Finance Manager    | `ADMIN`      | `+91 90000 00002`  |
| `retailer@demo.com`| `demo1234`| Vijay Electronics  | `RETAILER`   | `+91 90000 00003`  |
| `customer@demo.com`| `demo1234` | Rajesh Kumar       | `CUSTOMER`   | `+91 90000 00004`  |

#### Response — 200 OK

```json
{
  "success": true,
  "results": [
    {
      "email": "admin@demo.com",
      "status": "created",
      "userId": "0ec17ee0-fbab-4018-8c9f-3f20481c9e3c"
    },
    {
      "email": "manager@demo.com",
      "status": "created",
      "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    },
    {
      "email": "retailer@demo.com",
      "status": "created",
      "userId": "b2c3d4e5-f6a7-8901-bcde-f12345678901"
    },
    {
      "email": "customer@demo.com",
      "status": "created",
      "userId": "c3d4e5f6-a7b8-9012-cdef-123456789012"
    }
  ]
}
```

#### Response — Idempotent Re-run (200 OK)

If called again, existing users are skipped:

```json
{
  "success": true,
  "results": [
    { "email": "admin@demo.com",    "status": "already_exists", "userId": "0ec17ee0-..." },
    { "email": "manager@demo.com",  "status": "already_exists", "userId": "a1b2c3d4-..." },
    { "email": "retailer@demo.com", "status": "already_exists", "userId": "b2c3d4e5-..." },
    { "email": "customer@demo.com", "status": "already_exists", "userId": "c3d4e5f6-..." }
  ]
}
```

#### Response Fields

| Field              | Type    | Description                                      |
| ------------------ | ------- | ------------------------------------------------ |
| `success`          | boolean | Always `true` if the function completes          |
| `results`          | array   | Per-user creation result                         |
| `results[].email`  | string  | The demo user's email                            |
| `results[].status` | string  | `created`, `already_exists`, or `error: <msg>`   |
| `results[].userId` | string  | UUID of the created/existing auth user (if available) |

#### Error Response — 500

```json
{
  "error": "Internal server error message"
}
```

#### Frontend Example

```typescript
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seed-demo-users`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
  }
);

if (!response.ok) throw new Error(`Seeding failed (${response.status})`);
const { success, results } = await response.json();
console.log("Demo users seeded:", results);
```

---

### 4.2 `dashboard-stats`

Returns role-specific dashboard statistics. The function verifies the caller's JWT, loads their
profile to determine the role, and returns a statistics payload tailored to that role.

#### Endpoint

```
GET https://ntnoszvldvycrszjsrbw.supabase.co/functions/v1/dashboard-stats
```

#### Authentication

**JWT required.** The function calls `supabase.auth.getUser()` to verify the token and load the
user. It then loads the user's `profiles` row to determine the role.

#### Request

No request body. No query parameters.

```http
GET /functions/v1/dashboard-stats HTTP/1.1
Host: ntnoszvldvycrszjsrbw.supabase.co
Authorization: Bearer <access_token>
```

#### Response — 200 OK (SUPER_ADMIN / ADMIN)

```json
{
  "success": true,
  "role": "ADMIN",
  "stats": {
    "totalApplications": 42,
    "pendingApprovals": 8,
    "totalCustomers": 15,
    "totalRetailers": 5,
    "totalAssets": 30,
    "totalDisbursed": 1250000.00,
    "totalReceivable": 85000.00,
    "applicationsByStatus": {
      "DRAFT": 3,
      "SUBMITTED": 5,
      "UNDER_REVIEW": 3,
      "APPROVED": 2,
      "REJECTED": 4,
      "DISBURSED": 23,
      "CLOSED": 2
    }
  }
}
```

#### Response — 200 OK (RETAILER)

```json
{
  "success": true,
  "role": "RETAILER",
  "stats": {
    "totalApplications": 18,
    "pendingApprovals": 4,
    "approvedApplications": 10,
    "totalCustomers": 7,
    "totalFinanceAmount": 450000.00,
    "applicationsByStatus": {
      "DRAFT": 1,
      "SUBMITTED": 3,
      "UNDER_REVIEW": 1,
      "APPROVED": 2,
      "REJECTED": 1,
      "DISBURSED": 10
    }
  }
}
```

#### Response — 200 OK (CUSTOMER)

```json
{
  "success": true,
  "role": "CUSTOMER",
  "stats": {
    "totalApplications": 3,
    "activeLoans": 1,
    "pendingApplications": 1,
    "totalBorrowed": 50000.00,
    "monthlyEMI": 4442.42,
    "nextEMIDue": {
      "amount": 4442.42,
      "dueDate": "2026-08-12"
    },
    "applicationsByStatus": {
      "DRAFT": 1,
      "SUBMITTED": 0,
      "UNDER_REVIEW": 0,
      "APPROVED": 0,
      "REJECTED": 1,
      "DISBURSED": 1
    }
  }
}
```

#### Response Fields

| Field                          | Type    | Roles              | Description                                  |
| ------------------------------ | ------- | ------------------ | -------------------------------------------- |
| `success`                      | boolean | All                | Always `true` on success                      |
| `role`                         | string  | All                | The caller's role                             |
| `stats.totalApplications`      | number  | All                | Total applications (scoped by role)           |
| `stats.pendingApprovals`       | number  | ADMIN, SUPER_ADMIN | Applications in SUBMITTED or UNDER_REVIEW    |
| `stats.totalCustomers`         | number  | ADMIN, SUPER_ADMIN | Total customer profiles                       |
| `stats.totalRetailers`         | number  | ADMIN, SUPER_ADMIN | Total retailer profiles                       |
| `stats.totalAssets`            | number  | ADMIN, SUPER_ADMIN | Total assets in catalog                       |
| `stats.totalDisbursed`         | number  | ADMIN, SUPER_ADMIN | Sum of finance_amount for APPROVED + DISBURSED |
| `stats.totalReceivable`        | number  | ADMIN, SUPER_ADMIN | Sum of pending/overdue EMI amounts            |
| `stats.applicationsByStatus`   | object  | All                | Application count grouped by status           |
| `stats.approvedApplications`   | number  | RETAILER           | APPROVED + DISBURSED for this retailer        |
| `stats.totalFinanceAmount`     | number  | RETAILER           | Sum of finance_amount for retailer's apps     |
| `stats.activeLoans`            | number  | CUSTOMER           | APPROVED + DISBURSED for this customer        |
| `stats.pendingApplications`    | number  | CUSTOMER           | DRAFT + SUBMITTED + UNDER_REVIEW              |
| `stats.totalBorrowed`          | number  | CUSTOMER           | Sum of finance_amount for active loans        |
| `stats.monthlyEMI`             | number  | CUSTOMER           | Sum of monthly_emi for active loans           |
| `stats.nextEMIDue`             | object\|null | CUSTOMER      | Next pending EMI (`{ amount, dueDate }` or `null`) |

#### Error Responses

| Status | Condition                        | Response                          |
|:------:| -------------------------------- | --------------------------------- |
| 401    | Missing/invalid JWT              | `{"error": "Unauthorized"}`       |
| 404    | JWT valid but no profile row     | `{"error": "Profile not found"}`  |
| 500    | Database error / exception       | `{"error": "<message>"}`          |

#### Frontend Example

```typescript
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard-stats`,
  {
    method: "GET",
    headers: {
      Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
    },
  }
);

if (!response.ok) throw new Error(`Dashboard stats failed (${response.status})`);
const { success, role, stats } = await response.json();
```

---

### 4.3 `manage-application`

The application workflow engine. Executes application state transitions (submit, review, approve,
reject, disburse) with role-based authorization, records approval history, generates EMI schedules
on approval, sends customer notifications, and logs audit entries — all in one orchestrated call.

#### Endpoint

```
POST https://ntnoszvldvycrszjsrbw.supabase.co/functions/v1/manage-application
```

#### Authentication

**JWT required.** The function verifies the caller's JWT and loads their profile to check
role authorization for the requested action.

#### Request Body

```json
{
  "action": "APPROVE",
  "applicationId": "f5e4d3c2-b1a0-4e2f-9d8c-7b6a5f4e3d2c",
  "comments": "All KYC verified. Income meets criteria.",
  "rejectionReason": null
}
```

| Field             | Type    | Required | Description                                                                  |
| ----------------- | ------- |:--------:| ---------------------------------------------------------------------------- |
| `action`          | string  | ✅       | The transition to perform: `SUBMIT`, `REVIEW`, `APPROVE`, `REJECT`, `DISBURSE` |
| `applicationId`   | string  | ✅       | UUID of the `finance_applications` row to transition                          |
| `comments`        | string  | ❌       | Optional comment attached to the approval record and notification            |
| `rejectionReason` | string  | ❌       | Required for `REJECT` action; stored in `rejection_reason` and notification  |

#### Action → Role Authorization

| Action     | New Status       | Allowed Roles                           |
| ---------- | ---------------- | --------------------------------------- |
| `SUBMIT`   | `SUBMITTED`      | CUSTOMER, RETAILER, ADMIN, SUPER_ADMIN  |
| `REVIEW`   | `UNDER_REVIEW`   | ADMIN, SUPER_ADMIN                      |
| `APPROVE`  | `APPROVED`       | ADMIN, SUPER_ADMIN                      |
| `REJECT`   | `REJECTED`       | ADMIN, SUPER_ADMIN                      |
| `DISBURSE` | `DISBURSED`      | ADMIN, SUPER_ADMIN                      |

#### Request Examples

**Submit an application:**

```http
POST /functions/v1/manage-application HTTP/1.1
Host: ntnoszvldvycrszjsrbw.supabase.co
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "action": "SUBMIT",
  "applicationId": "f5e4d3c2-b1a0-4e2f-9d8c-7b6a5f4e3d2c"
}
```

**Approve an application:**

```json
{
  "action": "APPROVE",
  "applicationId": "f5e4d3c2-b1a0-4e2f-9d8c-7b6a5f4e3d2c",
  "comments": "All KYC verified. Income meets criteria."
}
```

**Reject an application:**

```json
{
  "action": "REJECT",
  "applicationId": "f5e4d3c2-b1a0-4e2f-9d8c-7b6a5f4e3d2c",
  "rejectionReason": "Income proof insufficient for requested finance amount."
}
```

**Disburse a loan:**

```json
{
  "action": "DISBURSE",
  "applicationId": "f5e4d3c2-b1a0-4e2f-9d8c-7b6a5f4e3d2c",
  "comments": "Disbursed to customer account XXXX1234."
}
```

#### Response — 200 OK

```json
{
  "success": true,
  "newStatus": "APPROVED"
}
```

| Field       | Type    | Description                          |
| ----------- | ------- | ------------------------------------ |
| `success`   | boolean | `true` if the transition succeeded   |
| `newStatus` | string  | The application's new status         |

#### Side Effects

When this function succeeds, it performs the following operations using the service-role key:

| Action     | DB Updates                                                                              |
| ---------- | --------------------------------------------------------------------------------------- |
| All        | Inserts an `approvals` record (approver, action, previous/new status, comments)         |
| All        | Inserts a `notifications` row for the customer (title, message, type, link)             |
| All        | Inserts an `audit_logs` row (user, action, entity, details)                             |
| `SUBMIT`   | Sets `finance_applications.submitted_at = now()`                                       |
| `APPROVE`  | Sets `finance_applications.approved_at = now()` + calls `generate_emi_schedule(app_id)` |
| `REJECT`   | Sets `finance_applications.rejection_reason = rejectionReason \|\| comments`           |
| `DISBURSE` | Sets `finance_applications.disbursed_at = now()`                                       |

#### Error Responses

| Status | Condition                                        | Response                                  |
|:------:| ------------------------------------------------ | ----------------------------------------- |
| 400    | `action` is not a valid transition               | `{"error": "Invalid action"}`             |
| 401    | Missing/invalid JWT                              | `{"error": "Unauthorized"}`               |
| 403    | Role not authorized for this action              | `{"error": "Not authorized for this action"}` |
| 404    | JWT valid but no profile                         | `{"error": "Profile not found"}`          |
| 404    | `applicationId` not found                        | `{"error": "Application not found"}`      |
| 500    | Database update error / exception                | `{"error": "<message>"}`                  |

#### Frontend Example

```typescript
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-application`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
    },
    body: JSON.stringify({
      action: "APPROVE",
      applicationId: appId,
      comments: "All KYC verified.",
    }),
  }
);

if (!response.ok) {
  const { error } = await response.json();
  throw new Error(error || `Action failed (${response.status})`);
}
const { success, newStatus } = await response.json();
```

---

### 4.4 `calculate-emi`

A stateless EMI calculation function. Given a principal amount, annual interest rate, and tenure,
returns the monthly EMI, total payable amount, total interest, and a full installment-by-installment
amortization schedule. Uses the reducing balance method.

This function does **not** read from or write to the database. It is used for preview calculations
in the loan calculator UI before an application is submitted.

#### Endpoint

```
POST https://ntnoszvldvycrszjsrbw.supabase.co/functions/v1/calculate-emi
```

#### Authentication

**JWT required** (Supabase gateway JWT verification, `verify_jwt: true`). The function itself
does not call `supabase.auth.getUser()` — it is a pure calculation.

#### Request Body

```json
{
  "principal": 50000,
  "annualRate": 12,
  "tenureMonths": 12
}
```

| Field           | Type   | Required | Description                                      |
| --------------- | ------ |:--------:| ------------------------------------------------ |
| `principal`     | number | ✅       | Finance amount in INR (the loan principal)       |
| `annualRate`    | number | ✅       | Annual interest rate as a percentage (e.g., `12` for 12%) |
| `tenureMonths`  | number | ✅       | Loan tenure in months (number of installments)   |

#### Request Example

```http
POST /functions/v1/calculate-emi HTTP/1.1
Host: ntnoszvldvycrszjsrbw.supabase.co
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "principal": 50000,
  "annualRate": 12,
  "tenureMonths": 12
}
```

#### Response — 200 OK

```json
{
  "emi": 4442.42,
  "totalPayable": 53309.04,
  "totalInterest": 3309.04,
  "principal": 50000,
  "schedule": [
    {
      "installmentNumber": 1,
      "dueDate": "2026-08-12",
      "amount": 4442.42,
      "principal": 3942.42,
      "interest": 500.00,
      "balance": 46057.58
    },
    {
      "installmentNumber": 2,
      "dueDate": "2026-09-12",
      "amount": 4442.42,
      "principal": 3981.84,
      "interest": 460.58,
      "balance": 42075.74
    },
    {
      "installmentNumber": 3,
      "dueDate": "2026-10-12",
      "amount": 4442.42,
      "principal": 4021.66,
      "interest": 420.76,
      "balance": 38054.08
    },
    {
      "installmentNumber": 12,
      "dueDate": "2027-07-12",
      "amount": 4441.05,
      "principal": 4428.55,
      "interest": 12.50,
      "balance": 0.00
    }
  ]
}
```

#### Response Fields

| Field                | Type   | Description                                              |
| -------------------- | ------ | -------------------------------------------------------- |
| `emi`                | number | Monthly EMI amount (rounded to 2 decimals)               |
| `totalPayable`       | number | Sum of all installment amounts                           |
| `totalInterest`      | number | `totalPayable − principal` (total interest paid)         |
| `principal`          | number | Echo of the input principal                              |
| `schedule`           | array  | Full amortization schedule (one entry per month)         |
| `schedule[].installmentNumber` | number | Installment sequence (1 to `tenureMonths`)     |
| `schedule[].dueDate` | string | Due date in `YYYY-MM-DD` format (month +N from today)    |
| `schedule[].amount`  | number | EMI amount for this installment                          |
| `schedule[].principal` | number | Principal component of this installment                 |
| `schedule[].interest` | number | Interest component of this installment                  |
| `schedule[].balance` | number | Outstanding principal balance after this installment     |

#### Calculation Method

The function uses the standard reducing balance amortization formula:

```
EMI = P × r × (1+r)^n / ((1+r)^n − 1)

where:
    P = principal
    r = monthly rate = annualRate / 12 / 100
    n = tenureMonths
```

If `r = 0` (interest-free), `EMI = P / n`.

The last installment is adjusted so the balance reaches exactly `0.00`.

> See [ARCHITECTURE.md §7 EMI Calculation Methodology](ARCHITECTURE.md#7-emi-calculation-methodology) for the full methodology.

#### Error Responses

| Status | Condition                                    | Response                                              |
|:------:| -------------------------------------------- | ----------------------------------------------------- |
| 400    | Missing `principal`, `annualRate`, or `tenureMonths` | `{"error": "Missing required fields: principal, annualRate, tenureMonths"}` |
| 500    | Exception (e.g., invalid JSON, type error)   | `{"error": "<message>"}`                              |

#### Frontend Example

```typescript
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calculate-emi`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
    },
    body: JSON.stringify({
      principal: 50000,
      annualRate: 12,
      tenureMonths: 12,
    }),
  }
);

if (!response.ok) {
  const { error } = await response.json();
  throw new Error(error || `EMI calculation failed (${response.status})`);
}
const { emi, totalPayable, totalInterest, schedule } = await response.json();
console.log(`Monthly EMI: ₹${emi}, Total Interest: ₹${totalInterest}`);
```

---

## Quick Reference

### Endpoint Summary

| #  | Function             | Method | Endpoint                                                                  | JWT |
| -- | -------------------- |:------:| ------------------------------------------------------------------------- |:---:|
| 1  | `seed-demo-users`    | POST   | `https://ntnoszvldvycrszjsrbw.supabase.co/functions/v1/seed-demo-users`    | ❌  |
| 2  | `dashboard-stats`    | GET    | `https://ntnoszvldvycrszjsrbw.supabase.co/functions/v1/dashboard-stats`    | ✅  |
| 3  | `manage-application` | POST   | `https://ntnoszvldvycrszjsrbw.supabase.co/functions/v1/manage-application` | ✅  |
| 4  | `calculate-emi`      | POST   | `https://ntnoszvldvycrszjsrbw.supabase.co/functions/v1/calculate-emi`      | ✅  |

### Request Body Summary

| Function             | Required Fields                              |
| -------------------- | --------------------------------------------- |
| `seed-demo-users`    | _None_ (no body)                              |
| `dashboard-stats`    | _None_ (no body)                              |
| `manage-application` | `action`, `applicationId`                     |
| `calculate-emi`      | `principal`, `annualRate`, `tenureMonths`     |

### Standard Request Headers

```http
Content-Type: application/json
Authorization: Bearer <access_token>
```

---

*This API reference reflects the currently deployed edge functions. Update it when functions are added, modified, or removed.*
