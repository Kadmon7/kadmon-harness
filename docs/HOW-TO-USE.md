# Kadmon Harness — Como Usar en Proyectos Reales

> Para la referencia completa de componentes, ver `docs/REFERENCE.md`.
> Para la guia de usuario general, ver `docs/GUIDE.md`.

---

## 1. Flujo Diario Completo

### Manana — Observar y planificar

```bash
# 1. Abrir Claude Code en el proyecto
cd /path/to/proyecto
claude

# 2. Ver estado del harness
/dashboard

# 3. Revisar sesion anterior
/sessions
```

El `/dashboard` muestra instintos activos, sesiones recientes, costos y salud de hooks. Si algun instinto tiene confianza >= 0.7, considera `/promote` para convertirlo en skill.

### Trabajo — Implementar con disciplina

```bash
# 5. Planificar la tarea del dia
/kplan implementar endpoint de busqueda por embedding

# 6. Implementar con TDD
/tdd crear funcion searchByEmbedding

# 7. Verificar despues de implementar
/verify

# 8. Si hay errores de compilacion
/build-fix

# 9. Buscar documentacion cuando sea necesario
/docs supabase-js rpc function
/docs sql.js prepared statements
```

El flujo es siempre: **Plan → Test → Implement → Verify**. Los hooks se encargan de verificar automaticamente (typecheck, lint, quality gate despues de cada edicion).

### Tarde — Revisar y cerrar

```bash
# 10. Revisar codigo antes de commit
/code-review

# 11. Guardar progreso (verifica + commit + push)
/checkpoint

# 12. Extraer patrones aprendidos
/learn

# 13. Si la sesion fue larga, ver costos
/dashboard
```

El `/checkpoint` ejecuta `/verify` automaticamente antes de commitear. Si falla, no commitea.

El `/learn` analiza la sesion y crea instintos con confianza 0.3. Con el tiempo, los instintos se refuerzan y eventualmente se promueven a skills.

---

## 2. Como Usar el Harness en ToratNetz

ToratNetz es un sistema RAG (Retrieval-Augmented Generation) para texto Torah, Talmud y comentarios rabiinicos. Stack: **Supabase + pgvector + TypeScript**.

### 2.1 — Chunks de texto hebreo

El harness incluye el skill `iterative-retrieval-hebrew` con patrones especificos para texto hebreo/arameo.

**Estrategias de chunking documentadas:**

| Tipo de texto | Unidad de chunk | Ejemplo |
|--------------|----------------|---------|
| Torah | Pesukim (versiculos) | Bereshit 1:1 |
| Torah | Parsha (secciones tematicas) | Parashat Bereshit |
| Talmud | Sugya (pasaje argumentativo) | Berachot 2a |
| Comentarios | Bloque de Rashi/Ramban sobre un pasuk | Rashi sobre Bereshit 1:1 |

**Consideraciones de embedding:**
- Usar modelos multilingues que soporten hebreo
- Embeddings separados para hebreo y arameo
- Almacenar texto original + transliteracion para flexibilidad de busqueda
- Metadata: libro, capitulo, versiculo, comentarista, periodo historico

### 2.2 — pgvector y embeddings

Schema documentado en el skill:

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

**Busqueda por similaridad:**

```sql
SELECT id, reference, content_hebrew,
  1 - (embedding <=> $1) AS similarity
FROM torah_chunks
WHERE source = $2
ORDER BY embedding <=> $1
LIMIT 10;
```

### 2.3 — RAG pipeline

El skill `iterative-retrieval` define un loop de 4 fases:

```
1. Dispatch — Query inicial → busqueda vectorial
2. Evaluate — Scoring de chunks por relevancia
3. Refine — Reformular query basado en resultados
4. Loop — Repetir hasta threshold o max iteraciones (3)
```

**Multi-source retrieval con cross-referencing:**

```typescript
async function retrieveWithContext(query: string, sources: string[]) {
  const embedding = await generateEmbedding(query);

  // Fase 1: Retriever de cada fuente
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

  // Fase 2: Cross-reference
  const torahResults = results.flat().filter(r => r.source === 'torah');
  const relatedCommentary = await fetchCommentary(
    torahResults.map(r => r.reference)
  );

  // Fase 3: Merge y ranking
  return rankByRelevance([...results.flat(), ...relatedCommentary]);
}
```

**Comandos del harness para ToratNetz:**

```bash
# Planificar una feature de busqueda
/kplan implementar busqueda semantica de pesukim

# Buscar docs de pgvector antes de implementar
/docs supabase pgvector similarity search

# TDD para la funcion de retrieval
/tdd crear funcion matchTorahChunks

# Review del SQL (auto-invoca database-reviewer)
/code-review
```

### 2.4 — Flujos XION

> `no_context` — No existe documentacion sobre XION en el harness. Si XION es un componente de ToratNetz o un proyecto separado, se necesita documentar su scope, arquitectura y stack antes de integrarlo al harness.

