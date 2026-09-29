# Urban Services API

Base URL: `/api`

Successful responses:

```json
{ "success": true, "message": "OK", "data": {} }
```

Errors:

```json
{ "success": false, "message": "Unable to assign technician", "errorCode": "TECHNICIAN_UNAVAILABLE" }
```

Validation errors use `422` and `errorCode: "VALIDATION_ERROR"` with an `errors` array.

Send `Authorization: Bearer <accessToken>` on protected routes. The backend checks the role. Frontend route guards are not enough.

## Authentication

| Method | Path | Auth | Body |
| --- | --- | --- | --- |
| POST | `/auth/register` | Public | `name, email, phone, password, address, city, state, pincode` |
| POST | `/auth/register/technician` | Public, multipart | Profile fields plus `photo`, `govId`, `license`, `certificates`, repeated `serviceIds` |
| POST | `/auth/login` | Public | `email, password` |
| POST | `/auth/refresh` | Public | `refreshToken` |
| POST | `/auth/logout` | Public | `refreshToken` |
| GET | `/auth/me` | Any | |
| PATCH | `/auth/profile` | Any | Profile fields, optional `avatar` file |
| POST | `/auth/change-password` | Any | `currentPassword, newPassword` |

Login returns `accessToken`, `refreshToken`, and `user`. Passwords are stored with bcrypt.

Roles: `ADMIN`, `CUSTOMER`, `TECHNICIAN`.

## Public catalog

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/categories` | Active categories |
| GET | `/services?q=&category=&featured=1` | Bookable services |
| GET | `/services/:id` | Service by id or slug, with reviews |
| GET | `/reviews/public` | Homepage reviews |
| GET | `/stats` | Live counts |
| GET | `/settings/public` | Safe website settings. Secrets are excluded |
| GET | `/locations` | Serviceable cities |
| GET | `/health` | API and database status |

## Customer

All routes require a customer token. Prefix: `/customer`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/dashboard` | Order counts, spend, current booking |
| GET | `/orders?bucket=&page=` | `active`, `completed`, `cancelled`, or all |
| POST | `/orders` | Create a booking |
| GET | `/orders/:id` | Detail, timeline, payments, review |
| PATCH | `/orders/:id/cancel` | `{ reason }` inside the cancellation window |
| PATCH | `/orders/:id/reschedule` | `{ scheduledDate, scheduledTime }` |
| POST | `/orders/:id/pay` | `{ method }` cash, upi, card, online, other |
| POST | `/orders/:id/review` | `{ rating, comment }` after completion |
| GET | `/orders/:id/tracking` | Customer coordinates and technician location when status is `on_the_way` or `arrived` |
| GET/POST | `/addresses` | Saved addresses |
| PUT/DELETE | `/addresses/:id` | Update or remove |
| GET | `/payments` | Payment history |
| GET | `/notifications` | In-app notifications |
| PATCH | `/notifications/read-all` | Mark read |
| GET | `/reviews` | Reviews this customer wrote |

Booking body:

```json
{
  "serviceId": 1,
  "scheduledDate": "2026-09-29",
  "scheduledTime": "16:00",
  "saveAddress": true,
  "paymentMethod": "upi",
  "payNow": true,
  "address": {
    "houseNo": "12-3-45",
    "street": "Main Road",
    "area": "Brodipet",
    "city": "Guntur",
    "state": "Andhra Pradesh",
    "pincode": "522002",
    "landmark": "Near clock tower",
    "latitude": 16.3067,
    "longitude": 80.4365
  }
}
```

Latitude and longitude are required. The order stores them with the written address.

The same order routes are also available under `/orders` for shared clients.

## Technician

