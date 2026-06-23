from typing import Literal

from pydantic import BaseModel, Field, field_validator

Priority = Literal["low", "medium", "high"]


class LoginData(BaseModel):
    username: str
    password: str


class RegisterData(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(..., min_length=6, max_length=200)


class BoardCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class BoardRename(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class KanbanColumn(BaseModel):
    id: str
    title: str
    cardIds: list[str]


class KanbanCard(BaseModel):
    id: str
    title: str
    details: str
    priority: Priority | None = None
    dueDate: str | None = None
    labels: list[str] | None = None
    assignee: str | None = None


class KanbanUpdate(BaseModel):
    columns: list[KanbanColumn]
    cards: dict[str, KanbanCard]


class CardCreate(BaseModel):
    id: str | None = None
    title: str = Field(..., min_length=1, max_length=500)
    details: str = Field("", max_length=5000)
    columnId: str
    priority: Priority | None = None
    dueDate: str | None = Field(default=None, max_length=40)
    labels: list[str] | None = Field(default=None, max_length=20)
    assignee: str | None = Field(default=None, max_length=80)


class CardUpdate(BaseModel):
    title: str | None = None
    details: str | None = None
    columnId: str | None = None
    position: int | None = Field(default=None, ge=0)
    priority: Priority | None = None
    dueDate: str | None = Field(default=None, max_length=40)
    labels: list[str] | None = Field(default=None, max_length=20)
    assignee: str | None = Field(default=None, max_length=80)


class AIRequest(BaseModel):
    prompt: str = Field(..., max_length=2000)
    board: dict | None = None
    board_id: int | None = None
    history: list[dict] | None = Field(default=None, max_length=50)


class StructuredAIResponse(BaseModel):
    response: str
    kanbanUpdate: KanbanUpdate | None = None

    @field_validator("response")
    def response_not_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("response must not be empty")
        return value
