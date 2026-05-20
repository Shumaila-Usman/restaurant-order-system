# Restaurant Order System – Backend

Node.js / Express / MongoDB backend for the Restaurant Order Notification System.

## Architecture

```
Central MongoDB: restaurant_order_system_v2
  ├── restaurants        – source DB config per restaurant
  ├── restaurantusers    – mobile app login credentials
  ├── adminusers         – admin panel login credentials
  ├── devicetokens       – FCM push tokens
  └── orderoverrides     – prep time, ack, notificationSent tracking

Restaurant Source DBs (each restaurant's own Atlas DB — read-only)
  └── orders collection  – real website orders, never written to by this backend
```

The mobile app **never** connects to restaurant source databases.
Only the backend connects to source databases.

---

## Local Setup Flow

```bash
cd backend
npm install
cp .env.example .env
# Edit .env — set MONGO_URI to your Atlas connection string

npm run db:init          # indexes + admin user + test restaurant + test owner
npm run db:seed-source   # 3 test orders in test_restaurant_source DB
npm run db:verify        # confirm everything is ready
npm run dev              # start server on http://localhost:5000
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | ✓ | Atlas connection string — DB name in URI is ignored, always uses `restaurant_order_system_v2` |
| `JWT_SECRET` | ✓ | Long random string for owner JWT signing |
| `ADMIN_JWT_SECRET` | ✓ | Long random string for admin JWT signing |
| `CRON_SECRET` | ✓ | Secret token for the cron endpoint |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | — | Path to Firebase service account JSON |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | — | Base64-encoded Firebase JSON (for Vercel) |
| `SEED_ADMIN_EMAIL` | — | Admin email for db:init (default: admin@example.com) |
| `SEED_ADMIN_PASSWORD` | — | Admin password for db:init (default: Admin123!) |
| `TEST_SOURCE_DB_URI` | — | Source DB URI for test restaurant (defaults to MONGO_URI) |
| `RESET_TEST_PASSWORDS` | — | Set to `true` to reset test passwords on db:init |

---

## Database Scripts

| Script | Command | Description |
|---|---|---|
| Initialize | `npm run db:init` | Creates indexes, admin, test restaurant, test owner. Safe to re-run. |
| Seed source | `npm run db:seed-source` | Inserts 3 test orders into `test_restaurant_source`. Safe to re-run. |
| Verify | `npm run db:verify` | Prints full health report. Read-only. |
| Seed admin only | `npm run seed:admin` | Legacy — use db:init instead |

---

## Central Database Collections

| Collection | Model | Description |
|---|---|---|
| `restaurants` | Restaurant | One doc per restaurant with source DB config |
| `restaurantusers` | RestaurantUser | Mobile app login accounts |
| `adminusers` | AdminUser | Admin panel login accounts |
| `devicetokens` | DeviceToken | FCM tokens per device |
| `orderoverrides` | OrderOverride | Prep time, ack, notificationSent per order |

---

## API Reference

### Health
```
GET /health
GET /api/health
→ { success: true, message: "Backend is running" }
```

### Restaurant Owner Auth
```
POST /api/auth/login          { email, password }
GET  /api/auth/me             Bearer token required
```

### Mobile Orders (Bearer token required)
```
GET    /api/orders                    ?limit=100
GET    /api/orders/:sourceOrderId
PATCH  /api/orders/:id/prep-time      { prepTimeMinutes, customPrepTimeLabel }
PATCH  /api/orders/:id/acknowledge
```

### Device Tokens (Bearer token required)
```
POST   /api/devices/register          { token, platform }
DELETE /api/devices/unregister        { token }
```

### Admin Auth
```
POST /api/admin/login         { email, password }
GET  /api/admin/me            Admin Bearer token required
```

### Admin Restaurants (Admin Bearer token required)
```
POST   /api/admin/restaurants
GET    /api/admin/restaurants
GET    /api/admin/restaurants/:id
PATCH  /api/admin/restaurants/:id
DELETE /api/admin/restaurants/:id
```

### Admin Restaurant Users (Admin Bearer token required)
```
POST   /api/admin/restaurants/:restaurantId/users   { name, email, password }
GET    /api/admin/restaurants/:restaurantId/users
PATCH  /api/admin/users/:userId                     { name, email, isActive }
PATCH  /api/admin/users/:userId/password            { password }
DELETE /api/admin/users/:userId
```

### Admin Orders (Admin Bearer token required)
```
GET /api/admin/orders                                    ?limit=50
GET /api/admin/restaurants/:restaurantId/orders          ?limit=100
GET /api/admin/orders/:sourceOrderId                     ?restaurantId=xxx
```

### Cron
```
GET /api/cron/check-paid-orders?token=CRON_SECRET
```

### Debug (Admin Bearer token required)
```
GET /api/debug/restaurants/:id/config
GET /api/debug/restaurants/:id/latest-orders
```

---

## Order Filtering Rules

- **Show**: `paymentStatus === sourcePaidValue` (e.g. `"paid"`)
- **Show regardless of**: `orderStatus` — pending/new/processing/preparing/completed all show
- **Hide**: unpaid, failed, or missing payment status

---

## Notification Flow

```
Cron → GET /api/cron/check-paid-orders
  → fetch paid orders from source DB
  → find orders without notificationSent=true
  → send FCM data notification to active device tokens
  → mark notificationSent=true AFTER send attempt

GET /api/orders (mobile polling) NEVER marks notificationSent=true
```

---

## Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Project Settings → Service Accounts → Generate new private key
3. Save JSON as `backend/firebase-service-account.json`
4. Set `FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json` in `.env`

For Vercel: base64-encode the JSON and set `FIREBASE_SERVICE_ACCOUNT_BASE64`.

Firebase is optional for local testing — the server starts fine without it,
FCM notifications are simply skipped.
