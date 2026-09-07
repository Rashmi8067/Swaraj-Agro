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

## Reference homepage reset
The public homepage has been redesigned to closely match the supplied Swaraj Agro reference: minimal navigation, a full agriculture/solar hero, strong headline, concise trust points, two solution cards, a small photo preview, authorization strip, and compact footer. The existing admin authentication, MongoDB, Cloudinary upload, branches, products and password-reset behavior are left intact.

### Optional one-time content reset
`npm run reset:content` intentionally resets the site document to a clean seed and deletes images in the `ds-swaraj-agro/` Cloudinary folder when Cloudinary credentials are configured. This is destructive; run it only when you really want to clear existing products, branches and photos.

### Product catalog update
The project includes the supplied Farm Machinery lineup as 31 separate catalog entries. Where the same machine has multiple brands, each brand is stored as its own product entry and the brand is explicitly included in that product's description. Existing MongoDB products are preserved; on the first app read after this version is deployed, the new catalog entries are added once.

## Product images
Selected product images are referenced from publicly available product/manufacturer listings and are used only where the machine type and brand could be reasonably matched. Exact-brand imagery was not substituted with unrelated machines when a reliable match could not be found. For commercial use, confirm image licensing/permission with the original source or manufacturer.


## v25 UI refinements
- Reduced mobile home hero-to-info-card spacing.
- Removed Browse Farm Machinery / Browse Solar Products buttons from their dedicated pages.
- Photos page now opens in List View by default with large photo-first cards.
- Tile View uses a 3-column photo layout.
- View toggle now clearly shows selected green/white and unselected white/green states.
