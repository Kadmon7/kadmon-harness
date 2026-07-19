# Agentic OS Dashboard Patterns

> 16 nodes

## Key Concepts

- **/api/telemetry Data Surface** (4 connections) — `scripts/dashboard-web/index.html`
- **readTypedInstallDiagnostics() Typed Reader Wrapper** (3 connections) — `docs/roadmap/v1.3-medik-expansion.md`
- **Versioned JSON Contracts + Schemas for Harness State** (3 connections) — `docs/roadmap/v2.0-ecc-delta-ports.md`
- **Catalog Panels — Agents / Skills / Commands** (3 connections) — `scripts/dashboard-web/index.html`
- **Instincts Hero Panel (confidence meter + promote-ready)** (3 connections) — `scripts/dashboard-web/index.html`
- **Telemetry Panels — Sessions / Cost / Hook Health / Agent Usage** (3 connections) — `scripts/dashboard-web/index.html`
- **/api/catalog Data Surface** (3 connections) — `scripts/dashboard-web/index.html`
- **10-Second Poll Refresh Loop (setInterval, not SSE)** (3 connections) — `scripts/dashboard-web/index.html`
- **/medik --ALV Shareable Redacted Diagnostic** (2 connections) — `docs/roadmap/v1.3-medik-expansion.md`
- **install-diagnostic.log `_v: 1` Schema Version Field** (2 connections) — `docs/roadmap/v1.3-medik-expansion.md`
- **Live In-Progress Activity Feed via SSE** (1 connections) — `docs/research/research-012-agentic-os-dashboard-ux-patterns.md`
- **Drill-Down From Summary Card to Full Artifact** (1 connections) — `docs/research/research-012-agentic-os-dashboard-ux-patterns.md`
- **Live Token-Burn / Usage-Window Meter** (1 connections) — `docs/research/research-012-agentic-os-dashboard-ux-patterns.md`
- **Double-Cast Overstates Type Guarantee (install-diagnostic-reader)** (1 connections) — `docs/roadmap/v1.3.1-performance-and-quality.md`
- **PROMOTE_CONFIDENCE Threshold (0.7)** (1 connections) — `scripts/dashboard-web/index.html`
- **esc() HTML-Escaping at the Render Boundary** (1 connections) — `scripts/dashboard-web/index.html`

## Relationships

- [Production Roadmap](Production_Roadmap.md) (2 shared connections)
- [Roadmap: V1](Roadmap-_V1.md) (1 shared connections)

## Source Files

- `docs/research/research-012-agentic-os-dashboard-ux-patterns.md`
- `docs/roadmap/v1.3-medik-expansion.md`
- `docs/roadmap/v1.3.1-performance-and-quality.md`
- `docs/roadmap/v2.0-ecc-delta-ports.md`
- `scripts/dashboard-web/index.html`

## Audit Trail

- EXTRACTED: 25 (71%)
- INFERRED: 10 (29%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*