# Kadmon Harness — Guia de Uso

> Para la referencia completa de componentes, ver [README.md](../README.md).

---

## 1. Que es Kadmon Harness

Kadmon Harness es una capa operativa sobre Claude Code CLI que transforma a Claude de un asistente reactivo en un sistema que **observa, recuerda, verifica, se especializa y evoluciona**. Impone el principio `no_context` — nunca inventar, nunca alucinar — mediante 20 hooks, 14 agentes especializados y un motor de aprendizaje por instintos.

### El Mantra: Observe -> Remember -> Verify -> Specialize -> Evolve

| Fase | Que hace | Componentes clave |
|------|----------|-------------------|
| **Observe** | Registra cada operacion, gestiona contexto | observe hooks, `/kompact audit`, `/dashboard` |
| **Remember** | Persiste sesiones, instintos, decisiones | SQLite, sessions, `/checkpoint`, `/docs` |
| **Verify** | Tests primero, review, gates de calidad | `/tdd`, `/verify`, `/code-review`, typecheck hooks |
| **Specialize** | Agentes de dominio, skills reutilizables | 14 agentes, 20 skills, `/kplan` |
| **Evolve** | Aprende de sesiones, extrae patrones | `/instinct learn`, `/evolve`, instinct engine |

### Como difiere de Claude Code vanilla

| Claude Code vanilla | Con Kadmon Harness |
|--------------------|--------------------|
| Sin memoria entre sesiones | SQLite persiste sesiones, instintos y costos |
| Sin verificacion automatica | Hooks validan tipos, lint y seguridad en cada edit |
| Agente generico | 14 agentes especializados (5 opus, 9 sonnet) |
| Sin aprendizaje | Motor de instintos con scoring de confianza (0.3->0.9) |
| Sin observabilidad | JSONL por sesion + dashboard CLI |

---

## 2. Quick Start

### Abrir el proyecto
```bash
cd C:/Command-Center/Kadmon-Harness
claude
```

### Primeras 3 cosas en cada sesion nueva

1. **Verificar que los hooks cargaron** — al iniciar sesion veras:
   ```
   ## Kadmon Session Started
   - Project: 9444ca5b82301f2f
   - Active Instincts (4)
   ```
   Si no aparece este mensaje, los hooks no estan funcionando.

2. **Correr el dashboard** para ver estado general:
   ```bash
   npx tsx scripts/dashboard.ts
   ```
   Muestra: instintos activos, ultimas sesiones, salud de hooks.

3. **Revisar instintos activos**:
   ```
   /instinct status
   ```
   Muestra confianza, ocurrencias y estado de cada patron aprendido.

---

## 3. Flujo Diario de Desarrollo

### Manana — Observar y planificar

```bash
# 1. Abrir Claude Code en el proyecto
cd /path/to/proyecto
claude

# 2. Ver estado del harness
/dashboard

# 3. Revisar instintos activos
/instinct status
```

El `/dashboard` muestra instintos activos, sesiones recientes, costos y salud de hooks. Si algun instinto tiene confianza >= 0.7, considera `/instinct promote` para convertirlo en skill.

### Trabajo — Implementar con disciplina

```bash
# 4. Planificar la tarea del dia
/kplan implementar endpoint de busqueda por embedding

# 5. Implementar con TDD
/tdd crear funcion searchByEmbedding

# 6. Verificar despues de implementar
/verify

# 7. Si hay errores de compilacion
/build-fix

# 8. Buscar documentacion cuando sea necesario
/docs supabase-js rpc function
/docs sql.js prepared statements
```

El flujo es siempre: **Plan -> Test -> Implement -> Verify**. Los hooks se encargan de verificar automaticamente (typecheck, lint, quality gate despues de cada edicion).

### Tarde — Revisar y cerrar

```bash
# 9. Revisar codigo antes de commit
/code-review

# 10. Guardar progreso (verifica + commit + push)
/checkpoint

# 11. Extraer patrones aprendidos
/instinct learn

# 12. Si la sesion fue larga, ver costos
/dashboard
```

El `/checkpoint` ejecuta `/verify` automaticamente antes de commitear. Si falla, no commitea.

### Diagrama del flujo completo

