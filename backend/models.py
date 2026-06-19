from pydantic import BaseModel, Field, field_validator


class LoginData(BaseModel):
    username: str
    password: str


class KanbanColumn(BaseModel):
    id: str
    title: str
    cardIds: list[str]


class KanbanCard(BaseModel):
    id: str
    title: str
    details: str


class KanbanUpdate(BaseModel):
    columns: list[KanbanColumn]
    cards: dict[str, KanbanCard]


class CardCreate(BaseModel):
    id: str | None = None
    title: str = Field(..., min_length=1, max_length=500)
    details: str = Field("", max_length=5000)
    columnId: str


class CardUpdate(BaseModel):
    title: str | None = None
    details: str | None = None
    columnId: str | None = None
    position: int | None = Field(default=None, ge=0)


class AIRequest(BaseModel):
    prompt: str = Field(..., max_length=2000)
    board: dict | None = None
    history: list[dict] | None = Field(default=None, max_length=50)


class StructuredAIResponse(BaseModel):
    response: str
    kanbanUpdate: KanbanUpdate | None = None

    @field_validator("response")
    def response_not_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("response must not be empty")
        return value
