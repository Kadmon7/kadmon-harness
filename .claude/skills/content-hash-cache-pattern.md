---
name: content-hash-cache-pattern
description: Cache expensive file processing results (PDF parsing, text extraction, image analysis, embedding generation) using SHA-256 of file content as the cache key — path-independent, auto-invalidating, with service-layer separation so the underlying processing function stays pure. Use this skill whenever building a file processing pipeline, adding a `--cache/--no-cache` CLI option, processing the same files repeatedly where cost matters, caching embeddings or chunks keyed by source file, or when the user says "cache the results", "avoid reprocessing", "SHA-256 cache", "content-based cache", or mentions expensive file operations that happen on every run. Do NOT use when results must always be fresh, when entries would be enormous (stream instead), or when output depends on parameters beyond file content.
---

# Content-Hash File Cache Pattern

Cache expensive file processing results using **content** (SHA-256 of the file bytes), not path, as the cache key. Survives file moves and renames, auto-invalidates when content changes, needs no index file.

## When to Activate

- Building a file processing pipeline (PDF parsing, OCR, text extraction, image analysis, embedding generation)
- Processing cost is high and the same files are processed repeatedly
- Adding a `--cache/--no-cache` CLI option to an existing pure function
- Caching expensive transformations keyed by source file

## When NOT to Use

- Data that must always be fresh (real-time feeds, live market data)
- Cache entries that would be enormous — consider streaming instead
- Results depend on parameters beyond file content (different extraction configs, different models) — key on `(content_hash, config_hash)` instead

## Core Pattern

### 1. Content-Hash Cache Key

Use file content (not path) as the cache key:

```python
import hashlib
from pathlib import Path

_HASH_CHUNK_SIZE = 65536  # 64KB chunks — don't load large files into memory

def compute_file_hash(path: Path) -> str:
    """SHA-256 of file contents (chunked for large files)."""
    if not path.is_file():
        raise FileNotFoundError(f"File not found: {path}")
    sha256 = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(_HASH_CHUNK_SIZE):
            sha256.update(chunk)
    return sha256.hexdigest()
```

**Why content hash?** File rename or move → cache hit. Content change → automatic invalidation. No index file needed.

### 2. Frozen Dataclass Cache Entry

```python
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class CacheEntry:
    file_hash: str
    source_path: str
    document: ExtractedDocument   # the cached result
```

Frozen + slots = small, immutable, safe to share.

### 3. File-Based Storage — one JSON per entry

Each entry is stored as `{hash}.json`. O(1) lookup by hash; no index file required.

```python
import json

def write_cache(cache_dir: Path, entry: CacheEntry) -> None:
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_dir / f"{entry.file_hash}.json"
    data = serialize_entry(entry)
    cache_file.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")

def read_cache(cache_dir: Path, file_hash: str) -> CacheEntry | None:
    cache_file = cache_dir / f"{file_hash}.json"
    if not cache_file.is_file():
        return None
    try:
        raw = cache_file.read_text(encoding="utf-8")
        data = json.loads(raw)
        return deserialize_entry(data)
    except (json.JSONDecodeError, ValueError, KeyError):
        return None  # treat corruption as cache miss
```

### 4. Service Layer Wrapper (Single Responsibility)

Keep the processing function pure. Add caching as a **separate** service layer — the processing function knows nothing about caching.

```python
def extract_with_cache(
    file_path: Path,
    *,
    cache_enabled: bool = True,
    cache_dir: Path = Path(".cache"),
) -> ExtractedDocument:
    """Cache check → extraction → cache write."""
    if not cache_enabled:
        return extract_text(file_path)  # pure function, no cache knowledge

    file_hash = compute_file_hash(file_path)

    cached = read_cache(cache_dir, file_hash)
    if cached is not None:
        logger.info("Cache hit: %s (hash=%s)", file_path.name, file_hash[:12])
        return cached.document

    logger.info("Cache miss: %s (hash=%s)", file_path.name, file_hash[:12])
    doc = extract_text(file_path)
    entry = CacheEntry(file_hash=file_hash, source_path=str(file_path), document=doc)
    write_cache(cache_dir, entry)
    return doc
```

## Key Design Decisions

| Decision | Rationale |
|---|---|
| SHA-256 content hash | Path-independent; auto-invalidates on content change |
| `{hash}.json` file naming | O(1) lookup; no index file needed |
| Service-layer wrapper | SRP: extraction stays pure, cache is a separate concern |
| Manual JSON serialization | Full control over frozen-dataclass serialization |
| Corruption returns `None` | Graceful degradation — re-processes on next run |
| Lazy `cache_dir.mkdir(parents=True)` | Directory created on first write only |

## Best Practices

- **Hash content, not paths** — paths change, content identity doesn't
- **Chunk large files** — never load the whole file into memory for hashing
- **Keep processing functions pure** — they should know nothing about caching
- **Log cache hit/miss** with truncated hashes for debugging without dumping full hex strings
- **Handle corruption gracefully** — treat invalid cache entries as misses, never crash

## Anti-Patterns

```python
# BAD — path-based caching (breaks on file move or rename)
cache = {"/path/to/file.pdf": result}

# BAD — cache logic inside the processing function (SRP violation)
def extract_text(path, *, cache_enabled=False, cache_dir=None):
    if cache_enabled:          # now this function has two jobs
        ...

# BAD — dataclasses.asdict() on nested frozen dataclasses
# Can cause subtle issues with complex nested types; use manual serialization
data = dataclasses.asdict(entry)
```

## TypeScript Equivalent

The same pattern in Node.js — hash the file with `crypto.createHash('sha256')` in a stream, store entries as `{hash}.json`, wrap the pure extractor with a service-layer function. The language changes; the design stays the same.

## Integration

- **orakle agent** (sonnet) — primary owner. orakle owns the data layer — databases, queries, and the caching patterns around them. This skill extends that remit to file-content caching for expensive read-once-process-many workflows.
- **postgres-patterns skill** — sibling for DB-side caching (materialized views, query caches); content-hash cache is the file-side counterpart.
- **cost-aware-llm-pipeline skill** — complementary. When the processing function calls an LLM, combining this cache with the cost-aware pipeline's routing and budget tracking gives you cheap reruns *and* bounded spend on the first run.
- **claude-api skill** — related. Prompt caching in the Claude API is a different layer (cache on the API side); this skill caches on the file side so the API call never happens when the content is unchanged.

## no_context Application

Cache correctness must rest on the actual content, not on the filename or metadata. Before trusting a cache hit, verify the hash was computed from the current file bytes — if the hash function was changed, old entries are invalid and must be rebuilt. A cache entry that can't be traced to a specific content hash is not a cache entry, it's a liability. The `no_context` principle here means: every cache hit is justified by a byte-for-byte identity claim, not a "probably the same file" assumption.
