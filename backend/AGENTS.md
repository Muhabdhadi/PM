# Backend AGENTS.md

Overview

This document describes the current backend scaffold added to the repository (FastAPI + containerization) and how to run and verify it locally.

Key files

- `backend/main.py`: Minimal FastAPI application exposing `/health`, `/api/echo` and serving static files from `backend/static` at `/`.
- `backend/requirements.txt`: Python dependencies (`fastapi`, `uvicorn[standard]`, `python-dotenv`, `requests`).
- `backend/static/index.html`: Placeholder static page used to verify static serving.
- `Dockerfile`: Builds a multi-stage image that first runs `npm install` and `npm run build` in the frontend, then copies the generated `frontend/out` static files into `backend/static` for serving.
- `docker-compose.yml`: Convenience compose file to build and run the container; mounts `backend/static` into the container for iterative development.
- `scripts/start.sh`, `scripts/stop.sh`: Unix scripts to build/run and stop the Docker container.
- `scripts/start.ps1`, `scripts/stop.ps1`: PowerShell equivalents for Windows.

Run / Verify

Using docker-compose (recommended):

```bash
docker-compose up --build -d
curl http://localhost:8000/health
curl http://localhost:8000/
docker-compose down
```

Or using scripts (Windows PowerShell):

```powershell
.\scripts\start.ps1
# then stop
.\scripts\stop.ps1
```

Notes

- The container reads `OPENROUTER_API_KEY` from the environment; set it in a local `.env` file or export it when running.
- Next step (planned): copy the Next.js production build into `backend/static` as part of the Docker image so the real Kanban UI is served at `/`. With Next.js 16, this now uses `output: "export"` in `frontend/next.config.ts` and a `npm run build` step to generate the `frontend/out` static assets.
