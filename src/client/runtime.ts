import type * as React from 'react'

/**
 * The client bundle is a lazy factory: React only exists once DSH materializes
 * the plugin and hands us the module table. Components and hooks therefore read
 * React through this binding at call time instead of importing it at module
 * scope, which would also bundle a second React copy into the artifact.
 */
let current: typeof React | undefined

export function bindReact(react: typeof React): void {
  current = react
}

export function useReact(): typeof React {
  if (current === undefined) {
    throw new Error('git-suite: React was not bound by the DSH client module loader')
  }
  return current
}

/** JSX factory (`jsxFactory: 'h'`) and explicit element helper. */
export function h(type: React.ElementType, props?: Record<string, unknown> | null, ...children: React.ReactNode[]): React.ReactElement {
  return useReact().createElement(type, props, ...children)
}

export function useState<S>(initialState: S | (() => S)): [S, React.Dispatch<React.SetStateAction<S>>] {
  return useReact().useState(initialState)
}

export function useEffect(effect: React.EffectCallback, deps?: React.DependencyList): void {
  useReact().useEffect(effect, deps)
}

export function useMemo<T>(factory: () => T, deps: React.DependencyList): T {
  return useReact().useMemo(factory, deps)
}

export function useCallback<T extends (...args: never[]) => unknown>(callback: T, deps: React.DependencyList): T {
  return useReact().useCallback(callback, deps)
}

export function useRef<T>(initialValue: T): React.MutableRefObject<T> {
  return useReact().useRef(initialValue)
}
