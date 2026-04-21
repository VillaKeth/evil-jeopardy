"""Knowledge category definitions, pattern matchers, and confidence scoring."""

import re
from dataclasses import dataclass

# Valid categories
CATEGORIES = [
    "architecture_decision",
    "bug_fix",
    "convention",
    "lesson_learned",
    "configuration",
    "preference",
    "api_knowledge",
    "troubleshooting",
]

# Pattern → (category, base_confidence)
# Ordered by specificity — first match wins
CATEGORY_PATTERNS: list[tuple[str, str, float]] = [
    # Sensitive — skip entirely
    (r"(?:password|secret|token|api.?key|credential)\b", "SKIP", 0.0),

    # High confidence: explicit keywords
    (r"(?:decided|decision|chose|selected|went with)\b", "architecture_decision", 0.85),
    (r"(?:architecture|pattern|convention|design rule)\b", "architecture_decision", 0.80),
    (r"(?:bug|issue|problem|error|crash|broke)\b.*(?:fix|resolv|caus|because)", "bug_fix", 0.85),
    (r"(?:prefer|wants?|likes?|always use|never use)\b", "preference", 0.80),
    (r"(?:port|ip|address|hostname|endpoint)\s*[:=]?\s*\d", "configuration", 0.90),

    # Medium confidence: contextual
    (r"(?:discover|found out|realiz|learn|notic)\w*\b", "lesson_learned", 0.70),
    (r"(?:important|critical|key|note|remember|caveat|gotcha)\s*:", "lesson_learned", 0.75),
    (r"(?:workaround|trick|tip|hint|shortcut)\b", "troubleshooting", 0.70),
    (r"(?:api|endpoint|function|method|call)\b.*(?:return|behav|expect|actual)", "api_knowledge", 0.70),
    (r"(?:must|always|never|rule|require)\b.*(?:before|after|first|last)", "convention", 0.70),
]


@dataclass
class CategorizedEntry:
    """Result of categorizing a text entry."""
    text: str
    category: str
    confidence: float
    subcategory: str | None = None


def categorize_text(text: str) -> CategorizedEntry | None:
    """
    Categorize a text entry by matching against known patterns.

    Returns None if the text should be skipped (sensitive data) or no pattern matches.
    """
    for pattern, category, confidence in CATEGORY_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            if category == "SKIP":
                return None
            return CategorizedEntry(
                text=text,
                category=category,
                confidence=confidence,
            )
    return None


def is_valid_category(category: str) -> bool:
    """Check if a category string is valid."""
    return category in CATEGORIES
