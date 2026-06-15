# Project Management MVP

This repository contains a Project Management MVP web app with a Next.js frontend and a FastAPI backend.

## Current status

- The Docker setup now builds the frontend and backend together.
- The frontend static build output is copied into the backend image and served from FastAPI.
- `localhost:8000` should display the Kanban frontend app.

## Run with Docker

From the repository root:

```powershell
docker compose up --build -d
```

Then open:

- `http://localhost:8000`
- `http://localhost:8000/health`

To stop the app:

```powershell
docker compose down
```

## Notes

- The Docker Compose service is defined in `docker-compose.yml`.
- The `frontend` build is generated inside the image and copied to `backend/static`.
- A previous volume mount was removed so the image-served frontend is not masked by the host placeholder.