```
Session start --> hooks cargan contexto automaticamente
    |
    +- /kplan --> planificar antes de implementar
    |
    +- /tdd --> escribir tests primero (RED -> GREEN -> REFACTOR)
    |
    +- [implementar]
    |
    +- /verify --> typecheck + tests + lint
    |
    +- /checkpoint --> review + commit + push
    |
    +- /instinct learn --> extraer instintos de la sesion
    |
Session end --> hooks persisten todo a SQLite
```

### Ejemplo concreto

```
> /kplan Agregar busqueda hebrea a ToratNetz
  -> konstruct agent (opus) analiza el codebase y produce un plan paso a paso

> /tdd Implementar funcion searchHebrew
  -> tdd-guide (sonnet) escribe test fallido primero
  -> implementas hasta que pase
  -> refactorizas

> /verify
  -> npm run build OK
  -> tsc --noEmit OK
  -> vitest run OK
  -> eslint OK

> /checkpoint
  -> code-reviewer valida cambios
  -> git commit -m "feat(search): add Hebrew text search"
  -> git push

> /instinct learn
  -> analiza observaciones de la sesion
  -> crea/refuerza instintos basados en patrones detectados
```

---

## 4. Los 18 Comandos

### Observe (3)

| Comando | Cuando usar | Ejemplo |
|---------|-------------|---------|
| `/dashboard` | Ver estado del harness: instintos, sesiones, costos, hook health | `/dashboard` |
| `/kompact` | Compactacion inteligente de contexto; `/kompact audit` para ver uso de ventana | `/kompact audit` |
| `/kompas` | Reconstruccion completa de contexto — busca en git, memoria, SQLite, docs | `/kompas` |

### Remember (3)

| Comando | Cuando usar | Ejemplo |
|---------|-------------|---------|
| `/checkpoint` | Guardar progreso — verifica, commitea y pushea | `/checkpoint` |
| `/docs` | Buscar documentacion actualizada de cualquier libreria | `/docs sql.js prepared statements` |
| `/update-docs` | Actualizar CLAUDE.md y README tras cambios estructurales | `/update-docs` |

### Verify (7)

| Comando | Cuando usar | Ejemplo |
|---------|-------------|---------|
| `/tdd` | Empezar ciclo test-first para nueva funcionalidad | `/tdd Implementar pruneInstincts` |
| `/verify` | Verificacion completa antes de commit; `/verify full` incluye security scan | `/verify` |
| `/build-fix` | Cuando TypeScript no compila | `/build-fix` |
| `/code-review` | Revisar calidad de cambios staged | `/code-review` |
| `/test-coverage` | Ver cobertura por archivo | `/test-coverage` |
| `/e2e` | Tests end-to-end de workflows completos (costoso) | `/e2e session lifecycle` |
| `/eval` | Evaluar calidad de un agente o skill | `/eval security-reviewer` |

### Specialize (2)

| Comando | Cuando usar | Ejemplo |
|---------|-------------|---------|
| `/kplan` | Tareas complejas, multi-archivo, enfoque incierto | `/kplan Migrar estado a Supabase` |
| `/workflow` | Ver o seguir un workflow guiado (dev, qa, instinct, evolve) | `/workflow dev` |

### Evolve (3)

| Comando | Cuando usar | Ejemplo |
|---------|-------------|---------|
| `/instinct` | Gestionar ciclo de instintos: `learn`, `status`, `promote`, `prune`, `export`, `eval` | `/instinct learn` |
| `/evolve` | Analisis de auto-optimizacion del harness | `/evolve` |
| `/refactor-clean` | Refactorizar codigo (nunca automatico) | `/refactor-clean state-store.ts` |

### Top 10 comandos mas usados (con detalle)

**1. `/kplan`** — Planificar tareas complejas
```bash
/kplan migrar persistencia de SQLite a Supabase
/kplan implementar busqueda semantica con pgvector
/kplan refactorizar session-manager para soportar multi-proyecto
```
Invoca konstruct (opus). Produce un plan numerado con fases, verificacion por paso, y estimaciones S/M/L.

**2. `/tdd`** — Desarrollo test-first
```bash
/tdd crear funcion calculateConfidence
/tdd implementar endpoint de busqueda por embedding
```
Invoca tdd-guide (sonnet). Genera test primero, espera que falle (red), luego implementa (green), luego refactoriza.