---

## 3. Como Usar el Harness en KAIRON

UNIVERSO KAIRON es un AI companion universe. Stack documentado: **React Native + ElevenLabs voice + Claude Sonnet 4.6**.

### 3.1 — React Native app

El harness soporta desarrollo React Native a traves del plugin **frontend-design** para componentes UI y **feature-dev** para features completas.

```bash
# Planificar una nueva pantalla
/kplan disenar pantalla de chat con CAIO companion

# Buscar docs de React Native
/docs react-native FlatList virtualization

# Implementar con TDD
/tdd crear componente ChatBubble
```

El agente `architect` (opus) puede disenar la estructura de la app:

```bash
/kplan disenar arquitectura de navegacion para KAIRON
```

### 3.2 — ElevenLabs voice

KAIRON usa:

| Componente | Tecnologia | Estado |
|-----------|-----------|--------|
| Text-to-Speech | Eleven v3 (GA) | Disponible |
| Transcripcion | Scribe v2 Realtime | Sub-150ms latency |
| LLM en voice agent | Claude Sonnet 4.6 | Soportado en ElevenAgents |
| Interaccion | WebSocket multimodal | En evaluacion |

**Comandos del harness para integracion de voz:**

```bash
# Buscar docs del SDK
/docs elevenlabs-sdk websocket streaming

# Planificar integracion
/kplan integrar ElevenLabs TTS v3 en flujo de chat
```

### 3.3 — CAIO companion

> `no_context` — No existe documentacion especifica sobre CAIO en el harness. Si CAIO es el nombre del AI companion de KAIRON, se necesita documentar: personalidad, capacidades, flujos de conversacion y modelo de interaccion antes de integrarlo al harness.

### 3.4 — Action items documentados (Marzo 2026)

Action items para KAIRON:

| Prioridad | Accion | Razon |
|-----------|--------|-------|
| **HIGH** | Probar Claude Sonnet 4.6 en ElevenAgents | Unificar LLM entre Harness y voice agent |
| **MEDIUM** | Evaluar WebSocket multimodal de ElevenAgents | Interacciones mas ricas para el companion |
| **MEDIUM** | Revisar Eleven v3 TTS GA | Voz mas expresiva |
| **LOW** | Probar Scribe v2 Realtime | Sub-150ms mejora flujo de conversacion |

---

## 4. Como Instalar en un Proyecto Nuevo

### Prerequisitos

- Node.js 18+
- Claude Code CLI instalado
- Git (repositorio inicializado)

### Paso 1 — Copiar el harness

```bash
# Desde el directorio de Kadmon-Harness
cp -r .claude/ /path/to/tu-proyecto/.claude/
cp -r scripts/ /path/to/tu-proyecto/scripts/
cp -r schemas/ /path/to/tu-proyecto/schemas/
cp tsconfig.json /path/to/tu-proyecto/
cp package.json /path/to/tu-proyecto/
```

### Paso 2 — Instalar dependencias

```bash
cd /path/to/tu-proyecto
npm install
```

Esto instala sql.js, zod, y compila TypeScript a dist/ automaticamente (via postinstall).

### Paso 3 — Adaptar CLAUDE.md

Editar `CLAUDE.md` en el nuevo proyecto:

1. Cambiar nombre del proyecto en "Identity"
2. Actualizar "Active Projects" con los proyectos reales
3. Ajustar stack si es diferente
4. Mantener el principio `no_context` y el mantra

### Paso 4 — Verificar instalacion

```bash
# Abrir Claude Code
claude

# Verificar que hooks funcionan
/dashboard

# Ejecutar tests del harness
npx vitest run

# Verificar build
npm run build
```

Si el dashboard muestra instintos y hook health, la instalacion fue exitosa.

### Paso 5 — Personalizar

- **Agregar skills** especificos del proyecto en `.claude/skills/`
- **Ajustar rules** en `.claude/rules/` segun el stack del proyecto
- **Configurar MCPs** en settings.json si se necesitan servidores adicionales
- **Crear contextos** en `.claude/contexts/` para modos de trabajo especificos

---

## 5. Top 10 Comandos Mas Usados

### 1. `/kplan` — Planificar tareas complejas

```bash
/kplan migrar persistencia de SQLite a Supabase
/kplan implementar busqueda semantica con pgvector
/kplan refactorizar session-manager para soportar multi-proyecto
```

Invoca el agente planner (opus). Produce un plan numerado con fases, verificacion por paso, y estimaciones S/M/L.

### 2. `/tdd` — Desarrollo test-first

```bash
/tdd crear funcion calculateConfidence
/tdd implementar endpoint de busqueda por embedding
```

Invoca tdd-guide (sonnet). Genera test primero, espera que falle (red), luego implementa (green), luego refactoriza.

### 3. `/verify` — Verificacion completa

```bash
/verify
```

