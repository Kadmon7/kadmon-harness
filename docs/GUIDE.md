# Kadmon Harness — Guía de Usuario

## 1. ¿Qué es Kadmon Harness?

Kadmon Harness es una capa operativa sobre Claude Code CLI que transforma a Claude de un asistente reactivo en un sistema que **observa, recuerda, verifica, se especializa y evoluciona**. Impone el principio `no_context` — nunca inventar, nunca alucinar — mediante 22 hooks, 14 agentes especializados y un motor de aprendizaje por instintos.

### El Mantra: Observe → Remember → Verify → Specialize → Evolve

| Fase | Qué hace | Componentes clave |
|------|----------|-------------------|
| **Observe** | Registra cada operación, gestiona contexto | observe hooks, `/kompact audit`, `/dashboard` |
| **Remember** | Persiste sesiones, instintos, decisiones | SQLite, sessions, `/checkpoint`, `/docs` |
| **Verify** | Tests primero, review, gates de calidad | `/tdd`, `/verify`, `/code-review`, typecheck hooks |
| **Specialize** | Agentes de dominio, skills reutilizables | 14 agentes, 20 skills, `/kplan` |
| **Evolve** | Aprende de sesiones, extrae patrones | `/instinct learn`, `/evolve`, instinct engine |

### ¿Cómo difiere de Claude Code vanilla?

| Claude Code vanilla | Con Kadmon Harness |
|--------------------|--------------------|
| Sin memoria entre sesiones | SQLite persiste sesiones, instintos y costos |
| Sin verificación automática | Hooks validan tipos, lint y seguridad en cada edit |
| Agente genérico | 14 agentes especializados (5 opus, 9 sonnet) |
| Sin aprendizaje | Motor de instintos con scoring de confianza (0.3→0.9) |
| Sin observabilidad | JSONL por sesión + dashboard CLI |

---

## 2. Quick Start

### Abrir el proyecto
```bash
cd "C:/Proyectos Kadmon/Kadmon-Harness"
claude
```

### Primeras 3 cosas en cada sesión nueva

1. **Verificar que los hooks cargaron** — al iniciar sesión verás:
   ```
   ## Kadmon Session Started
   - Project: 9444ca5b82301f2f
   - Active Instincts (4)
   ```
   Si no aparece este mensaje, los hooks no están funcionando.

2. **Correr el dashboard** para ver estado general:
   ```bash
   npx tsx scripts/dashboard.ts
   ```
   Muestra: instintos activos, últimas sesiones, salud de hooks.

3. **Revisar instintos activos**:
   ```
   /instinct status
   ```
   Muestra confianza, ocurrencias y estado de cada patrón aprendido.

---

## 3. Flujo Diario de Desarrollo

```
Session start ──→ hooks cargan contexto automáticamente
    │
    ├─ /kplan ──→ planificar antes de implementar
    │
    ├─ /tdd ──→ escribir tests primero (RED → GREEN → REFACTOR)
    │
    ├─ [implementar]
    │
    ├─ /verify ──→ typecheck + tests + lint
    │
    ├─ /checkpoint ──→ review + commit + push
    │
    ├─ /instinct learn ──→ extraer instintos de la sesión
    │
Session end ──→ hooks persisten todo a SQLite
```

### Ejemplo concreto

```
> /kplan Agregar búsqueda hebrea a ToratNetz
  → planner agent (opus) analiza el codebase y produce un plan paso a paso
  → plan guardado en docs/plans/

> /tdd Implementar función searchHebrew
  → tdd-guide (sonnet) escribe test fallido primero
  → implementas hasta que pase
  → refactorizas

> /verify
  → npm run build ✓
  → tsc --noEmit ✓
  → vitest run ✓
  → eslint ✓

> /checkpoint
  → code-reviewer valida cambios
  → git commit -m "feat(search): add Hebrew text search"
  → git push

> /instinct learn
  → analiza observaciones de la sesión
  → crea/refuerza instintos basados en patrones detectados
```

---

## 4. Los 17 Comandos

### Observe (2)

| Comando | Cuándo usar | Ejemplo |
|---------|-------------|---------|
| `/dashboard` | Ver estado del harness: instintos, sesiones, costos, hook health | `/dashboard` |
| `/kompact` | Compactación inteligente de contexto; `/kompact audit` para ver uso de ventana | `/kompact audit` |

