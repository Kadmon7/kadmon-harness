---
name: frontend-patterns
description: React and React Native patterns — component composition, compound components via Context, custom hooks (useToggle/useDebounce/useQuery), Context+Reducer state management, performance (memo, useMemo, lazy/Suspense for web, virtualization), Error Boundary, accessibility (keyboard nav, focus management), form handling, Framer Motion / Reanimated animations, and React Native-specific caveats. Use this skill whenever building or reviewing .tsx/.jsx files, web dashboards, or KAIRON mobile components; whenever the user says "React", "React Native", "component", "hook", "state management", "a11y", "Suspense", "memo", or "performance"; and when typescript-reviewer or kody is reviewing frontend code. Also use before picking a data-fetching pattern (custom hook vs SWR vs React Query).
---

# Frontend Development Patterns

Modern React patterns for maintainable, performant user interfaces. Applies to React (web) and React Native (KAIRON).

## When to Use

- Building React components (composition, props, rendering)
- Managing state (useState, useReducer, Context)
- Optimizing performance (memoization, virtualization, code splitting)
- Building accessible, keyboard-navigable UI
- Reviewing .tsx/.jsx files via typescript-reviewer or kody

## Component Composition

```typescript
interface CardProps {
  children: React.ReactNode
  variant?: 'default' | 'outlined'
}

export function Card({ children, variant = 'default' }: CardProps) {
  return <div className={`card card-${variant}`}>{children}</div>
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="card-header">{children}</div>
}

export function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="card-body">{children}</div>
}

// Usage: <Card><CardHeader>Title</CardHeader><CardBody>Content</CardBody></Card>
```

## Compound Components

Share implicit state between related components via Context.

```typescript
interface TabsContextValue {
  activeTab: string
  setActiveTab: (tab: string) => void
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined)

export function Tabs({ children, defaultTab }: {
  children: React.ReactNode
  defaultTab: string
}) {
  const [activeTab, setActiveTab] = useState(defaultTab)
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </TabsContext.Provider>
  )
}

export function Tab({ id, children }: { id: string; children: React.ReactNode }) {
  const context = useContext(TabsContext)
  if (!context) throw new Error('Tab must be used within Tabs')
  return (
    <button
      className={context.activeTab === id ? 'active' : ''}
      onClick={() => context.setActiveTab(id)}
    >
      {children}
    </button>
  )
}
```

## Custom Hooks

### useToggle

```typescript
export function useToggle(initialValue = false): [boolean, () => void] {
  const [value, setValue] = useState(initialValue)
  const toggle = useCallback(() => setValue(v => !v), [])
  return [value, toggle]
}
```

### useDebounce

```typescript
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}
```

### useQuery (async data fetching)

```typescript
export function useQuery<T>(key: string, fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetcher())
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [fetcher])

  useEffect(() => { refetch() }, [key, refetch])
  return { data, error, loading, refetch }
}
```

## State Management: Context + Reducer

```typescript
type Action =
  | { type: 'SET_ITEMS'; payload: Item[] }
  | { type: 'SELECT_ITEM'; payload: Item }
  | { type: 'SET_LOADING'; payload: boolean }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_ITEMS': return { ...state, items: action.payload }
    case 'SELECT_ITEM': return { ...state, selected: action.payload }
    case 'SET_LOADING': return { ...state, loading: action.payload }
    default: return state
  }
}

const AppContext = createContext<{
  state: State; dispatch: Dispatch<Action>
} | undefined>(undefined)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}
```

## Performance

### Memoization

```typescript
// Expensive computations
const sorted = useMemo(() => items.sort((a, b) => b.score - a.score), [items])

// Callbacks passed to children
const handleSearch = useCallback((q: string) => setQuery(q), [])

// Pure components
export const ItemCard = React.memo<ItemCardProps>(({ item }) => (
  <div><h3>{item.name}</h3></div>
))
```

### Code Splitting (React web only -- not React Native)

```typescript
const HeavyChart = lazy(() => import('./HeavyChart'))

export function Dashboard() {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <HeavyChart data={data} />
    </Suspense>
  )
}
```

### Virtualization for Long Lists

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

