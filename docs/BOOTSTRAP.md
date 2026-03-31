# Como Crear un Proyecto Encima del Harness

> Esta guia explica como usar el Kadmon Harness como base para un proyecto nuevo.

## Que es el Harness

El Kadmon Harness es un **template operativo para Claude Code**. Le da a Claude:
- **Memoria** — tracking de sesiones, instincts que aprenden tus patrones
- **Calidad** — 22 hooks que validan codigo, previenen errores, y hacen enforce de convenciones
- **Agentes** — 14 agentes especializados (code-reviewer, planner, tdd-guide, etc.)
- **Skills** — 20 documentos de conocimiento que los agentes consultan
- **Comandos** — 17 slash commands (/kplan, /tdd, /verify, /checkpoint, etc.)

Sin el harness, Claude Code opera "crudo" — sin memoria entre sesiones, sin quality gates, sin agentes especializados.

## Como Funciona

Cada proyecto necesita su propio `.claude/` — Claude Code no comparte configuracion entre proyectos. El harness se usa como template: copias la infraestructura, personalizas los agentes/skills para tu dominio, y agregas tu codigo.

```
kadmon-harness/          ← EL TEMPLATE (no se modifica despues de clonar)
  .claude/               ← configuracion de Claude Code
  scripts/lib/           ← infraestructura (state-store, session-manager)
  dist/                  ← codigo compilado (usado por hooks)

tu-proyecto/             ← TU PROYECTO (clonado del template)
  .claude/               ← copiado + personalizado
  scripts/lib/           ← copiado (infraestructura)
  dist/                  ← compilado localmente
  src/                   ← TU CODIGO (nuevo)
  CLAUDE.md              ← adaptado a tu proyecto
```

## Paso a Paso

### 1. Clonar el harness como template

```bash
# Opcion A: Clonar directamente
git clone https://github.com/Kadmon7/kadmon-harness.git mi-proyecto
cd mi-proyecto

# Opcion B: Si ya tienes un repo, copiar la infraestructura
cp -r kadmon-harness/.claude/ mi-proyecto/.claude/
cp -r kadmon-harness/scripts/ mi-proyecto/scripts/
cp kadmon-harness/tsconfig.json mi-proyecto/
cp kadmon-harness/package.json mi-proyecto/  # adaptar despues
```

### 2. Instalar y compilar

```bash
cd mi-proyecto
npm install
npm run build    # compila scripts/lib/ → dist/ (necesario para que los hooks funcionen)
```

### 3. Cambiar el remote de git

```bash
# Si clonaste, apuntar a tu nuevo repo
git remote set-url origin https://github.com/tu-usuario/mi-proyecto.git
# O si es proyecto nuevo:
git remote remove origin
git remote add origin https://github.com/tu-usuario/mi-proyecto.git
```

### 4. Adaptar CLAUDE.md

Reescribir `CLAUDE.md` para tu proyecto. Mantener las secciones de estructura pero cambiar:
- **Stack**: tu stack real (ej: "Supabase + pgvector + React" para ToratNetz)
- **File Structure**: tu estructura de archivos
- **Common Pitfalls**: tus gotchas (ej: "Hebrew text needs RTL handling")
- **Status**: version de tu proyecto

Lo que NO cambiar (viene del harness y sigue aplicando):
- Core Principle (no_context)
- Mantra (Observe → Remember → Verify → Specialize → Evolve)
- Agents, Commands, Skills tables (siguen siendo las mismas)
- Hook System description
- Development Workflow

### 5. Personalizar agentes

En `.claude/agents/`, tienes 14 agentes universales. Puedes:

**Mantener tal cual** (funcionan para cualquier proyecto):
- code-reviewer, planner, architect, tdd-guide, build-error-resolver
- security-reviewer, refactor-cleaner, docs-lookup, doc-updater

**Adaptar** (agregar contexto de tu dominio):
- database-reviewer → agregar patrones de tu schema
- e2e-runner → adaptar a tus workflows

**Crear nuevos** para tu dominio:
```markdown
# Ejemplo: agente para ToratNetz
---
name: hebrew-text-reviewer
description: Review Hebrew/Aramaic text processing code
model: sonnet
tools: Read, Grep, Glob
---
# Hebrew Text Reviewer
## Role
Specialist in Hebrew text processing, RTL handling, and Torah source references...
```

### 6. Personalizar skills

En `.claude/skills/`, tienes 20 skills. Mantener todos los universales y agregar los de tu dominio:

