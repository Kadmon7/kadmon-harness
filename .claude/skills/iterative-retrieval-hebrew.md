---
name: iterative-retrieval-hebrew
description: Use when building Hebrew/Aramaic RAG systems for ToratNetz — Torah, Talmud, and commentary retrieval
---

# Iterative Retrieval — Hebrew (ToratNetz)

ToratNetz-specific RAG patterns for Hebrew and Aramaic text retrieval. Extends the base [iterative-retrieval](iterative-retrieval.md) skill.

## When to Use
- Building retrieval pipelines for Torah text search
- Handling Hebrew morphology in embeddings
- Cross-referencing Torah → Talmud → Commentaries
- Designing pgvector schemas for religious text

## Hebrew Text Challenges
- Hebrew morphology: root-based system (shoresh), prefixes/suffixes change word form
- Right-to-left text handling in embeddings
- Aramaic content in Talmud requires separate handling
- Cross-referencing: Torah → Talmud → Commentaries (Rashi, Ramban, etc.)

## Chunking Strategies
- **Pesukim (verses)**: Natural boundaries in Torah text
- **Parsha sections**: Logical thematic units
- **Commentary blocks**: Rashi/Ramban on specific pesukim
- **Sugya (Talmudic passage)**: Logical argument units in Gemara

## Embedding Considerations
- Use multilingual embedding models that support Hebrew
- Consider separate embeddings for Hebrew and Aramaic content
- Store original text + transliteration for search flexibility
- Metadata: book, chapter, verse, commentator, time period

## pgvector Table Design
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

## Similarity Search
```sql
SELECT id, reference, content_hebrew,
  1 - (embedding <=> $1) AS similarity
FROM torah_chunks
WHERE source = $2
ORDER BY embedding <=> $1
LIMIT 10;
```

## Multi-Source RAG
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

## Rules
- MUST use multilingual embedding models — monolingual English models fail on Hebrew
- MUST store both Hebrew original and transliteration for search flexibility
- MUST handle Aramaic separately from Hebrew in Talmudic passages
- MUST preserve canonical references (book:chapter:verse) in metadata
- MUST separate Hebrew and English search paths for accuracy
- NEVER fabricate Torah citations — return "no relevant passages found" if below threshold
- MUST cache embeddings for frequently queried passages (e.g., popular pesukim)

## no_context Application
Torah retrieval is sacred text — never generate or approximate religious content. Return actual text from the database only. If retrieval returns no relevant results above threshold, respond with "no relevant passages found" — never fabricate Torah, Talmud, or commentary citations.