**3. `/verify`** — Verificacion completa
```bash
/verify
```
Ejecuta en orden: build -> typecheck -> tests -> lint. Se detiene al primer fallo.

**4. `/checkpoint`** — Guardar progreso
```bash
/checkpoint
```
Ejecuta /verify, luego code-review, luego commit con formato convencional, luego push.

**5. `/dashboard`** — Ver estado del harness
```bash
/dashboard
```
Muestra: instintos activos con barras de confianza, sesiones recientes, costos, y salud de hooks.

**6. `/docs`** — Buscar documentacion
```bash
/docs supabase-js insert
/docs sql.js prepare statement
/docs zod discriminated union
/docs react-native flatlist
```
Busca via Context7 MCP. Si no encuentra, fallback a WebSearch. Nunca inventa.

**7. `/code-review`** — Revisar codigo
```bash
/code-review
```
Invoca code-reviewer (TypeScript specialist mode) + security-reviewer (si aplica). Findings con severidad BLOCK/WARN/NOTE.

**8. `/instinct learn`** — Extraer patrones
```bash
/instinct learn
```
Analiza la sesion actual y crea instintos con confianza 0.3. Con refuerzo en sesiones futuras, suben a 0.7+ y se promueven a skills.

**9. `/evolve`** — Auto-optimizacion
```bash
/evolve
```
Invoca harness-optimizer (opus). Analiza hook latency, instinct quality, skill gaps, cost trends. Produce recomendaciones — nunca auto-aplica.

**10. `/kompact`** — Compactar contexto
```bash
/kompact          # Compactacion guiada
/kompact audit    # Solo auditar uso de ventana
```
Guarda estado antes de compactar. Usa en sesiones largas cuando Claude se pone lento.

---

## 5. Los 14 Agentes

### Agentes automaticos (Claude los invoca solo)

| Agente | Modelo | Disparador |
|--------|--------|------------|
| code-reviewer | sonnet | Al editar archivos `.ts` o `.tsx` (modo TypeScript specialist) |
| database-reviewer | opus | Al editar SQL, schemas, migraciones, codigo Supabase |
| security-reviewer | opus | Al tocar auth, API keys, input de usuario, exec/spawn, SQL |
| build-error-resolver | sonnet | Cuando falla compilacion TypeScript o Vitest |
| performance-optimizer | sonnet | Al detectar bucles O(n^2), queries lentas, patrones memory-intensive |
| python-reviewer | sonnet | Al editar archivos `.py` |

### Agentes manuales (tu los invocas)

| Agente | Modelo | Comando | Cuando usarlo |
|--------|--------|---------|---------------|
| arkitect | opus | `/kplan` | Disenar sistemas nuevos, decisiones arquitectonicas |
| konstruct | opus | `/kplan` | Planificar tareas multi-archivo |
| code-reviewer | sonnet | `/code-review`, `/checkpoint` | Antes de cada commit |
| tdd-guide | sonnet | `/tdd` | Desarrollo test-first |
| refactor-cleaner | sonnet | `/refactor-clean` | Limpiar codigo, eliminar duplicacion |
| almanak | sonnet | `/docs` | Buscar API docs actualizadas via Context7 |
| doktor | opus | `/update-docs` | Actualizar CLAUDE.md y README |
| e2e-runner | sonnet | `/e2e` | Tests E2E completos (costoso) |
| harness-optimizer | opus | `/evolve` | Analisis de optimizacion (solo recomendaciones) |

**Regla de modelo**: opus para decisiones complejas (5 agentes), sonnet para implementacion (9 agentes). Nunca haiku para review ni seguridad.

---

## 6. Los 20 Skills

### Observe

| Skill | Descripcion |
|-------|-------------|
| search-first | Investigar codigo existente antes de escribir nuevo |
| context-budget | Gestionar ventana de contexto, evitar degradacion |

### Remember

| Skill | Descripcion |
|-------|-------------|
| architecture-decision-records | Capturar decisiones arquitectonicas como ADRs |
| continuous-learning-v2 | Como funciona el sistema de instintos: observacion -> confianza -> promocion |

### Verify

| Skill | Descripcion |
|-------|-------------|
| tdd-workflow | RED -> GREEN -> REFACTOR para cada feature |
| verification-loop | Pipeline completo: build -> typecheck -> lint -> tests -> diff |
| safety-guard | Prevenir operaciones destructivas (hooks de bloqueo) |
| receiving-code-review | Recibir y aplicar feedback de code review, priorizar findings |
| systematic-debugging | Diagnostico estructurado: reproduce, isolate, hypothesize, verify |

