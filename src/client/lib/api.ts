import type {
  BranchAction,
  BranchActionPayload,
  BranchPayload,
  CheckoutPayload,
  ClonePayload,
  GenerateMessagePayload,
  OpenAppPayload,
  PickDirectoryPayload,
  PushTarget,
  RemoteAddPayload,
  RemoteRemovePayload,
  RemoteUrlPayload,
  RevealPayload,
  SyncAction,
  SyncPayload,
  TagInfoPayload,
  TagPayload,
  TagStatusPayload,
  CommitOpPayload,
  ReflogPayload,
  VersionPayload,
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

export type RequestMode = 'projects' | 'tree' | 'branches' | 'log' | 'commit' | 'resolve' | 'tag' | 'tag-status' | 'version' | 'reflog' | 'switch' | 'status' | 'workspace-diff'

export interface RequestParams {
  mode: RequestMode
  path?: string | null
  limit?: string
  offset?: string
  scope?: 'all' | 'remotes' | 'stash' | 'staged' | 'unstaged' | 'untracked'
  ref?: string
  hash?: string
  name?: string
  remote?: string
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

export type WorkspaceAction = 'stage' | 'unstage' | 'commit' | 'discard' | 'delete' | 'ignore'

export interface WorkspaceActionRequest {
  action: WorkspaceAction
  path: string
  paths?: string[]
  /** `ignore` only: which pattern to append to `.gitignore`. */
  mode?: 'file' | 'name' | 'extension'
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

export interface OpenAppRequest {
  path: string
  target: 'terminal' | 'explorer'
}

/** POST /git-suite/open: open a terminal or the OS file manager at the repository root. */
export async function requestOpenApp(body: OpenAppRequest, signal?: AbortSignal): Promise<OpenAppPayload> {
  return postCommitJson<OpenAppPayload>('/git-suite/open', body, signal)
}

export interface RevealFileRequest {
  path: string
  file: string
}

/** POST /git-suite/reveal: show one working-tree file in the OS file browser. */
export async function requestRevealFile(body: RevealFileRequest, signal?: AbortSignal): Promise<RevealPayload> {
  return postCommitJson<RevealPayload>('/git-suite/reveal', body, signal)
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
  /** `create` (default) or `delete`. */
  action?: 'create' | 'delete'
  /** Commit to tag; ignored when `base` is used instead. */
  hash?: string
  /** Ref to tag (`HEAD`, a branch, a tag, or a commit). */
  base?: string
  name: string
  /** Previous name when the tag is renamed. */
  previousName?: string
  message?: string
  force?: boolean
}

/** POST /git-suite/tag: create or force-move a tag at one commit. */
export async function requestTag(body: TagRequest, signal?: AbortSignal): Promise<TagPayload> {
  return postCommitJson<TagPayload>('/git-suite/tag', body, signal)
}

/** GET /git-suite?mode=tag: one tag's commit, subject, and annotation message. */
export async function requestTagInfo(
  params: { path: string; name: string },
  signal?: AbortSignal,
): Promise<TagInfoPayload> {
  return requestJson<TagInfoPayload>({ mode: 'tag', path: params.path, name: params.name }, signal)
}

/** GET /git-suite?mode=tag-status: how local tags compare with one remote's tags. */
export async function requestTagStatus(
  params: { path: string; remote: string },
  signal?: AbortSignal,
): Promise<TagStatusPayload> {
  return requestJson<TagStatusPayload>({ mode: 'tag-status', path: params.path, remote: params.remote }, signal)
}

/** GET /git-suite?mode=version: installed version versus the latest npm release. */
export async function requestVersionCheck(signal?: AbortSignal): Promise<VersionPayload> {
  return requestJson<VersionPayload>({ mode: 'version' }, signal)
}

/** GET /git-suite?mode=reflog: recent HEAD movements for recovery. */
export async function requestReflog(
  params: { path: string; limit?: number },
  signal?: AbortSignal,
): Promise<ReflogPayload> {
  return requestJson<ReflogPayload>({
    mode: 'reflog',
    path: params.path,
    ...(params.limit === undefined ? {} : { limit: String(params.limit) }),
  }, signal)
}

export interface CommitOpRequest {
  path: string
  action: 'cherry-pick' | 'revert' | 'reset' | 'abort'
  hash?: string
  mode?: 'soft' | 'mixed' | 'hard'
}

/** POST /git-suite/commit-op: cherry-pick, revert, reset, or abort. */
export async function requestCommitOp(body: CommitOpRequest, signal?: AbortSignal): Promise<CommitOpPayload> {
  return postCommitJson<CommitOpPayload>('/git-suite/commit-op', body, signal)
}

export interface BranchRequest {
  path: string
  name: string
  /** Commit the branch starts at; ignored when `base` is used instead. */
  hash?: string
  /** Ref the branch starts at (`HEAD`, a branch, a tag, or a commit). */
  base?: string
}

/** POST /git-suite/branch: create a local branch at a commit or ref. */
export async function requestBranch(body: BranchRequest, signal?: AbortSignal): Promise<BranchPayload> {
  return postCommitJson<BranchPayload>('/git-suite/branch', body, signal)
}

export interface CheckoutRequest {
  path: string
  hash?: string
  branch?: string
  /** Any revision to detach HEAD at, e.g. a tag ref; ignored when `hash` is set. */
  ref?: string
}

/** POST /git-suite/checkout: switch to a local branch or detach HEAD at a commit. */
export async function requestCheckout(body: CheckoutRequest, signal?: AbortSignal): Promise<CheckoutPayload> {
  return postCommitJson<CheckoutPayload>('/git-suite/checkout', body, signal)
}

export interface SyncRequest {
  action: SyncAction
  /** Tag name for `fetch-tag`: overwrite the local tag from the remote. */
  tag?: string
  path: string
  remote?: string
  branch?: string
  refs?: PushTarget[]
  /** Tag names pushed individually. */
  tagRefs?: string[]
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

export interface RemoveRemoteRequest {
  path: string
  name: string
}

export interface AddRemoteRequest {
  path: string
  name: string
  url: string
}

export interface SetRemoteUrlRequest {
  path: string
  /** Current remote name. */
  name: string
  url: string
  /** New name when the remote is renamed as well. */
  newName?: string
}

/** POST /git-suite/remote: remove one configured remote. */
export async function requestRemoveRemote(body: RemoveRemoteRequest, signal?: AbortSignal): Promise<RemoteRemovePayload> {
  return postCommitJson<RemoteRemovePayload>('/git-suite/remote', { action: 'remove', ...body }, signal)
}

/** POST /git-suite/remote: add one configured remote. */
export async function requestAddRemote(body: AddRemoteRequest, signal?: AbortSignal): Promise<RemoteAddPayload> {
  return postCommitJson<RemoteAddPayload>('/git-suite/remote', { action: 'add', ...body }, signal)
}

/** POST /git-suite/remote: rename and/or replace the URL of one configured remote. */
export async function requestSetRemoteUrl(body: SetRemoteUrlRequest, signal?: AbortSignal): Promise<RemoteUrlPayload> {
  return postCommitJson<RemoteUrlPayload>('/git-suite/remote', { action: 'set-url', ...body }, signal)
}

export interface BranchActionRequest {
  action: BranchAction
  path: string
  branch: string
  remote?: string
  newName?: string
}

/** POST /git-suite/branch-action: merge, rebase, rename, or delete a local branch. */
export async function requestBranchAction(body: BranchActionRequest, signal?: AbortSignal): Promise<BranchActionPayload> {
  return postCommitJson<BranchActionPayload>('/git-suite/branch-action', body, signal)
}

export function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError(error instanceof Error ? error.message : String(error), 'internal')
}