Ejecuta en orden: build → typecheck → tests → lint. Se detiene al primer fallo. Ejecutar antes de cada commit.

### 4. `/checkpoint` — Guardar progreso

```bash
/checkpoint
```

Ejecuta /verify, luego code-review, luego commit con formato convencional, luego push. Todo en un paso.

### 5. `/dashboard` — Ver estado del harness

```bash
/dashboard
```

Muestra: instintos activos con barras de confianza, sesiones recientes, costos, y salud de hooks.

### 6. `/docs` — Buscar documentacion

```bash
/docs supabase-js insert
/docs sql.js prepare statement
/docs zod discriminated union
/docs react-native flatlist
```

Busca via Context7 MCP. Si no encuentra, fallback a WebSearch. Nunca inventa — reporta `no_context`.

### 7. `/code-review` — Revisar codigo

```bash
/code-review
```

Invoca code-reviewer + typescript-reviewer + security-reviewer (si aplica). Produce findings con severidad BLOCK/WARN/NOTE.

### 8. `/learn` — Extraer patrones

```bash
/learn
```

Analiza la sesion actual y crea instintos con confianza 0.3. Con refuerzo en sesiones futuras, suben a 0.7+ y se promueven a skills.

### 9. `/evolve` — Auto-optimizacion

```bash
/evolve
```

Invoca harness-optimizer (opus). Analiza hook latency, instinct quality, skill gaps, cost trends. Produce recomendaciones — nunca auto-aplica.

---

## 6. Errores Comunes y Como Resolverlos

### "no_context: must Read [file] before editing"

**Causa:** El hook `no-context-guard` bloqueo una edicion porque el archivo no fue leido primero.

**Solucion:** Leer el archivo antes de editarlo. Esto es intencional — el principio `no_context` impide modificar codigo sin entenderlo.

```
❌ Edit src/lib/state-store.ts (sin Read previo)
✅ Read src/lib/state-store.ts → Edit src/lib/state-store.ts
```

### "--no-verify is blocked by Kadmon safety guard"

**Causa:** El hook `block-no-verify` bloqueo un comando git con `--no-verify` o `--no-gpg-sign`.

**Solucion:** No hay override — es intencional. Si los pre-commit hooks fallan, arreglar la causa raiz:

```bash
/build-fix    # Si es error de compilacion
/verify       # Para ver que falla exactamente
```

### "config-protection: [file] is a protected config file"

**Causa:** El hook `config-protection` bloqueo una edicion a un archivo critico (tsconfig.json, eslint.config.js, package.json scripts, settings.json, vitest.config.ts).

**Solucion:** Pedir al arquitecto que autorice el cambio:

```bash
/kplan modificar tsconfig.json para agregar paths
```

### "conventional commit format required"

**Causa:** El hook `commit-format-guard` bloqueo un commit con mensaje incorrecto.

**Solucion:** Usar formato convencional:

```
feat(search): add embedding similarity function
fix(hooks): correct observe-pre JSONL path on Windows
docs: update REFERENCE.md with plugin section
chore: bump sql.js to 1.15.0
```

Tipos validos: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`, `perf`

### MCP health check warnings

**Causa:** Un servidor MCP (GitHub, Context7, o Supabase) no respondio correctamente.

**Solucion:**

```bash
# Verificar conectividad
/docs test-connection

# Si Context7 falla, el agente docs-lookup usa WebSearch como fallback
# Si GitHub MCP falla, usar gh CLI directamente
gh pr list
```

### TypeScript errors after edit

**Causa:** El hook `post-edit-typecheck` detecto errores de tipo despues de una edicion.

**Solucion:**

```bash
# Ver el error completo
/build-fix

# Errores comunes:
# TS2307 (cannot find module) → agregar .js extension al import
# TS7016 (no declaration file) → agregar @types/paquete
# TS2345 (argument type) → verificar tipos con /docs
```

### "No observations" en dashboard

**Causa:** Las sesiones anteriores fueron muy cortas o no generaron actividad suficiente para registrar observaciones.

**Solucion:** Esto es normal al inicio. Los observe hooks (`observe-pre`, `observe-post`) registran datos automaticamente durante la sesion activa. Despues de algunas herramientas usadas, el dashboard mostrara datos en "Hook Health".

### Instintos no se promueven

**Causa:** Un instinto necesita confianza >= 0.7 y >= 3 ocurrencias para ser promovido.

**Solucion:** Los instintos inician en 0.3 y suben +0.1 por refuerzo. Se necesitan al menos 4 refuerzos para llegar a 0.7. Esto es por diseno — evita promover patrones prematuros.

```bash
/instinct-status   # Ver confianza actual
/promote           # Promover manualmente si cumple threshold
```

---

*Kadmon Harness v0.2 — Observe → Remember → Verify → Specialize → Evolve*
*Principio: `no_context` — si no hay evidencia, no inventar.*
