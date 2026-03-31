# Kadmon Harness — Referencia Completa

> Version: v0.3 | Fecha: 2026-03-30 | Estado: A

Esta es la referencia completa de todo lo que existe en el harness.
Para aprender a usarlo en proyectos reales, ver `docs/HOW-TO-USE.md`.
Para el flujo diario, ver `docs/GUIDE.md`.

---

## Seccion 1 — Arquitectura General

### Que es Kadmon Harness

Kadmon Harness es una capa operativa sobre Claude Code CLI que transforma a Claude de un asistente reactivo en un sistema que observa lo que hace, recuerda entre sesiones, verifica su trabajo, se especializa por dominio y evoluciona con el tiempo.

El principio fundamental es `no_context` — si no hay evidencia, no inventar. Nunca alucinar.

### El Mantra

```
Observe → Remember → Verify → Specialize → Evolve
```

| Fase | Que hace | Componentes clave |
|------|----------|-------------------|
| **Observe** | Registra cada operacion, gestiona contexto | observe hooks, `/kompact audit`, `/dashboard` |
| **Remember** | Persiste sesiones, instintos, decisiones | SQLite, `/checkpoint`, `/docs`, `/instinct learn` |
| **Verify** | Tests primero, review, gates de calidad | `/tdd`, `/verify`, `/code-review`, typecheck hooks |
| **Specialize** | Agentes de dominio, skills reutilizables | 14 agentes, 20 skills, `/kplan` |
| **Evolve** | Aprende de sesiones, extrae patrones | `/instinct learn`, `/evolve`, instinct engine |

### Stack tecnologico

| Tecnologia | Rol |
|-----------|-----|
| TypeScript / Node.js | Lenguaje principal, runtime |
| sql.js (WASM) | Base de datos local (SQLite en memoria, persiste a disco) |
| Zod | Validacion de datos en fronteras del sistema |
| Claude API | LLM backend (Opus para arquitectura, Sonnet para implementacion) |
| Vitest | Framework de testing |
| ESLint 9 | Linting con soporte TypeScript |

### Como se conectan los componentes

```
Usuario ejecuta /comando
    ↓
Comando invoca agente (opus o sonnet)
    ↓
Agente aplica skills relevantes
    ↓
Hooks Pre-Tool validan antes de cada operacion
    ↓
Claude ejecuta herramienta (Edit, Bash, etc.)
    ↓
Hooks Post-Tool verifican resultado (typecheck, lint, quality)
    ↓
Observe hooks registran todo a JSONL
    ↓
Al cerrar sesion: hooks Stop persisten a SQLite
```

**Reglas** definen que esta permitido y que no.
**Contextos** modifican el comportamiento segun el modo (dev/research/review).
**Settings.json** registra todos los hooks y permisos.

---

## Seccion 2 — .claude/ (el corazon del harness)

### 2.1 — Agentes (.claude/agents/)

14 archivos markdown que definen el comportamiento de subagentes especializados. Ver `.claude/agents/`.

#### Agentes Opus (5) — decisiones complejas

| Agente | Que hace | Auto-invoca cuando... | Invocacion manual | Output |
|--------|----------|----------------------|-------------------|--------|
| **architect** | Disena sistemas, toma decisiones arquitectonicas. Produce ADRs con Decision/Contexto/Opciones/Consecuencias. | Nunca auto-invoca | `/kplan` (tareas arquitectonicas) | ADR markdown |
| **planner** | Descompone tareas complejas en pasos numerados con verificacion. Identifica dependencias y riesgos. | Nunca auto-invoca | `/kplan` (tareas multi-archivo) | Plan con fases S/M/L |
| **database-reviewer** | Revisa SQL, schemas, migraciones y codigo Supabase. Valida RLS, pgvector, sql.js patterns. | Al editar archivos SQL, schemas o Supabase | — | Schema/Queries/sql.js review |
| **security-reviewer** | Detecta vulnerabilidades: inyeccion SQL, XSS, command injection, path traversal. Severidad CRITICAL/HIGH/MEDIUM/LOW. | Al tocar auth, API keys, exec/spawn, SQL | `/code-review` | Reporte por severidad |
| **harness-optimizer** | Analiza hook latency, instinct quality, skill gaps, cost trends. Nunca auto-aplica cambios. | Nunca auto-invoca | `/evolve` | Reporte con PROMOTE/CREATE/OPTIMIZE |

#### Agentes Sonnet (9) — implementacion y review

