# Project Management MVP

This repository contains a Project Management MVP web app with a Next.js frontend and a FastAPI backend.

## Overview

The app provides a small project management experience centered on a single Kanban board. It is designed as an MVP with local data persistence and an AI assistant integration.

## Functionality

- User sign-in with hardcoded credentials (`user` / `password`).
- Protected access so unauthenticated users are redirected to login.
- A Kanban board with fixed columns that can be renamed.
- Cards can be created, moved between columns, edited, and deleted.
- Board state is persisted in a local SQLite database (`backend/pm.db`).
- AI assistant support through an OpenRouter proxy endpoint that can return structured responses and apply board updates.

## Current status

- Docker setup builds frontend and backend together.
- Frontend static build output is copied into the backend image and served from FastAPI.
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
- The frontend build is generated inside the image and copied to `backend/static`.
- The backend uses SQLite to store board state and supports AI proxy requests through `OPENROUTER_API_KEY`.