### Specialize

| Skill | Descripcion |
|-------|-------------|
| coding-standards | Convenciones TypeScript/JS del ecosistema Kadmon |
| api-design | Patrones de diseno REST/RPC para servicios TypeScript |
| orchestration-patterns | Dispatch de agentes, ejecucion paralela, plan via subagents |

### Evolve

| Skill | Descripcion |
|-------|-------------|
| eval-harness | Framework de evaluacion estructurada para agentes/skills |
| e2e-testing | Patrones para tests de workflows completos |

### Dominios tecnicos

| Skill | Descripcion |
|-------|-------------|
| database-migrations | Evolucion segura de schemas SQLite y Supabase |
| postgres-patterns | Best practices PostgreSQL, pgvector, RLS |
| iterative-retrieval | RAG progresivo (pgvector, multi-step retrieval) |
| iterative-retrieval-hebrew | RAG hebreo/arameo: Pesukim, Sugya, embeddings multilingue |
| mcp-server-patterns | Construir y consumir servidores MCP |
| claude-api | Patrones para Claude API y Anthropic TypeScript SDK |

---

## 7. El Sistema de Hooks

Kadmon tiene **20 hooks** que se ejecutan automaticamente en distintos momentos.

### Hooks de bloqueo (exit 2 — operaciones bloqueadas)

| Hook | Que bloquea |
|------|-------------|
| block-no-verify | `git commit --no-verify` y similares |
| commit-format-guard | Commits sin formato convencional (`type(scope): desc`) |
| commit-quality | Commits con console.log, debugger o secrets en staged |
| config-protection | Editar tsconfig.json strict mode, eslint rules |
| no-context-guard | Editar sin haber leido el archivo primero |

### Hooks de advertencia (exit 1 — sugieren pero permiten)

| Hook | Que advierte |
|------|-------------|
| git-push-reminder | Recuerda ejecutar `/verify` antes de git push |
| ts-review-reminder | Advierte tras 5+ ediciones .ts sin code review |
| console-log-warn | Detecta `console.log()` en codigo de produccion |
| deps-change-reminder | Recuerda correr `/docs` al cambiar dependencias en package.json |
| post-edit-typecheck | Corre `tsc --noEmit` en archivos .ts editados |
| quality-gate | Corre ESLint en archivos editados |

### Hooks de observacion (registran todo)

| Hook | Que registra | Latencia |
|------|-------------|----------|
| observe-pre | Cada invocacion de herramienta (pre-ejecucion) | < 50ms |
| observe-post | Resultado de cada herramienta (post-ejecucion) | < 50ms |

### Hooks post-edicion (transforman archivos)

| Hook | Que hace |
|------|----------|
| post-edit-format | Auto-formatea con Prettier despues de editar |
| pr-created | Detecta creacion de PR y registra la URL |

### Hooks de sesion (persisten estado)

| Hook | Evento | Que hace |
|------|--------|----------|
| session-start | SessionStart | Inicializa sesion: carga 3 sesiones recientes, muestra historial como trayectoria, "Pending Work" de tasks incompletas, recupera sesiones huerfanas |
| pre-compact-save | PreCompact | Guarda estado y tasks pendientes antes de compactacion de contexto |
| session-end-all | Stop | Consolida: persiste sesion + evalua patrones + trackea costo + escribe marcador + log diario |

### Hooks MCP

| Hook | Que hace |
|------|----------|
| mcp-health-check | Valida salud del servidor MCP antes de llamadas |
| mcp-health-failure | Registra fallos MCP para diagnostico |

### Verificar salud de hooks
```bash
npx tsx scripts/dashboard.ts
```
La seccion "Hook Health" muestra estado OK/WARN/FAIL basado en observaciones recientes.

---

## 8. Sistema de Memoria

Kadmon opera con **5 capas de memoria**, de mas estatica a mas dinamica:

### Capa 1: CLAUDE.md (tu lo escribes)
- Identidad, stack, agentes, comandos, skills, status
- Se carga automaticamente en cada sesion
- Archivo: `CLAUDE.md` en raiz del proyecto