| Agente | Que hace | Auto-invoca cuando... | Invocacion manual | Output |
|--------|----------|----------------------|-------------------|--------|
| **code-reviewer** | Revisa calidad de codigo, strict mode, type safety, Node16 resolution. Severidad BLOCK/WARN/NOTE. | Al editar `.ts`/`.tsx` (TypeScript specialist mode), `/checkpoint` | `/code-review` | Review markdown |
| **tdd-guide** | Guia ciclo red-green-refactor. Genera templates de test antes de implementacion. | Nunca auto-invoca | `/tdd` | Test template TypeScript |
| **build-error-resolver** | Diagnostica errores TS2xxx, module resolution, Vitest, sql.js WASM. Fix minimo. | Al fallar compilacion TypeScript o Vitest | `/build-fix` | Error Report estructurado |
| **refactor-cleaner** | Identifica codigo muerto, duplicacion, oportunidades de consolidacion. | Nunca auto-invoca | `/refactor-clean` | Refactoring Summary |
| **performance-optimizer** | Analiza bucles O(n^2), queries lentas, patrones memory-intensive. | Al detectar patrones de baja performance | — | Performance Report |
| **python-reviewer** | Revisa codigo Python: ML, embeddings, backends. | Al editar archivos `.py` | — | Python Review |
| **docs-lookup** | Busca documentacion via Context7 MCP. Fallback a WebSearch. Nunca inventa APIs. | Al referenciar APIs desconocidas | `/docs` | Signature + ejemplo + source |
| **doc-updater** | Actualiza CLAUDE.md, README, counts de componentes. Verifica contra filesystem. | Sugerido tras commits con cambios estructurales | `/update-docs` | Lista de archivos actualizados |
| **e2e-runner** | Ejecuta tests end-to-end: session lifecycle, instinct lifecycle, hook chains. Costoso. | Nunca auto-invoca | `/e2e` | 5 escenarios de test |

---

### 2.2 — Skills (.claude/skills/)

26 archivos markdown que ensenan a Claude patrones especificos. Claude los consulta durante tareas relevantes.

#### TypeScript / Calidad de codigo

| Skill | Que ensena | Cuando se aplica |
|-------|-----------|-----------------|
| **coding-standards** | Naming (camelCase/PascalCase/kebab-case), imports con `node:` prefix, .js extensions | Al escribir cualquier codigo TypeScript |
| **api-design** | Diseno REST/RPC con Zod schemas, error handling, versionado | Al crear endpoints o APIs |
| **claude-api** | Uso correcto de Anthropic SDK: Messages, Tool Use, streaming | Al integrar Claude API en codigo |

#### Base de datos / Supabase

| Skill | Que ensena | Cuando se aplica |
|-------|-----------|-----------------|
| **postgres-patterns** | Indexes, upsert, RLS, pgvector, cheatsheet de SQL | Al escribir queries PostgreSQL |
| **database-migrations** | ALTER TABLE, migraciones Supabase, rollback safe | Al modificar schemas |

#### Testing

| Skill | Que ensena | Cuando se aplica |
|-------|-----------|-----------------|
| **tdd-workflow** | Ciclo red-green-refactor, 80%+ coverage, `:memory:` SQLite | Con `/tdd` o al implementar features |
| **e2e-testing** | Mock vs real matrix, lifecycle rules, cleanup patterns | Con `/e2e` o tests de integracion |
| **verification-loop** | Pipeline de 6 pasos: build, typecheck, test, lint, format, review | Con `/verify` o antes de commit |
| **eval-harness** | Framework de evaluacion: EvalCase interface, scoring rubric 1-5, criteria | Con `/eval` |

#### Investigacion / Documentacion

| Skill | Que ensena | Cuando se aplica |
|-------|-----------|-----------------|
| **search-first** | Buscar en codebase antes de crear codigo nuevo | Antes de cualquier implementacion |
| **architecture-decision-records** | Templates ADR, lifecycle, formato Decision/Context/Options | Al tomar decisiones arquitectonicas |

#### Harness meta-skills

| Skill | Que ensena | Cuando se aplica |
|-------|-----------|-----------------|
| **safety-guard** | 3 layers de proteccion: block-no-verify, config-protection, no-context-guard | Cuando algo es bloqueado por hooks |
| **context-budget** | Gestion de ventana de contexto, cuando compactar | Sesiones largas |
| **strategic-compact** | Cuando y como compactar contexto sin perder informacion critica | Antes de compactacion |
| **continuous-learning-v2** | Instinct lifecycle: create, reinforce, contradict, promote, prune | Con `/instinct learn`, `/evolve` |
| **mcp-server-patterns** | Configuracion MCP, health checks, secrets management | Al integrar MCPs |

#### ToratNetz-especificos

| Skill | Que ensena | Cuando se aplica |
|-------|-----------|-----------------|
| **iterative-retrieval** | RAG loop de 4 fases: dispatch, evaluate, refine, loop. pgvector patterns. | Al construir sistemas RAG |
| **iterative-retrieval-hebrew** | Hebrew/Aramaic RAG: Pesukim, Sugya, Rashi/Ramban, embeddings multilingue | Al trabajar en ToratNetz |

