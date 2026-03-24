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

## Hebrew Text Specifics (ToratNetz)

### Challenges
- Hebrew morphology: root-based system (shoresh), prefixes/suffixes change word form
- Right-to-left text handling in embeddings
- Aramaic content in Talmud requires separate handling
- Cross-referencing: Torah → Talmud → Commentaries (Rashi, Ramban, etc.)

### Chunking Strategies
- **Pesukim (verses)**: Natural boundaries in Torah text
- **Parsha sections**: Logical thematic units
- **Commentary blocks**: Rashi/Ramban on specific pesukim
- **Sugya (Talmudic passage)**: Logical argument units in Gemara

### Embedding Considerations
- Use multilingual embedding models that support Hebrew
- Consider separate embeddings for Hebrew and Aramaic content
- Store original text + transliteration for search flexibility
- Metadata: book, chapter, verse, commentator, time period

## pgvector Patterns

### Table Design
```sql
CREATE TABLE torah_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,           -- 'torah', 'talmud', 'rashi', 'ramban'
  book TEXT NOT NULL,             -- 'bereshit', 'shemot', etc.
  reference TEXT NOT NULL,        -- '1:1', 'berachot 2a'
  content_hebrew TEXT NOT NULL,
  content_english TEXT,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_torah_embedding ON torah_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### Similarity Search
```sql
SELECT id, reference, content_hebrew,
  1 - (embedding <=> $1) AS similarity
FROM torah_chunks
WHERE source = $2
ORDER BY embedding <=> $1
LIMIT 10;
```

### Multi-Source RAG
```typescript
async function retrieveWithContext(query: string, sources: string[]) {
  const embedding = await generateEmbedding(query);

  // Phase 1: Retrieve from each source
  const results = await Promise.all(
    sources.map(source =>
      supabase.rpc('match_torah_chunks', {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: 5,
        source_filter: source,
      })
    )
  );

  // Phase 2: Cross-reference
  // If Torah verse found, also fetch related Rashi/Ramban commentaries
  const torahResults = results.flat().filter(r => r.source === 'torah');
  const relatedCommentary = await fetchCommentary(torahResults.map(r => r.reference));

  // Phase 3: Merge and rank
  return rankByRelevance([...results.flat(), ...relatedCommentary]);
}
```

## Relevance Scoring
```typescript
interface RetrievalResult {
  chunkId: string;
  similarity: number;    // pgvector cosine similarity (0-1)
  source: string;        // torah, talmud, rashi, etc.
  reference: string;     // canonical reference
  content: string;
}

function isRelevant(result: RetrievalResult): boolean {
  return result.similarity >= 0.7; // threshold
}
```

## Rules
- Always set a relevance threshold — do not return low-similarity results
- Limit iterations (max 3 refinements) to prevent infinite loops
- Log retrieval metrics (latency, chunk count, relevance scores) for optimization
- Cache embeddings for frequently queried passages
- Separate Hebrew and English search paths for better accuracy

## no_context Application
Retrieval must be evidence-based: return actual text from the database, never generated Torah content. If retrieval returns no relevant results above threshold, respond with "no relevant passages found" — never fabricate Torah citations.