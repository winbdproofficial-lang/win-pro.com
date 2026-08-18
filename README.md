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