### Remember (3)

| Comando | Cuándo usar | Ejemplo |
|---------|-------------|---------|
| `/checkpoint` | Guardar progreso — verifica, commitea y pushea | `/checkpoint` |
| `/docs` | Buscar documentación actualizada de cualquier librería | `/docs sql.js prepared statements` |
| `/update-docs` | Actualizar CLAUDE.md y README tras cambios estructurales | `/update-docs` |

### Verify (7)

| Comando | Cuándo usar | Ejemplo |
|---------|-------------|---------|
| `/tdd` | Empezar ciclo test-first para nueva funcionalidad | `/tdd Implementar pruneInstincts` |
| `/verify` | Verificación completa antes de commit; `/verify full` incluye security scan | `/verify` |
| `/build-fix` | Cuando TypeScript no compila | `/build-fix` |
| `/code-review` | Revisar calidad de cambios staged | `/code-review` |
| `/test-coverage` | Ver cobertura por archivo | `/test-coverage` |
| `/e2e` | Tests end-to-end de workflows completos (costoso) | `/e2e session lifecycle` |
| `/eval` | Evaluar calidad de un agente o skill | `/eval security-reviewer` |

### Specialize (2)

| Comando | Cuándo usar | Ejemplo |
|---------|-------------|---------|
| `/kplan` | Tareas complejas, multi-archivo, enfoque incierto | `/kplan Migrar estado a Supabase` |
| `/workflow` | Ver o seguir un workflow guiado (dev, qa, instinct, evolve) | `/workflow dev` |

### Evolve (3)

| Comando | Cuándo usar | Ejemplo |
|---------|-------------|---------|
| `/instinct` | Gestionar ciclo de instintos: `learn`, `status`, `promote`, `prune`, `export`, `eval` | `/instinct learn` |
| `/evolve` | Análisis de auto-optimización del harness | `/evolve` |
| `/refactor-clean` | Refactorizar código (nunca automático) | `/refactor-clean state-store.ts` |

---

## 5. Los 14 Agentes

### Agentes automáticos (Claude los invoca solo)

| Agente | Modelo | Disparador |
|--------|--------|------------|
| code-reviewer | sonnet | Al editar archivos `.ts` o `.tsx` (modo TypeScript specialist) |
| database-reviewer | opus | Al editar SQL, schemas, migraciones, código Supabase |
| security-reviewer | opus | Al tocar auth, API keys, input de usuario, exec/spawn, SQL |
| build-error-resolver | sonnet | Cuando falla compilación TypeScript o Vitest |
| performance-optimizer | sonnet | Al detectar bucles O(n^2), queries lentas, patrones memory-intensive |
| python-reviewer | sonnet | Al editar archivos `.py` |

### Agentes manuales (tú los invocas)

| Agente | Modelo | Comando | Cuándo usarlo |
|--------|--------|---------|---------------|
| architect | opus | `/kplan` | Diseñar sistemas nuevos, decisiones arquitectónicas |
| planner | opus | `/kplan` | Planificar tareas multi-archivo |
| code-reviewer | sonnet | `/code-review`, `/checkpoint` | Antes de cada commit |
| tdd-guide | sonnet | `/tdd` | Desarrollo test-first |
| refactor-cleaner | sonnet | `/refactor-clean` | Limpiar código, eliminar duplicación |
| docs-lookup | sonnet | `/docs` | Buscar API docs actualizadas vía Context7 |
| doc-updater | sonnet | `/update-docs` | Actualizar CLAUDE.md y README |
| e2e-runner | sonnet | `/e2e` | Tests E2E completos (costoso) |
| harness-optimizer | opus | `/evolve` | Análisis de optimización (solo recomendaciones) |

**Regla de modelo**: opus para decisiones complejas (5 agentes), sonnet para implementación (9 agentes). Nunca haiku para review ni seguridad.

---

## 6. Los 20 Skills

### Observe

| Skill | Descripción |
|-------|-------------|
| search-first | Investigar código existente antes de escribir nuevo |
| context-budget | Gestionar ventana de contexto, evitar degradación |

### Remember

| Skill | Descripción |
|-------|-------------|
| architecture-decision-records | Capturar decisiones arquitectónicas como ADRs |
| continuous-learning-v2 | Cómo funciona el sistema de instintos: observación → confianza → promoción |

