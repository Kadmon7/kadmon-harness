# Pendientes para la laptop — sesión 2026-07-19/20 (Fable)

> Todo el trabajo de esta sesión ya está mergeado a `main`
> (kadmon-harness **PRs #10 / #11 / #12**; ToratNetz **PR #31**).
> Estos **3 pendientes NO se pudieron ejecutar en el runner remoto** —
> hay que correrlos en tu máquina. Borrá este archivo cuando los 3 estén hechos.

---

## 1. `graphify update .` — en LOS DOS repos

El grafo de `graphify-out/` quedó stale: el CLI `graphify` no está instalado en el contenedor remoto,
así que ningún cambio de esta sesión se reflejó en el grafo.

```bash
# en la raíz de kadmon-harness
graphify update .
# y en la raíz de ToratNetz
graphify update .
```

Refresca solo la capa de CÓDIGO (AST, sin costo LLM). Para la capa de docs se necesita un `/graphify`
completo (con costo LLM) — opcional.

---

## 2. kadmon-harness — correr la suite UNA vez en Windows Git Bash

Los fixes de portabilidad (PR #11, 11 tests env-coupled) se verificaron en **Linux**. Falta confirmar
simetría en **Windows** — los tests 5 / 10 / 11 tienen ramas explícitas por plataforma:

```bash
# en la raíz de kadmon-harness, sobre Git Bash
npm run build && npx vitest run
```

Esperado: **1488 passed / 5 skipped / 0 failed**.

---

## 3. ToratNetz — migración `response_snapshot.lang` + decisión starlette/FastAPI

**(a) Migración Alembic — `response_snapshot.lang`**
El breadcrumb `Snippet.lang` (PR #31, kody gap 2) quedó a nivel `Snippet`/`ContextPack`, pero **NO se
persiste** en la tabla `response_snapshot` porque le falta la columna. Requiere DB viva + gate orakle:

```bash
cd backend
alembic revision --autogenerate -m "add lang to response_snapshot"
# revisar la migración generada ANTES de aplicar, luego escribir lang en snapshot_context()
```

**(b) Decisión starlette / FastAPI** — `pip-audit` encontró 7 CVEs en `starlette 0.46.2` cuyo fix
supera el cap de `fastapi==0.115.12` (`<0.47.0`). **Ninguno de los 7 paths vulnerables se usa hoy**.
Decisión tuya: upgrade coordinado de FastAPI o diferir. Detalle frozen en el repo de ToratNetz:
`docs/security/pip-audit-2026-07-19.md`.

---

*Generado por Claude Code (Fable). Este archivo es un recordatorio efímero — no es documentación del
proyecto; borralo cuando termines los 3.*
