import type { ForgeAuthPrompt } from '../components/ForgeAuthDialog.js'
import { toast } from '../components/Toast.js'
import { useCallback, useEffect, useRef, useState } from '../runtime.js'
import { isAbortError, requestCredential, requestPull, requestPullCheckout, requestPulls, toApiError, type ApiError } from '../lib/api.js'
import { defaultForgeRemote, forgeOf, supportedRemotes } from '../lib/forge.js'
import type { DetailStatus, LoadStatus, PullDetail, PullSummary, RemoteGroup, Translate } from '../types.js'

export interface PullsView {
  /** Supported remotes only; empty when this repository has no forge. */
  remotes: RemoteGroup[]
  remote: string
  state: 'open' | 'all'
  status: LoadStatus
  pulls: PullSummary[]
  error: ApiError | null
  hasMore: boolean
  selected: number | null
  detail: PullDetail | null
  detailStatus: DetailStatus
  detailError: ApiError | null
  authPrompt: ForgeAuthPrompt | null
  authBusy: boolean
  authError: string | null
  checkingOut: number | null
  selectRemote(name: string): void
  setState(state: 'open' | 'all'): void
  refresh(): void
  selectPull(number: number): void
  submitToken(username: string, token: string): Promise<void>
  dismissAuth(): void
  checkout(number: number): Promise<void>
}

export interface UsePullsOptions {
  /** Only load while the PR view is the visible one. */
  active: boolean
  repoRoot: string
  remotes: readonly RemoteGroup[]
  /** Current branch upstream (`origin/main`), used to pick the default remote. */
  upstream: string
  t: Translate
  /** Called after a pull request was checked out, so the panel reloads. */
  onCheckedOut(): void
}

/**
 * Owns the PR view: supported remotes, the paged list, the selected request's
 * detail, credential prompting, and local checkout. Requests stay lazy: while
 * the history or commit view is visible nothing here talks to the network.
 */
