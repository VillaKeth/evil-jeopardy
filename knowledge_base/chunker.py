"""Document chunking for markdown and code files."""
from __future__ import annotations
import re
from .backends import Chunk


def _estimate_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token."""
    return len(text) // 4


class MarkdownChunker:
    """Split markdown files on header boundaries."""

    def __init__(self, max_tokens: int = 500, min_tokens: int = 50):
        self.max_tokens = max_tokens
        self.min_tokens = min_tokens

    def chunk_markdown(self, text: str, metadata: dict) -> list[Chunk]:
        if not text.strip():
            return []

        sections = self._split_by_headers(text)
        chunks = []
        header_stack: list[str] = []

        for header, body in sections:
            if header:
                level = len(re.match(r"^(#+)", header).group(1))
                title = header.lstrip("#").strip()
                header_stack = header_stack[:level - 1]
                header_stack.append(title)

            section_path = " > ".join(header_stack) if header_stack else ""
            full_text = f"{header}\n\n{body}".strip() if header else body.strip()

            if _estimate_tokens(full_text) < self.min_tokens:
                continue

            if _estimate_tokens(full_text) > self.max_tokens:
                sub_chunks = self._split_long_section(full_text, section_path, metadata, len(chunks))
                chunks.extend(sub_chunks)
            else:
                chunks.append(Chunk(
                    text=full_text,
                    metadata={
                        **metadata,
                        "section_path": section_path,
                        "chunk_index": len(chunks),
                    }
                ))

        for i, chunk in enumerate(chunks):
            chunk.metadata["chunk_index"] = i

        return chunks

    def _split_by_headers(self, text: str) -> list[tuple[str, str]]:
        """Split text into (header, body) pairs."""
        pattern = re.compile(r"^(#{1,6}\s+.+)$", re.MULTILINE)
        parts = pattern.split(text)
        sections = []

        if parts[0].strip():
            sections.append(("", parts[0]))

        for i in range(1, len(parts), 2):
            header = parts[i].strip()
            body = parts[i + 1] if i + 1 < len(parts) else ""
            sections.append((header, body))

        return sections

    def _split_long_section(self, text: str, section_path: str, metadata: dict, start_index: int) -> list[Chunk]:
        """Split oversized sections on paragraph boundaries, preserving code blocks."""
        paragraphs = re.split(r"\n\n+", text)
        chunks = []
        current = []
        current_len = 0

        for para in paragraphs:
            para_tokens = _estimate_tokens(para)
            if current and current_len + para_tokens > self.max_tokens:
                chunk_text = "\n\n".join(current)
                if _estimate_tokens(chunk_text) >= self.min_tokens:
                    chunks.append(Chunk(
                        text=chunk_text,
                        metadata={**metadata, "section_path": section_path, "chunk_index": start_index + len(chunks)},
                    ))
                current = [para]
                current_len = para_tokens
            else:
                current.append(para)
                current_len += para_tokens

        if current:
            chunk_text = "\n\n".join(current)
            if _estimate_tokens(chunk_text) >= self.min_tokens:
                chunks.append(Chunk(
                    text=chunk_text,
                    metadata={**metadata, "section_path": section_path, "chunk_index": start_index + len(chunks)},
                ))

        return chunks


class CodeChunker:
    """Split code files on function/class boundaries."""

    def __init__(self, min_tokens: int = 50):
        self.min_tokens = min_tokens

    def chunk_code(self, text: str, language: str, metadata: dict) -> list[Chunk]:
        if not text.strip():
            return []

        if language in ("python", "drl"):
            return self._chunk_python(text, metadata)
        elif language in ("typescript", "javascript"):
            return self._chunk_typescript(text, metadata)
        else:
            return [Chunk(text=text, metadata={**metadata, "section_path": "", "chunk_index": 0})]

    def _chunk_python(self, text: str, metadata: dict) -> list[Chunk]:
        """Split Python on top-level def/class boundaries."""
        pattern = re.compile(r"^(?=(?:def |class |async def ))", re.MULTILINE)
        return self._split_by_pattern(text, pattern, metadata)

    def _chunk_typescript(self, text: str, metadata: dict) -> list[Chunk]:
        """Split TypeScript on export function/class/const boundaries."""
        pattern = re.compile(
            r"^(?=(?:export\s+(?:default\s+)?(?:function|class|const|async\s+function)|"
            r"function\s|class\s|const\s+\w+\s*=\s*(?:async\s*)?\())",
            re.MULTILINE,
        )
        return self._split_by_pattern(text, pattern, metadata)

    def _split_by_pattern(self, text: str, pattern: re.Pattern, metadata: dict) -> list[Chunk]:
        positions = [m.start() for m in pattern.finditer(text)]
        if not positions:
            if _estimate_tokens(text) >= self.min_tokens:
                return [Chunk(text=text.strip(), metadata={**metadata, "section_path": "", "chunk_index": 0})]
            return []

        chunks = []

        if positions[0] > 0:
            preamble = text[:positions[0]].strip()
            if _estimate_tokens(preamble) >= self.min_tokens:
                chunks.append(Chunk(
                    text=preamble,
                    metadata={**metadata, "section_path": "preamble", "chunk_index": 0},
                ))

        for i, pos in enumerate(positions):
            end = positions[i + 1] if i + 1 < len(positions) else len(text)
            block = text[pos:end].strip()
            if _estimate_tokens(block) >= self.min_tokens:
                name_match = re.match(r"(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:def|function|class|const)\s+(\w+)", block)
                name = name_match.group(1) if name_match else f"block_{i}"
                chunks.append(Chunk(
                    text=block,
                    metadata={**metadata, "section_path": name, "chunk_index": len(chunks)},
                ))

        return chunks