---

### 2.3 — Comandos (.claude/commands/)

17 archivos markdown que definen slash commands. El usuario los invoca con `/nombre`.

#### Observe (2 comandos)

| Comando | Que hace | Cuando usarlo | Ejemplo |
|---------|----------|--------------|---------|
| `/dashboard` | Muestra estado del harness: instintos, sesiones, costos, hook health | Al inicio de sesion o para monitorear | `/dashboard` |
| `/kompact` | Compactacion inteligente; `/kompact audit` audita uso de ventana de contexto | Cuando Claude se pone lento o para compactar | `/kompact audit` |

#### Remember (3 comandos)

| Comando | Que hace | Cuando usarlo | Ejemplo |
|---------|----------|--------------|---------|
| `/checkpoint` | Verifica, commitea y pushea en un solo paso | Al completar una unidad de trabajo | `/checkpoint` |
| `/docs` | Busca documentacion actualizada via Context7 | Antes de usar cualquier API | `/docs supabase-js insert` |
| `/update-docs` | Actualiza CLAUDE.md y README con counts reales | Tras cambios estructurales | `/update-docs` |

#### Verify (7 comandos)

| Comando | Que hace | Cuando usarlo | Ejemplo |
|---------|----------|--------------|---------|
| `/verify` | Typecheck + tests + lint completo; `/verify full` agrega security scan | Antes de cada commit | `/verify` |
| `/tdd` | Inicia ciclo test-first para nueva funcionalidad | Al implementar features nuevas | `/tdd implementar pruneInstincts` |
| `/build-fix` | Diagnostica y arregla errores de compilacion | Cuando TypeScript no compila | `/build-fix` |
| `/code-review` | Revisa calidad de cambios staged o recientes | Antes de merge o commit | `/code-review` |
| `/test-coverage` | Reporta cobertura por archivo | Para identificar gaps de testing | `/test-coverage` |
| `/e2e` | Tests end-to-end de workflows completos (costoso) | Para validacion exhaustiva | `/e2e session lifecycle` |
| `/eval` | Evalua calidad de un agente o skill | Despues de modificar agentes/skills | `/eval security-reviewer` |

#### Specialize (2 comandos)

| Comando | Que hace | Cuando usarlo | Ejemplo |
|---------|----------|--------------|---------|
| `/kplan` | Planifica tareas complejas multi-archivo | Cuando el enfoque es incierto | `/kplan migrar estado a Supabase` |
| `/workflow` | Muestra o guia workflows disponibles (dev, qa, instinct, evolve) | Para seguir un workflow estructurado | `/workflow dev` |

#### Evolve (3 comandos)

| Comando | Que hace | Cuando usarlo | Ejemplo |
|---------|----------|--------------|---------|
| `/instinct` | Gestiona ciclo de instintos: subcomandos `learn`, `status`, `promote`, `prune`, `export`, `eval` | Para todas las operaciones de instintos | `/instinct learn` |
| `/evolve` | Analisis de auto-optimizacion del harness | Periodicamente | `/evolve` |
| `/refactor-clean` | Refactoriza codigo: dead code, duplicacion | Cuando el codigo necesita limpieza | `/refactor-clean state-store.ts` |

---

### 2.4 — Hooks (.claude/hooks/scripts/)

22 hook scripts + 3 utilidades (parse-stdin, generate-session-summary, evaluate-patterns-shared). Se ejecutan automaticamente en respuesta a eventos de Claude Code.

**Codigos de salida:**
- `exit(0)` = permitir la operacion
- `exit(1)` = advertir pero permitir
- `exit(2)` = bloquear la operacion

#### Seguridad (bloquean operaciones peligrosas)

| Hook | Evento | Matcher | Que hace | Exit |
|------|--------|---------|----------|------|
| **block-no-verify** | PreToolUse | Bash | Bloquea `--no-verify` y `--no-gpg-sign` en git | 2 |
| **commit-format-guard** | PreToolUse | Bash | Bloquea commits sin formato convencional (`type(scope): desc`) | 2 |
| **config-protection** | PreToolUse | Edit\|Write | Bloquea edicion de configs criticos (tsconfig, eslint, settings.json) | 2 |
| **no-context-guard** | PreToolUse | Edit\|Write | Bloquea Edit/Write sin Read previo del archivo | 2 |

#### Advertencia (sugieren pero no bloquean)

| Hook | Evento | Matcher | Que hace | Exit |
|------|--------|---------|----------|------|
| **git-push-reminder** | PreToolUse | Bash | Recuerda ejecutar `/verify` antes de git push | 1 |
| **ts-review-reminder** | PostToolUse | Edit\|Write | Advierte tras 5+ ediciones .ts sin code review | 1 |

