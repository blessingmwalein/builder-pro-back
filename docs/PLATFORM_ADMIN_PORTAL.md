# BuilderPro — Platform Admin Portal API Documentation
> Base URL: `http://localhost:3005/api/v1`  
> All Platform Admin endpoints live under `/platform-admin/*`  
> Two auth methods: **Bearer token** (from login) OR **API key** (`x-platform-admin-key` header)

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Dashboard Overview](#2-dashboard-overview)
3. [Company Management](#3-company-management)
4. [Subscription Management](#4-subscription-management)
5. [Payments & Billing](#5-payments--billing)
6. [Page-by-Page API Map](#6-page-by-page-api-map)
7. [Full Screen Workflow](#7-full-screen-workflow)
8. [Response Shapes](#8-response-shapes)

---

## 1. Authentication

### 1.1 Login

```
POST /platform-admin/auth/login
Content-Type: application/json
```

**Body:**
```json
{
  "email": "admin@builderpro.app",
  "password": "AdminPassword123#"
}
```

**Response:**
```json
{
  "accessToken": "eyJ...",
  "tokenType": "Bearer"
}
```

> Store `accessToken` — use it as `Authorization: Bearer <token>` on all subsequent requests.

---

### 1.2 Get My Profile

```
GET /platform-admin/auth/me
Authorization: Bearer <platformAdminToken>
```

**Response:**
```json
{
  "id": "padmin_xxx",
  "email": "admin@builderpro.app",
  "name": "Platform Admin",
  "apiKey": "pa_live_xxx"
}
```

---

### 1.3 Rotate API Key

```
POST /platform-admin/auth/rotate-api-key
Authorization: Bearer <platformAdminToken>
Content-Type: application/json
```

**Body:**
```json
{ "reason": "Scheduled quarterly rotation" }
```

**Response:**
```json
{
  "newApiKey": "pa_live_newkey_xxx",
  "rotatedAt": "2026-04-04T10:00:00.000Z"
}
```

> After rotation, update any server-to-server integrations using the old key.

---

### Auth Headers Quick Reference

| Use Case | Header |
|----------|--------|
| After login (browser) | `Authorization: Bearer <platformAdminToken>` |
| Server-to-server / scripts | `x-platform-admin-key: <apiKey>` |

---

## 2. Dashboard Overview

### 2.1 Platform Overview Stats

```
GET /platform-admin/overview
x-platform-admin-key: <apiKey>
```

**Response:**
```json
{
  "totalCompanies": 42,
  "activeCompanies": 38,
  "suspendedCompanies": 1,
  "pendingApprovals": 3,
  "totalSubscriptions": 42,
  "trialSubscriptions": 7,
  "activeSubscriptions": 35,
  "canceledSubscriptions": 2,
  "totalRevenue": 15400.00,
  "monthlyRecurringRevenue": 2800.00
}
```

**Frontend usage:**
- Stat cards: Total companies, Active, Pending approvals
- Revenue cards: Total revenue, MRR
- Alert badge: `pendingApprovals > 0` → show badge on nav

---

## 3. Company Management

### 3.1 List All Companies

```
GET /platform-admin/companies?page=1&limit=20&search=bling
x-platform-admin-key: <apiKey>
```

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |
| `search` | string | Search by company name or slug |

**Response:**
```json
{
  "items": [
    {
      "id": "co_xxx",
      "name": "Bling Construction",
      "slug": "bling-construction",
      "industry": "Construction",
      "accountType": "COMPANY",
      "countryCode": "ZW",
      "defaultCurrency": "USD",
      "isActive": true,
      "createdAt": "2026-04-04T10:00:00.000Z",
      "subscription": {
        "status": "TRIAL",
        "planCode": "STARTER",
        "trialEndsAt": "2026-05-04T00:00:00.000Z"
      },
      "ownerEmail": "owner@blingco.com",
      "_count": { "users": 3, "projects": 2 }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 42 }
}
```

---

### 3.2 Pending Company Approvals

```
GET /platform-admin/companies/pending-approvals?page=1&limit=20
x-platform-admin-key: <apiKey>
```

Returns companies that registered but have `isActive: false` (awaiting manual approval).

**Response shape:** Same as List Companies above but only `isActive: false` companies.

---

### 3.3 Approve or Suspend a Company

```
PATCH /platform-admin/companies/:companyId/approval
x-platform-admin-key: <apiKey>
Content-Type: application/json
```

**Body:**
```json
{ "isActive": true }
```

| `isActive` | Effect |
|-----------|--------|
| `true` | Approves / re-activates the company — users can now log in |
| `false` | Suspends the company — all users blocked from accessing the app |

**Response:**
```json
{
  "id": "co_xxx",
  "name": "Bling Construction",
  "isActive": true,
  "updatedAt": "2026-04-04T11:00:00.000Z"
}
```

---

## 4. Subscription Management

### 4.1 List All Subscriptions

```
GET /platform-admin/subscriptions?page=1&limit=20&search=bling
x-platform-admin-key: <apiKey>
```

**Response:**
```json
{
  "items": [
    {
      "id": "sub_xxx",
      "status": "TRIAL",
      "billingCycle": "MONTHLY",
      "currentPeriodFrom": "2026-04-04T00:00:00.000Z",
      "currentPeriodTo": "2026-05-04T00:00:00.000Z",
      "trialEndsAt": "2026-05-04T00:00:00.000Z",
      "company": {
        "id": "co_xxx",
        "name": "Bling Construction",
        "slug": "bling-construction"
      },
      "platformPlan": {
        "code": "STARTER",
        "name": "Starter",
        "monthlyPrice": 0
      }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 42 }
}
```

---

### 4.2 Update Subscription Status

```
PATCH /platform-admin/subscriptions/:subscriptionId/status
x-platform-admin-key: <apiKey>
Content-Type: application/json
```

**Body:**
```json
{ "status": "ACTIVE" }
```

**Allowed status values:**

| Status | When to use |
|--------|-------------|
| `TRIAL` | Reset to trial (e.g. grant extension) |
| `ACTIVE` | Manually activate (e.g. offline payment confirmed) |
| `PAST_DUE` | Flag as overdue for payment |
| `CANCELED` | Cancel the subscription |

**Response:**
```json
{
  "id": "sub_xxx",
  "status": "ACTIVE",
  "updatedAt": "2026-04-04T11:00:00.000Z"
}
```

---

## 5. Payments & Billing

### 5.1 List All Payments

```
GET /platform-admin/billing/payments?page=1&limit=20&search=
x-platform-admin-key: <apiKey>
```

**Response:**
```json
{
  "items": [
    {
      "id": "pay_xxx",
      "transactionRef": "PAY-xxx",
      "method": "PAYNOW",
      "status": "COMPLETED",
      "amount": 49.00,
      "currency": "USD",
      "createdAt": "2026-04-04T10:00:00.000Z",
      "company": {
        "id": "co_xxx",
        "name": "Bling Construction"
      },
      "subscription": {
        "id": "sub_xxx",
        "planCode": "PRO"
      }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 120 }
}
```

**Payment status values:** `PENDING` | `COMPLETED` | `FAILED` | `REFUNDED`

---

## 6. Page-by-Page API Map

### Login Page
| Action | API Call |
|--------|----------|
| Submit login form | `POST /platform-admin/auth/login` |
| Load admin profile after login | `GET /platform-admin/auth/me` |

---

### Dashboard Page
| Widget | API Call |
|--------|----------|
| Stat cards (companies, revenue, MRR) | `GET /platform-admin/overview` |
| Pending approvals badge / count | `GET /platform-admin/overview` → `pendingApprovals` |
| Recent companies table | `GET /platform-admin/companies?limit=5` |
| Recent payments table | `GET /platform-admin/billing/payments?limit=5` |

---

### Companies Page
| Action | API Call |
|--------|----------|
| Load companies table | `GET /platform-admin/companies?page=&limit=&search=` |
| Search companies | `GET /platform-admin/companies?search=<term>` |
| Approve a company | `PATCH /platform-admin/companies/:id/approval` `{ "isActive": true }` |
| Suspend a company | `PATCH /platform-admin/companies/:id/approval` `{ "isActive": false }` |

---

### Pending Approvals Page
| Action | API Call |
|--------|----------|
| Load pending list | `GET /platform-admin/companies/pending-approvals` |
| Approve company | `PATCH /platform-admin/companies/:id/approval` `{ "isActive": true }` |
| Reject / ignore company | `PATCH /platform-admin/companies/:id/approval` `{ "isActive": false }` |

---

### Subscriptions Page
| Action | API Call |
|--------|----------|
| Load subscriptions table | `GET /platform-admin/subscriptions?page=&limit=&search=` |
| Activate subscription manually | `PATCH /platform-admin/subscriptions/:id/status` `{ "status": "ACTIVE" }` |
| Cancel subscription | `PATCH /platform-admin/subscriptions/:id/status` `{ "status": "CANCELED" }` |
| Grant trial extension | `PATCH /platform-admin/subscriptions/:id/status` `{ "status": "TRIAL" }` |

---

### Payments / Billing Page
| Action | API Call |
|--------|----------|
| Load payments table | `GET /platform-admin/billing/payments?page=&limit=&search=` |

---

### Settings / API Key Page
| Action | API Call |
|--------|----------|
| View current profile & key | `GET /platform-admin/auth/me` |
| Rotate API key | `POST /platform-admin/auth/rotate-api-key` |

---

## 7. Full Screen Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLATFORM ADMIN PORTAL                        │
│─────────────────────────────────────────────────────────────────│
│                                                                 │
│  1. LOGIN                                                       │
│     POST /platform-admin/auth/login                             │
│     → store accessToken                                         │
│                                                                 │
│  2. DASHBOARD                                                   │
│     GET /platform-admin/overview                                │
│     → display: total companies, MRR, pending approvals          │
│                                                                 │
│  3. PENDING APPROVALS  (approval queue)                         │
│     GET /platform-admin/companies/pending-approvals             │
│     → for each company:                                         │
│       ✓ Approve: PATCH /platform-admin/companies/:id/approval   │
│                  body: { "isActive": true }                     │
│       ✗ Reject:  PATCH /platform-admin/companies/:id/approval   │
│                  body: { "isActive": false }                    │
│                                                                 │
│  4. ALL COMPANIES                                               │
│     GET /platform-admin/companies?search=&page=                 │
│     → suspend active: PATCH .../approval { "isActive": false }  │
│     → reactivate:     PATCH .../approval { "isActive": true }   │
│                                                                 │
│  5. SUBSCRIPTIONS                                               │
│     GET /platform-admin/subscriptions                           │
│     → manually activate:  PATCH .../status { "status":"ACTIVE"} │
│     → cancel:             PATCH .../status {"status":"CANCELED"} │
│                                                                 │
│  6. PAYMENTS                                                    │
│     GET /platform-admin/billing/payments                        │
│     → read-only view of all payment transactions                │
│                                                                 │
│  7. SETTINGS                                                    │
│     GET  /platform-admin/auth/me       (view key)               │
│     POST /platform-admin/auth/rotate-api-key  (rotate key)      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Response Shapes

### Pagination Meta (all list endpoints)
```json
{
  "items": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 42
  }
}
```

### Subscription Status Enum
| Value | Meaning |
|-------|---------|
| `TRIAL` | Free 30-day trial, not yet paid |
| `ACTIVE` | Paid and active |
| `PAST_DUE` | Payment failed / overdue |
| `CANCELED` | Subscription canceled |

### Company `isActive` Flag
| Value | Meaning |
|-------|---------|
| `true` | Company is active — all users can log in |
| `false` | Company is suspended / pending approval |

### Payment Status Enum
| Value | Meaning |
|-------|---------|
| `PENDING` | Awaiting gateway confirmation |
| `COMPLETED` | Payment received |
| `FAILED` | Payment failed |
| `REFUNDED` | Payment refunded |

---

*Platform Admin Portal — BuilderPro*
