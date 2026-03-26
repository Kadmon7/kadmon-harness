---
name: iterative-retrieval
description: Use when building RAG (Retrieval-Augmented Generation) systems, especially for ToratNetz
---

# Iterative Retrieval

Progressive context retrieval for RAG systems. Core skill for ToratNetz.

## When to Use
- Building retrieval pipelines for Torah text search
- Designing pgvector similarity search
- Implementing multi-source RAG
- Optimizing retrieval quality

## How It Works

### 4-Phase Retrieval Loop
1. **Dispatch** — Initial query → vector similarity search
2. **Evaluate** — Score retrieved chunks for relevance
3. **Refine** — Reformulate query based on initial results
4. **Loop** — Repeat until relevance threshold met or max iterations reached

### Architecture
```
User Query
    ↓
[Embedding] → pgvector similarity search
    ↓
[Retrieved Chunks] → relevance scoring
    ↓
[Sufficient?] → YES → Generate answer
    ↓ NO
[Refine Query] → loop back to embedding
```

## Relevance Scoring
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

## Rules
- MUST set a relevance threshold — never return low-similarity results
- MUST limit iterations (max 3 refinements) to prevent infinite loops
- MUST log retrieval metrics (latency, chunk count, relevance scores) for optimization
- PREFER caching embeddings for frequently queried content
- MUST separate search paths by language for multilingual content

## no_context Application
Retrieval must be evidence-based: return actual text from the database, never generated content. If retrieval returns no relevant results above threshold, respond with "no relevant passages found" — never fabricate citations.

See also: [iterative-retrieval-hebrew.md](iterative-retrieval-hebrew.md) for ToratNetz-specific Hebrew/Aramaic RAG patterns.