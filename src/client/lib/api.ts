import type {
  BranchPayload,
  CheckoutPayload,
  ClonePayload,
  CreateWorkspacePayload,
  GenerateMessagePayload,
  PickDirectoryPayload,
  PushTarget,
  SyncAction,
  SyncPayload,
  TagPayload,
} from '../types.js'

export interface ErrorDetails {
  path?: string
  detail?: string
  ref?: string
  hash?: string
  [key: string]: unknown
}

/** A route failure with the host's stable error code and diagnostics. */
export class ApiError extends Error {
  readonly code: string
  readonly details?: ErrorDetails

  constructor(message: string, code: string, details?: ErrorDetails) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
  }
}

export type RequestMode = 'projects' | 'tree' | 'branches' | 'log' | 'commit' | 'switch' | 'status' | 'workspace-diff'

export interface RequestParams {
  mode: RequestMode
  path?: string | null
  limit?: string
  offset?: string
  scope?: 'all' | 'remotes' | 'stash' | 'staged' | 'unstaged' | 'untracked'
  ref?: string
  hash?: string
  file?: string
  sort?: 'date' | 'topo'
  remotes?: '1'
}

interface ErrorPayload {
  ok?: boolean
  error?: { code?: string; message?: string; details?: ErrorDetails }
}

/** Fetch one JSON payload from the plugin's route. */
export async function requestJson<T>(
  params: RequestParams,
  signal?: AbortSignal,
  method: 'GET' | 'POST' = 'GET',
): Promise<T> {
  // Read modes use the GET-only resource route; the branch switch is a POST
  // handler because DSH resource routes answer 405 for non-GET methods.
  const endpoint = params.mode === 'switch' ? '/git-suite/switch' : '/git-suite'
  const url = new URL(endpoint, window.location.origin)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  }
  const response = await fetch(url, {
    method,
    signal,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'x-dsh-git-suite': '1' },
  })
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  const parsed = payload as ErrorPayload | null
  if (response.ok && parsed?.ok === true) return payload as T
  throw new ApiError(
    parsed?.error?.message ?? `Request failed with HTTP ${response.status}`,
    parsed?.error?.code ?? 'request-failed',
    parsed?.error?.details,
  )
}

export function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError'
}

export type WorkspaceAction = 'stage' | 'unstage' | 'commit'

export interface WorkspaceActionRequest {
  action: WorkspaceAction
  path: string
  paths?: string[]
  all?: boolean
  message?: string
  amend?: boolean
  push?: boolean
}