### Verify

| Skill | Descripción |
|-------|-------------|
| tdd-workflow | RED → GREEN → REFACTOR para cada feature |
| verification-loop | Pipeline completo: build → typecheck → lint → tests → diff |
| safety-guard | Prevenir operaciones destructivas (hooks de bloqueo) |
| receiving-code-review | Recibir y aplicar feedback de code review, priorizar findings |
| systematic-debugging | Diagnóstico estructurado: reproduce, isolate, hypothesize, verify |

### Specialize

| Skill | Descripción |
|-------|-------------|
| coding-standards | Convenciones TypeScript/JS del ecosistema Kadmon |
| api-design | Patrones de diseño REST/RPC para servicios TypeScript |
| orchestration-patterns | Dispatch de agentes, ejecución paralela, plan via subagents |

### Evolve

| Skill | Descripción |
|-------|-------------|
| eval-harness | Framework de evaluación estructurada para agentes/skills |
| e2e-testing | Patrones para tests de workflows completos |

### Dominios técnicos

| Skill | Descripción |
|-------|-------------|
| database-migrations | Evolución segura de schemas SQLite y Supabase |
| postgres-patterns | Best practices PostgreSQL, pgvector, RLS |
| iterative-retrieval | RAG progresivo (pgvector, multi-step retrieval) |
| iterative-retrieval-hebrew | RAG hebreo/arameo: Pesukim, Sugya, embeddings multilingüe |
| mcp-server-patterns | Construir y consumir servidores MCP |
| claude-api | Patrones para Claude API y Anthropic TypeScript SDK |

---

## 7. El Sistema de Hooks

Kadmon tiene **22 hooks** que se ejecutan automáticamente en distintos momentos.

### Hooks de bloqueo (exit 2 — operaciones bloqueadas)

| Hook | Qué bloquea |
|------|-------------|
| block-no-verify | `git commit --no-verify` y similares |
| commit-format-guard | Commits sin formato convencional (`type(scope): desc`) |
| commit-quality | Commits con scope o descripción de baja calidad |
| config-protection | Editar tsconfig.json strict mode, eslint rules |
| no-context-guard | Editar sin haber leído el archivo primero |

### Hooks de advertencia (exit 1 — sugieren pero permiten)

| Hook | Qué advierte |
|------|-------------|
| git-push-reminder | Recuerda ejecutar `/verify` antes de git push |
| ts-review-reminder | Advierte tras 5+ ediciones .ts sin code review |
| console-log-warn | Detecta `console.log()` en código de producción |
| post-edit-typecheck | Corre `tsc --noEmit` en archivos .ts editados |
| quality-gate | Corre ESLint en archivos editados |

### Hooks de observación (registran todo)

| Hook | Qué registra | Latencia |
|------|-------------|----------|
| observe-pre | Cada invocación de herramienta (pre-ejecución) | < 50ms |
| observe-post | Resultado de cada herramienta (post-ejecución) | < 50ms |

### Hooks post-edición (transforman archivos)

| Hook | Qué hace |
|------|----------|
| post-edit-format | Auto-formatea con Prettier después de editar |
| pr-created | Detecta creación de PR y registra la URL |

### Hooks de sesión (persisten estado)

| Hook | Evento | Qué hace |
|------|--------|----------|
| session-start | SessionStart | Inicializa sesion: carga 3 sesiones recientes, muestra historial como trayectoria, "Pending Work" de tasks incompletas, recupera sesiones huerfanas |
| pre-compact-save | PreCompact | Guarda estado y tasks pendientes antes de compactacion de contexto |
| session-end-persist | Stop | Persiste resumen de sesion (summary, task lifecycle, errores) a SQLite |
| evaluate-session | Stop | Extrae patrones, actualiza confianza de instintos |
| cost-tracker | Stop | Calcula y registra costo en tokens por modelo (fallback: estimacion desde observaciones) |
| session-end-marker | Stop | Marca fin limpio de sesion para lifecycle tracking |

### Hooks MCP

| Hook | Qué hace |
|------|----------|
| mcp-health-check | Valida salud del servidor MCP antes de llamadas |
| mcp-health-failure | Registra fallos MCP para diagnóstico |

### Verificar salud de hooks
```bash
npx tsx scripts/dashboard.ts
```
La sección "Hook Health" muestra estado OK/WARN/FAIL basado en observaciones recientes.

