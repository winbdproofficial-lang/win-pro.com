# win-pro.com[README.md](https://github.com/user-attachments/files/31165064/README.md)
# WINBD-PRO Full Stack

A self-contained WINBD-PRO starter containing:

- `frontend/` — customer web app (register, login, profile, wallet, payments)
- `admin-panel/` — protected admin dashboard
- `backend/` — Express + PostgreSQL API, JWT auth, refresh tokens, wallets, payment intents and audit logs
- `backend/sql/` — database schema
- `docker-compose.yml` — local PostgreSQL
- `.env.example` — safe configuration template

> Payment gateway integration is intentionally provider-neutral. No real gateway credentials or real-money processing are included.

## Quick start (Windows)

1. Install Node.js 20+ and Docker Desktop.
2. Copy `backend/.env.example` to `backend/.env` and set a long random `JWT_SECRET`.
3. From the project root:

```bash
docker compose up -d postgres
cd backend
npm install
npm run migrate
npm run create-admin -- admin "ChangeThisStrongPassword123!" admin@example.com
npm start
```

4. Open:
   - Customer: http://localhost:8080/
   - Admin: http://localhost:8080/admin/

## Development

```bash
cd backend
npm run dev
```

## Notes

- Never commit `backend/.env`.
- Change the bootstrap admin password immediately.
- Use HTTPS, a real domain, restricted CORS and a production PostgreSQL instance before deployment.
- Configure a licensed payment provider in `backend/src/paymentProvider.js` before enabling real payment processing.