**Universales (mantener)**:
- coding-standards, tdd-workflow, verification-loop, systematic-debugging
- postgres-patterns, database-migrations, api-design
- safety-guard, search-first, context-budget

**Agregar para tu dominio** (ejemplos):
- `hebrew-embeddings.md` — como generar embeddings para texto hebreo
- `supabase-rls-patterns.md` — patrones de Row Level Security
- `react-native-navigation.md` — patrones de navegacion

### 7. Personalizar comandos

Los 17 comandos funcionan tal cual. Si necesitas comandos nuevos, crealos en `.claude/commands/`:

```markdown
---
description: Ingerir texto de Torah en la base de datos
agent: hebrew-text-reviewer
skills: [hebrew-embeddings, postgres-patterns]
---
## Steps
1. Validar formato del texto fuente
2. Tokenizar y generar embeddings
3. Insertar en Supabase con metadata
```

### 8. Personalizar patrones de instincts

Editar `.claude/hooks/pattern-definitions.json` para agregar patrones de tu dominio:
```json
{
  "name": "Validate Hebrew text before embedding",
  "domain": "hebrew",
  "action": "Always validate Hebrew text encoding before generating embeddings",
  ...
}
```

### 9. Limpiar lo que no necesitas

```bash
# Borrar docs del harness (tu proyecto tendra los suyos)
rm -rf docs/genesis docs/audit docs/decisions docs/roadmap

# Borrar tests del harness (escribiras los tuyos)
rm -rf tests/

# Borrar agent-memory del harness
rm -rf .claude/agent-memory/

# Mantener docs/GUIDE.md y docs/REFERENCE.md como referencia
# (o borrarlos si ya los conoces de memoria)
```

### 10. Primera sesion

```bash
# Verificar que todo funciona
npm run build
npx vitest run          # deberia pasar (tests del harness aun presentes si no los borraste)
npx tsx scripts/dashboard.ts   # dashboard vacio pero funcional

# Iniciar Claude Code
claude

# Dentro de Claude Code:
/dashboard              # verificar que hooks funcionan
/kplan                  # planificar tu primer feature
```

## Estructura Final

```
mi-proyecto/
  .claude/
    agents/             ← 14 universales + tus agentes de dominio
    skills/             ← 20 universales + tus skills de dominio
    commands/           ← 17 universales + tus comandos
    hooks/
      scripts/          ← 22 hooks (no tocar, funcionan para cualquier proyecto)
      pattern-definitions.json  ← personalizado con tus patrones
    rules/
      common/           ← 9 reglas universales (no tocar)
      typescript/       ← 6 reglas TS (no tocar)
    settings.json       ← permisos y hook config (raramente se toca)
  scripts/
    lib/                ← infraestructura del harness (no tocar)
    dashboard.ts        ← dashboard CLI
  dist/                 ← compilado (regenerar con npm run build)
  src/                  ← TU CODIGO
  tests/                ← TUS TESTS
  CLAUDE.md             ← adaptado a tu proyecto
  package.json          ← tus dependencias + las del harness
  tsconfig.json         ← config TS
```

## Que Ganas

| Sin Harness | Con Harness |
|-------------|-------------|
| Claude no recuerda sesiones anteriores | Session tracking con summary, files, costs |
| No hay quality gates | 22 hooks: typecheck, lint, no-context-guard, commit format |
| Code review manual | code-reviewer agent auto-invocado en .ts/.tsx |
| No hay patrones aprendidos | Instincts que aprenden tus workflows |
| Comandos basicos de Claude Code | 17 comandos especializados (/kplan, /tdd, /verify...) |
| Sin presupuesto de contexto | Monitoring de contexto, /kompact inteligente |
| Sin dashboard | `/dashboard` con instincts, sesiones, costos, hook health |

## Actualizaciones del Harness

Cuando el harness se actualice (nuevos hooks, agentes mejorados, etc.), puedes traer los cambios:

```bash
# Agregar el harness como remote
git remote add harness https://github.com/Kadmon7/kadmon-harness.git

# Traer cambios
git fetch harness
git diff main harness/main -- .claude/hooks/scripts/  # ver que cambio

# Cherry-pick o merge selectivo
git checkout harness/main -- .claude/hooks/scripts/session-start.js  # traer un hook especifico
```

**No hacer `git merge harness/main`** — eso traeria TODO incluyendo docs, tests, y archivos del harness que no necesitas.
