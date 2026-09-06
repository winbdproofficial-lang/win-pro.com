# WINBD-PRO Full Stack

WINBD-PRO starter containing:

- `frontend/` — customer web app
- `admin/` — protected admin dashboard
- `backend/` — Express + PostgreSQL API with JWT auth, refresh tokens, wallets, payment intents and audit logs
- `backend/sql/` — database migrations
- `backend/.env.example` — safe configuration template

## Database

This project is configured to use the Supabase PostgreSQL project. Do not commit a real `.env` file, database password, JWT secret, service-role key, or payment credentials.

## Local development

1. Install Node.js 20+.
2. Copy `backend/.env.example` to `backend/.env`.
3. Put your Supabase PostgreSQL connection string in `DATABASE_URL` and create a random `JWT_SECRET` of at least 32 characters.
4. From the `backend/` directory:

```bash
npm install
npm run migrate
npm start
```

5. Open:
   - Customer: `http://localhost:8080/`
   - Admin: `http://localhost:8080/admin/`

Create an admin account with:

```bash
npm run create-admin -- admin "CHANGE_THIS_TO_A_STRONG_PASSWORD" admin@example.com
```

Payment integration remains provider-neutral until the licensed provider and its official server-side API/webhook details are configured.
## Game catalogue

The Render backend exposes `/api/bt/v1/provider/getWebsiteCategory`. When provider credentials are configured and a provider returns games, the frontend shows the live provider catalogue. When no provider catalogue is available yet, the backend returns a local preview catalogue so the Games page is populated and can be styled/tested before API onboarding. Preview entries never call a provider launch endpoint.

Configure provider secrets in Render Environment Variables using the names in `backend/.env.example`. Do not commit API tokens, agent IDs, or secret keys to Git.