### Capa 2: Rules (siempre cargadas)
- 15 archivos de reglas en `.claude/rules/`
- Gobiernan: coding style, seguridad, testing, hooks, git, patterns, performance
- Se cargan automaticamente segun contexto

### Capa 3: Auto Memory (Claude lo escribe)
- Claude Code guarda memorias en `~/.claude/projects/{project}/memory/`
- Tipos: user, feedback, project, reference, decision, gotcha (6 tipos)
- Indice en `MEMORY.md`
- Persiste entre conversaciones automaticamente

### Capa 4: Observaciones (JSONL efimero)
- Cada sesion genera `$TEMP/kadmon/{sessionId}/observations.jsonl`
- Registra cada tool call (pre y post)
- Al cerrar sesion, `session-end-all.js` lo resume a SQLite
- Evalua patrones y actualiza instintos

### Capa 5: Instintos Kadmon (SQLite, scoring de confianza)
- Patrones aprendidos almacenados en `~/.kadmon/kadmon.db`
- Ciclo de vida: **creacion (0.3)** -> **refuerzo (+0.1/ocurrencia)** -> **promocion (>=0.7)** -> **skill permanente**
- Si las contradicciones superan las ocurrencias -> status `contradicted`
- `/instinct prune` archiva instintos debiles (< 0.2 confianza) o contradichos (> 7 dias)

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

**Tarea**: Agregar funcion `exportInstincts()` al instinct-manager.

```
# 1. Planificar
> /kplan Agregar exportInstincts al instinct-manager

  konstruct (opus) analiza scripts/lib/instinct-manager.ts
  Produce plan: 3 pasos, 2 archivos, complejidad S

# 2. Test first
> /tdd Implementar exportInstincts

  tdd-guide escribe test en tests/lib/instinct-manager.test.ts:
  - test: exporta instintos activos como JSON
  - test: retorna array vacio sin instintos
  - test: incluye metadata de proyecto

  Tests fallan (RED)

# 3. Implementar
  Escribes la funcion en scripts/lib/instinct-manager.ts
  Hooks automaticos:
  - post-edit-typecheck -> verifica tipos OK
  - quality-gate -> ESLint limpio OK
  - observe-pre/post -> registra operaciones

  Tests pasan (GREEN)

# 4. Verificar
> /verify
  Build OK | Typecheck OK | Tests 78/78 OK | Lint OK

# 5. Commit
> /checkpoint
  code-reviewer valida cambios -> PASS
  git commit -m "feat(instincts): add exportInstincts function"
  git push OK

# 6. Aprender
> /instinct learn
  Detecta patron: "Read instinct-manager.ts before editing"
  Refuerza instinto existente: confidence 0.3 -> 0.4
```

### Ejemplo 2: Debugging un error de build

```
# Error: TypeScript no compila despues de editar state-store.ts
> /build-fix
  build-error-resolver (sonnet):
  1. Corre npm run build -> lee error
  2. "Property 'syncedAt' does not exist on type 'SyncQueueItem'"
  3. Propone fix: agregar syncedAt?: string a SyncQueueItem
  4. Re-build OK | Tests 76/76 OK
```

### Ejemplo 3: Instalar harness en un proyecto nuevo

```bash
# 1. Copiar estructura .claude/ al proyecto destino
cp -r .claude/ /path/to/nuevo-proyecto/.claude/

# 2. Copiar scripts de soporte
cp -r scripts/ /path/to/nuevo-proyecto/scripts/
cp tsconfig.json /path/to/nuevo-proyecto/

# 3. Copiar dependencias necesarias (en package.json agregar):
#   "sql.js": "^1.14.1"
#   "zod": "^3.23.0"

# 4. Instalar y compilar
cd /path/to/nuevo-proyecto
npm install
npm run build

# 5. Abrir Claude Code — session-start.js detecta el nuevo proyecto
claude

# La primera sesion:
# - Crea nuevo projectHash basado en git remote
# - Inicializa SQLite vacio en ~/.kadmon/kadmon.db
# - Sin instintos previos — empezara a aprender desde cero
```

---

## 10. Usar en ToratNetz

ToratNetz es un sistema RAG (Retrieval-Augmented Generation) para texto Torah, Talmud y comentarios rabinicos. Stack: **Supabase + pgvector + TypeScript**.

