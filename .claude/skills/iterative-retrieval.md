---
name: iterative-retrieval
description: RAG system patterns and multi-agent context retrieval — query expansion, re-ranking, chunk management, context window optimization, subagent context problem. Use this skill whenever building retrieval-augmented generation pipelines, implementing semantic search with embeddings, designing chunk strategies for ToratNetz or any document corpus, spawning subagents that need codebase context, or when the user mentions "RAG", "retrieval", "embeddings", "chunks", "semantic search", or "vector search". Also use when optimizing retrieval quality or debugging poor search results.
---

# Iterative Retrieval

Progressive context retrieval for RAG systems and multi-agent workflows. Core skill for ToratNetz and agent orchestration.

## When to Use
- Building retrieval pipelines for Torah text search
- Designing pgvector similarity search
- Implementing multi-source RAG
- Spawning subagents that need codebase context they cannot predict upfront
- Optimizing retrieval quality

## The Problem

Retrieval targets (subagents, RAG pipelines) don't know what context they need until they start working. Standard approaches fail:
- **Send everything**: Exceeds context limits
- **Send nothing**: Agent lacks critical information
- **Guess what's needed**: Often wrong

## The Solution: 4-Phase Retrieval Loop

```
+-----------+      +-----------+
| DISPATCH  |----->| EVALUATE  |
+-----------+      +-----------+
      ^                  |
      |                  v
+-----------+      +-----------+
|   LOOP    |<-----|  REFINE   |
+-----------+      +-----------+

   Max 3 cycles, then proceed
```

### Phase 1: DISPATCH
Initial broad query to gather candidates:
- For RAG: vector similarity search against embeddings
- For code: Grep/Glob with keywords and file patterns

### Phase 2: EVALUATE
Score retrieved content for relevance:

| Score | Meaning | Action |
|-------|---------|--------|
| 0.8-1.0 | High -- directly implements target | Keep, high priority |
| 0.5-0.7 | Medium -- related patterns or types | Keep, lower priority |
| 0.2-0.4 | Low -- tangentially related | Exclude from context |
| 0-0.2 | None -- not relevant | Drop, add to exclude list |

3 high-relevance files beats 10 mediocre ones. Stop at good enough.

### Phase 3: REFINE
Update search criteria based on evaluation:
- Add terminology discovered in high-relevance results
- Exclude confirmed irrelevant paths
- Target specific gaps identified in evaluation

### Phase 4: LOOP
Repeat with refined criteria (max 3 cycles). Each cycle should increase relevance, not just volume.

## RAG Architecture (ToratNetz)

```
User Query
    |
[Embedding] --> pgvector similarity search
    |
[Retrieved Chunks] --> relevance scoring
    |
[Sufficient?] --> YES --> Generate answer
    | NO
[Refine Query] --> loop back to embedding
```

### Relevance Scoring
```typescript
interface RetrievalResult {
  chunkId: string;
  similarity: number;    // pgvector cosine similarity (0-1)
  source: string;        // e.g., 'documents', 'knowledge_base'
  reference: string;     // canonical reference
  content: string;
}

function isRelevant(result: RetrievalResult): boolean {
  return result.similarity >= 0.7; // threshold
}
```

## Multi-Agent Context

When spawning subagents, use iterative retrieval to provide context:

```
Cycle 1: Broad search (Grep for keywords, Glob for patterns)
Cycle 2: Evaluate top candidates, identify gaps
Cycle 3: Targeted search for specific missing context
--> Pass curated context to subagent
```

This prevents sending the entire codebase (too large) or guessing what files are needed (often wrong).

## Gotchas
- Set a relevance threshold -- never return low-similarity results to the user. 0.7 is a reasonable default.
- Limit iterations to max 3 refinements to prevent infinite loops. Diminishing returns after 2-3 cycles.
- Separate search paths by language for multilingual content (Hebrew/Aramaic vs English in ToratNetz).
- Cache embeddings for frequently queried content -- re-embedding the same text wastes API calls.
- Log retrieval metrics (latency, chunk count, relevance scores) for optimization -- without metrics you are guessing.

## Rules
- MUST set a relevance threshold -- never return low-similarity results
- MUST limit iterations (max 3 refinements) to prevent infinite loops
- MUST log retrieval metrics for optimization
- PREFER caching embeddings for frequently queried content
- MUST separate search paths by language for multilingual content

## no_context Application
Retrieval must be evidence-based: return actual text from the database, never generated content. If retrieval returns no relevant results above threshold, respond with "no relevant passages found" -- never fabricate citations.

See also: [iterative-retrieval-hebrew.md](iterative-retrieval-hebrew.md) for ToratNetz-specific Hebrew/Aramaic RAG patterns.
