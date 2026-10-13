# DEVELOPMENT / DEMO STORAGE FALLBACK

When `MONGODB_URI` is not reachable in development, the backend can switch to
**DEVELOPMENT/DEMO file storage** backed by JSON files under `.dev-data/`.
In production, the backend refuses to start or write to this fallback.

This fallback exists so the application can be demonstrated locally
without a running MongoDB instance. It implements the same CRUD interface
as the Mongoose models and is clearly labelled in the API responses and
the health endpoint (`/api/health` reports `"mode": "file"` and
`"label": "DEVELOPMENT/DEMO FILE STORAGE ..."`).

**NEVER use this fallback for production data.**