### Chunks de texto hebreo

El harness incluye el skill `iterative-retrieval-hebrew` con patrones especificos para texto hebreo/arameo.

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

### pgvector y embeddings

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
```

### RAG pipeline

El skill `iterative-retrieval` define un loop de 4 fases:

```
1. Dispatch — Query inicial -> busqueda vectorial
2. Evaluate — Scoring de chunks por relevancia
3. Refine — Reformular query basado en resultados
4. Loop — Repetir hasta threshold o max iteraciones (3)
```

### Comandos del harness para ToratNetz

```bash
/kplan implementar busqueda semantica de pesukim
/docs supabase pgvector similarity search
/tdd crear funcion matchTorahChunks
/code-review    # auto-invoca database-reviewer en SQL
```

---

## 11. Usar en KAIRON

UNIVERSO KAIRON es un AI companion universe. Stack: **React Native + ElevenLabs voice + Claude Sonnet 4.6**.

### React Native app

```bash
# Planificar una nueva pantalla
/kplan disenar pantalla de chat con CAIO companion

# Buscar docs de React Native
/docs react-native FlatList virtualization

# Implementar con TDD
/tdd crear componente ChatBubble
```

### ElevenLabs voice

| Componente | Tecnologia | Estado |
|-----------|-----------|--------|
| Text-to-Speech | Eleven v3 (GA) | Disponible |
| Transcripcion | Scribe v2 Realtime | Sub-150ms latency |
| LLM en voice agent | Claude Sonnet 4.6 | Soportado en ElevenAgents |
| Interaccion | WebSocket multimodal | En evaluacion |

```bash
/docs elevenlabs-sdk websocket streaming
/kplan integrar ElevenLabs TTS v3 en flujo de chat
```

### Action items (Marzo 2026)

| Prioridad | Accion | Razon |
|-----------|--------|-------|
| **HIGH** | Probar Claude Sonnet 4.6 en ElevenAgents | Unificar LLM entre Harness y voice agent |
| **MEDIUM** | Evaluar WebSocket multimodal de ElevenAgents | Interacciones mas ricas para el companion |
| **MEDIUM** | Revisar Eleven v3 TTS GA | Voz mas expresiva |
| **LOW** | Probar Scribe v2 Realtime | Sub-150ms mejora flujo de conversacion |

---

## 12. Instalar en un Proyecto Nuevo

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

---

## 13. Tips & Tricks

1. **Usa `/kompact audit` al inicio de sesiones largas** — te dice cuanto contexto queda y que esta consumiendo mas.

2. **Compacta en los momentos correctos** — despues de commits, entre features, nunca a mitad de implementacion. Usa `/kompact` para un flujo guiado de compactacion.

3. **Lee las puntuaciones de instintos** — `/instinct status` muestra barras de confianza:
   - `[========  ]` (0.8) = patron muy confiable
   - `[===       ]` (0.3) = recien creado, necesita validacion
   - Promotable: confidence >= 0.7 + ocurrencias >= 3

4. **Fuerza un aprendizaje con `/instinct learn`** — no esperes al cierre de sesion. Despues de un workflow exitoso, extrae patrones inmediatamente.

5. **Si un hook falla**, revisa stderr — todos los hooks imprimen JSON con el error:
   ```bash
   npx tsx scripts/dashboard.ts
   ```

6. **Bypass temporal de no-context-guard** — solo cuando sea absolutamente necesario:
   ```bash
   KADMON_NO_CONTEXT_GUARD=off
   ```
   Esto desactiva la validacion de "leer antes de editar". Usalo con precaucion.

7. **Revisa costos por sesion** — el cost-tracker registra automaticamente. Usa `/dashboard` para ver estimados en USD por sesion.

8. **Extended Thinking** — Claude puede razonar internamente antes de responder:
   - **Alt+T** — toggle extended thinking on/off
   - Recomendado para: `/kplan`, decisiones arquitectonicas, debugging complejo
   - Desactivar para: edits simples, formatting, lookups (ahorra tokens)

---

## 14. Troubleshooting

### Hooks no disparan
- **Verificar**: Aparece "Kadmon Session Started" al abrir Claude Code?
- **Causa comun**: Node.js no esta en PATH. Los hooks usan `PATH="$PATH:/c/Program Files/nodejs"`.
- **Fix**: Verificar que `node --version` funciona en terminal.

### SQLite no persiste datos
- **Verificar**: `ls ~/.kadmon/kadmon.db`
- **Causa comun**: `npm run build` no se ejecuto — los lifecycle hooks importan desde `dist/`.
- **Fix**: `npm run build` y reiniciar sesion.

### Typecheck falla despues de editar
- **Verificar**: El hook `post-edit-typecheck` imprime errores en stderr.
- **Fix rapido**: `/build-fix` invoca build-error-resolver automaticamente.
- **Fix manual**: Leer el error, corregir tipos en `scripts/lib/types.ts`.

### Context7 MCP caido
- **Sintoma**: `/docs` no retorna resultados.
- **Verificar**: El hook `mcp-health-check` muestra warnings si hay > 2 fallos en 5 minutos.
- **Fallback**: almanak agent usa WebSearch como respaldo automatico.

### Instintos no se crean
- **Requisito**: La sesion necesita >= 10 tool calls para que `evaluate-session` active.
- **Fix**: Usa `/instinct learn` manualmente para forzar extraccion de patrones.

### Tests fallan en CI pero pasan local
- **Causa comun**: Tests dependen de `~/.kadmon/kadmon.db` en lugar de `:memory:`.
- **Regla**: Todo test debe usar `:memory:` SQLite. Verificar con `/test-coverage`.

### "no_context: must Read [file] before editing"
- **Causa**: El hook `no-context-guard` bloqueo una edicion porque el archivo no fue leido primero.
- **Solucion**: Leer el archivo antes de editarlo. Esto es intencional.
  ```
  MAL:  Edit src/lib/state-store.ts (sin Read previo)
  BIEN: Read src/lib/state-store.ts -> Edit src/lib/state-store.ts
  ```

### "--no-verify is blocked by Kadmon safety guard"
- **Causa**: El hook `block-no-verify` bloqueo un comando git con `--no-verify`.
- **Solucion**: No hay override — es intencional. Si los pre-commit hooks fallan, arreglar la causa raiz:
  ```bash
  /build-fix    # Si es error de compilacion
  /verify       # Para ver que falla exactamente
  ```

### "config-protection: [file] is a protected config file"
- **Causa**: El hook `config-protection` bloqueo una edicion a un archivo critico.
- **Solucion**: Pedir al arkitect que autorice el cambio:
  ```bash
  /kplan modificar tsconfig.json para agregar paths
  ```

### "conventional commit format required"
- **Causa**: El hook `commit-format-guard` bloqueo un commit con mensaje incorrecto.
- **Solucion**: Usar formato convencional:
  ```
  feat(search): add embedding similarity function
  fix(hooks): correct observe-pre JSONL path on Windows
  docs: update README with consolidated reference
  chore: bump sql.js to 1.15.0
  ```
  Tipos validos: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`, `perf`

