# StockFlow — inventory, sales, purchases and ledger

This project is a production-ready Node/Express web app backed by MongoDB Atlas. Cloudinary is wired for authenticated file uploads, and the app is designed to deploy as a single web service on Render.

## Local run

1. Copy `.env.example` to `.env` and fill in your values.
2. Run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:10000`.

## Production architecture

Browser → Render (Node/Express) → MongoDB Atlas

Images/files → Cloudinary

Git repository → GitHub → Render auto-deploys on push

## Important

Never commit `.env`, passwords, MongoDB credentials, or Cloudinary secrets to GitHub. The initial login credentials are supplied through environment variables and should be changed before sharing the public URL.
