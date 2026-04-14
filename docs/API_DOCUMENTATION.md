# BuilderPro API — Full Documentation
> Base URL: `http://localhost:3005/api/v1`  
> All tenant-scoped endpoints require `x-tenant-slug` header OR a valid Bearer token (tenant is resolved from JWT if header is omitted).

---

## Table of Contents

1. [Authentication & Headers](#1-authentication--headers)
2. [Onboarding Flow](#2-onboarding-flow)
3. [Auth Module](#3-auth-module)
4. [Users Module](#4-users-module)
5. [Companies Module](#5-companies-module)
6. [RBAC — Roles & Permissions](#6-rbac--roles--permissions)
7. [Projects Module](#7-projects-module)
8. [Tasks Module](#8-tasks-module)
9. [Time Tracking Module](#9-time-tracking-module)
10. [Materials Module](#10-materials-module)
11. [Quotes & Variations Module](#11-quotes--variations-module)
12. [Invoices Module](#12-invoices-module)
13. [Financials Module](#13-financials-module)
14. [Employees Module](#14-employees-module)
15. [CRM — Clients Module](#15-crm--clients-module)
16. [Messaging Module](#16-messaging-module)
17. [Notifications Module](#17-notifications-module)
18. [Documents Module](#18-documents-module)
19. [Reporting Module](#19-reporting-module)
20. [Subscriptions Module](#20-subscriptions-module)
21. [Billing Module](#21-billing-module)
22. [Platform Admin Module](#22-platform-admin-module)
23. [Frontend Workflows](#23-frontend-workflows)
24. [Permission Reference](#24-permission-reference)
25. [Enum Reference](#25-enum-reference)

---

## 1. Authentication & Headers

### Standard Tenant Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes (protected routes) | `Bearer <accessToken>` |
| `x-tenant-slug` | Recommended | Company slug (e.g. `bling-company`). If omitted, resolved from JWT. |
| `Content-Type` | Yes (POST/PUT/PATCH) | `application/json` |

### Platform Admin Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Bearer <platformAdminToken>` |
| `x-platform-admin-key` | Alternative | Static API key for machine-to-machine |

### Token Lifecycle

```
POST /onboarding/register  ──► accessToken + refreshToken (30-day trial starts)
POST /auth/login           ──► accessToken (15m TTL) + refreshToken (7d TTL)
POST /auth/refresh         ──► new accessToken + refreshToken
```

---

## 2. Onboarding Flow

> All endpoints in this section are **public** (no auth required) unless noted.

### 2.1 List Available Plans

```
GET /onboarding/plans
```

**Response:**
```json
[
  {
    "id": "plan_id",
    "code": "STARTER",
    "name": "Starter",
    "description": "...",
    "targetAccountType": "COMPANY",
    "monthlyPrice": 0,
    "annualPrice": 0,
    "limits": { "users": 5, "projects": 3, "storage_gb": 1 },
    "features": ["projects", "tasks", "time_tracking"],
    "sortOrder": 1
  }
]
```

---

### 2.2 Register New Company

```
POST /onboarding/register
```

**Body:**
```json
{
  "companyName": "Bling Construction",
  "industry": "Construction",
  "accountType": "COMPANY",
  "defaultCurrency": "USD",
  "countryCode": "ZW",
  "firstName": "Blessing",
  "lastName": "Mwale",
  "email": "owner@blingco.com",
  "phone": "+263772440088",
  "password": "Password123#",
  "planCode": "STARTER"
}
```

> `accountType`: `COMPANY` | `INDIVIDUAL`  
> `planCode`: optional, defaults to `STARTER`

**Response:**
```json
{
  "accessToken": "eyJ...",
  "tokenType": "Bearer",
  "company": {
    "id": "co_xxx",
    "name": "Bling Construction",
    "slug": "bling-construction",
    "accountType": "COMPANY",
    "defaultCurrency": "USD"
  },
  "user": {
    "id": "usr_xxx",
    "email": "owner@blingco.com",
    "firstName": "Blessing",
    "lastName": "Mwale"
  },
  "subscription": {
    "status": "TRIAL",
    "planCode": "STARTER",
    "planName": "Starter",
    "trialEndsAt": "2026-05-04T00:00:00.000Z",
    "trialDaysLeft": 30,
    "limits": { "users": 5, "projects": 3 },
    "activateUrl": "/onboarding/activate-subscription"
  }
}
```

> The returned `accessToken` can be used immediately for subsequent requests.  
> The company `slug` is auto-generated from `companyName` (e.g. `"Bling Construction"` → `"bling-construction"`).

---

### 2.3 Check Subscription Status

```
GET  /onboarding/subscription-status   (Bearer required)
POST /onboarding/subscription-status   (Bearer required)
```

**Headers:** `Authorization: Bearer <token>`, `x-tenant-slug: <slug>`

**Response:**
```json
{
  "status": "TRIAL",
  "planCode": "STARTER",
  "planName": "Starter",
  "billingCycle": "MONTHLY",
  "currentPeriodFrom": "2026-04-04T00:00:00.000Z",
  "currentPeriodTo": "2026-05-04T00:00:00.000Z",
  "trialEndsAt": "2026-05-04T00:00:00.000Z",
  "trialDaysLeft": 30,
  "limits": { "users": 5, "projects": 3 },
  "isExpired": false
}
```

> `status` values: `TRIAL` | `TRIAL_EXPIRED` | `ACTIVE` | `PAST_DUE` | `CANCELED` | `NONE`

---

### 2.4 Activate Subscription (End Trial → Pay)

```
POST /onboarding/activate-subscription
```

**Headers:** `Authorization: Bearer <token>`, `x-tenant-slug: <slug>`

**Body:**
```json
{
  "method": "PAYNOW",
  "billingCycle": "MONTHLY",
  "planCode": "PRO"
}
```

> `method`: `PAYNOW` | `ECOCASH` | `BANK_TRANSFER` | `CASH` | `CARD`  
> `billingCycle`: `MONTHLY` | `ANNUAL`  
> `planCode`: optional (upgrade at activation time)

**Response (free plan):**
```json
{
  "status": "ACTIVE",
  "planCode": "STARTER",
  "planName": "Starter",
  "billingCycle": "MONTHLY",
  "currentPeriodTo": "2026-05-04T00:00:00.000Z",
  "message": "Account activated successfully (free plan)."
}
```

**Response (paid plan):**
```json
{
  "status": "PENDING_PAYMENT",
  "planCode": "PRO",
  "planName": "Pro",
  "billingCycle": "MONTHLY",
  "amount": 49,
  "currency": "USD",
  "paymentUrl": "https://www.paynow.co.zw/payment/...",
  "providerReference": "PAY-xxx",
  "message": "Complete payment to activate your subscription."
}
```

---

## 3. Auth Module

### 3.1 Login

```
POST /auth/login
```

**Body:**
```json
{
  "email": "owner@blingco.com",
  "password": "Password123#",
  "companySlug": "bling-construction"
}
```

> `companySlug` can also be provided via `x-tenant-slug` header instead of body.

**Response:**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "tokenType": "Bearer",
  "expiresIn": "15m"
}
```

---

### 3.2 Register User Into Existing Company

```
POST /auth/register
```

> This adds a **new user** to an **already existing** company (not for creating new companies — use `/onboarding/register` for that).

**Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@blingco.com",
  "password": "Password123#",
  "companySlug": "bling-construction",
  "phone": "+263772000000"
}
```

---

### 3.3 Refresh Token

```
POST /auth/refresh
```

**Body:**
```json
{ "refreshToken": "eyJ..." }
```

---

### 3.4 Get Current User (Me)

```
GET /auth/me
```

**Headers:** `Authorization: Bearer <token>`, `x-tenant-slug: <slug>`

**Response:**
```json
{
  "user": {
    "id": "usr_xxx",
    "email": "owner@blingco.com",
    "firstName": "Blessing",
    "lastName": "Mwale",
    "phone": "+263772440088",
    "avatarUrl": null,
    "roles": [{ "id": "role_xxx", "name": "Owner" }],
    "lastLoginAt": "2026-04-04T10:00:00.000Z"
  },
  "tenant": {
    "id": "co_xxx",
    "name": "Bling Construction",
    "slug": "bling-construction",
    "logoUrl": null,
    "industry": "Construction",
    "countryCode": "ZW",
    "defaultCurrency": "USD",
    "timezone": "Africa/Harare",
    "isActive": true,
    "accountType": "COMPANY"
  },
  "permissions": ["projects.*", "tasks.*", "invoices.*", "settings.*"]
}
```

---

### 3.5 Invite User

```
POST /auth/invite
```

**Required Permission:** `employees.*` or `settings.*`  
**Headers:** `Authorization: Bearer <token>`, `x-tenant-slug: <slug>`

**Body:**
```json
{
  "email": "worker@blingco.com",
  "firstName": "Alice",
  "lastName": "Moyo",
  "phone": "+263772111111",
  "roleId": "role_worker_id"
}
```

**Response:**
```json
{
  "userId": "usr_xxx",
  "email": "worker@blingco.com",
  "inviteToken": "abc123...",
  "inviteLink": "/auth/accept-invite?token=abc123...",
  "expiresAt": "2026-04-11T10:00:00.000Z"
}
```

---

### 3.6 Accept Invite

```
POST /auth/accept-invite
```

**Body:**
```json
{
  "token": "abc123...",
  "password": "MyPassword123#"
}
```

**Response:** Same as login (accessToken + refreshToken).

---

## 4. Users Module

**All endpoints require:** `Authorization: Bearer <token>`, `x-tenant-slug: <slug>`

### 4.1 List Users

```
GET /users?page=1&limit=20&search=&isActive=true
```

**Required Permission:** `employees.*` or `settings.*`

**Response:**
```json
{
  "items": [
    {
      "id": "usr_xxx",
      "email": "owner@blingco.com",
      "firstName": "Blessing",
      "lastName": "Mwale",
      "phone": "+263772440088",
      "isActive": true,
      "lastLoginAt": "2026-04-04T10:00:00.000Z",
      "roles": [{ "id": "role_xxx", "name": "Owner" }]
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1 }
}
```

---

### 4.2 Get / Update My Profile

```
GET /users/me
PUT /users/me
```

**PUT Body:**
```json
{
  "firstName": "Blessing",
  "lastName": "Mwale",
  "phone": "+263772440088"
}
```

---

### 4.3 Get / Update Specific User

```
GET  /users/:userId
PUT  /users/:userId
```

**Required Permission:** `employees.*` or `settings.*`

---

### 4.4 Activate / Deactivate User

```
PUT /users/:userId/activate
PUT /users/:userId/deactivate
```

**Required Permission:** `settings.*`

---

## 5. Companies Module

**All endpoints require:** `Authorization: Bearer <token>`, `x-tenant-slug: <slug>`, Permission: `settings.*`

### 5.1 Get Company

```
GET /companies/me
```

**Response:**
```json
{
  "id": "co_xxx",
  "name": "Bling Construction",
  "slug": "bling-construction",
  "logoUrl": null,
  "industry": "Construction",
  "accountType": "COMPANY",
  "defaultCurrency": "USD",
  "countryCode": "ZW",
  "timezone": "Africa/Harare",
  "isActive": true
}
```

---

### 5.2 Update Company

```
PATCH /companies/me
```

**Body:**
```json
{
  "name": "Bling Construction Ltd",
  "countryCode": "ZW",
  "defaultCurrency": "USD",
  "timezone": "Africa/Harare"
}
```

---

## 6. RBAC — Roles & Permissions

**All endpoints require:** `Authorization: Bearer <token>`, `x-tenant-slug: <slug>`

### 6.1 List All Permission Keys

```
GET /rbac/permissions
```

Returns all available permission strings (e.g. `projects.*`, `invoices.view`).

---

### 6.2 List Roles

```
GET /rbac/roles
```

**Required Permission:** `settings.*`

**Response:**
```json
{
  "items": [
    {
      "id": "role_xxx",
      "name": "Owner",
      "description": "Full access",
      "isSystem": true,
      "permissions": ["projects.*", "tasks.*", "settings.*"]
    }
  ]
}
```

---

### 6.3 Create Role

```
POST /rbac/roles
```

**Required Permission:** `settings.*`

**Body:**
```json
{
  "name": "Finance Manager",
  "description": "Access to invoices and financials",
  "permissionKeys": ["invoices.*", "financials.*", "reports.*"]
}
```

---

### 6.4 Update Role

```
PUT /rbac/roles/:roleId
```

**Body:** Same as create.

---

### 6.5 Delete Role

```
DELETE /rbac/roles/:roleId
```

> Cannot delete system roles (`isSystem: true`).

---

### 6.6 Add / Remove Permissions on a Role

```
POST   /rbac/roles/:roleId/permissions
DELETE /rbac/roles/:roleId/permissions/:permissionKey
```

**POST Body:**
```json
{ "permissionKeys": ["invoices.*", "quotes.view"] }
```

---

### 6.7 Get User Roles

```
GET /rbac/users/:userId/roles
```

**Required Permission:** `settings.*` or `employees.*`

---

### 6.8 Assign / Remove Role from User

```
POST   /rbac/users/:userId/roles
DELETE /rbac/users/:userId/roles/:roleId
```

**POST Body:**
```json
{ "roleId": "role_xxx" }
```

---

## 7. Projects Module

**All endpoints require:** `Authorization: Bearer <token>`, `x-tenant-slug: <slug>`

### 7.1 Create Project

```
POST /projects
```

**Required Permission:** `projects.*` or `projects.create`

**Body:**
```json
{
  "code": "PROJ-001",
  "name": "Harare Office Block",
  "description": "5-storey commercial building",
  "status": "ACTIVE",
  "projectType": "COMMERCIAL",
  "siteAddress": "123 Samora Machel Ave, Harare",
  "projectManagerId": "usr_xxx",
  "clientId": "client_xxx",
  "startDate": "2026-04-10",
  "endDate": "2026-12-31",
  "baselineBudget": 500000
}
```

> `status`: `DRAFT` | `ACTIVE` | `ON_HOLD` | `COMPLETED` | `ARCHIVED`

---

### 7.2 List Projects

```
GET /projects?page=1&limit=20&search=harare&status=ACTIVE
```

**Required Permission:** `projects.*` or `projects.view`

---

### 7.3 Get Project Details

```
GET /projects/:projectId
```

---

### 7.4 Get Project Dashboard

```
GET /projects/:projectId/dashboard
```

**Response includes:** task counts, budget utilisation, timeline, alerts, member list.

---

### 7.5 Update Project

```
PUT /projects/:projectId
```

**Body (all optional):**
```json
{
  "name": "Harare Office Block Phase 2",
  "status": "ON_HOLD",
  "completionPercent": 45,
  "clientId": "client_xxx",
  "projectManagerId": "usr_xxx"
}
```

---

### 7.6 Delete Project

```
DELETE /projects/:projectId
```

**Required Permission:** `projects.*` or `projects.delete`  
Soft-deletes (sets `deletedAt`).

---

### 7.7 Project Members

```
GET    /projects/:projectId/members
POST   /projects/:projectId/members
DELETE /projects/:projectId/members/:userId
```

**POST Body:**
```json
{
  "userId": "usr_xxx",
  "role": "Site Supervisor"
}
```

---

## 8. Tasks Module

**All endpoints require:** `Authorization: Bearer <token>`, `x-tenant-slug: <slug>`

### 8.1 Create Task

```
POST /tasks
```

**Required Permission:** `tasks.*` or `tasks.create`

**Body:**
```json
{
  "projectId": "proj_xxx",
  "title": "Pour concrete foundations",
  "description": "North wing foundations only",
  "status": "TODO",
  "priority": "HIGH",
  "startDate": "2026-04-10",
  "dueDate": "2026-04-20",
  "estimatedHours": 40,
  "parentTaskId": null,
  "assigneeIds": ["usr_xxx", "usr_yyy"]
}
```

> `status`: `TODO` | `IN_PROGRESS` | `BLOCKED` | `REVIEW` | `DONE`  
> `priority`: `LOW` | `MEDIUM` | `HIGH` | `CRITICAL`

---

### 8.2 List Tasks

```
GET /tasks?projectId=proj_xxx&status=IN_PROGRESS&priority=HIGH&page=1&limit=20
```

**Required Permission:** `tasks.*` or `tasks.view`

---

### 8.3 My Queue (Assigned Tasks)

```
GET /tasks/my-queue
```

Returns all tasks assigned to the current user.

---

### 8.4 Get Task Details

```
GET /tasks/:taskId
```

Returns task + comments + checklists + subtasks.

---

### 8.5 Update Task

```
PUT /tasks/:taskId
```

**Body (all optional):**
```json
{
  "title": "Updated title",
  "priority": "CRITICAL",
  "dueDate": "2026-04-25",
  "estimatedHours": 50
}
```

---

### 8.6 Update Task Status

```
PUT /tasks/:taskId/status
```

**Body:**
```json
{ "status": "IN_PROGRESS" }
```

---

### 8.7 Assignees

```
POST   /tasks/:taskId/assignees/:userId
DELETE /tasks/:taskId/assignees/:userId
```

**Required Permission:** `tasks.*` or `tasks.assign`

---

### 8.8 Comments

```
GET  /tasks/:taskId/comments
POST /tasks/:taskId/comments
```

**POST Body:**
```json
{ "content": "Foundations complete on north wing." }
```

---

### 8.9 Checklists

```
POST /tasks/:taskId/checklists
```

**Body:**
```json
{
  "title": "Pre-pour checklist",
  "items": ["Inspect formwork", "Check reinforcement", "Verify levels"]
}
```

---

### 8.10 Toggle Checklist Item

```
PUT /tasks/:taskId/checklists/:checklistId/items/:itemId/toggle
```

---

## 9. Time Tracking Module

**All endpoints require:** `Authorization: Bearer <token>`, `x-tenant-slug: <slug>`

### 9.1 Clock In

```
POST /time-tracking/clock-in
```

**Required Permission:** `timesheets.*` or `timesheets.view_own`

**Body:**
```json
{
  "projectId": "proj_xxx",
  "taskId": "task_xxx",
  "gpsInLat": -17.8292,
  "gpsInLng": 31.0522
}
```

---

### 9.2 Clock Out

```
PUT /time-tracking/:entryId/clock-out
```

**Body:**
```json
{
  "breakMinutes": 30,
  "gpsOutLat": -17.8292,
  "gpsOutLng": 31.0522
}
```

---

### 9.3 Manual Time Entry

```
POST /time-tracking/manual
```

**Required Permission:** `timesheets.*`

**Body:**
```json
{
  "projectId": "proj_xxx",
  "taskId": "task_xxx",
  "clockInAt": "2026-04-04T07:00:00.000Z",
  "clockOutAt": "2026-04-04T15:30:00.000Z",
  "breakMinutes": 30,
  "notes": "Overtime Saturday work"
}
```

> Manual entries are flagged for manager approval.

---

### 9.4 Approve / Reject Time Entry

```
PUT /time-tracking/:entryId/approve
```

**Required Permission:** `timesheets.*` or `timesheets.approve`

**Body:**
```json
{
  "status": "APPROVED",
  "approvalComment": "Verified with site supervisor"
}
```

> `status`: `APPROVED` | `REJECTED`

---

### 9.5 List Entries

```
GET /time-tracking?projectId=proj_xxx&workerId=usr_xxx&status=PENDING&from=2026-04-01&to=2026-04-30&page=1&limit=20
```

---

### 9.6 Active Entry

```
GET /time-tracking/active
```

Returns the currently clocked-in entry for the user.

---

### 9.7 Weekly Summary

```
GET /time-tracking/weekly-summary?weekStart=2026-03-30
```

---

## 10. Materials Module

**All endpoints require:** `Authorization: Bearer <token>`, `x-tenant-slug: <slug>`

### 10.1 Create Material

```
POST /materials
```

**Required Permission:** `materials.*` or `materials.manage_inventory`

**Body:**
```json
{
  "name": "Cement (50kg bag)",
  "sku": "CEM-50KG",
  "unit": "bags",
  "unitCost": 12.50,
  "supplierId": "supplier_xxx"
}
```

---

### 10.2 List Materials

```
GET /materials?page=1&limit=20&search=cement&lowStock=true
```

**Required Permission:** `materials.*` or `materials.log`

---

### 10.3 Low Stock Alerts

```
GET /materials/low-stock
```

Returns materials where current stock ≤ `reorderAt` threshold.

---

### 10.4 Log Material Usage (on a Project)

```
POST /materials/usage
```

**Required Permission:** `materials.*` or `materials.log`

**Body:**
```json
{
  "projectId": "proj_xxx",
  "materialId": "mat_xxx",
  "quantity": 50,
  "unitCost": 12.50,
  "supplierId": "supplier_xxx",
  "notes": "Foundation pour north wing"
}
```

---

### 10.5 Adjust Stock

```
PUT /materials/:materialId/stock-adjust
```

**Body:**
```json
{ "quantity": -10 }
```

> Positive = add stock, negative = reduce stock.

---

### 10.6 Material Usage Logs

```
GET /materials/logs?page=1&limit=20&projectId=proj_xxx&materialId=mat_xxx
```

---

### 10.7 Suppliers

```
POST   /materials/suppliers
GET    /materials/suppliers/list?page=1&limit=20
DELETE /materials/suppliers/:supplierId
```

**POST Body:**
```json
{
  "name": "ZimCem Supplies",
  "email": "orders@zimcem.co.zw",
  "phone": "+263774000000",
  "address": "15 Industrial Road, Harare",
  "website": "https://zimcem.co.zw"
}
```

---

## 11. Quotes & Variations Module

**All endpoints require:** `Authorization: Bearer <token>`, `x-tenant-slug: <slug>`

### 11.1 Create Quote

```
POST /quotes
```

**Required Permission:** `quotes.*` or `quotes.create`

**Body:**
```json
{
  "clientId": "client_xxx",
  "projectId": "proj_xxx",
  "title": "Office Block — Phase 1 Quote",
  "issueDate": "2026-04-04",
  "expiryDate": "2026-04-30",
  "lineItems": [
    {
      "category": "Labour",
      "description": "Foundation work",
      "quantity": 1,
      "unitPrice": 25000
    },
    {
      "category": "Materials",
      "description": "Concrete & steel",
      "quantity": 1,
      "unitPrice": 45000
    }
  ]
}
```

---

### 11.2 Quote Status Flow

```
DRAFT → (send) → SENT → (approve) → APPROVED → (convert) → CONVERTED
                       → (reject) → REJECTED
```

```
PUT /quotes/:quoteId/send      (Permission: quotes.send)
PUT /quotes/:quoteId/approve   (Permission: quotes.approve)
PUT /quotes/:quoteId/reject    (Permission: quotes.approve)  Body: { "notes": "..." }
PUT /quotes/:quoteId/convert   (Converts approved quote to invoice)
```

---

### 11.3 List / Get / Update / Delete Quote

```
GET    /quotes?page=1&limit=20&status=SENT&clientId=client_xxx
GET    /quotes/:quoteId
PUT    /quotes/:quoteId       Body: { "title", "notes", "paymentTerms", "expiryDate", "taxRate", "discountAmount", "lineItems" }
DELETE /quotes/:quoteId
```

---

### 11.4 Variations (Change Orders)

```
POST /quotes/variations/:projectId
GET  /quotes/variations/:projectId
PUT  /quotes/variations/:variationId/approve
PUT  /quotes/variations/:variationId/reject
```

**POST Body:**
```json
{
  "title": "Additional floor requested by client",
  "description": "6th floor addition",
  "type": "ADDITION",
  "lineItems": [
    { "category": "Labour", "description": "6th floor construction", "quantity": 1, "unitPrice": 80000 }
  ]
}
```

> Approving a variation automatically updates the project budget.

---

## 12. Invoices Module

**All endpoints require:** `Authorization: Bearer <token>`, `x-tenant-slug: <slug>`

### 12.1 Create Invoice

```
POST /invoices
```

**Required Permission:** `invoices.*` or `invoices.create`

**Body:**
```json
{
  "clientId": "client_xxx",
  "projectId": "proj_xxx",
  "quoteId": "quote_xxx",
  "issueDate": "2026-04-04",
  "dueDate": "2026-05-04",
  "lineItems": [
    {
      "description": "Foundation works — Phase 1",
      "quantity": 1,
      "unitPrice": 25000
    }
  ]
}
```

---

### 12.2 Invoice Status Flow

```
DRAFT → (send) → SENT → (payment recorded) → PARTIALLY_PAID / PAID
               → (void) → VOID
(auto-job) → OVERDUE (when past dueDate)
```

```
PUT /invoices/:invoiceId/send
PUT /invoices/:invoiceId/void
PUT /invoices/mark-overdue/run    (trigger the overdue-marking job)
```

---

### 12.3 Record Payment

```
POST /invoices/:invoiceId/payments
```

**Required Permission:** `invoices.*` or `invoices.mark_paid`

**Body:**
```json
{
  "method": "BANK_TRANSFER",
  "amount": 12500
}
```

> Partial payments change status to `PARTIALLY_PAID`. Full payment sets `PAID`.

---

### 12.4 Aging Report

```
GET /invoices/aging-report
```

Returns overdue invoices grouped by 0–30, 31–60, 61–90, 90+ days.

---

### 12.5 Client Statement

```
GET /invoices/:clientId/statement
```

Returns all invoices + payment history for a client.

---

### 12.6 List / Get / Update / Delete

```
GET    /invoices?page=1&limit=20&status=SENT&clientId=xxx&projectId=xxx
GET    /invoices/:invoiceId
PUT    /invoices/:invoiceId    Body: { "dueDate", "notes", "paymentTerms", "retentionPct", "lineItems" }
DELETE /invoices/:invoiceId
```

---

## 13. Financials Module

**All endpoints require:** `Authorization: Bearer <token>`, `x-tenant-slug: <slug>`, Permission: `financials.*` or `financials.view`

### 13.1 Company Financial Dashboard

```
GET /financials/dashboard
```

Returns revenue, costs, profit margins, cash flow overview.

---

### 13.2 Project Financial Summary

```
GET /financials/summary?projectId=proj_xxx
```

Returns budget vs actual, breakdown by category.

---

### 13.3 Budget Categories

```
GET  /financials/budget-categories
POST /financials/budget-categories
```

**POST Body:**
```json
{ "code": "LABOUR", "name": "Labour Costs" }
```

---

### 13.4 Project Budget

```
GET /financials/projects/:projectId/budget
PUT /financials/projects/:projectId/budget
```

**PUT Body:**
```json
{
  "lines": [
    { "categoryId": "cat_labour", "plannedAmount": 200000, "thresholdPct": 90 },
    { "categoryId": "cat_materials", "plannedAmount": 150000, "thresholdPct": 85 }
  ]
}
```

> `thresholdPct`: alert threshold (e.g. 90 = alert when 90% of budget used).

---

### 13.5 Project Transactions

```
GET  /financials/projects/:projectId/transactions?page=1&limit=20
POST /financials/transactions
```

**POST Body:**
```json
{
  "projectId": "proj_xxx",
  "categoryId": "cat_materials",
  "description": "Cement purchase April 2026",
  "amount": 6250,
  "occurredAt": "2026-04-04",
  "reference": "INV-001"
}
```

---

## 14. Employees Module

**All endpoints require:** `Authorization: Bearer <token>`, `x-tenant-slug: <slug>`, Permission: `employees.*` or `employees.manage`

### 14.1 Create Employee Record

```
POST /employees
```

**Body:**
```json
{
  "userId": "usr_xxx",
  "employeeCode": "EMP-001",
  "jobTitle": "Site Supervisor",
  "employmentType": "FULL_TIME",
  "hourlyRate": 8.50,
  "startDate": "2026-01-01"
}
```

> `employmentType`: `FULL_TIME` | `PART_TIME` | `SUBCONTRACTOR` | `CASUAL`

---

### 14.2 List / Get / Update / Delete

```
GET    /employees?page=1&limit=20&search=&isActive=true
GET    /employees/:employeeId
PUT    /employees/:employeeId      Body: { "jobTitle", "hourlyRate", ... }
PUT    /employees/:employeeId/status  Body: { "isActive": false }
DELETE /employees/:employeeId
```

---

### 14.3 Payroll Export

```
GET /employees/payroll-export?from=2026-04-01&to=2026-04-30
```

Returns hours worked, hourly rate, gross pay per employee for the period.

---

## 15. CRM — Clients Module

**All endpoints require:** `Authorization: Bearer <token>`, `x-tenant-slug: <slug>`

### 15.1 Create Client

```
POST /crm/clients
```

**Required Permission:** `crm.*` or `crm.manage`

**Body:**
```json
{
  "name": "Delta Properties Ltd",
  "contactPerson": "James Mutasa",
  "clientType": "CORPORATE",
  "email": "james@delta.co.zw",
  "phone": "+263772555000",
  "address": "50 Baines Ave, Harare",
  "notes": "Key account — large commercial projects"
}
```

> `clientType`: `INDIVIDUAL` | `CORPORATE`

---

### 15.2 List / Get / Update / Delete

```
GET    /crm/clients?page=1&limit=20&search=delta
GET    /crm/clients/:clientId
PUT    /crm/clients/:clientId
DELETE /crm/clients/:clientId
```

`GET /:clientId` returns full history: projects, quotes, invoices, payments.

---

## 16. Messaging Module

**All endpoints require:** `Authorization: Bearer <token>`, `x-tenant-slug: <slug>`, Permission: `messaging.*`

### 16.1 List Conversations

```
GET /messaging/conversations
```

---

### 16.2 Create Conversation

```
POST /messaging/conversations
```

**Body:**
```json
{
  "type": "PROJECT",
  "projectId": "proj_xxx",
  "title": "Site coordination"
}
```

> `type`: `PROJECT` | `DIRECT`  
> For `DIRECT`: provide `participantIds: ["usr_a", "usr_b"]`

---

### 16.3 Get Project Channel

```
GET /messaging/projects/:projectId/conversation
```

Auto-creates the project channel if it doesn't exist yet.

---

### 16.4 Messages

```
GET  /messaging/conversations/:conversationId/messages?page=1&limit=20
POST /messaging/messages
```

**POST Body:**
```json
{
  "conversationId": "conv_xxx",
  "body": "Concrete pour scheduled for 7am tomorrow"
}
```

---

### 16.5 Mark Read

```
PUT /messaging/conversations/:conversationId/read
```

---

## 17. Notifications Module

**All endpoints require:** `Authorization: Bearer <token>`, `x-tenant-slug: <slug>`, Permission: `settings.*`

### 17.1 List My Notifications

```
GET /notifications/me?page=1&limit=20
```

---

### 17.2 Mark as Read

```
PATCH /notifications/:notificationId/read
```

**Body:**
```json
{ "isRead": true }
```

---

## 18. Documents Module

**All endpoints require:** `Authorization: Bearer <token>`, `x-tenant-slug: <slug>`

### 18.1 Upload Document (Register File)

```
POST /documents
```

**Required Permission:** `documents.*` or `documents.upload`

**Body:**
```json
{
  "fileKey": "companies/co_xxx/projects/proj_xxx/plans/blueprint-v1.pdf",
  "fileName": "blueprint-v1.pdf",
  "contentType": "application/pdf",
  "sizeBytes": 2048000,
  "projectId": "proj_xxx",
  "type": "PLAN",
  "folder": "blueprints",
  "gpsLat": -17.8292,
  "gpsLng": 31.0522
}
```

> `type`: `PLAN` | `PHOTO` | `CONTRACT` | `REPORT` | `OTHER`  
> Upload the actual file to S3/storage first, then register the `fileKey` here.

---

### 18.2 Get Download URL

```
GET /documents/:documentId/download-url
```

Returns a pre-signed download URL.

---

### 18.3 List / Get / Delete

```
GET    /documents?page=1&limit=20&projectId=proj_xxx&type=PLAN&folder=blueprints
GET    /documents/:documentId
DELETE /documents/:documentId
```

---

## 19. Reporting Module

**All endpoints require:** `Authorization: Bearer <token>`, `x-tenant-slug: <slug>`, Permission: `reports.*` or `reports.view`

### 19.1 Project Progress Report

```
GET /reporting/project-progress/:projectId
```

Returns: task completion %, budget utilisation, timeline status, milestone list.

---

### 19.2 Labour Report

```
GET /reporting/labour?from=2026-04-01&to=2026-04-30&projectId=proj_xxx
```

Returns: hours by worker, hours by project, cost breakdown.

---

### 19.3 Materials Report

```
GET /reporting/materials?projectId=proj_xxx&from=2026-04-01&to=2026-04-30
```

Returns: materials used, quantities, costs, supplier breakdown.

---

### 19.4 Financial Summary Report

```
GET /reporting/financial-summary?from=2026-04-01&to=2026-04-30
```

**Required Permission:** `reports.*` or `financials.view`

Returns: revenue, costs, profit margins, outstanding invoices.

---

### 19.5 List Generated Reports

```
GET /reporting
```

---

### 19.6 Generate Custom Report (Async)

```
POST /reporting/generate
```

**Body:**
```json
{
  "reportType": "LABOUR",
  "filters": {
    "from": "2026-04-01",
    "to": "2026-04-30",
    "projectId": "proj_xxx"
  }
}
```

Report is queued; poll `GET /reporting` for the result.

---

## 20. Subscriptions Module

**All endpoints require:** `Authorization: Bearer <token>`, `x-tenant-slug: <slug>`, Permission: `settings.*`

### 20.1 List Plans

```
GET /subscriptions/plans
```

---

### 20.2 Current Subscription

```
GET /subscriptions/current
```

---

### 20.3 Change Plan

```
POST /subscriptions/change-plan
```

**Body:**
```json
{ "planCode": "PRO" }
```

---

## 21. Billing Module

### 21.1 Initiate PayNow Payment

```
POST /billing/paynow/initiate
```

**Required Permission:** `invoices.*`  
**Headers:** `Authorization: Bearer <token>`, `x-tenant-slug: <slug>`

**Body:**
```json
{
  "invoiceId": "inv_xxx",
  "amount": 25000,
  "currency": "USD",
  "payerEmail": "client@delta.co.zw"
}
```

**Response:**
```json
{
  "paymentUrl": "https://www.paynow.co.zw/payment/...",
  "providerReference": "PAY-xxx"
}
```

---

### 21.2 PayNow Webhook (called by PayNow gateway)

```
POST /billing/webhooks/paynow
```

> **Public** — no auth. Called automatically by PayNow on payment completion.

**Body:**
```json
{
  "reference": "PAY-xxx",
  "companyId": "co_xxx"
}
```

---

## 22. Platform Admin Module

> These endpoints manage the **entire platform** (all tenants). Use the platform admin bearer token or API key.

### 22.1 Platform Admin Login

```
POST /platform-admin/auth/login
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

---

### 22.2 Get Platform Admin Profile

```
GET /platform-admin/auth/me
```

**Headers:** `Authorization: Bearer <platformAdminToken>`

---

### 22.3 Rotate API Key

```
POST /platform-admin/auth/rotate-api-key
```

**Body:**
```json
{ "reason": "Scheduled rotation" }
```

---

### 22.4 Platform Overview (Stats)

```
GET /platform-admin/overview
```

**Headers:** `x-platform-admin-key: <apiKey>`

**Response:**
```json
{
  "totalCompanies": 42,
  "activeCompanies": 38,
  "totalSubscriptions": 42,
  "activeSubscriptions": 35,
  "trialSubscriptions": 7,
  "totalRevenue": 15400,
  "pendingApprovals": 3
}
```

---

### 22.5 List All Companies

```
GET /platform-admin/companies?page=1&limit=20&search=bling
```

**Headers:** `x-platform-admin-key: <apiKey>`

---

### 22.6 Pending Company Approvals

```
GET /platform-admin/companies/pending-approvals?page=1&limit=20
```

Returns companies with `isActive: false` awaiting review.

---

### 22.7 Approve / Reject Company

```
PATCH /platform-admin/companies/:companyId/approval
```

**Body:**
```json
{ "isActive": true }
```

> `isActive: true` = approve, `isActive: false` = suspend/reject.

---

### 22.8 List All Subscriptions

```
GET /platform-admin/subscriptions?page=1&limit=20&search=
```

---

### 22.9 Update Subscription Status

```
PATCH /platform-admin/subscriptions/:subscriptionId/status
```

**Body:**
```json
{ "status": "ACTIVE" }
```

> `status`: `TRIAL` | `ACTIVE` | `PAST_DUE` | `CANCELED`

---

### 22.10 List All Payments

```
GET /platform-admin/billing/payments?page=1&limit=20
```

---

### 22.11 Company Details (with Subscription Relations)

```
GET /platform-admin/companies/:companyId
```

Returns a single company with enriched relations for admin operations:
- Recent subscriptions (latest first)
- Subscription plan and platform plan links
- Recent payments per subscription
- Aggregate counts (`users`, `projects`, `subscriptions`, `invoices`)

**Response (example):**
```json
{
  "id": "co_xxx",
  "name": "Bling Construction",
  "slug": "bling-construction",
  "isActive": true,
  "subscriptions": [
    {
      "id": "sub_xxx",
      "status": "ACTIVE",
      "billingCycle": "MONTHLY",
      "currentPeriodFrom": "2026-04-01T00:00:00.000Z",
      "currentPeriodTo": "2026-05-01T00:00:00.000Z",
      "plan": {
        "id": "plan_xxx",
        "code": "PRO",
        "name": "Pro"
      },
      "platformPlan": {
        "id": "pp_xxx",
        "code": "PRO",
        "name": "BuilderPro Pro"
      },
      "payments": [
        {
          "id": "pay_xxx",
          "status": "SUCCESS",
          "amount": 49,
          "currency": "USD"
        }
      ]
    }
  ],
  "_count": {
    "users": 12,
    "projects": 7,
    "subscriptions": 2,
    "invoices": 30
  }
}
```

---

### 22.12 Platform Admin RBAC APIs (Cross-Tenant)

> These endpoints let platform admins manage roles and permissions for any company by passing `:companyId`.

### 22.12.1 List Permission Catalog

```
GET /platform-admin/companies/:companyId/rbac/permissions
```

**Response:**
```json
{
  "companyId": "co_xxx",
  "items": [
    { "key": "projects.*" },
    { "key": "tasks.view" },
    { "key": "settings.permissions" }
  ]
}
```

---

### 22.12.2 Roles CRUD

```
GET    /platform-admin/companies/:companyId/rbac/roles
GET    /platform-admin/companies/:companyId/rbac/roles/:roleId
POST   /platform-admin/companies/:companyId/rbac/roles
PUT    /platform-admin/companies/:companyId/rbac/roles/:roleId
DELETE /platform-admin/companies/:companyId/rbac/roles/:roleId
```

**POST/PUT Body:**
```json
{
  "name": "Finance Manager",
  "description": "Access to invoices and financial reports",
  "permissionKeys": ["invoices.*", "financials.*", "reports.view"]
}
```

---

### 22.12.3 Assign / Remove Role Permissions

```
POST   /platform-admin/companies/:companyId/rbac/roles/:roleId/permissions
DELETE /platform-admin/companies/:companyId/rbac/roles/:roleId/permissions/:permissionKey
```

**POST Body:**
```json
{ "permissionKeys": ["quotes.view", "invoices.send"] }
```

---

### 22.12.4 User Role Management

```
GET    /platform-admin/companies/:companyId/rbac/users/:userId/roles
POST   /platform-admin/companies/:companyId/rbac/users/:userId/roles
DELETE /platform-admin/companies/:companyId/rbac/users/:userId/roles/:roleId
```

**POST Body:**
```json
{ "roleId": "role_xxx" }
```

---

## 23. Frontend Workflows

### 23.1 New Company Onboarding Flow

```
1. Show plan picker
   GET /onboarding/plans

2. Registration form
   POST /onboarding/register
   → Save accessToken, companySlug to local storage

3. Check subscription status (dashboard banner)
   GET /onboarding/subscription-status
   → if status === 'TRIAL', show "X days left" banner
   → if status === 'TRIAL_EXPIRED', block app and show upgrade gate

4. Optional: Upgrade / Activate
   POST /onboarding/activate-subscription
   → Free plan: immediately ACTIVE
   → Paid plan: redirect to paymentUrl
   → PayNow webhook auto-updates status to ACTIVE
```

---

### 23.2 Login Flow

```
1. POST /auth/login  (with companySlug + email + password)
2. Store accessToken + refreshToken
3. On 401 response: POST /auth/refresh → retry with new accessToken
4. GET /auth/me → populate user context, permissions, tenant info
```

---

### 23.3 Invite & Onboard New Team Member

```
1. (Admin) POST /auth/invite  → sends invite email with token
2. (User) POST /auth/accept-invite  → sets password, gets tokens
3. (Admin) POST /rbac/users/:userId/roles  → assign role
4. (Admin) POST /employees  → create employee record with hourly rate
```

---

### 23.4 Project Lifecycle

```
1. Create client      POST /crm/clients
2. Create project     POST /projects  (link clientId)
3. Set budget         PUT  /financials/projects/:id/budget
4. Add team members   POST /projects/:id/members
5. Create tasks       POST /tasks
6. Workers clock in   POST /time-tracking/clock-in
7. Workers clock out  PUT  /time-tracking/:id/clock-out
8. Manager approves   PUT  /time-tracking/:id/approve
9. Log materials      POST /materials/usage
10. Generate quote    POST /quotes → send → approve → convert
11. Create invoice    POST /invoices → send → record payment
12. Reports           GET  /reporting/project-progress/:id
```

---

### 23.5 Quote → Invoice → Payment Flow

```
1. POST /quotes              (DRAFT)
2. PUT  /quotes/:id/send     (DRAFT → SENT)
3. PUT  /quotes/:id/approve  (SENT → APPROVED)   — or client approves via client portal
4. PUT  /quotes/:id/convert  (APPROVED → CONVERTED, creates invoice in DRAFT)
5. PUT  /invoices/:id/send   (DRAFT → SENT)
6. POST /billing/paynow/initiate  → redirect client to paymentUrl
7. Webhook: POST /billing/webhooks/paynow  → auto-marks PAID
   — OR manual: POST /invoices/:id/payments  (cash/bank/card)
```

---

### 23.6 Admin Portal Pages → APIs Mapping

| Page | APIs Used |
|------|-----------|
| Dashboard | `GET /financials/dashboard`, `GET /projects`, `GET /notifications/me` |
| Projects List | `GET /projects`, `POST /projects` |
| Project Detail | `GET /projects/:id/dashboard`, `GET /tasks`, `GET /reporting/project-progress/:id` |
| Tasks Board (Kanban) | `GET /tasks?projectId=`, `PUT /tasks/:id/status` |
| My Tasks | `GET /tasks/my-queue` |
| Time Sheets | `GET /time-tracking`, `POST /time-tracking/clock-in`, `PUT /time-tracking/:id/clock-out` |
| Time Approvals | `GET /time-tracking?status=PENDING`, `PUT /time-tracking/:id/approve` |
| Clients | `GET /crm/clients`, `POST /crm/clients`, `GET /crm/clients/:id` |
| Quotes | `GET /quotes`, `POST /quotes`, `PUT /quotes/:id/send` |
| Invoices | `GET /invoices`, `POST /invoices`, `POST /invoices/:id/payments` |
| Financials | `GET /financials/dashboard`, `GET /financials/projects/:id/budget` |
| Employees | `GET /employees`, `POST /employees`, `GET /employees/payroll-export` |
| Materials | `GET /materials`, `POST /materials/usage`, `GET /materials/low-stock` |
| Documents | `GET /documents`, `POST /documents`, `GET /documents/:id/download-url` |
| Reports | `GET /reporting/labour`, `GET /reporting/financial-summary` |
| Settings → Company | `GET /companies/me`, `PATCH /companies/me` |
| Settings → Users | `GET /users`, `POST /auth/invite`, `PUT /users/:id/deactivate` |
| Settings → Roles | `GET /rbac/roles`, `POST /rbac/roles`, `PUT /rbac/roles/:id` |
| Settings → Subscription | `GET /subscriptions/current`, `GET /subscriptions/plans`, `POST /subscriptions/change-plan` |
| Messaging | `GET /messaging/conversations`, `GET /messaging/conversations/:id/messages`, `POST /messaging/messages` |

---

### 23.7 Platform Admin Portal Pages → APIs Mapping

| Page | APIs Used |
|------|-----------|
| Login | `POST /platform-admin/auth/login` |
| Overview Dashboard | `GET /platform-admin/overview` |
| All Companies | `GET /platform-admin/companies` |
| Company Details | `GET /platform-admin/companies/:id` |
| Pending Approvals | `GET /platform-admin/companies/pending-approvals`, `PATCH /platform-admin/companies/:id/approval` |
| Roles & Permissions | `GET /platform-admin/companies/:companyId/rbac/permissions`, `GET /platform-admin/companies/:companyId/rbac/roles`, `POST /platform-admin/companies/:companyId/rbac/roles`, `PUT /platform-admin/companies/:companyId/rbac/roles/:id`, `DELETE /platform-admin/companies/:companyId/rbac/roles/:id`, `POST /platform-admin/companies/:companyId/rbac/roles/:id/permissions`, `DELETE /platform-admin/companies/:companyId/rbac/roles/:id/permissions/:permissionKey`, `GET /platform-admin/companies/:companyId/rbac/users/:userId/roles`, `POST /platform-admin/companies/:companyId/rbac/users/:userId/roles`, `DELETE /platform-admin/companies/:companyId/rbac/users/:userId/roles/:roleId` |
| Subscriptions | `GET /platform-admin/subscriptions`, `PATCH /platform-admin/subscriptions/:id/status` |
| Payments | `GET /platform-admin/billing/payments` |
| API Key | `POST /platform-admin/auth/rotate-api-key` |

---

### 23.8 Client Portal Pages → APIs Mapping

> Clients log in with their own user account (role: `Client`) using standard `/auth/login`.  
> Permissions for Client role: `projects.view`, `quotes.view`, `invoices.view`

| Page | APIs Used |
|------|-----------|
| My Projects | `GET /projects` (filtered by client's assigned projects) |
| Project Progress | `GET /projects/:id/dashboard` |
| Quotes | `GET /quotes` (their quotes only) |
| Approve Quote | `PUT /quotes/:id/approve` or `PUT /quotes/:id/reject` |
| Invoices | `GET /invoices` |
| Pay Invoice | `POST /billing/paynow/initiate` → redirect to PayNow |
| Documents | `GET /documents?projectId=` |
| Messaging | `GET /messaging/projects/:projectId/conversation`, `POST /messaging/messages` |

---

## 24. Permission Reference

| Permission Key | Who Needs It |
|---------------|--------------|
| `projects.*` | Full project access (Owner, PM) |
| `projects.view` | Read-only project access (Supervisor, Worker, Client) |
| `projects.create` | Create new projects |
| `projects.delete` | Delete projects |
| `tasks.*` | Full task management |
| `tasks.view` | View tasks |
| `tasks.complete` | Mark tasks done |
| `tasks.assign` | Assign users to tasks |
| `timesheets.*` | Full timesheet management |
| `timesheets.view_own` | View own time entries |
| `timesheets.view_all` | View all workers' time entries |
| `timesheets.approve` | Approve/reject time entries |
| `materials.*` | Full materials management |
| `materials.log` | Log material usage |
| `materials.manage_inventory` | Create/update/delete materials |
| `quotes.*` | Full quotes management |
| `quotes.view` | View quotes |
| `quotes.create` | Create/edit quotes |
| `quotes.send` | Send quotes to clients |
| `quotes.approve` | Approve/reject quotes |
| `invoices.*` | Full invoices management |
| `invoices.view` | View invoices |
| `invoices.create` | Create/edit invoices |
| `invoices.send` | Send invoices |
| `invoices.mark_paid` | Record payments |
| `financials.*` | Full financials access |
| `financials.view` | View financials |
| `employees.*` | Full employee management |
| `employees.manage` | Create/update employees |
| `crm.*` | Full CRM access |
| `crm.view` | View clients |
| `crm.manage` | Create/update clients |
| `settings.*` | Company settings, users, roles |
| `reports.*` | Full reporting |
| `reports.view` | View reports |
| `messaging.*` | Full messaging |
| `messaging.view` | Read messages |
| `messaging.send` | Send messages |
| `documents.*` | Full document management |
| `documents.view` | View/download documents |
| `documents.upload` | Upload documents |

---

### Built-in Role Permissions

| Role | Permissions |
|------|-------------|
| **Owner** | All (`projects.*`, `tasks.*`, `timesheets.*`, `materials.*`, `quotes.*`, `invoices.*`, `financials.*`, `employees.*`, `settings.*`, `crm.*`, `reports.*`, `messaging.*`, `documents.*`) |
| **Project Manager** | Same as Owner except no `settings.*` |
| **Site Supervisor** | `projects.view`, `tasks.*`, `timesheets.*`, `materials.*`, `messaging.*`, `documents.*` |
| **Worker** | `projects.view`, `tasks.view`, `tasks.complete`, `timesheets.view_own`, `materials.log`, `messaging.*` |
| **Accountant** | `invoices.*`, `financials.*`, `quotes.view`, `reports.*` |
| **Client** | `projects.view`, `quotes.view`, `invoices.view` |

---

## 25. Enum Reference

### SubscriptionStatus
`TRIAL` | `ACTIVE` | `PAST_DUE` | `CANCELED`

### AccountType
`COMPANY` | `INDIVIDUAL`

### ProjectStatus
`DRAFT` | `ACTIVE` | `ON_HOLD` | `COMPLETED` | `ARCHIVED`

### TaskStatus
`TODO` | `IN_PROGRESS` | `BLOCKED` | `REVIEW` | `DONE`

### Priority
`LOW` | `MEDIUM` | `HIGH` | `CRITICAL`

### InvoiceStatus
`DRAFT` | `SENT` | `PARTIALLY_PAID` | `PAID` | `OVERDUE` | `VOID`

### PaymentMethod
`PAYNOW` | `ECOCASH` | `BANK_TRANSFER` | `CASH` | `CARD`

### EmploymentType
`FULL_TIME` | `PART_TIME` | `SUBCONTRACTOR` | `CASUAL`

### DocumentType
`PLAN` | `PHOTO` | `CONTRACT` | `REPORT` | `OTHER`

### MessageType (Conversation)
`PROJECT` | `DIRECT`

### BillingCycle
`MONTHLY` | `ANNUAL`

---

*Generated from BuilderPro backend source — `src/` + Postman collection.*