#### Observacion (registran lo que pasa)

| Hook | Evento | Matcher | Que hace | Exit |
|------|--------|---------|----------|------|
| **observe-pre** | PreToolUse | all | Registra invocacion de herramienta a JSONL (pre-ejecucion) | 0 |
| **observe-post** | PostToolUse | all | Registra resultado de herramienta a JSONL (post-ejecucion) | 0 |

#### Post-edicion (verifican despues de cambios)

| Hook | Evento | Matcher | Que hace | Exit |
|------|--------|---------|----------|------|
| **post-edit-format** | PostToolUse | Edit\|Write | Auto-formatea archivos editados | 0 |
| **post-edit-typecheck** | PostToolUse | Edit\|Write | Ejecuta typecheck en archivos .ts/.tsx editados | 1 si errores |
| **quality-gate** | PostToolUse | Edit\|Write | Ejecuta lint y style checks en archivos editados | 1 si issues |

#### Sesion (inicio y fin)

| Hook | Evento | Matcher | Que hace | Exit |
|------|--------|---------|----------|------|
| **session-start** | SessionStart | all | Inicializa sesion: carga instintos y resumen de sesion anterior | 0 |
| **session-end-persist** | Stop | all | Persiste resumen de sesion y observaciones a SQLite | 0 |
| **evaluate-session** | Stop | all | Evalua calidad de sesion, actualiza confianza de instintos | 0 |
| **cost-tracker** | Stop | all | Registra uso de tokens y costo por sesion | 0 |
| **pre-compact-save** | PreCompact | all | Guarda estado antes de compactacion de contexto | 0 |

#### MCP (monitorean servidores externos)

| Hook | Evento | Matcher | Que hace | Exit |
|------|--------|---------|----------|------|
| **mcp-health-check** | PreToolUse | mcp__ | Valida salud del servidor MCP antes de llamadas | 1 si unhealthy |
| **mcp-health-failure** | PostToolUseFailure | mcp__ | Registra fallos de servidores MCP para diagnostico | 0 |

#### Utilidad

| Archivo | Que hace |
|---------|----------|
| **parse-stdin.js** | Helper que sanitiza backslashes de Windows en JSON stdin. Importado por multiples hooks. |

---

### 2.5 — Rules (.claude/rules/)

14 archivos markdown que definen reglas imperativas. Claude los lee automaticamente segun globs y `alwaysApply`.

#### Rules comunes (9 archivos, `alwaysApply: true`)

| Archivo | Que comportamiento impone | Top 3 reglas | Enforced por |
|---------|--------------------------|-------------|-------------|
| **common/agents.md** | Routing de modelos y cuando invocar agentes | MUST usar opus para architect/planner; ALWAYS security-reviewer para auth/keys; NEVER haiku para review | Routing built-in |
| **common/coding-style.md** | Naming, tipos, imports | MUST camelCase para variables; NEVER usar `any`; MUST `node:` prefix para builtins | post-edit-typecheck, quality-gate |
| **common/development-workflow.md** | Orden de trabajo | ALWAYS Research→Plan→Test→Implement→Review→Commit; ALWAYS /verify antes de /checkpoint; NEVER commit tests rojos | no-context-guard, block-no-verify |
| **common/git-workflow.md** | Commits y branches | MUST conventional commits; NEVER force push a main; NEVER --no-verify | block-no-verify, config-protection |
| **common/hooks.md** | Catalogo de 22 hooks | NEVER crashear Claude Code; MUST try/catch; observe hooks < 50ms | Self-documenting |
| **common/patterns.md** | Patrones de diseno | MUST dependency injection; NEVER global mutable state; MUST context en error messages | no-context-guard |
| **common/performance.md** | Rendimiento | NEVER cargar archivos > 50KB; MUST batch operations en SQLite; PREFER lazy loading | cost-tracker |
| **common/security.md** | Seguridad | NEVER commit secrets; ALWAYS validar input con Zod; NEVER string concat para SQL | security-reviewer, config-protection |
| **common/testing.md** | Testing | MUST 80%+ coverage nuevo codigo; MUST `:memory:` SQLite para tests; MUST Vitest | tdd-guide, post-edit-typecheck |

#### Rules TypeScript (5 archivos, `alwaysApply: false`, globs especificos)

