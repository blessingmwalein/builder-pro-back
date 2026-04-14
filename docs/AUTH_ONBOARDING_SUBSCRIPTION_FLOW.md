# BuilderPro New Auth + Onboarding + Subscription Payment Flow

This document defines the updated flow for:

- Auth without requiring tenant slug during login
- Auto-generated tenant slug on registration
- Onboarding with subscription activation
- Paynow web/mobile payment integration

Base URL (local):

- `http://localhost:3005/api/v1`

## 1. What Changed

1. Login no longer requires `companySlug` in request body.
2. Login no longer requires `x-tenant-slug` header.
3. Tenant slug is auto-generated from company name during onboarding registration.
4. Subscription activation supports real Paynow web and EcoCash mobile flows.

## 2. Auth Flow (No Slug Required)

### 2.1 Register User (Auth Module)

Endpoint:

- `POST /auth/register`

Request body:

```json
{
  "firstName": "Blessing",
  "lastName": "Moyo",
  "email": "owner@builderpro.local",
  "password": "ChangeMe123!",
  "phone": "+263771234567"
}
```

Response:

- `accessToken`
- `refreshToken`
- `tokenType`
- User profile fields

Notes:

- If company context is needed in your UI, use `/onboarding/register` flow for full tenant creation.

### 2.2 Login (Email + Password Only)

Endpoint:

- `POST /auth/login`

Request body:

```json
{
  "email": "owner@builderpro.local",
  "password": "ChangeMe123!"
}
```

Response:

- `accessToken`
- `refreshToken`
- `tokenType`
- User context

No tenant slug is required for this call.

### 2.3 Refresh

Endpoint:

- `POST /auth/refresh`

Request body:

```json
{
  "refreshToken": "<refresh-token>"
}
```

## 3. Onboarding Flow (Company + Owner + Trial)

### 3.1 Register Company Account

Endpoint:

- `POST /onboarding/register`

Request body:

```json
{
  "companyName": "Engraved White Flint Distributors",
  "industry": "Construction",
  "firstName": "Blessing",
  "lastName": "Moyo",
  "email": "owner@builderpro.local",
  "password": "ChangeMe123!",
  "planCode": "STARTER"
}
```

Behavior:

- Company is created
- Owner user is created
- Default roles and permissions are created
- Trial subscription is created
- Company slug is auto-generated from `companyName`

Response includes:

- `accessToken`
- `company` with generated `slug`
- `subscription` with trial info

### 3.2 Get Subscription Status

Endpoint:

- `GET /onboarding/subscription-status`

Headers:

- `Authorization: Bearer <accessToken>`
- `x-tenant-slug: <companySlug>`

## 4. Subscription Activation + Payment

### 4.1 Activate Subscription

Endpoint:

- `POST /onboarding/activate-subscription`

Headers:

- `Authorization: Bearer <accessToken>`
- `x-tenant-slug: <companySlug>`

#### Web checkout example

```json
{
  "planCode": "ENTERPRISE",
  "method": "PAYNOW",
  "billingCycle": "MONTHLY",
  "payerEmail": "owner@builderpro.local"
}
```

#### EcoCash mobile example

```json
{
  "planCode": "ENTERPRISE",
  "method": "ECOCASH",
  "billingCycle": "MONTHLY",
  "payerEmail": "owner@builderpro.local",
  "payerPhone": "0777123456"
}
```

Response fields (paid plans):

- `status: PENDING_PAYMENT`
- `paymentUrl` (web flow)
- `instructions` (mobile flow)
- `pollUrl`
- `providerReference`
- `entitlements` (`limits`, `features`)

### 4.2 Poll Payment Status

Endpoint:

- `POST /billing/paynow/poll`

Headers:

- `Authorization: Bearer <accessToken>`
- `x-tenant-slug: <companySlug>`

Body:

```json
{
  "reference": "SUB-<companyId>-<timestamp>",
  "pollUrl": "<paynow-poll-url>"
}
```

Result:

- Verifies status with Paynow
- Updates payment record
- Activates subscription when paid

### 4.3 Paynow Webhook

Endpoint:

- `POST /billing/webhooks/paynow`

Notes:

- Set this as Paynow `resultUrl`
- Backend verifies transaction using poll URL and updates invoice/subscription state

## 5. Required Env for Paynow

```env
PAYNOW_BASE_URL=https://www.paynow.co.zw
PAYNOW_INTEGRATION_ID=24164
PAYNOW_INTEGRATION_KEY=88b0ed1d-625e-49b1-ac17-a5b62a10a15b
PAYNOW_RESULT_URL=http://localhost:3005/api/v1/billing/webhooks/paynow
PAYNOW_RETURN_URL=http://localhost:3005/api/docs
PAYNOW_USE_STUB=false
```

## 6. Web Admin Integration Checklist

1. Login screen sends only email and password.
2. Onboarding register screen sends `companyName` and owner fields.
3. Save generated `company.slug` from onboarding response.
4. For authenticated tenant endpoints, include:
   - `Authorization: Bearer <accessToken>`
   - `x-tenant-slug: <companySlug>`
5. For paid activation:
   - Redirect to `paymentUrl` for web
   - Show `instructions` for EcoCash
   - Poll `POST /billing/paynow/poll` until success
6. Refresh subscription status after successful payment.

## 7. Suggested Frontend Sequence

1. `POST /onboarding/register`
2. Store `accessToken` and `company.slug`
3. `GET /onboarding/subscription-status`
4. `POST /onboarding/activate-subscription`
5. Payment step (web redirect or mobile instructions)
6. `POST /billing/paynow/poll`
7. `GET /onboarding/subscription-status` and unlock paid features