Prefix: `/technician`. Requires an approved technician for job actions.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/dashboard` | Jobs, earnings, sales |
| GET | `/orders` | Assigned jobs |
| GET | `/orders/:id` | Job detail and Google Maps URL |
| POST | `/orders/:id/accept` | Accept assignment |
| POST | `/orders/:id/reject` | Reject and return the order to admin |
| PATCH | `/orders/:id/status` | Multipart `status`, optional `images` |
| POST | `/orders/:id/pay` | Record payment |
| POST | `/location` | `{ latitude, longitude, accuracy }` while online |
| GET | `/earnings` | Per-order earnings |
| GET | `/incentives` | Rules and calculated slabs |
| GET | `/reports/sales?period=daily` | `daily`, `weekly`, `monthly`, `yearly` |
| GET | `/reports/sales/export` | CSV download |
| GET | `/customers` | Customers from assigned jobs |
| PATCH | `/availability` | `{ availability, isOnline }` |
| GET | `/payments` | Payments on this technician's jobs |
| GET | `/notifications` | |

Status order:

```text
assigned → accepted → on_the_way → arrived → service_started → service_completed → payment_completed
```

`assigned` can also move to `rejected`. Starting travel requires the technician to be online. Location updates are rejected while offline.

Google Maps navigation URL returned on the order:

```text
https://www.google.com/maps/dir/?api=1&destination=LATITUDE,LONGITUDE
```

## Admin

Prefix: `/admin`. Admin token required. Admin margin is included on order payloads. It is removed for other roles.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/dashboard` | Sales cards and charts |
| GET | `/orders` | Search, status, payment, date, pagination |
| GET | `/orders/:id` | Full order |
| PATCH | `/orders/:id` | Notes, schedule, discount, other costs. Margin is recalculated |
| GET | `/orders/:id/candidates` | Filters: `available`, `expertise`, `withinLimit`, `levelId`, `minRating`, `maxDistance` |
| POST | `/orders/:id/assign-technician` | `{ technicianId, override }` |
| PATCH | `/orders/:id/cancel` | Cancel |
| POST | `/orders/:id/refund` | Refund a paid order and reverse earnings |
| GET/PATCH | `/customers`, `/customers/:id/status` | Customer management |
| GET/PATCH | `/technicians`, `/technicians/:id` | Profile, level, daily limit, services |
| PATCH | `/technicians/:id/approval` | `pending`, `approved`, `rejected`, `suspended` |
| CRUD | `/categories`, `/services` | Catalog. Services accept an image upload |
| CRUD | `/pricing`, `/levels` | Technician cost and experience levels |
| CRUD | `/incentives` | Daily, weekly, and monthly slabs |
| GET | `/payments` | Transactions |
| GET | `/reports/:type` | `sales`, `orders`, `technicians`, `customers`, `services`, `payments`, `profit`, `incentives` |
| GET | `/reports/:type/export?format=csv` | `csv`, `xlsx`, or `pdf` |
| GET | `/map` | Technician positions and open jobs |
| GET/PUT | `/settings` | `{ entries: [{ key, value, group }] }` |
| GET/PATCH | `/reviews`, `/reviews/:id` | Publish or hide |
| CRUD | `/locations` | Service cities |
| POST | `/notifications/broadcast` | `{ title, message, audience }` |

Assignment is manual unless you later enable automation. `auto_assign` is stored in settings and defaults to off. If a technician is offline, on leave, busy, or at the daily job limit, the API returns `TECHNICIAN_UNAVAILABLE` or `DAILY_LIMIT_REACHED` unless `override` is true.

## Realtime

Connect Socket.IO with `auth: { token }`. The server joins `user:{id}` and `role:{ROLE}`.

| Event | When |
| --- | --- |
| `order:created` | New booking |
| `order:assigned` | Technician assigned |
| `order:updated` | Status change |
| `notification:new` | In-app notification |
| `technician:location` | Online technician ping. Customer rooms receive it for `on_the_way` and `arrived` jobs |

Clients emit `track:join` with an order id. The server checks that the user is the customer, the assigned technician, or an admin.

## Payments and money

An order stores `subtotal`, `discount`, `tax`, `total_amount`, `technician_cost`, `other_costs`, and `admin_margin`.

```text
admin_margin = total_amount − technician_cost − discount − other_costs
```

Technician earnings for a completed order equal the configured technician cost. Incentives are calculated separately from active slabs: the highest slab whose minimum service count has been reached. Customer payments and technician earnings stay in different tables.

Without `PAYMENT_SECRET`, non-cash “pay now” records a payment in MySQL and stores a transaction id. Replace `insertPayment` in the order service when a gateway is connected. Cash stays unpaid until a technician or customer records it.

## Emails

`backend/src/services/emailService.js` sends:

- `sendBookingConfirmation`
- `sendTechnicianAssignedEmail`
- `sendTechnicianOnTheWayEmail`
- `sendServiceStartedEmail`
- `sendServiceCompletedEmail`
- `sendPaymentReceipt`

If SMTP is not configured, the message is logged and the API still succeeds.
