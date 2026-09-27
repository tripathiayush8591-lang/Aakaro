from typing import Annotated, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, StringConstraints

RequestId = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_-]{1,64}$")]
Idea = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)
]
Answer = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1200)
]


class ConnectionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    requestId: RequestId
    idea: Idea


class ConnectionResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    summary: Answer
    possibleAudience: Answer
    clarifyingQuestion: Answer


T = TypeVar("T")


class Success(BaseModel, Generic[T]):
    requestId: str
    data: T
