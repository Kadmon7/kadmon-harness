# Install Cluster

> 10 nodes

## Key Concepts

- **install-diagnostic-reader.ts** (11 connections) — `scripts/lib/install-diagnostic-reader.ts`
- **readTypedInstallDiagnostics()** (5 connections) — `scripts/lib/install-diagnostic-reader.ts`
- **InstallHealthReport** (5 connections) — `scripts/lib/install-health.ts`
- **isValidEntry()** (3 connections) — `scripts/lib/install-diagnostic-reader.ts`
- **VersionedInstallReport** (2 connections) — `scripts/lib/install-diagnostic-reader.ts`
- **REQUIRED_FIELDS** (2 connections) — `scripts/lib/install-diagnostic-reader.ts`
- **warnDropped()** (2 connections) — `scripts/lib/install-diagnostic-reader.ts`
- **RawReadFn** (1 connections) — `scripts/lib/install-diagnostic-reader.ts`
- **ADR-0028** (1 connections) — `scripts/lib/install-diagnostic-reader.ts`
- **NOTE: validation checks only field PRESENCE, not runtime shape. Consumers** (1 connections) — `scripts/lib/install-diagnostic-reader.ts`

## Relationships

- [Medik ALV Diagnostics](Medik_ALV_Diagnostics.md) (3 shared connections)
- [Install Health Telemetry](Install_Health_Telemetry.md) (2 shared connections)
- [Hook Tests: Install Diagnostic Test](Hook_Tests-_Install_Diagnostic_Test.md) (1 shared connections)
- [Lib Tests: Install Health Test](Lib_Tests-_Install_Health_Test.md) (1 shared connections)

## Source Files

- `scripts/lib/install-diagnostic-reader.ts`
- `scripts/lib/install-health.ts`

## Audit Trail

- EXTRACTED: 33 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*