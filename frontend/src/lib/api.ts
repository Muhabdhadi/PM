import type { BoardData } from "@/lib/kanban";

export type BoardSummary = {
  id: number;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
  role?: "owner" | "editor";
  owner?: string | null;
};

export type BoardMember = {
  user_id: number;
  username: string;
  role: string;
};

export type ActivityEntry = {
  actor: string;
  action: string;
  created_at: string;
};

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

// --- Auth ---------------------------------------------------------------

export async function login(username: string, password: string) {
  return asJson<{ status: string }>(
    await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
  );
}

export async function register(username: string, password: string) {
  return asJson<{ status: string; username: string }>(
    await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
  );
}

export async function logout() {
  await fetch("/api/logout", { method: "POST" });
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return asJson<{ status: string }>(
    await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    })
  );
}

export async function authStatus() {
  return asJson<{ authenticated: boolean; username: string | null }>(
    await fetch("/api/auth-status")
  );
}

// --- Boards -------------------------------------------------------------

export async function listBoards() {
  return asJson<{ boards: BoardSummary[] }>(await fetch("/api/boards"));
}

export async function createBoard(name: string) {
  return asJson<{ status: string; board: { id: number; name: string } }>(
    await fetch("/api/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
  );
}

export async function renameBoard(boardId: number, name: string) {
  return asJson<{ status: string }>(
    await fetch(`/api/boards/${boardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
  );
}

export async function deleteBoard(boardId: number) {
  return asJson<{ status: string }>(
    await fetch(`/api/boards/${boardId}`, { method: "DELETE" })
  );
}

export async function listMembers(boardId: number) {
  return asJson<{ members: BoardMember[] }>(
    await fetch(`/api/boards/${boardId}/members`)
  );
}

export async function addMember(boardId: number, username: string) {
  return asJson<{ status: string; members: BoardMember[] }>(
    await fetch(`/api/boards/${boardId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    })
  );
}

export async function removeMember(boardId: number, memberId: number) {
  return asJson<{ status: string; members: BoardMember[] }>(
    await fetch(`/api/boards/${boardId}/members/${memberId}`, { method: "DELETE" })
  );
}

export async function listActivity(boardId: number) {
  return asJson<{ activity: ActivityEntry[] }>(
    await fetch(`/api/boards/${boardId}/activity`)
  );
}

// --- Single board kanban ------------------------------------------------

export async function getBoard(boardId?: number) {
  const qs = boardId != null ? `?board_id=${boardId}` : "";
  return asJson<{ board: BoardData; boardId: number; name: string | null }>(
    await fetch(`/api/board${qs}`)
  );
}

export async function saveBoard(board: BoardData, boardId?: number) {
  const qs = boardId != null ? `?board_id=${boardId}` : "";
  return asJson<{ status: string }>(
    await fetch(`/api/board${qs}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(board),
    })
  );
}

const boardQs = (boardId?: number) => (boardId != null ? `?board_id=${boardId}` : "");

export async function createCard(
  card: { id: string; title: string; details: string; columnId: string },
  boardId?: number
) {
  return fetch(`/api/cards${boardQs(boardId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
  });
}

export async function updateCard(
  cardId: string,
  patch: {
    columnId?: string;
    position?: number;
    title?: string;
    details?: string;
    priority?: string | null;
    dueDate?: string | null;
    labels?: string[];
    assignee?: string | null;
  },
  boardId?: number
) {
  return fetch(`/api/cards/${cardId}${boardQs(boardId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export async function deleteCard(cardId: string, boardId?: number) {
  return fetch(`/api/cards/${cardId}${boardQs(boardId)}`, { method: "DELETE" });
}

export async function addComment(cardId: string, text: string, boardId?: number) {
  return asJson<{ status: string; comment: import("@/lib/kanban").Comment }>(
    await fetch(`/api/cards/${cardId}/comments${boardQs(boardId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
  );
}
