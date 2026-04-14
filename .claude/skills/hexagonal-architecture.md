---
name: hexagonal-architecture
description: Design, implement, and refactor systems using Ports and Adapters (hexagonal architecture) — domain model, use-case orchestration, inbound/outbound ports, adapters, composition root, testable boundaries. Use this skill whenever building a new feature where long-term maintainability matters, refactoring layered or framework-heavy code where domain logic is tangled with I/O, supporting multiple interfaces for the same use case (HTTP + CLI + worker), replacing infrastructure without rewriting business rules, or when the user says "hexagonal", "ports and adapters", "clean architecture", "domain-driven", "decouple from the framework", "separate business logic from I/O", or "how do I make this testable". Covers TypeScript, Java, Kotlin, and Go.
---

# Hexagonal Architecture (Ports & Adapters)

Keep business logic independent from frameworks, transport, and persistence. The core app depends on **abstract ports**; adapters implement those ports at the edges. Domain doesn't know what database you use, what web framework you ship, or what queue processes events.

## When to Use

- Building new features where long-term maintainability and testability matter
- Refactoring layered or framework-heavy code where domain logic is mixed with I/O
- Supporting multiple interfaces for the same use case (HTTP + CLI + queue worker + cron)
- Replacing infrastructure (database, external APIs, message bus) without rewriting business rules
- When boundaries are unclear and every change ripples across unrelated files

## Core Concepts

- **Domain model** — business rules, entities, and value objects. No framework imports.
- **Use cases (application layer)** — orchestrate domain behavior and workflow steps.
- **Inbound ports** — contracts describing what the application can do (commands, queries, use-case interfaces).
- **Outbound ports** — contracts for dependencies the application needs (repositories, gateways, event publishers, clock, UUID source).
- **Adapters** — infrastructure and delivery implementations of ports (HTTP controllers, DB repositories, queue consumers, SDK wrappers).
- **Composition root** — a single wiring location where concrete adapters are bound to use cases.

Dependency direction is always **inward**:

- Adapters → application / domain
- Application → port interfaces (inbound and outbound contracts)
- Domain → domain-only abstractions (no framework, no infrastructure)
- Domain → nothing external

## Workflow

### Step 1 — Model a use case boundary

Define a single use case with a clear input and output DTO. Keep transport details (Express `req`, GraphQL `context`, job payload wrappers) **outside** this boundary.

### Step 2 — Define outbound ports first

Identify every side effect as a port:

- Persistence: `UserRepositoryPort`
- External calls: `BillingGatewayPort`
- Cross-cutting: `LoggerPort`, `ClockPort`, `UuidPort`

Ports model **capabilities**, not technologies. `OrderRepositoryPort`, not `PostgresOrderRepository`.

### Step 3 — Implement the use case with pure orchestration

The use case class/function receives ports via constructor or arguments. It validates application-level invariants, coordinates domain rules, and returns plain data structures. No framework imports, no direct DB calls.

### Step 4 — Build adapters at the edge

- Inbound adapter converts protocol input (HTTP request) to use-case input.
- Outbound adapter maps app contracts to concrete APIs, ORMs, or query builders.
- All mapping lives in adapters, **never inside use cases**.

### Step 5 — Wire in a composition root

Instantiate adapters, then inject them into use cases. Keep wiring centralized — avoid hidden service-locator behavior.

### Step 6 — Test per boundary

- Unit-test use cases with **fake ports** (in-memory implementations).
- Integration-test adapters with real infrastructure.
- E2E-test user-facing flows through inbound adapters.

## Architecture Diagram

```
Client (HTTP/CLI/Worker)
   │
   ▼
Inbound Adapter  ──calls──▶  UseCase (Application)
                                 │  uses
                                 ▼
                          OutboundPort (Interface)
                                 ▲
                                 │  implements
                          Outbound Adapter  ──▶  DB / API / Queue

UseCase ──▶ DomainModel
```

## Module Layout — feature-first

```
src/
  features/
    orders/
      domain/
        Order.ts
        OrderPolicy.ts
      application/
        ports/
          inbound/
            CreateOrder.ts
          outbound/
            OrderRepositoryPort.ts
            PaymentGatewayPort.ts
        use-cases/
          CreateOrderUseCase.ts
      adapters/
        inbound/
          http/
            createOrderRoute.ts
        outbound/
          postgres/
            PostgresOrderRepository.ts
          stripe/
            StripePaymentGateway.ts
      composition/
        ordersContainer.ts
```

## TypeScript Example

### Port definitions

```typescript
export interface OrderRepositoryPort {
  save(order: Order): Promise<void>
  findById(orderId: string): Promise<Order | null>
}

export interface PaymentGatewayPort {
  authorize(input: { orderId: string; amountCents: number }): Promise<{ authorizationId: string }>
}
```

### Use case — pure orchestration

```typescript
type CreateOrderInput = { orderId: string; amountCents: number }
type CreateOrderOutput = { orderId: string; authorizationId: string }

export class CreateOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepositoryPort,
    private readonly paymentGateway: PaymentGatewayPort,
  ) {}

  async execute(input: CreateOrderInput): Promise<CreateOrderOutput> {
    const order = Order.create({ id: input.orderId, amountCents: input.amountCents })

    const auth = await this.paymentGateway.authorize({
      orderId: order.id,
      amountCents: order.amountCents,
    })

    // markAuthorized returns a new Order — never mutates in place
    const authorized = order.markAuthorized(auth.authorizationId)
    await this.orderRepository.save(authorized)

    return { orderId: order.id, authorizationId: auth.authorizationId }
  }
}
```