/** POST a workspace mutation; resource routes are GET-only, so this uses the action handler. */
export async function requestAction<T>(body: WorkspaceActionRequest, signal?: AbortSignal): Promise<T> {
  const response = await fetch(new URL('/git-suite/action', window.location.origin), {
    method: 'POST',
    signal,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      'x-dsh-git-suite': '1',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  const parsed = payload as ErrorPayload | null
  if (response.ok && parsed?.ok === true) return payload as T
  throw new ApiError(
    parsed?.error?.message ?? `Request failed with HTTP ${response.status}`,
    parsed?.error?.code ?? 'request-failed',
    parsed?.error?.details,
  )
}

export interface CloneRequest {
  url: string
  path: string
}

/** POST /git-suite/clone; the destination must not exist yet. */
export async function requestClone(body: CloneRequest, signal?: AbortSignal): Promise<ClonePayload> {
  const response = await fetch(new URL('/git-suite/clone', window.location.origin), {
    method: 'POST',
    signal,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      'x-dsh-git-suite': '1',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  const parsed = payload as ErrorPayload | null
  if (response.ok && parsed?.ok === true) return payload as ClonePayload
  throw new ApiError(
    parsed?.error?.message ?? `Request failed with HTTP ${response.status}`,
    parsed?.error?.code ?? 'request-failed',
    parsed?.error?.details,
  )
}

export interface GenerateMessageRequest {
  path: string
}

/** POST /git-suite/generate-message; the host summarizes the staged (or unstaged) diff with the default model. */
export async function requestGenerateMessage(
  body: GenerateMessageRequest,
  signal?: AbortSignal,
): Promise<GenerateMessagePayload> {
  const response = await fetch(new URL('/git-suite/generate-message', window.location.origin), {
    method: 'POST',
    signal,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      'x-dsh-git-suite': '1',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  const parsed = payload as ErrorPayload | null
  if (response.ok && parsed?.ok === true) return payload as GenerateMessagePayload
  throw new ApiError(
    parsed?.error?.message ?? `Request failed with HTTP ${response.status}`,
    parsed?.error?.code ?? 'request-failed',
    parsed?.error?.details,
  )
}

/** POST /git-suite/pick-directory; the host opens its native directory chooser. */
export async function requestPickDirectory(
  mode: 'repo' | 'directory' = 'repo',
  signal?: AbortSignal,
): Promise<PickDirectoryPayload> {
  const response = await fetch(new URL('/git-suite/pick-directory', window.location.origin), {
    method: 'POST',
    signal,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      'x-dsh-git-suite': '1',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ mode }),
  })
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  const parsed = payload as ErrorPayload | null
  if (response.ok && parsed?.ok === true) return payload as PickDirectoryPayload
  throw new ApiError(
    parsed?.error?.message ?? `Request failed with HTTP ${response.status}`,
    parsed?.error?.code ?? 'request-failed',
    parsed?.error?.details,
  )
}

export interface CreateWorkspaceRequest {
  path: string
}

/** POST /git-suite/create-workspace; registers the repository directory as a DSH workspace. */
export async function requestCreateWorkspace(
  body: CreateWorkspaceRequest,
  signal?: AbortSignal,
): Promise<CreateWorkspacePayload> {
  const response = await fetch(new URL('/git-suite/create-workspace', window.location.origin), {
    method: 'POST',
    signal,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      'x-dsh-git-suite': '1',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  const parsed = payload as ErrorPayload | null
  if (response.ok && parsed?.ok === true) return payload as CreateWorkspacePayload
  throw new ApiError(
    parsed?.error?.message ?? `Request failed with HTTP ${response.status}`,
    parsed?.error?.code ?? 'request-failed',
    parsed?.error?.details,
  )
}

async function postCommitJson<T>(endpoint: string, body: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch(new URL(endpoint, window.location.origin), {
    method: 'POST',
    signal,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      'x-dsh-git-suite': '1',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  const parsed = payload as ErrorPayload | null
  if (response.ok && parsed?.ok === true) return payload as T
  throw new ApiError(
    parsed?.error?.message ?? `Request failed with HTTP ${response.status}`,
    parsed?.error?.code ?? 'request-failed',
    parsed?.error?.details,
  )
}

export interface TagRequest {
  path: string
  hash: string
  name: string
  message?: string
  force?: boolean
}

/** POST /git-suite/tag: create or force-move a tag at one commit. */
export async function requestTag(body: TagRequest, signal?: AbortSignal): Promise<TagPayload> {
  return postCommitJson<TagPayload>('/git-suite/tag', body, signal)
}

export interface BranchRequest {
  path: string
  hash: string
  name: string
}

/** POST /git-suite/branch: create a local branch at one commit. */
export async function requestBranch(body: BranchRequest, signal?: AbortSignal): Promise<BranchPayload> {
  return postCommitJson<BranchPayload>('/git-suite/branch', body, signal)
}

export interface CheckoutRequest {
  path: string
  hash?: string
  branch?: string
}

/** POST /git-suite/checkout: switch to a local branch or detach HEAD at a commit. */
export async function requestCheckout(body: CheckoutRequest, signal?: AbortSignal): Promise<CheckoutPayload> {
  return postCommitJson<CheckoutPayload>('/git-suite/checkout', body, signal)
}

export interface SyncRequest {
  action: SyncAction
  path: string
  remote?: string
  branch?: string
  refs?: PushTarget[]
  tags?: boolean
  force?: boolean
  fetchAll?: boolean
  prune?: boolean
  forceTags?: boolean
}

/** POST /git-suite/sync: fetch all remotes, or pull/push an explicit remote branch. */
export async function requestSync(body: SyncRequest, signal?: AbortSignal): Promise<SyncPayload> {
  return postCommitJson<SyncPayload>('/git-suite/sync', body, signal)
}

export function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError(error instanceof Error ? error.message : String(error), 'internal')
}
