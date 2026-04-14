---
name: regex-vs-llm-structured-text
description: Decision framework for choosing between regex and LLM when parsing structured text (quizzes, forms, invoices, repeating document patterns) — start with regex for cheap deterministic extraction, then add LLM only for low-confidence edge cases via confidence scoring. Use this skill whenever building a text-extraction pipeline, deciding between regex and LLM for parsing, combining both approaches, optimizing cost/accuracy tradeoffs in text processing, or when the user says "parse this structured text", "extract from PDF/forms", "regex or LLM", "cheap extraction", "LLM fallback", "confidence scoring", or "hybrid parser". Avoid reaching for an LLM first when the text has a repeating pattern — regex is 100-1000× cheaper and deterministic.
---

# Regex vs LLM for Structured Text

A practical decision framework for parsing structured text (quizzes, forms, invoices, repeating document patterns). The key insight: **regex handles 95-98% of cases cheaply and deterministically; an LLM is the fallback for the remaining edge cases, not the default**.

## When to Activate

- Parsing structured text with repeating patterns (questions, forms, tables, line items)
- Deciding between regex and LLM for a text-extraction task
- Building a hybrid pipeline that combines both
- Optimizing cost/accuracy tradeoffs in existing text processing

## Decision Framework

```
Is the text format consistent and repeating?
├── Yes (>90% follows a pattern) → Start with Regex
│   ├── Regex handles 95%+ → Done, no LLM needed
│   └── Regex handles <95% → Add LLM for edge cases only
└── No (free-form, highly variable) → Use LLM directly
```

## Architecture Pattern

```
Source Text
    │
    ▼
[Regex Parser]       — extracts structure (95-98% accuracy)
    │
    ▼
[Text Cleaner]       — removes noise (markers, page numbers, artifacts)
    │
    ▼
[Confidence Scorer]  — flags low-confidence extractions
    │
    ├── High (≥0.95)  → direct output
    └── Low  (<0.95)  → [LLM Validator] → output
```

## Implementation

### 1. Regex Parser — handles the majority

```python
import re
from dataclasses import dataclass

@dataclass(frozen=True)
class ParsedItem:
    id: str
    text: str
    choices: tuple[str, ...]
    answer: str
    confidence: float = 1.0

def parse_structured_text(content: str) -> list[ParsedItem]:
    pattern = re.compile(
        r"(?P<id>\d+)\.\s*(?P<text>.+?)\n"
        r"(?P<choices>(?:[A-D]\..+?\n)+)"
        r"Answer:\s*(?P<answer>[A-D])",
        re.MULTILINE | re.DOTALL,
    )
    items = []
    for match in pattern.finditer(content):
        choices = tuple(
            c.strip() for c in re.findall(r"[A-D]\.\s*(.+)", match.group("choices"))
        )
        items.append(ParsedItem(
            id=match.group("id"),
            text=match.group("text").strip(),
            choices=choices,
            answer=match.group("answer"),
        ))
    return items
```

### 2. Confidence Scoring — flag what needs LLM help

```python
@dataclass(frozen=True)
class ConfidenceFlag:
    item_id: str
    score: float
    reasons: tuple[str, ...]

def score_confidence(item: ParsedItem) -> ConfidenceFlag:
    reasons: list[str] = []
    score = 1.0

    if len(item.choices) < 3:
        reasons.append("few_choices")
        score -= 0.3
    if not item.answer:
        reasons.append("missing_answer")
        score -= 0.5
    if len(item.text) < 10:
        reasons.append("short_text")
        score -= 0.2

    return ConfidenceFlag(
        item_id=item.id,
        score=max(0.0, score),
        reasons=tuple(reasons),
    )

def identify_low_confidence(
    items: list[ParsedItem],
    threshold: float = 0.95,
) -> list[ConfidenceFlag]:
    return [score_confidence(i) for i in items if score_confidence(i).score < threshold]
```

### 3. LLM Validator — edge cases only

```python
def validate_with_llm(item: ParsedItem, original_text: str, client) -> ParsedItem:
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",   # cheapest model is enough for validation
        max_tokens=500,
        messages=[{
            "role": "user",
            "content": (
                f"Extract the question, choices, and answer from this text.\n\n"
                f"Text: {original_text}\n\n"
                f"Current extraction: {item}\n\n"
                f"Return corrected JSON if needed, or 'CORRECT' if accurate."
            ),
        }],
    )
    # parse response into a corrected ParsedItem...
    return corrected_item
```

### 4. Hybrid Pipeline

```python
def process_document(
    content: str,
    *,
    llm_client=None,
    confidence_threshold: float = 0.95,
) -> list[ParsedItem]:
    items = parse_structured_text(content)                       # step 1: regex
    low_confidence = identify_low_confidence(items, confidence_threshold)   # step 2

    if not low_confidence or llm_client is None:
        return items

    low_conf_ids = {f.item_id for f in low_confidence}
    return [
        validate_with_llm(i, content, llm_client) if i.id in low_conf_ids else i
        for i in items
    ]
```

## Real-World Metrics

From a production quiz parsing pipeline (410 items):

| Metric | Value |
|---|---|
| Regex success rate | 98.0% |
| Low-confidence items | 8 (2.0%) |
| LLM calls needed | ~5 |
| Cost savings vs all-LLM | ~95% |
| Test coverage | 93% |

Ballpark rule: for structured text with repeating patterns, **all-LLM is 20-100× more expensive** than regex-first hybrid, for the same final accuracy.

## Best Practices

- **Start with regex** — even an imperfect first-draft pattern gives you a baseline to iterate on
- **Use confidence scoring** to programmatically identify what needs LLM help (no manual inspection)
- **Use the cheapest model** for validation — Haiku-class is almost always sufficient
- **Never mutate parsed items** — return new instances from cleaning and validation steps
- **TDD works well for parsers** — write tests for known patterns first, then edge cases
- **Log regex success rate and LLM call count** — if regex success drops below 90%, your input shape may have shifted

## Anti-Patterns

- Sending all text to an LLM when regex handles 95%+ (expensive, slow, non-deterministic)
- Using regex for free-form, highly variable text (LLM is better here)
- Skipping confidence scoring and hoping regex "just works" — you'll miss silent failures
- Mutating parsed objects during cleaning/validation steps
- Not testing edge cases (malformed input, missing fields, encoding issues)

## When to Use — quick reference

- Quiz / exam question parsing
- Form data extraction
- Invoice and receipt processing
- Document structure parsing (headers, sections, tables)
- Any structured text with repeating patterns where cost matters

## Integration

- **kody agent** (sonnet) — primary owner. kody reviews code quality and decision-making; this skill is the reference kody uses when reviewing any parsing pipeline that reaches for an LLM by default.
- **cost-aware-llm-pipeline skill** — complementary. When the LLM branch *does* fire, cost-aware-llm-pipeline keeps it within a budget and routes to the cheapest model. Load both when designing a hybrid parser.
- **tdd-workflow skill** — sibling. Parsers are a domain where TDD is unusually effective — known patterns become golden tests, edge cases get added as they're discovered. Use TDD to build the regex first, then add the LLM fallback as a separate tested path.
- **/abra-kdabra command** — entry point when planning a new parsing pipeline.

## no_context Application

Every claim in a "regex vs LLM" decision must rest on a real sample of the target text. Before recommending "use regex", read at least a few actual documents from the corpus and verify the pattern is consistent — don't guess from the *name* of the format. Before recommending "go straight to an LLM", verify the text really is free-form — don't default to LLM out of habit. The `no_context` principle here means: the decision is made from the data, not from a preference.
