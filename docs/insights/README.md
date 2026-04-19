# 📊 docs/insights/

Archivo curado de reportes `/insights` — las analíticas de uso built-in de Claude Code, condensadas a markdown legible para análisis de tendencias a través del tiempo.

---

## 🎯 Por qué existe esta carpeta

`/insights` genera un reporte interactivo HTML + JSON en `~/.claude/usage-data/report.html` cada vez que corre. Ese archivo vive **fuera del repo**, no está versionado, y el JSON raw (~15KB) es impráctico de leer como archivo plano.

Esta carpeta guarda un archivo **curado** de los reportes que valen la pena preservar, rewriteados como markdown escaneable para que puedas:

- Leerlos en GitHub / VS Code sin lanzar el HTML
- Greppear a través de reportes pasados (`grep -r "TDD" docs/insights/`)
- Trackear cómo evoluciona tu workflow en el tiempo
- Identificar fricciones y wins recurrentes entre snapshots

---

## 🛠️ Cómo archivar un reporte nuevo

1. Correr `/insights` en Claude Code
2. Leer el reporte generado (HTML o salida de `/insights` en chat)
3. Pedirle a Claude: **"guarda el insights"** (o abrir sesión, referenciar el JSON, decirle que lo archive)
4. Claude convierte el JSON a un archivo `YYYY-MM-DD-insights.md` siguiendo el template de abajo
5. Commitear con tier `skip` (docs-only, sin runtime change)

> **⚠️ Manual by design.** No cada corrida de `/insights` merece un archivo. Períodos cortos (pocas sesiones) rara vez cargan señal. Archiva cuando el período cubra ≥20 sesiones o cuando algo cambió notablemente (tooling nuevo, shift grande en patrones de fricción).

---

## 📁 Naming convention

```
docs/insights/YYYY-MM-DD-insights.md
```

Date-first porque los snapshots son periódicos, no contra-monótonos (a diferencia de ADRs/plans). El orden es naturalmente cronológico.

---

## 🎨 Estilo visual — emojis semánticos

**📝 Override intencional de la regla global 'no emojis'** — este directorio usa emojis semánticos (no decorativos) por petición explícita del architect para mejorar legibilidad. El override aplica **SOLO a `docs/insights/`**; el resto del repo (research, decisions, plans, roadmap, código, comentarios) mantiene la regla sin emojis de `~/.claude/CLAUDE.md`.

### Emojis con significado fijo

| Emoji | Sección | Propósito |
|-------|---------|-----------|
| 📊 | Header principal | Marca el documento como insights |
| 🎯 | TL;DR | Resumen ejecutivo |
| 🏆 | Wins | Lo que salió chido |
| ⚠️ | Frictions | Lo que salió mal |
| ⚡ | Quick wins | Acciones accionables corto plazo |
| 🎭 | Interaction style | Perfil del architect observado |
| 📈 | Numbers | Métricas cuantitativas |
| ✨ | What's working | Narrativa de wins |
| 🔥 | Where things go wrong | Narrativa de frictions |
| 🚨 🔁 💨 | Friction loops | Marcadores de loops específicos |
| 🧪 | Copyable prompts | Prompts reusables |
| 📋 | CLAUDE.md additions | Reglas sugeridas para el global |
| 🚀 | On the horizon | Workflows ambiciosos futuros |
| 🔍 | Signals to watch | Métricas a monitorear próximo período |
| 🎬 | Fun ending | Cita memorable del período |
| 📌 | Raw data | Link al HTML original |

### Tono — formal pero divertido

Narrativa en **español mexicano casual** (tono del architect), headers/metadata/frontmatter/términos técnicos en **inglés** (greppability + portabilidad).

**Ejemplo del tono esperado:**

- ❌ Evitar: "Claude caves under pressure instead of defending correct positions"
- ✅ Adoptar: "🚨 Claude se dobla bajo presión — tú preguntas 3 veces '¿seguro?' y Claude concede aunque la posición original fuera correcta. Lección: defender evidencia, no complacer."

Inspiración: release notes de Linear/Vercel + retrospectives de equipos ágiles + bitácora con personalidad.

---

## 📐 Estructura del reporte

Cada reporte sigue este skeleton (~250-350 líneas target; compresión vs el JSON raw ~500 líneas):

```markdown
---
date: YYYY-MM-DD
period_from: YYYY-MM-DD
period_to: YYYY-MM-DD
sessions_total: N
sessions_analyzed: N
messages: N
hours: N
commits: N
source: ~/.claude/usage-data/report.html (snapshot archived YYYY-MM-DD)
---

# 📊 Insights — YYYY-MM-DD

> Periodo: **...** · X sesiones · Yh · Z commits

---

## 🎯 TL;DR
### 🏆 Wins (3)
### ⚠️ Frictions (3)
### ⚡ Quick wins (3)

---

## 🎭 Interaction style
<2-3 párrafos del perfil del architect observado ese período>

---

## 📈 Numbers at a glance
<tabla de métricas + tabla de áreas de proyecto>

---

## ✨ What's working
### 🎯 <Patrón 1>
### 🔬 <Patrón 2>
### 🌐 <Patrón 3>

---

## 🔥 Where things go wrong
### 🚨 Loop 1 — <nombre>
> Síntoma / Evidencia / Fix en formato blockquote
### 🔁 Loop 2 — <nombre>
### 💨 Loop 3 — <nombre>

---

## 🧪 Copyable prompts
<3 bloques de código con prompts reusables>

---

## 📋 CLAUDE.md additions worth considering
<3 reglas candidatas con emoji tópico>

---

## 🚀 On the horizon
<3 workflows ambiciosos>

---

## 🔍 Signals to watch next period
<5 métricas/señales para el próximo snapshot>

---

## 🎬 Fun ending
> <cita memorable del período>
<2-3 oraciones de contexto>

---

## 📌 Raw data
→ Fuente original: `~/.claude/usage-data/report.html`
```

---

## 📜 Policy

- **Frecuencia**: mensual-ish. Sin cadencia dura — archiva cuando la señal esté alta.
- **Retención**: todos los reportes archivados se mantienen indefinidamente. Archivos markdown chiquitos, storage barato, valor histórico crece con el tiempo.
- **No automatización**: la conversión es manual by design. Tú filtras qué vale la pena archivar.
- **Manual-gated**: solo se archiva cuando el architect pide explícitamente ("guarda el insights"). No auto-archivado por corrida de `/insights`.
- **Emojis semánticos permitidos** (override documentado arriba).

---

## 📚 Index

<!-- Add newest first -->
- [📊 2026-04-17-insights.md](./2026-04-17-insights.md) — 97 sesiones (38 analizadas), 2026-03-25 → 2026-04-17, 58h, 62 commits