### MCP health check warnings
- **Causa**: Un servidor MCP (GitHub, Context7, o Supabase) no respondio correctamente.
- **Solucion**:
  ```bash
  /docs test-connection
  # Si Context7 falla, almanak usa WebSearch como fallback
  # Si GitHub MCP falla, usar gh CLI directamente
  gh pr list
  ```

### TypeScript errors after edit
- **Causa**: El hook `post-edit-typecheck` detecto errores de tipo.
- **Solucion**:
  ```bash
  /build-fix
  # Errores comunes:
  # TS2307 (cannot find module) -> agregar .js extension al import
  # TS7016 (no declaration file) -> agregar @types/paquete
  # TS2345 (argument type) -> verificar tipos con /docs
  ```

### Instintos no se promueven
- **Causa**: Un instinto necesita confianza >= 0.7 y >= 3 ocurrencias para ser promovido.
- **Solucion**: Los instintos inician en 0.3 y suben +0.1 por refuerzo. Se necesitan al menos 4 refuerzos para llegar a 0.7. Esto es por diseno — evita promover patrones prematuros.
  ```bash
  /instinct status   # Ver confianza actual
  /instinct promote  # Promover manualmente si cumple threshold
  ```

---

*Kadmon Harness v0.3 — 14 agentes, 18 comandos, 20 skills, 20 hooks, 180 tests*
*Principio: `no_context` — si no hay evidencia, no inventar.*