export function usePulls({ active, repoRoot, remotes, upstream, t, onCheckedOut }: UsePullsOptions): PullsView {
  const supported = supportedRemotes(remotes)
  const [remote, setRemote] = useState('')
  const [state, setState] = useState<'open' | 'all'>('open')
  const [pulls, setPulls] = useState<PullSummary[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [error, setError] = useState<ApiError | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [detail, setDetail] = useState<PullDetail | null>(null)
  const [detailStatus, setDetailStatus] = useState<DetailStatus>('idle')
  const [detailError, setDetailError] = useState<ApiError | null>(null)
  const [authPrompt, setAuthPrompt] = useState<ForgeAuthPrompt | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [checkingOut, setCheckingOut] = useState<number | null>(null)
  const [reload, setReload] = useState(0)
  const listAbort = useRef<AbortController | null>(null)
  const detailAbort = useRef<AbortController | null>(null)
  /** The next list load skips the host's response cache (manual refresh). */
  const freshRef = useRef(false)

  // Pick a supported remote once the refs tree has loaded.
  useEffect(() => {
    if (!active) return
    if (supported.length === 0) {
      if (remote !== '') setRemote('')
      return
    }
    if (supported.some(item => item.name === remote)) return
    setRemote(defaultForgeRemote(remotes, upstream))
  }, [active, remotes, upstream, remote, supported.length])

  // A different repository, remote, or filter starts from a clean slate.
  useEffect(() => {
    listAbort.current?.abort()
    detailAbort.current?.abort()
    setPulls([])
    setSelected(null)
    setDetail(null)
    setDetailStatus('idle')
    setDetailError(null)
    setError(null)
    setStatus('loading')
    setAuthPrompt(null)
    setAuthError(null)
  }, [repoRoot, remote, state])

  // Leaving the view cancels anything still in flight.
  useEffect(() => {
    if (active) return
    listAbort.current?.abort()
    detailAbort.current?.abort()
  }, [active])

  const promptAuth = useCallback((apiError: ApiError, remoteName: string): void => {
    const details = apiError.details ?? {}
    const forge = forgeOf(remotes, remoteName)
    setAuthError(null)
    setAuthPrompt({
      provider: typeof details.provider === 'string' ? details.provider : forge?.provider ?? '',
      host: typeof details.host === 'string' ? details.host : forge?.host ?? '',
      remote: typeof details.remote === 'string' ? details.remote : remoteName,
      owner: forge?.owner ?? '',
    })
  }, [remotes])

  const selectPull = useCallback(async (number: number, fresh = false): Promise<void> => {
    setSelected(number)
    setDetail(null)
    setDetailStatus('loading')
    setDetailError(null)
    detailAbort.current?.abort()
    const controller = new AbortController()
    detailAbort.current = controller
    try {
      const payload = await requestPull({ path: repoRoot, remote, number, state, fresh }, controller.signal)
      if (controller.signal.aborted) return
      setDetail(payload.pull)
      setDetailStatus('ready')
    } catch (loadError) {
      if (controller.signal.aborted || isAbortError(loadError)) return
      const apiError = toApiError(loadError)
      setDetailError(apiError)
      setDetailStatus('error')
      if (apiError.code === 'forge-auth-required') promptAuth(apiError, remote)
    }
  }, [promptAuth, remote, repoRoot, state])

  // Load one page whenever the view becomes visible or its inputs change.
  useEffect(() => {
    if (!active || repoRoot === '' || remote === '') return undefined
    if (!supported.some(item => item.name === remote)) return undefined
    const fresh = freshRef.current
    freshRef.current = false
    listAbort.current?.abort()
    const controller = new AbortController()
    listAbort.current = controller
    setStatus('loading')
    setError(null)
    requestPulls({ path: repoRoot, remote, state, fresh }, controller.signal)
      .then(payload => {
        if (controller.signal.aborted) return
        setPulls(Array.isArray(payload.pulls) ? payload.pulls : [])
        setHasMore(payload.hasMore === true)
        setStatus('ready')
      })
      .catch(loadError => {
        if (controller.signal.aborted || isAbortError(loadError)) return
        const apiError = toApiError(loadError)
        setError(apiError)
        setStatus('error')
        if (apiError.code === 'forge-auth-required') promptAuth(apiError, remote)
      })
    return () => controller.abort()
  }, [active, promptAuth, reload, remote, repoRoot, state, supported.length])

  // Open the newest pull request after the list arrives.
  useEffect(() => {
    if (status !== 'ready' || pulls.length === 0) return
    if (selected !== null && pulls.some(pull => pull.number === selected)) return
    const first = pulls[0]
    if (first !== undefined) void selectPull(first.number)
  }, [pulls, selected, selectPull, status])

  useEffect(() => () => {
    listAbort.current?.abort()
    detailAbort.current?.abort()
  }, [])

  const selectRemote = useCallback((name: string): void => {
    setRemote(name)
  }, [])

  const refresh = useCallback((): void => {
    freshRef.current = true
    setReload(value => value + 1)
    if (selected !== null) void selectPull(selected, true)
  }, [selected, selectPull])

  const submitToken = useCallback(async (username: string, token: string): Promise<void> => {
    const prompt = authPrompt
    if (prompt === null || authBusy) return
    setAuthBusy(true)
    setAuthError(null)
    try {
      await requestCredential({
        path: repoRoot,
        remote: prompt.remote,
        username,
        password: token,
        forge: true,
      })
      setAuthPrompt(null)
      freshRef.current = true
      setReload(value => value + 1)
      if (selected !== null) void selectPull(selected, true)
    } catch (authFailure) {
      setAuthError(toApiError(authFailure).message)
    } finally {
      setAuthBusy(false)
    }
  }, [authBusy, authPrompt, repoRoot, selected, selectPull])

  const dismissAuth = useCallback((): void => {
    setAuthPrompt(null)
    setAuthError(null)
  }, [])

  const checkout = useCallback(async (number: number): Promise<void> => {
    if (checkingOut !== null || repoRoot === '' || remote === '') return
    setCheckingOut(number)
    try {
      const payload = await requestPullCheckout({ path: repoRoot, remote, number })
      toast(payload.existing
        ? t('pullCheckoutExisting').replace('{branch}', payload.branch)
        : t('pullCheckoutDone').replace('{number}', String(number)).replace('{branch}', payload.branch))
      onCheckedOut()
    } catch (checkoutError) {
      toast(toApiError(checkoutError).message, 'error')
    } finally {
      setCheckingOut(null)
    }
  }, [checkingOut, onCheckedOut, remote, repoRoot, t])

  return {
    remotes: supported,
    remote,
    state,
    status,
    pulls,
    error,
    hasMore,
    selected,
    detail,
    detailStatus,
    detailError,
    authPrompt,
    authBusy,
    authError,
    checkingOut,
    selectRemote,
    setState,
    refresh,
    selectPull: number => { void selectPull(number) },
    submitToken,
    dismissAuth,
    checkout,
  }
}
