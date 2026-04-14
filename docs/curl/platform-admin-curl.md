# Platform Admin cURL Reference

## Variables

```bash
BASE_URL=http://localhost:3005/api/v1
PLATFORM_ADMIN_EMAIL=platform-admin@builderpro.local
PLATFORM_ADMIN_PASSWORD=PlatformAdmin123!
PLATFORM_ADMIN_API_KEY=change-me-platform-admin-key
```

## 1) Login (returns bearer token)

```bash
curl -X POST "$BASE_URL/platform-admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'$PLATFORM_ADMIN_EMAIL'",
    "password": "'$PLATFORM_ADMIN_PASSWORD'"
  }'
```

## 2) Auth Me (bearer)

```bash
PLATFORM_ADMIN_TOKEN="<paste-token-from-login>"

curl -X GET "$BASE_URL/platform-admin/auth/me" \
  -H "Authorization: Bearer $PLATFORM_ADMIN_TOKEN"
```

## 3) Rotate API key (bearer)

```bash
curl -X POST "$BASE_URL/platform-admin/auth/rotate-api-key" \
  -H "Authorization: Bearer $PLATFORM_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Quarterly rotation"}'
```

## 4) Platform overview (api key)

```bash
curl -X GET "$BASE_URL/platform-admin/overview" \
  -H "x-platform-admin-key: $PLATFORM_ADMIN_API_KEY"
```

## 5) List companies (bearer)

```bash
curl -G "$BASE_URL/platform-admin/companies" \
  -H "Authorization: Bearer $PLATFORM_ADMIN_TOKEN" \
  --data-urlencode "page=1" \
  --data-urlencode "limit=20" \
  --data-urlencode "search=builder"
```

## 6) Approve company (bearer)

```bash
COMPANY_ID="<company-id>"

curl -X PATCH "$BASE_URL/platform-admin/companies/$COMPANY_ID/approval" \
  -H "Authorization: Bearer $PLATFORM_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive":true}'
```
