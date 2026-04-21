"""Protocol interfaces for KB backends. Enables future LlamaIndex swap."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable


@dataclass
class Chunk:
    text: str
    metadata: dict = field(default_factory=dict)


@dataclass
class SearchResult:
    id: str
    score: float
    text: str
    source: str  # "knowledge" or "documents"
    metadata: dict = field(default_factory=dict)


@runtime_checkable
class EmbeddingBackend(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]: ...
    def embed_query(self, text: str) -> list[float]: ...


@runtime_checkable
class ChunkingBackend(Protocol):
    def chunk_markdown(self, text: str, metadata: dict) -> list[Chunk]: ...
    def chunk_code(self, text: str, language: str, metadata: dict) -> list[Chunk]: ...


@runtime_checkable
class RetrievalBackend(Protocol):
    def search(self, query: str, collection: str, limit: int, filters: dict | None = None) -> list[SearchResult]: ...
    def add(self, text: str, collection: str, metadata: dict) -> str: ...
    def delete_by_filter(self, collection: str, filters: dict) -> int: ...
