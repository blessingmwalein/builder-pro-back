# BuilderPro Backend (NestJS + Prisma + PostgreSQL)

Multi-tenant construction management backend with JWT auth, RBAC, Bull queues, WebSockets, and Swagger docs.

## 1) Quick Start

1. Install dependencies:

```bash
npm install
```

2. Configure `.env`:

```env
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
PORT=3005
DEFAULT_COMPANY_SLUG=builder-pro-demo
```

3. Generate Prisma client and run migrations:

```bash
npm run prisma:generate
npx prisma migrate dev --name init_platform
npm run prisma:seed
```

4. Start app:

```bash
npm run start:dev
```

5. Open Swagger:

`http://localhost:3005/api/docs`

### 1.1 Platform Admin env (required)

Add these env values before seeding:

```env
PLATFORM_ADMIN_JWT_SECRET=change-me-platform-admin-jwt-secret
PLATFORM_ADMIN_JWT_TTL=12h
PLATFORM_ADMIN_DEFAULT_EMAIL=platform-admin@builderpro.local
PLATFORM_ADMIN_DEFAULT_PASSWORD=PlatformAdmin123!
PLATFORM_ADMIN_DEFAULT_NAME=Platform Admin
PLATFORM_ADMIN_DEFAULT_API_KEY=change-me-platform-admin-key
```

Optional multi-admin seed (JSON):

```env
PLATFORM_ADMIN_SEED_USERS_JSON=[{"email":"admin1@builderpro.local","password":"StrongPass1!","displayName":"Admin One","apiKey":"admin-one-key"},{"email":"admin2@builderpro.local","password":"StrongPass2!","displayName":"Admin Two","apiKey":"admin-two-key"}]
```

## 2) Why You See `Tenant slug is required`

This API is multi-tenant. The backend must know which company/tenant each request belongs to.

Tenant resolution order:

1. `x-tenant-slug` request header
2. subdomain (if using tenant subdomains)
3. JWT token `companyId` fallback (for authenticated endpoints)

If none is present for protected endpoints, you get:

```json
{
  "message": "Tenant slug is required",
  "error": "Unauthorized",
  "statusCode": 401
}
```

## 3) Universal Header Setup (Recommended)

Use this on all API clients:

- `Authorization: Bearer <access_token>`
- `x-tenant-slug: builder-pro-demo`

### 3.1 Swagger UI

1. Open `/api/docs`
2. Click `Authorize` and paste bearer token
3. For endpoints that accept tenant header, include `x-tenant-slug`

### 3.2 Postman (Collection-level)

Set collection variables:

- `baseUrl` = `http://localhost:3005/api/v1`
- `tenantSlug` = `builder-pro-demo`
- `accessToken` = `<jwt>`

Set collection headers:

- `x-tenant-slug: {{tenantSlug}}`
- `Authorization: Bearer {{accessToken}}`

### 3.3 Frontend (Axios)

```ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3005/api/v1',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  const tenantSlug = localStorage.getItem('tenantSlug') || 'builder-pro-demo';

  config.headers = config.headers ?? {};
  config.headers['x-tenant-slug'] = tenantSlug;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;
```

## 4) Onboarding Flow (Step by Step)

### 4.0 Paynow Environment

Set these before running paid activation flows:

```env
PAYNOW_BASE_URL=https://www.paynow.co.zw
PAYNOW_INTEGRATION_ID=<your integration id>
PAYNOW_INTEGRATION_KEY=<your integration key>
PAYNOW_RESULT_URL=http://localhost:3005/api/v1/billing/webhooks/paynow
PAYNOW_RETURN_URL=http://localhost:3005/api/docs
PAYNOW_USE_STUB=false
```

### 4.1 Register company and get access token

`POST /api/v1/onboarding/register`

```json
{
  "companyName": "Builder Pro Demo",
  "industry": "Construction",
  "firstName": "Blessing",
  "lastName": "Moyo",
  "email": "owner@builderpro.local",
  "password": "ChangeMe123!",
  "planCode": "STARTER"
}
```

This creates the tenant, owner, default roles/permissions, and an initial trial subscription.

### 4.2 Check subscription status

`GET /api/v1/onboarding/subscription-status`

Headers:

- `Authorization: Bearer <accessToken>`
- `x-tenant-slug: <tenantSlug>`

### 4.3 Activate paid subscription with Paynow (web or mobile)

`POST /api/v1/onboarding/activate-subscription`

Headers:

- `Authorization: Bearer <accessToken>`
- `x-tenant-slug: <tenantSlug>`

Request body (web checkout):

```json
{
  "planCode": "ENTERPRISE",
  "method": "PAYNOW",
  "billingCycle": "MONTHLY",
  "payerEmail": "owner@builderpro.local"
}
```

Request body (EcoCash mobile):

```json
{
  "planCode": "ENTERPRISE",
  "method": "ECOCASH",
  "billingCycle": "MONTHLY",
  "payerEmail": "owner@builderpro.local",
  "payerPhone": "0777123456"
}
```

Response includes:

