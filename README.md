# RELT program portal

Monorepo for a tutoring-program portal.

- `backend/` — Django, PostgreSQL, GraphQL and Django authentication
- `frontend/` — React, Vite and TypeScript

## Quick start

1. Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL`.
2. Start PostgreSQL (or run `docker compose up -d db`).
3. In `backend/`, create a virtual environment, then run `pip install -r requirements.txt`, `python manage.py migrate`, and `python manage.py createsuperuser`.
4. In `frontend/`, run `npm install` then `npm run dev`.

The frontend defaults to `http://localhost:8000/graphql/`; configure `VITE_GRAPHQL_URL` if needed.