| Archivo | Globs | Que impone | Enforced por |
|---------|-------|-----------|-------------|
| **typescript/coding-style.md** | `**/*.ts,**/*.tsx` | Strict mode, .js extensions, `import type` | code-reviewer (TypeScript specialist mode) |
| **typescript/hooks.md** | `.claude/hooks/scripts/*.js` | parseStdin(), lifecycle hooks desde dist/, `npm run build` | post-edit-typecheck |
| **typescript/patterns.md** | `**/*.ts` | Result pattern, Zod schemas, `catch (e: unknown)` | code-reviewer (TypeScript specialist mode) |
| **typescript/security.md** | `**/*.ts` | Branded types, path.resolve(), parameterized queries | security-reviewer |
| **typescript/testing.md** | `tests/**/*.ts` | vi.fn(), mock externals, close DB en afterEach | tdd-guide |

---

### 2.6 — Contextos (.claude/contexts/)

3 archivos que modifican el comportamiento de Claude segun el modo de trabajo.

| Contexto | Cuando activar | Que cambia | Prioridades |
|----------|---------------|-----------|-------------|
| **dev.md** | Desarrollo activo — implementar features, fix bugs | Todos los hooks activos, TDD enforced, verify antes de commit | Working → Right → Clean |
| **research.md** | Investigacion y exploracion — entender codigo, buscar APIs | Write guards relajados, search-first enfasis, puede desactivar no-context-guard | Understand → Explore → Hypothesis → Verify |
| **review.md** | Code review — revisar PRs, auditar codigo | Read-only preferido, findings por severidad, no implementar | Security → Correctness → Performance → Readability |

**Como activar:** Seleccionar el contexto al inicio de la sesion en Claude Code.

---

### 2.7 — settings.json

Archivo central de configuracion del harness. Controla:

