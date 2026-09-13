# Swaraj Agro + StockFlow

Single Render web service containing:
- Public Swaraj Agro website at `/`
- StockFlow inventory application at `/stockflow/`
- Public website admin at `/admin/login`
- StockFlow API at `/api/*`

Both applications use the same MongoDB Atlas database connection and Cloudinary account, while keeping their data collections logically separate.

Set the environment variables in Render using `.env.example` as the template. Never commit a real `.env` file or secrets to GitHub.
