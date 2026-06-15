# Frontend AGENTS.md

Overview

This file documents the existing frontend demo (Next.js) so the agent and maintainers can quickly understand structure, key components, and how to run tests locally.

Key files and responsibilities

- `src/app/page.tsx`: app entry page that renders the demo Kanban board.
- `src/app/layout.tsx`: global layout and CSS import.
- `src/components/KanbanBoard.tsx`: main board component that composes columns and cards.
- `src/components/KanbanColumn.tsx`: column wrapper and logic.
- `src/components/KanbanCard.tsx`: single card component with edit/move behavior.
- `src/components/KanbanCardPreview.tsx`: small preview used by drag-and-drop flows.
- `src/components/NewCardForm.tsx`: UI to add new cards.
- `src/lib/kanban.ts`: helper functions and example data; unit tests in `src/lib/kanban.test.ts`.
- `src/components/KanbanBoard.test.tsx`: frontend unit tests (vitest + testing-library).

Tests

- Frontend uses `vitest` for unit tests and `@testing-library/react` for component tests. See `vitest.config.ts` and `test/setup.ts`.
- Run tests locally with `pnpm`/`npm` depending on your environment (see `package.json`).

Run / Build

- Install: `pnpm install` (or `npm install`).
- Dev: `pnpm dev` (starts Next.js dev server).
- Build: `pnpm build` then `pnpm start` to serve a production build.

Notes for integration

- The frontend currently runs as a standalone Next.js app. For the MVP backend integration we will statically build the site and copy the build output to the backend image to be served by FastAPI.
- There are existing unit tests; before making behavior changes, run the test suite to ensure regressions are caught.

Owner / Contact

- Primary owner for frontend: repository maintainer (ask if unknown). The agent will update this file if structure changes.