- `paymentUrl` for web checkout
- `instructions` for mobile checkout
- `pollUrl` to check status
- `providerReference` merchant reference used by Paynow

### 4.4 Poll payment status

`POST /api/v1/billing/paynow/poll`

Headers:

- `Authorization: Bearer <accessToken>`
- `x-tenant-slug: <tenantSlug>`

Body:

```json
{
  "reference": "SUB-<companyId>-<timestamp>",
  "pollUrl": "https://www.paynow.co.zw/interface/remotetransaction?..."
}
```

The backend verifies with Paynow via `pollTransaction`, updates payment status, and activates the subscription when paid.

### 4.5 Paynow webhook callback

`POST /api/v1/billing/webhooks/paynow`

Configure this as Paynow `resultUrl`. The backend parses webhook payload, verifies status via Paynow poll URL, and applies invoice/subscription updates.

### Step 1: Register tenant user (legacy auth flow)

`POST /api/v1/auth/register`

```json
{
  "firstName": "Blessing",
  "lastName": "Moyo",
  "email": "owner@builderpro.local",
  "password": "ChangeMe123!",
  "companyName": "Builder Pro Demo",
  "phone": "+263771234567"
}
```

`companySlug` is optional. If omitted, backend auto-generates it from `companyName`.

### Step 2: Login

`POST /api/v1/auth/login`

Login now only requires email + password.

```json
{
  "email": "owner@builderpro.local",
  "password": "ChangeMe123!"
}
```

Optional: include `companySlug` only when the same email exists in multiple tenants.

### Step 3: Save tokens and tenant

Store:

- `accessToken`
- `refreshToken`
- `tenantSlug`

### Step 4: Call protected APIs

Send:

- `Authorization: Bearer <accessToken>`
- `x-tenant-slug: <tenantSlug>`

### Step 5: Refresh token when expired

`POST /api/v1/auth/refresh`

```json
{
  "refreshToken": "<refreshToken>"
}
```

## 5) Common API Flows

### 5.1 Project + Task flow

1. `POST /projects`
2. `GET /projects`
3. `POST /tasks`
4. `PATCH /tasks/:id/status`

### 5.2 Time Tracking flow

1. `POST /time-tracking/clock-in`
2. `PATCH /time-tracking/:id/clock-out`
3. `PATCH /time-tracking/:id/approve`

### 5.3 Quote -> Invoice -> Payment flow

1. `POST /quotes`
2. `POST /invoices`
3. `POST /invoices/:id/payments`
4. Paynow callback: `POST /billing/webhooks/paynow`

## 6) Troubleshooting

### 6.1 Tenant errors

- Ensure `x-tenant-slug` is sent for protected calls
- Ensure token belongs to same tenant
- Ensure tenant slug exists and is active

### 6.2 Database connectivity (Prisma P1001)

- Check `DATABASE_URL`
- For Neon + Prisma, prefer:
  `?sslmode=require`
- Avoid `channel_binding=require` if Prisma connection fails

### 6.3 WebSocket setup

- Ensure `@nestjs/platform-socket.io` is installed
- Send auth token and tenant header during socket handshake

## 7) Build and Test

```bash
npm run build
npm run test
npm run test:e2e
```

## 8) Platform Admin Auth + Management

Platform admin endpoints are cross-tenant and do not require `x-tenant-slug`.

Supported auth methods for `/api/v1/platform-admin/*`:

1. Bearer token from `POST /platform-admin/auth/login`
2. Per-admin API key via `x-platform-admin-key`

### 8.1 Login

`POST /api/v1/platform-admin/auth/login`

```json
{
  "email": "platform-admin@builderpro.local",
  "password": "PlatformAdmin123!"
}
```

### 8.2 Current admin

`GET /api/v1/platform-admin/auth/me`

Headers:

- `Authorization: Bearer <platform_admin_token>`

### 8.3 Rotate API key

`POST /api/v1/platform-admin/auth/rotate-api-key`

Headers:

- `Authorization: Bearer <platform_admin_token>`

Body:

```json
{
  "reason": "Quarterly rotation"
}
```

### 8.4 cURL and Postman docs

- cURL reference: `docs/curl/platform-admin-curl.md`
- Postman collection: `docs/postman/platform-admin.postman_collection.json`
- Full Postman collection (all APIs): `docs/postman/builderpro-full.postman_collection.json`
- Postman environment: `docs/postman/builderpro-local.postman_environment.json`

Import the collection file directly into Postman and set values for:

- `baseUrl`
- `platformAdminEmail`
- `platformAdminPassword`
- `platformAdminToken`
- `platformAdminApiKey`

### 8.5 Swagger JSON export (OpenAPI)

When the app is running, you can import Swagger JSON directly into Postman:

- Swagger UI: `http://localhost:3005/api/docs`
- OpenAPI JSON: `http://localhost:3005/api-json`

Postman import options:

1. Import `docs/postman/builderpro-full.postman_collection.json`
2. Or import URL `http://localhost:3005/api-json` for generated OpenAPI collection
# builder-pro-back