---

## 8. Sistema de Memoria

Kadmon opera con **5 capas de memoria**, de más estática a más dinámica:

### Capa 1: CLAUDE.md (tú lo escribes)
- Identidad, stack, agentes, comandos, skills, status
- Se carga automáticamente en cada sesión
- Archivo: `CLAUDE.md` en raíz del proyecto

### Capa 2: Rules (siempre cargadas)
- 15 archivos de reglas en `.claude/rules/`
- Gobiernan: coding style, seguridad, testing, hooks, git, patterns, performance
- Se cargan automáticamente según contexto

### Capa 3: Auto Memory (Claude lo escribe)
- Claude Code guarda memorias en `~/.claude/projects/{project}/memory/`
- Tipos: user, feedback, project, reference, decision, gotcha (6 tipos)
- Índice en `MEMORY.md`
- Persiste entre conversaciones automáticamente

### Capa 4: Observaciones (JSONL efímero)
- Cada sesión genera `$TEMP/kadmon/{sessionId}/observations.jsonl`
- Registra cada tool call (pre y post)
- Al cerrar sesión, `session-end-persist.js` lo resume a SQLite
- `evaluate-session.js` extrae patrones y actualiza instintos

### Capa 5: Instintos Kadmon (SQLite, scoring de confianza)
- Patrones aprendidos almacenados en `~/.kadmon/kadmon.db`
- Ciclo de vida: **creación (0.3)** → **refuerzo (+0.1/ocurrencia)** → **promoción (≥0.7)** → **skill permanente**
- Si las contradicciones superan las ocurrencias → status `contradicted`
- `/instinct prune` archiva instintos débiles (< 0.2 confianza) o contradichos (> 7 días)

### Verificar estado de memoria

```bash
# Dashboard completo (instintos, sesiones, hooks)
npx tsx scripts/dashboard.ts

# Solo instintos activos
/instinct status

# Exportar instintos a JSON
/instinct export
```

---

## 9. Ejemplos Reales

### Ejemplo 1: Construir una nueva feature TypeScript

**Tarea**: Agregar función `exportInstincts()` al instinct-manager.

```
# 1. Planificar
> /kplan Agregar exportInstincts al instinct-manager

  planner (opus) analiza scripts/lib/instinct-manager.ts
  Produce plan: 3 pasos, 2 archivos, complejidad S

# 2. Test first
> /tdd Implementar exportInstincts

  tdd-guide escribe test en tests/lib/instinct-manager.test.ts:
  - test: exporta instintos activos como JSON
  - test: retorna array vacío sin instintos
  - test: incluye metadata de proyecto

  Tests fallan (RED ✗)

# 3. Implementar
  Escribes la función en scripts/lib/instinct-manager.ts
  Hooks automáticos:
  - post-edit-typecheck → verifica tipos ✓
  - quality-gate → ESLint limpio ✓
  - observe-pre/post → registra operaciones

  Tests pasan (GREEN ✓)

# 4. Verificar
> /verify
  Build ✓ | Typecheck ✓ | Tests 78/78 ✓ | Lint ✓

# 5. Commit
> /checkpoint
  code-reviewer valida cambios → PASS
  git commit -m "feat(instincts): add exportInstincts function"
  git push ✓

# 6. Aprender
> /instinct learn
  Detecta patrón: "Read instinct-manager.ts before editing"
  Refuerza instinto existente: confidence 0.3 → 0.4
```

### Ejemplo 2: Debugging un error de build

```
# Error: TypeScript no compila después de editar state-store.ts
> /build-fix
  build-error-resolver (sonnet):
  1. Corre npm run build → lee error
  2. "Property 'syncedAt' does not exist on type 'SyncQueueItem'"
  3. Propone fix: agregar syncedAt?: string a SyncQueueItem
  4. Re-build ✓ | Tests 76/76 ✓
```

### Ejemplo 3: Instalar harness en un proyecto nuevo

