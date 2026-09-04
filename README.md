# DS Swaraj Agro — website

This version keeps the existing admin/login, password reset, MongoDB and Cloudinary functionality and refreshes the public site into a dedicated-page structure.

## Public pages
- `/` — focused home page
- `/solar-solutions` — solar landing page
- `/farm-machinery` — farm machinery landing page
- `/products` — searchable catalogue with exactly two main categories
- `/about` — company information
- `/branches` — clickable branch locations with detail popups
- `/photos` — full photo gallery
- `/contact` — contact details and editable Google Maps link
- `/health` — Render health check

## Admin
- `/admin/login`
- Existing company, branch, product, photo and password-reset workflows are preserved.
- Company logo, Google Maps URL, banner, hero text, phone, email and address remain editable.

## Deployment
The app is designed for Node/Express hosting such as Render. Set the same environment variables you already use for MongoDB, Cloudinary, SMTP, session secret, admin password and reset email. Render should use:

Build command: `npm install`

Start command: `npm start`

Do not commit `.env`, `data/*.json`, or `public/uploads/*`.

## Notes
Google Maps photos are not automatically imported from a public Maps share URL. The website's Photos page uses photos uploaded through the existing admin photo gallery and provides a direct Google Maps link.
