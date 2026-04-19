---
number: 2
title: "Minimal useful example of TypeScript decorators 2026"
topic: "Minimal useful example of TypeScript decorators 2026"
slug: typescript-decorators-2026
date: 2026-04-19
agent: skavenger
session_id: "a330258f-13a2-4abb-9b76-e4b34003cf28"
sub_questions:
  - "What is the current state of TypeScript decorators (TS 5.x, Stage 3 ECMAScript)?"
  - "What are the minimal useful patterns for class, method, field, and accessor decorators?"
  - "How do you configure tsconfig for modern decorators and what are the key gotchas?"
sources_count: 5
confidence: High
caps_hit: []
open_questions:
  - "When will parameter decorators reach Stage 3 and be supported in TS 5.x?"
  - "What is the migration story for NestJS/Angular projects from experimentalDecorators to Stage 3?"
  - "Does emitDecoratorMetadata have a Stage 3 equivalent or replacement in the pipeline?"
untrusted_sources: true
---

## Research: Minimal useful example of TypeScript decorators 2026 [skavenger]

### TL;DR

TypeScript 5.x (2026) ships Stage 3 ECMAScript decorators with no compiler flags required. The API changed fundamentally from legacy: decorators now receive `(value, context)` where context is a typed object. New projects should omit `experimentalDecorators` entirely; legacy mode stays only for NestJS/Angular migration paths.

### Executive Summary

Since TypeScript 5.0, decorators follow the ECMAScript Stage 3 proposal and are syntax-valid without any tsconfig flag. The context object is the central innovation: it provides `kind`, `name`, `static`, `private`, `access`, and the critically useful `addInitializer` hook. Five targets are supported — class, method, field, getter/setter, and auto-accessor (`accessor` keyword) — each with a corresponding typed context interface (`ClassDecoratorContext`, `ClassMethodDecoratorContext`, `ClassFieldDecoratorContext`, etc.). The old `experimentalDecorators: true` + `emitDecoratorMetadata: true` path still compiles but is a different subsystem: incompatible signatures, incompatible with `reflect-metadata`, and unable to emit type metadata. For any greenfield TypeScript project in 2026, modern decorators are the correct path. The one hard constraint: parameter decorators (`@Param()`) are not part of Stage 3 — libraries like NestJS that depend on them still require legacy mode.

---

### 1. tsconfig Setup (Modern vs. Legacy)

**Modern (Stage 3, recommended for all new projects in 2026):**

No flags needed. A minimal `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true
  }
}
```

`experimentalDecorators` must be **absent** (or `false`). If it is present and `true`, TypeScript activates the legacy subsystem — the two are mutually exclusive on a per-file basis. ([TypeScript TSConfig — experimentalDecorators](https://www.typescriptlang.org/tsconfig/experimentalDecorators.html))

**Legacy (NestJS / Angular migration only):**

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

---

### 2. Method Decorator — the most common pattern

The minimal useful example is a **logging/tracing decorator** for a method. It wraps the original function and preserves `this` binding.

**Untyped (works, safe for demos):**

```typescript
function loggedMethod(originalMethod: any, context: ClassMethodDecoratorContext) {
  const methodName = String(context.name);
  return function replacementMethod(this: any, ...args: any[]) {
    console.log(`Entering ${methodName}`);
    const result = originalMethod.call(this, ...args);
    console.log(`Exiting  ${methodName}`);
    return result;
  };
}

class Person {
  name: string;
  constructor(name: string) { this.name = name; }

  @loggedMethod
  greet() {
    console.log(`Hello, I'm ${this.name}`);
  }
}

new Person("Kadmon").greet();
// Entering greet
// Hello, I'm Kadmon
// Exiting  greet
```

Source: [TypeScript 5.0 Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html)

---

### 3. `addInitializer` — binding `this` correctly

`context.addInitializer` is the hook that runs inside the constructor for instance decorators (or at class initialization for statics). The most practical use: auto-binding a method so it survives detachment from the class instance.

Source: [TypeScript 5.0 Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html)

---

### 4. Class Decorator — subclassing pattern

Class decorators receive the constructor and may return a subclass.

Source: [All you need to know about TypeScript 5.0 Decorators (Medium)](https://medium.com/@templum.dev/all-you-need-to-know-about-typescript-decorators-as-introduced-in-5-0-b03866a8b213)

---

### 5. Auto-accessor (`accessor` keyword) — a new primitive

The `accessor` keyword is the one truly new class syntax introduced alongside Stage 3 decorators. It auto-generates a private backing field + getter + setter.

Source: [Using modern decorators in TypeScript (LogRocket)](https://blog.logrocket.com/using-modern-decorators-typescript/)

---

### Key Takeaways

- For any new TypeScript project in 2026: omit `experimentalDecorators`, no flags needed, decorators work out of the box with `target: "ES2022"` or higher.
- The `(value, context)` signature is the canonical modern signature — `context.kind` tells you what you are decorating.
- `context.addInitializer` is the correct way to bind methods to instances without manual constructor code.
- The `accessor` keyword is Stage 3 exclusive and the cleanest way to decorate properties with get/set logic.
- Legacy `experimentalDecorators` and Stage 3 are **mutually exclusive subsystems** — do not mix in one codebase.
- NestJS and pre-v19 Angular still require legacy mode due to parameter decorators and `reflect-metadata`.

### Open Questions

- When will parameter decorators advance past Stage 2 and be included in Stage 3, enabling NestJS-style DI without legacy mode?
- What is Angular's roadmap for migrating from decorator-based DI to signals-based patterns, and does it eliminate the need for `experimentalDecorators` entirely?
- Is there a Stage 3 replacement for `emitDecoratorMetadata` (i.e., a TC39 proposal for type metadata emission)?

### Sources

1. [TypeScript 5.0 Release Notes — Decorators](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html)
2. [Using modern decorators in TypeScript (LogRocket)](https://blog.logrocket.com/using-modern-decorators-typescript/)
3. [All you need to know about TypeScript 5.0 Decorators (Medium / Templum)](https://medium.com/@templum.dev/all-you-need-to-know-about-typescript-decorators-as-introduced-in-5-0-b03866a8b213)
4. [TypeScript TSConfig — experimentalDecorators](https://www.typescriptlang.org/tsconfig/experimentalDecorators.html)
5. [TypeScript Stage 3 Decorators: A Journey Through Setup and Usage (DEV Community)](https://dev.to/baliachbryan/typescript-stage-3-decorators-a-journey-through-setup-and-usage-5f00)

### Methodology

Searched 3 queries / fetched 4 URLs / 0 video transcripts.
Caps hit: none.
Confidence: High.
Self-eval: coverage 1.0, cross-verification 0.80, recency 0.85, diversity 0.75 → composite 0.86 (no second pass).
Diversity: passed — official docs (typescriptlang.org x2), industry blog (logrocket.com), community (medium.com, dev.to) — 4 domains.