```bash
# 1. Copiar estructura .claude/ al proyecto destino
cp -r .claude/ /path/to/ToratNetz/.claude/

# 2. Copiar dependencias necesarias
# En el package.json del proyecto destino, agregar:
#   "sql.js": "^1.14.1"
#   "zod": "^3.23.0"

# 3. Copiar scripts de soporte
cp -r scripts/ /path/to/ToratNetz/scripts/
cp tsconfig.json /path/to/ToratNetz/

# 4. Instalar y compilar
cd /path/to/ToratNetz
npm install
npm run build

# 5. Abrir Claude Code — session-start.js detecta el nuevo proyecto
claude

# La primera sesión:
# - Crea nuevo projectHash basado en git remote
# - Inicializa SQLite vacío en ~/.kadmon/kadmon.db
# - Sin instintos previos — empezará a aprender desde cero
```

---

## 10. Tips & Tricks

1. **Usa `/kompact audit` al inicio de sesiones largas** — te dice cuánto contexto queda y qué está consumiendo más.

2. **Compacta en los momentos correctos** — después de commits, entre features, nunca a mitad de implementación. Usa `/kompact` para un flujo guiado de compactación.

3. **Lee las puntuaciones de instintos** — `/instinct status` muestra barras de confianza:
   - `████████░░` (0.8) = patrón muy confiable
   - `███░░░░░░░` (0.3) = recién creado, necesita validación
   - Promotable: confidence ≥ 0.7 + ocurrencias ≥ 3

4. **Fuerza un aprendizaje con `/instinct learn`** — no esperes al cierre de sesión. Después de un workflow exitoso, extrae patrones inmediatamente.

5. **Si un hook falla**, revisa stderr — todos los hooks imprimen JSON con el error:
   ```bash
   # Revisar salud general
   npx tsx scripts/dashboard.ts
   ```

6. **Bypass temporal de no-context-guard** — solo cuando sea absolutamente necesario:
   ```bash
   KADMON_NO_CONTEXT_GUARD=off
   ```
   Esto desactiva la validación de "leer antes de editar". Úsalo con precaución.

7. **Revisa costos por sesión** — el cost-tracker registra automáticamente. Usa `/dashboard` para ver estimados en USD por sesión.

8. **Extended Thinking** — Claude puede razonar internamente antes de responder:
   - **Alt+T** — toggle extended thinking on/off
   - **Ctrl+O** — ver output de thinking
   - **`MAX_THINKING_TOKENS=10000`** — limitar tokens de razonamiento (variable de entorno)
   - **`alwaysThinkingEnabled`** en `~/.claude/settings.json` — activar/desactivar por defecto
   - Recomendado para: `/kplan`, decisiones arquitectónicas, debugging complejo
   - Desactivar para: edits simples, formatting, lookups (ahorra tokens)

---

## 11. Troubleshooting

### Hooks no disparan
- **Verificar**: ¿Aparece "Kadmon Session Started" al abrir Claude Code?
- **Causa común**: Node.js no está en PATH. Los hooks usan `PATH="$PATH:/c/Program Files/nodejs"`.
- **Fix**: Verificar que `node --version` funciona en terminal.

### SQLite no persiste datos
- **Verificar**: `ls ~/.kadmon/kadmon.db`
- **Causa común**: `npm run build` no se ejecutó — los lifecycle hooks importan desde `dist/`.
- **Fix**: `npm run build` y reiniciar sesión.

### Typecheck falla después de editar
- **Verificar**: El hook `post-edit-typecheck` imprime errores en stderr.
- **Fix rápido**: `/build-fix` invoca build-error-resolver automáticamente.
- **Fix manual**: Leer el error, corregir tipos en `scripts/lib/types.ts`.

### Context7 MCP caído
- **Síntoma**: `/docs` no retorna resultados.
- **Verificar**: El hook `mcp-health-check` muestra warnings si hay > 2 fallos en 5 minutos.
- **Fallback**: docs-lookup agent usa WebSearch como respaldo automático.

### Instintos no se crean
- **Requisito**: La sesión necesita ≥ 10 tool calls para que `evaluate-session.js` active.
- **Fix**: Usa `/instinct learn` manualmente para forzar extracción de patrones.

### Tests fallan en CI pero pasan local
- **Causa común**: Tests dependen de `~/.kadmon/kadmon.db` en lugar de `:memory:`.
- **Regla**: Todo test debe usar `:memory:` SQLite. Verificar con `/test-coverage`.

---

*Kadmon Harness v0.3 — 14 agentes, 17 comandos, 20 skills, 22 hooks, 154 tests*
*Principio: `no_context` — si no hay evidencia, no inventar.*