export function VirtualList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5
  })
  // Render only visible items using virtualizer.getVirtualItems()
}
```

## Error Boundary

```typescript
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })}>Retry</button>
        </div>
      )
    }
    return this.props.children
  }
}
```

## Accessibility

### Keyboard Navigation

```typescript
const handleKeyDown = (e: React.KeyboardEvent) => {
  switch (e.key) {
    case 'ArrowDown': e.preventDefault(); setIndex(i => Math.min(i + 1, max)); break
    case 'ArrowUp': e.preventDefault(); setIndex(i => Math.max(i - 1, 0)); break
    case 'Enter': e.preventDefault(); onSelect(options[index]); break
    case 'Escape': setIsOpen(false); break
  }
}
```

### Focus Management (Modals)

```typescript
export function Modal({ isOpen, onClose, children }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
      modalRef.current?.focus()
    } else {
      previousFocusRef.current?.focus()
    }
  }, [isOpen])

  return isOpen ? (
    <div ref={modalRef} role="dialog" aria-modal="true" tabIndex={-1}
      onKeyDown={e => e.key === 'Escape' && onClose()}>
      {children}
    </div>
  ) : null
}
```

## Form Handling

```typescript
interface FormState {
  values: Record<string, string>
  errors: Record<string, string>
  touched: Record<string, boolean>
}

export function useForm<T extends Record<string, string>>(
  initialValues: T,
  validate: (values: T) => Record<string, string>
) {
  const [state, setState] = useState<FormState>({
    values: initialValues,
    errors: {},
    touched: {}
  })

  const setField = (name: string, value: string) => {
    setState(prev => ({
      ...prev,
      values: { ...prev.values, [name]: value },
      touched: { ...prev.touched, [name]: true }
    }))
  }

  const handleSubmit = (onSubmit: (values: T) => void) => {
    const errors = validate(state.values as T)
    if (Object.keys(errors).length === 0) {
      onSubmit(state.values as T)
    } else {
      setState(prev => ({ ...prev, errors }))
    }
  }

  return { ...state, setField, handleSubmit }
}
```

## Data Fetching Libraries

For production apps, prefer established data-fetching libraries over custom hooks:

| Library | Best For | Key Feature |
|---------|----------|-------------|
| SWR | Simple fetching, revalidation | Stale-while-revalidate pattern |
| React Query (TanStack) | Complex caching, mutations | Cache invalidation, optimistic updates |
| Server Components | Next.js apps | Zero client-side JS for data fetching |

Use the custom `useQuery` hook (above) for simple cases. Upgrade to SWR/React Query when you need cache invalidation, optimistic updates, or pagination support.

## Animation Patterns (Framer Motion)

```typescript
import { motion, AnimatePresence } from 'framer-motion'

// List animation
function AnimatedList({ items }: { items: Item[] }) {
  return (
    <AnimatePresence>
      {items.map(item => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          <ItemCard item={item} />
        </motion.div>
      ))}
    </AnimatePresence>
  )
}
```

For React Native, use `Animated` API or Reanimated 3 instead of Framer Motion.

## React Native Notes

| Pattern | Web | React Native |
|---------|-----|-------------|
| Code splitting (lazy/Suspense) | Supported | Not supported |
| CSS classes | className | StyleSheet.create |
| Virtualization | @tanstack/react-virtual | FlatList (built-in) |
| Animations | Framer Motion / CSS | Animated API / Reanimated |
| Navigation | react-router | React Navigation |

## Integration

- **Agent**: typescript-reviewer (TSX review), kody (code quality)
- **Project**: KAIRON (React Native), future web dashboards
- **For specific React/React Native API questions**: use almanak + Context7

## Gotchas
- Code splitting (lazy/Suspense) is NOT supported in React Native -- only use in web projects
- `useEffect` for derived state is an anti-pattern -- compute derived values during render instead
- Inline objects as props (`style={{ color: 'red' }}`) cause unnecessary re-renders -- hoist or memoize
- `key={index}` in dynamic lists causes bugs when items are added/removed -- use stable unique IDs
- `React.FC` is generally discouraged -- use plain function components with typed props

## no_context Application

When reviewing React code, reads the actual component file before suggesting patterns. For unfamiliar React or React Native APIs, uses almanak + Context7 for current documentation rather than relying on training data.
