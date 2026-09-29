# Urban Services

A home-services booking platform with a public website and three connected dashboards: customer, technician, and admin. Orders, technician assignment, exact locations, Google Maps navigation, live tracking, payments, technician costs, incentives, and sales reports all run through the API and MySQL.

## Structure

```text
urban-services/
├── frontend/     React, Tailwind, React Router
├── backend/      Node.js, Express, JWT, Socket.IO
└── database/     schema.sql, seed.sql, migrations/
```

## Requirements

- Node.js 20 or newer
- MySQL 8 or newer
- A Google Maps browser key is optional. Latitude and longitude are still stored, and **Open in Google Maps** uses them even without a key.

## Database

On your own computer, create the database and put its name in `backend/.env` as `DB_NAME`. `npm run seed` creates that database if your MySQL user is allowed to, then loads the tables and demo data.

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS urban_services CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

You can also import the tables yourself. Select the database first, then import `database/schema.sql`. The file does not create a database, so it works in phpMyAdmin on shared hosting.

```bash
mysql -u root -p urban_services < database/schema.sql
```

`database/migrations/001_initial.sql` points at that same schema. Demo accounts, services, orders, earnings, and reviews are loaded by the seeder so passwords are hashed with bcrypt:

```bash
cd backend
npm install
npm run seed
```

The seeder rebuilds the database. Do not run it against production data.

Demo logins after seeding:

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@urbanservices.com | Admin@123 |
| Customer | raj@urbanservices.com | Customer@123 |
| Customer | priya@urbanservices.com | Customer@123 |
| Technician | ramesh@urbanservices.com | Tech@123 |
| Technician | suresh@urbanservices.com | Tech@123 |
| Technician | anita@urbanservices.com | Tech@123 |
| Technician pending approval | kiran@urbanservices.com | Tech@123 |

## Backend

```bash
cd backend
npm install
copy .env.example .env
```

Set `DB_PASSWORD`, `JWT_SECRET`, and `JWT_REFRESH_SECRET` in `.env`. SMTP values can stay empty in development; booking still succeeds and the email content is printed in the API log.

```bash
npm run seed
npm run dev
```

The API listens on `http://localhost:5000`.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api`, `/uploads`, and Socket.IO to the backend, so `VITE_API_URL` can stay empty locally.

For a production build:

```bash
npm run build
```

Set `VITE_API_URL` to the public API origin before building, for example `https://api.yourdomain.com`. Put the Google Maps browser key in `VITE_GOOGLE_MAPS_API_KEY` if you want the draggable map. Navigation links work without it.

## What to try

1. Log in as Raj and open the assigned AC repair, or book a new service and confirm a latitude and longitude.
2. Log in as admin, open the unassigned order, and assign a technician. The customer receives an in-app notification and an email when SMTP is configured.
3. Log in as that technician, go online, open the job, and use **Open in Google Maps**. The link is `https://www.google.com/maps/dir/?api=1&destination=LAT,LNG`.
4. Start travel. The customer **Track technician** view receives location updates.
5. Complete the job and record payment. Earnings, the daily incentive slab, and admin margin update from the database.

Admin margin for each order is:

```text
customer payment − technician cost − discount − other costs
```

Technicians do not receive the admin margin field.

## Hostinger deployment

Hostinger plans differ. Use a plan that provides MySQL and a Node.js app (or a VPS). The steps below stay the same if the panel labels change.

1. **MySQL.** In hPanel, create a database and user. The name will look like `u750180796_urban`. Open that database in phpMyAdmin and import `database/schema.sql`. Do not import a script that runs `CREATE DATABASE`; Hostinger returns error 1044 because the user cannot create another database. Set `DB_NAME` in the API `.env` to the exact hPanel database name. `database/seed.sql` only documents the demo accounts. Load demo data with `npm run seed` from a machine that can reach this database, or register the first admin after the tables exist.
2. **Backend.** Upload the `backend` folder without `node_modules`. Set the start file to `server.js` and the start command to `npm start`. Set environment variables from `backend/.env.example`: database host (often `localhost` on the same hosting account), database name, user, password, long random JWT secrets, `CLIENT_URL`, `CORS_ORIGIN`, and SMTP. Do not commit `.env`.
3. **Uploads.** Make sure the `backend/uploads` directory is writable. Completion photos and technician documents are stored there.
4. **Frontend.** On your computer set `VITE_API_URL` to the API origin and run `npm run build`. Upload the contents of `frontend/dist` to the site document root or a subdomain such as `www`.
5. **Domains.** Point `api.yourdomain.com` at the Node app and `yourdomain.com` at the static build. Enable SSL in the hosting panel for both. Browsers block live location and some map features on insecure origins.
6. **CORS.** Set `CORS_ORIGIN` to the exact frontend origin, including `https`. Multiple origins can be comma-separated.
7. **Sockets.** Live order and location updates use Socket.IO on the same Node port. If the host only proxies HTTP, confirm websocket upgrade is allowed. The customer track page also polls every 12 seconds, so tracking still updates if websockets are blocked.
8. **SMTP.** Use the mailbox credentials from the host or another provider. Booking, assignment, travel, service start, completion, and payment each have an HTML email. If SMTP is empty, the API logs the message and continues.
9. **Maps.** Restrict the browser key to your domain and set `VITE_GOOGLE_MAPS_API_KEY` at build time. Technician navigation does not need the key; it opens Google Maps with the stored coordinates.
10. **Check production.** Call `https://api.yourdomain.com/api/health` and confirm `"database": "up"`. Then sign in on the public site and place a test booking.

On a VPS you can run the API with a process manager and put Nginx in front of it. Shared Node hosting usually does that for you when you select `server.js`.

## API

Endpoint details, request bodies, and error shapes are in [docs/API.md](docs/API.md).