**Hooks:** Registra los 22 hooks con su evento, matcher y comando. Cada hook usa el pattern:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "PATH=\"$PATH:/c/Program Files/nodejs\" node .claude/hooks/scripts/block-no-verify.js"
          }
        ]
      }
    ]
  }
}
```

**Permisos deny:** Protege archivos sensibles de lectura:
```json
"deny": ["Read(./.env)", "Read(./.env.*)", "Read(./secrets/**)"]
```

**Para agregar un nuevo hook:**
1. Crear el script en `.claude/hooks/scripts/nuevo-hook.js`
2. Agregar la entrada en `settings.json` bajo el evento correcto
3. Definir el matcher (Bash, Edit|Write, mcp__, Agent, o vacio para todos)
4. Usar `PATH="$PATH:/c/Program Files/nodejs"` como prefijo del comando (Windows)
5. Actualizar `.claude/rules/common/hooks.md` con la documentacion

---

## Seccion 3 — scripts/

Directorio principal de codigo ejecutable. Todo el TypeScript del harness vive aqui.

### Entry point

| Archivo | Que hace | Como ejecutar |
|---------|----------|--------------|
| **dashboard.ts** | CLI dashboard — carga observaciones de temp y renderiza estado | `npx tsx scripts/dashboard.ts` |

### scripts/lib/ — Librerias compartidas (10 archivos)

| Archivo | Lines | Exports principales | Que hace |
|---------|-------|-------------------|----------|
| **state-store.ts** | 387 | `openDb()`, `closeDb()`, `upsertSession()`, `upsertInstinct()`, `insertCostEvent()` | Capa de persistencia SQLite. Convierte camelCase ↔ snake_case. Persiste a `~/.kadmon/kadmon.db`. |
| **dashboard.ts** | 212 | `renderDashboard()`, `getInstinctRows()`, `getHookHealthRows()` | Renderiza dashboard CLI con ANSI colors. Consulta state-store para datos. |
| **instinct-manager.ts** | 117 | `createInstinct()`, `reinforceInstinct()`, `contradictInstinct()`, `promoteInstinct()`, `pruneInstincts()` | Lifecycle de instintos: crear (0.3), reforzar (+0.1), contradecir, promover (>=0.7), podar. |
| **types.ts** | 109 | `Instinct`, `SessionSummary`, `ObservabilityEvent`, `CostEvent`, `ProjectInfo` | Interfaces TypeScript para todos los modelos de datos del harness. |
| **session-manager.ts** | 80 | `startSession()`, `endSession()`, `getLastSession()`, `loadSessionContext()` | Lifecycle de sesiones: crear, finalizar, cargar contexto previo. |
| **utils.ts** | 54 | `nowISO()`, `generateId()`, `hashString()`, `kadmonDataDir()`, `formatDuration()` | Utilidades: timestamps, UUIDs, hashing SHA256, paths, logging JSON a stderr. |
| **cost-calculator.ts** | 41 | `calculateCost()`, `formatCost()` | Calcula costos LLM por modelo (Opus/Sonnet/Haiku) y tokens. |
| **project-detect.ts** | 29 | `detectProject()` | Detecta proyecto git: remote URL, branch, root dir, project hash. |
| **schema.sql** | 73 | — | Schema SQL con 4 tablas + 8 indexes. Aplicado al inicializar la DB. |
| **sql.js.d.ts** | 28 | `Database`, `Statement`, `SqlJsStatic` | Type definitions para sql.js (WASM SQLite). |

---

## Seccion 4 — src/

**No existe.** Todo el codigo TypeScript vive en `scripts/` y `scripts/lib/`. El proyecto compila a `dist/` via `tsc`.

---

## Seccion 5 — schemas/

3 archivos JSON Schema (draft 2020-12) que validan los modelos de datos del harness.

| Schema | Que valida | Usado por |
|--------|-----------|----------|
| **instinct.schema.json** | Instinct: confidence [0,1], occurrences >= 0, status enum (active/promoted/contradicted/archived) | Validacion en instinct-manager |
| **session.schema.json** | SessionSummary: ID, project_hash, timestamps ISO 8601, arrays de strings | Validacion en session-manager |
| **observability.schema.json** | ObservabilityEvent: event_type enum (tool_pre/tool_post/tool_fail/compaction/hook) | Validacion en observe hooks |

---

## Seccion 6 — tests/

**101 tests en 14 archivos.** Framework: Vitest.

### Como ejecutar

```bash
npx vitest run          # Todos los tests
npx vitest run --watch  # Watch mode
npx vitest run tests/lib/state-store.test.ts  # Un archivo especifico
```

### Tests por categoria

#### Hook tests (7 archivos, ~40 tests)

| Archivo | Tests | Que verifica |
|---------|-------|-------------|
| **block-no-verify.test.ts** | 4 | Bloquea --no-verify, permite comandos normales |
| **commit-format-guard.test.ts** | 8 | Valida formato convencional, soporta HEREDOC y scope |
| **no-context-guard.test.ts** | 6 | Bloquea edicion sin Read previo |
| **observe-pre.test.ts** | 6 | Registra eventos tool_pre a JSONL correctamente |
| **transparency-reminder.test.ts** | 4 | Recuerda anunciar agentes con emojis |
| **ts-review-reminder.test.ts** | 5 | Advierte tras 5+ ediciones .ts sin review |
| **session-start.test.ts** | 0 (skip) | Placeholder — pendiente de implementacion |

#### Library tests (7 archivos, ~61 tests)

| Archivo | Tests | Que verifica |
|---------|-------|-------------|
| **dashboard.test.ts** | 16 | Renderizado de instincts, sessions, hook health, costs |
| **utils.test.ts** | 14 | ID generation, hashing, timestamps, formatDuration |
| **instinct-manager.test.ts** | 11 | Lifecycle completo: create→reinforce→contradict→promote→prune |
| **state-store.test.ts** | 11 | CRUD de sessions, instincts, cost events, sync queue |
| **cost-calculator.test.ts** | 7 | Pricing por modelo, edge cases (zero tokens) |
| **session-manager.test.ts** | 6 | Start/end session, context loading, duracion |
| **project-detect.test.ts** | 3 | Deteccion git, project hashing |

### Como agregar un nuevo test

1. Crear `tests/lib/nuevo-modulo.test.ts` o `tests/hooks/nuevo-hook.test.ts`
2. Importar de Vitest: `import { describe, it, expect } from 'vitest'`
3. Para hooks: usar `execFileSync` con `input` option (Windows-safe)
4. Para DB: usar `:memory:` SQLite, cerrar en `afterEach`
5. Ejecutar: `npx vitest run tests/lib/nuevo-modulo.test.ts`

---

## Seccion 7 — docs/

### Archivos principales

| Archivo | Que cubre |
|---------|----------|
| **GUIDE.md** | Guia de usuario completa: mantra, quick start, 17 comandos, 14 agentes, 20 skills, hooks, instintos, flujo diario |
| **REFERENCE.md** | Este documento — referencia exhaustiva de cada componente |

### Subdirectorios

| Directorio | Contenido |
|-----------|----------|
| **audit/** | Reportes de auditoria. Actualmente: `harness-audit-2026-03-26.md` — auditoria completa con grades A/B/C/F |
| **decisions/** | 5 Architecture Decision Records (ADRs) |
| **plans/** | Planes de implementacion generados por `/kplan` |
| **setup/** | Documentacion de fases de setup inicial (prompt-0A a prompt-8) |
| **design/** | Especificacion de diseno original |
| **analysis/** | Analisis de fase 1 |

### Architecture Decision Records (docs/decisions/)

| ADR | Decision |
|-----|---------|
| **ADR-001** | Dual persistence: SQLite local + Supabase planeado para v2 |
| **ADR-002** | No Bash/Python — solo TypeScript/Node.js |
| **ADR-003** | Single hook profile — un settings.json centralizado |
| **ADR-004** | no-context-guard como hook obligatorio |
| **ADR-005** | Observaciones efimeras en JSONL (temp), persistentes en SQLite |

---

## Seccion 8 — Plugins

### Plugins activos (10)

| Plugin | Version | Que agrega | Comandos clave |
|--------|---------|-----------|---------------|
| **superpowers** | 5.0.6 | Brainstorming, plan writing/execution, TDD, debugging, code review, worktrees | Multiples skills: brainstorming, writing-plans, executing-plans, systematic-debugging |
| **skill-creator** | — | Crear, modificar y evaluar skills | Crear skills, correr evals, benchmark variance |
| **feature-dev** | — | Desarrollo guiado de features con comprension de codebase | code-architect, code-explorer, code-reviewer subagentes |
| **frontend-design** | — | Interfaces frontend production-grade con alto diseno | Genera componentes web, paginas, aplicaciones |
| **claude-md-management** | 1.0.0 | Auditoria y mejora de archivos CLAUDE.md | revise-claude-md, claude-md-improver |
| **claude-code-setup** | 1.0.0 | Analisis de codebase y recomendaciones de automations | claude-automation-recommender |
| **code-simplifier** | 1.0.0 | Simplifica y refina codigo para claridad y mantenibilidad | Revisa codigo modificado recientemente |
| **ralph-loop** | — | Loop de ejecucion recurrente | ralph-loop, cancel-ralph, help |
| **typescript-lsp** | 1.0.0 | TypeScript Language Server Protocol support | Diagnosticos, completions |
| **supabase** | — | Integracion Supabase: DB, auth, storage, edge functions | Via MCP tools |

### Plugins deshabilitados (3)

| Plugin | Razon |
|--------|-------|
| **commit-commands** | Deshabilitado explicitamente — el harness usa commit-format-guard hook y `/checkpoint` en su lugar |
| **hookify** | No instalado — Python/Windows incompatible; el harness implementa hooks nativos en Node.js |
| **security-guidance** | No instalado — duplica funcionalidad del security-reviewer agent |

---

## Seccion 9 — Base de datos SQLite

### Ubicacion

```
~/.kadmon/kadmon.db     # Datos persistentes (sesiones, instintos, costos)
$TMPDIR/kadmon/{sid}/   # Observaciones efimeras (JSONL por sesion)
```

### Tablas

#### sessions
Almacena resumen de cada sesion de Claude Code.

| Columna | Tipo | Descripcion |
|---------|------|------------|
| id | TEXT PK | UUID de sesion |
| project_hash | TEXT | Hash SHA256 del proyecto (primeros 16 chars) |
| started_at / ended_at | TEXT | Timestamps ISO 8601 |
| duration_ms | INTEGER | Duracion en milisegundos |
| branch | TEXT | Git branch activa |
| tasks | TEXT (JSON) | Array de tareas realizadas |
| files_modified | TEXT (JSON) | Array de archivos modificados |
| tools_used | TEXT (JSON) | Array de herramientas usadas |
| message_count | INTEGER | Mensajes intercambiados |
| total_input/output_tokens | INTEGER | Tokens consumidos |
| estimated_cost_usd | REAL | Costo estimado |
| instincts_created | TEXT (JSON) | Instintos generados en esta sesion |
| compaction_count | INTEGER | Veces que se compacto contexto |

#### instincts
Almacena patrones aprendidos con scoring de confianza.

| Columna | Tipo | Descripcion |
|---------|------|------------|
| id | TEXT PK | UUID del instinto |
| project_hash | TEXT | Proyecto asociado |
| pattern | TEXT | El patron aprendido |
| action | TEXT | Accion asociada |
| confidence | REAL (0-1) | Confianza (inicia en 0.3, +0.1 por refuerzo, max 0.9) |
| occurrences | INTEGER | Veces observado |
| contradictions | INTEGER | Veces contradecido |
| source_sessions | TEXT (JSON) | Sesiones donde se observo |
| status | TEXT | 'active', 'promoted', 'contradicted', 'archived' |
| scope | TEXT | 'project' (local) o 'global' (todo el sistema) |
| promoted_to | TEXT | Referencia al skill si fue promovido |

**Lifecycle de un instinto:**
```
Crear (0.3) → Reforzar (+0.1) → ... → Reforzar (0.7+) → Promover a skill
                  ↓ si contradecido
              Contradecir → Archivar (prune despues de 7 dias)
