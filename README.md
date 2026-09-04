# DS Swaraj Agro — editable website

A Node.js + Express + EJS company website with a password-protected admin dashboard.

## Current features
- Editable company name, tagline, GSTIN, address, email, phones and website copy
- Editable company logo with JPG/PNG/WEBP upload
- Exactly two public product categories: **Solar Solution** and **Farm Machinery**
- Clickable category cards that filter products
- Product subcategory field for organizing products within either main category
- Add/remove/edit products with price, description, featured status and photo
- Add/remove/edit branch locations with descriptions, contact fields and photos
- Public branch section highlights only branch locations; clicking a location opens a popup with full details
- Admin login with bcrypt password hashing
- Password reset by 6-digit OTP email
- Data and images persist to MongoDB Atlas and Cloudinary when configured (recommended for
  any host with an ephemeral filesystem); falls back to local files for local development.

## Run locally
1. Install Node.js 18+.
2. Copy `.env.example` to `.env`.
3. Set `SESSION_SECRET`, `ADMIN_PASSWORD`, and `RESET_EMAIL` — these are required, the server
   will refuse to start without them.
4. Run `npm install`.
5. Run `npm run dev` or `npm start`.
6. Open http://localhost:3000
7. Admin: http://localhost:3000/admin/login, using the password you set as `ADMIN_PASSWORD`.

With `MONGODB_URI` and `CLOUDINARY_*` left blank, data is stored in `data/site.json` /
`data/admin.json` and images in `public/uploads/` — convenient for local testing, but not
durable on hosts that wipe local disk on restart (see Deploying below).

## Real OTP delivery
Configure SMTP in `.env` using the values supported by your email provider. Without SMTP
configured, the OTP is printed to the server console instead — fine for local testing only.

## Deploying (free hosting)
This app needs a persistent server, not static hosting. Recommended free path:

1. **MongoDB Atlas** (free M0 cluster, no card required) — stores your site content so it
   survives restarts and redeploys. Set `MONGODB_URI` (and optionally `MONGODB_DB`).
2. **Cloudinary** (free tier, no card required) — stores uploaded photos. Set
   `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
3. **Render** (or any Node host) — deploy from this repo with `npm start`, and set all the
   above as environment variables in the host's dashboard, plus `SESSION_SECRET`,
   `ADMIN_PASSWORD`, and `RESET_EMAIL`.

Without `MONGODB_URI` / `CLOUDINARY_*` set, any host with an ephemeral filesystem (most free
tiers, including Render's) will silently lose everything added through the admin panel the
next time the app restarts.

## Production hardening
Before public deployment also use HTTPS (most hosts provide this automatically), rate
limiting, CSRF protection, a production session store, secured SMTP credentials, and regular
backups of your database.