### Outbound adapter

```typescript
export class PostgresOrderRepository implements OrderRepositoryPort {
  constructor(private readonly db: SqlClient) {}

  async save(order: Order): Promise<void> {
    await this.db.query(
      'insert into orders (id, amount_cents, status, authorization_id) values ($1, $2, $3, $4)',
      [order.id, order.amountCents, order.status, order.authorizationId],
    )
  }

  async findById(orderId: string): Promise<Order | null> {
    const row = await this.db.oneOrNone('select * from orders where id = $1', [orderId])
    return row ? Order.rehydrate(row) : null
  }
}
```

### Composition root

```typescript
export const buildCreateOrderUseCase = (deps: { db: SqlClient; stripe: StripeClient }) => {
  const orderRepository = new PostgresOrderRepository(deps.db)
  const paymentGateway = new StripePaymentGateway(deps.stripe)
  return new CreateOrderUseCase(orderRepository, paymentGateway)
}
```

## Multi-Language Mapping

Same boundary rules everywhere; only syntax and wiring style change.

- **TypeScript / JavaScript** — ports as interfaces; use cases as classes with constructor injection; explicit factory module for wiring.
- **Java** — packages: `domain`, `application.port.in`, `application.port.out`, `application.usecase`, `adapter.in`, `adapter.out`. Spring `@Service` is optional.
- **Kotlin** — mirrors the Java split. Ports as interfaces; use cases as classes with constructor injection (Koin / Dagger / Spring / manual).
- **Go** — packages: `internal/<feature>/domain`, `application`, `ports`, `adapters/inbound`, `adapters/outbound`. Small interfaces owned by the consuming package; wire in `cmd/<app>/main.go`.

## Anti-Patterns

- Domain entities importing ORM models, web framework types, or SDK clients
- Use cases reading directly from `req`, `res`, or queue metadata
- Returning database rows directly from use cases without mapping
- Adapters calling each other directly instead of flowing through use-case ports
- Dependency wiring spread across many files with hidden global singletons
- One god-use-case that orchestrates everything instead of small focused ones

## Migration Playbook

Refactoring an existing layered system to hexagonal:

1. Pick one vertical slice (single endpoint or job) with frequent change pain.
2. Extract a use-case boundary with explicit input/output types.
3. Introduce outbound ports around existing infrastructure calls.
4. Move orchestration logic from controllers/services into the use case.
5. Keep old adapters, but make them delegate to the new use case.
6. Add tests around the new boundary (unit + adapter integration).
7. Repeat slice-by-slice. **Never a big-bang rewrite.**

### Refactoring principles

- **Strangler approach** — route one use case at a time through new ports/adapters; leave the rest alone
- **Facade first** — wrap legacy services behind outbound ports before replacing internals
- **Composition freeze** — centralize wiring early so new dependencies don't leak into domain or use-case layers
- **Rollback path** — keep a reversible toggle per migrated slice until production behavior is verified

## Testing Strategy

- **Domain tests** — pure business rules, no mocks, no framework setup
- **Use-case unit tests** — orchestration tested with fakes/stubs for outbound ports; assert business outcomes and port interactions
- **Outbound adapter contract tests** — shared contract suites run against each implementation of a port
- **Inbound adapter tests** — verify protocol mapping (HTTP ↔ use-case input/output)
- **Adapter integration tests** — run against real infra for serialization, schema, query behavior, retries, timeouts
- **E2E tests** — critical user journeys through the full stack
- **Refactor safety** — add characterization tests before extraction; keep them until the new boundary is stable

## Best Practices Checklist

- [ ] Domain and use-case layers import only internal types and ports
- [ ] Every external dependency is represented by an outbound port
- [ ] Validation occurs at boundaries (inbound adapter + use-case invariants)
- [ ] Immutable transformations — return new values/entities, don't mutate
- [ ] Errors translated across boundaries (infra errors → app/domain errors)
- [ ] Composition root is explicit and auditable
- [ ] Use cases testable with simple in-memory fakes for ports
- [ ] Refactoring starts from one vertical slice with behavior-preserving tests
- [ ] Language/framework specifics stay in adapters, never in domain rules

## Integration

- **arkitect agent** (opus) — primary owner. arkitect handles architecture decisions and ADRs; this skill is the reference arkitect uses when the design question is "where do the boundaries go".
- **architecture-decision-records skill** — sibling. An ADR captures the *decision* to use hexagonal; this skill explains *how* to apply it. Write the ADR first, then use this skill to implement.
- **api-design skill** — complementary. `api-design` covers the HTTP surface at the inbound adapter boundary; this skill covers what happens after the request enters the hexagon.
- **/abra-kdabra command** — entry point. When a task carries architecture signals, arkitect runs before konstruct and can load this skill during the planning phase.

## no_context Application

Hexagonal recommendations must be grounded in the actual codebase, not in a generic template. Before suggesting "extract a use case", read the existing code to find the real seam — where does transport meet domain? Where are side effects concentrated? A generic "put your business logic in a use case" is not a recommendation; "extract the order-creation flow from `src/routes/orders.ts` lines 34-110 into a `CreateOrderUseCase`, introducing `OrderRepositoryPort` to abstract the raw SQL on line 58" is. The `no_context` principle here means: the refactor plan is derived from the code you just read, not from the textbook pattern.