```

#### cost_events
Tracking granular de costos por modelo y tokens.

| Columna | Tipo | Descripcion |
|---------|------|------------|
| id | TEXT PK | UUID del evento |
| session_id | TEXT FK | Sesion asociada |
| model | TEXT | Modelo usado (opus/sonnet/haiku) |
| input_tokens / output_tokens | INTEGER | Tokens de entrada/salida |
| estimated_cost_usd | REAL | Costo estimado |

#### sync_queue
Cola de sincronizacion para futura persistencia en cloud (Supabase v2).

| Columna | Tipo | Descripcion |
|---------|------|------------|
| id | INTEGER PK | Autoincremento |
| table_name | TEXT | Tabla origen |
| record_id | TEXT | ID del registro |
| operation | TEXT | 'insert', 'update', 'delete' |
| payload | TEXT (JSON) | Datos serializados |
| synced_at | TEXT | NULL = pendiente |
| retry_count / last_error | INT/TEXT | Reintentos y errores |

### Como consultar

```bash
npx tsx scripts/dashboard.ts  # Vista rapida con dashboard CLI
```

---

## Seccion 10 — MCPs configurados

3 servidores MCP configurados globalmente en `~/.claude/settings.json`.

| MCP | Tipo | Que habilita | Usado por |
|-----|------|-------------|----------|
| **GitHub** | HTTP (`api.githubcopilot.com/mcp/`) | Buscar codigo, crear PRs/issues, leer archivos, commits, reviews | code-reviewer, doc-updater |
| **Context7** | Comando (`npx -y @upstash/context7-mcp`) | Documentacion actualizada de cualquier libreria: resolve library → fetch docs | docs-lookup agent, `/docs` |
| **Supabase** | HTTP (`mcp.supabase.com/mcp`) | DB operations, auth, storage, edge functions, migrations, SQL execution | database-reviewer, architect |

**Health monitoring:** Los hooks `mcp-health-check` (PreToolUse) y `mcp-health-failure` (PostToolUseFailure) monitorean la salud de los MCPs. Resultados en `$TMPDIR/kadmon/mcp-health.json`.

---

## Seccion 11 — Archivos raiz

| Archivo | Que hace |
|---------|----------|
| **CLAUDE.md** | Documento que Claude lee al inicio de cada sesion. Define: identidad, stack, agents, commands, skills, workflow, transparency mode, memory, hooks, status. Es el "cerebro" del harness. |
| **README.md** | Overview del proyecto para GitHub: componentes, quick start, tabla de agents/skills/commands, attribution. |
| **package.json** | ES Module. Dependencies: sql.js, zod. Scripts: build (tsc + copy schema), test (vitest), typecheck (tsc --noEmit), lint (eslint). Node >= 18. |
| **tsconfig.json** | Target ES2022, module Node16, strict mode. Compila scripts/ y tests/ a dist/. Declaration files habilitados. |
| **eslint.config.js** | ESLint 9 con TypeScript plugin. Aplica a scripts/ y tests/. Ignora dist/, .claude/, node_modules/. Errors en `any`, warns en unused vars. |
| **vitest.config.ts** | **No existe** — usa defaults de Vitest. |
| **.gitignore** | Excluye: node_modules, dist, .env*, .db, logs, OS artifacts. |
| **install.ps1 / install.sh** | **No existen** — la instalacion usa `npm install` (postinstall ejecuta build). |

---

## Seccion 12 — Referencia rapida

### Que uso para...?

| Situacion | Componente |
|-----------|-----------|
| Planear una tarea nueva | `/kplan` → planner agent (opus) |
| Hacer TDD | `/tdd` → tdd-guide agent (sonnet) |
| Revisar codigo antes de commit | `/checkpoint` → code-reviewer agent |
| Ver estado del harness | `/dashboard` |
| Buscar documentacion de una API | `/docs supabase-js insert` → docs-lookup + Context7 MCP |
| Arreglar errores de compilacion | `/build-fix` → build-error-resolver agent |
| Aprender de la sesion | `/instinct learn` |
| Evolucionar el harness | `/evolve` → harness-optimizer agent (opus) |
| Disenar UI (KAIRON/ToratNetz) | `/kplan` con senales de diseno → architect agent |
| Hacer una feature completa | `/kplan` → planner agent |
| Auditar seguridad | `/code-review` → security-reviewer agent (opus) |
| Ver que instintos tiene el harness | `/instinct status` |
| Exportar instintos para backup | `/instinct export` |
| Refactorizar codigo | `/refactor-clean` → refactor-cleaner agent |

### Numeros clave

| Metrica | Valor |
|---------|-------|
| Agentes | 14 (5 opus, 9 sonnet) |
| Skills | 20 |
| Comandos | 17 |
| Hooks | 22 |
| Rules | 14 |
| Contextos | 3 |
| Tests | 154 passing |
| Tablas SQLite | 4 + 8 indexes |
| MCPs | 2 (Supabase, Context7) |
| ADRs | 5 |

---

*Kadmon Harness v0.3 — 14 agentes, 17 comandos, 20 skills, 22 hooks*
*Principio: `no_context` — si no hay evidencia, no inventar.*
