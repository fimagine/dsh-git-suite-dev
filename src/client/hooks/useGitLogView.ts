import type { ChangeEvent, FormEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from '../runtime.js'
import { isAbortError, requestJson, toApiError, type ApiError } from '../lib/api.js'
import { graphGeometry, layoutGraph, type GraphGeometry, type GraphLayout } from '../lib/graph.js'
import { addRecentProject, readRecentProjects, writeRecentProjects } from '../lib/recent-projects.js'
import {
  branchLabelFor,
  buildProjectGroups,
  currentBranchLabel,
  customBranchOf,
  findCurrentProject,
  type BranchOption,
  type ProjectGroups,
} from '../lib/projects.js'
import type {
  Branch,
  BranchesPayload,
  Commit,
  CommitDetail,
  CommitPayload,
  DetailStatus,
  LoadStatus,
  LogPayload,
  Project,
  ProjectsPayload,
  Repo,
  Translate,
} from '../types.js'

const DEFAULT_LIMIT = 50

interface LoadLogOptions {
  path?: string
  limit: number
  offset?: number
  selection?: string
  append?: boolean
}

/** Everything the panel and its subcomponents render, plus the actions they trigger. */
export interface GitLogView {
  repo: Repo | null
  projectsStatus: LoadStatus
  projectGroups: ProjectGroups
  currentProject: Project | null
  selectedProjectPath: string
  pathInput: string
  limit: number
  status: LoadStatus
  commits: Commit[]
  error: ApiError | null
  hasMore: boolean
  selected: string | null
  detail: CommitDetail | null
  detailStatus: DetailStatus
  detailError: ApiError | null
  copied: boolean
  branchesStatus: LoadStatus
  branches: Branch[]
  localBranches: Branch[]
  remoteBranches: Branch[]
  branchSelection: string
  customBranch: BranchOption | null
  currentBranchLabel: string
  branchLabel: string
  branchesNote: string | null
  scanNote: string | null
  graph: GraphLayout
  geometry: GraphGeometry
  changePathText(value: string): void
  setLimit(value: number): void
  selectProject(event: ChangeEvent<HTMLSelectElement>): void
  selectBranch(event: ChangeEvent<HTMLSelectElement>): void
  submitPath(event: FormEvent<HTMLFormElement>): void
  refresh(): void
  loadMore(): void
  rescanProjects(): void
  selectCommit(commit: Commit): void
  closeDetail(): void
  copyHash(): void
}

/**
 * Owns the viewer's state: project scan and recents, branch list, paged commit
 * log, and the selected commit's detail. Rendering lives in the components.
 */
export function useGitLogView(t: Translate): GitLogView {
  const [pathInput, setPathInput] = useState('')
  const [repo, setRepo] = useState<Repo | null>(null)
  const [commits, setCommits] = useState<Commit[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [error, setError] = useState<ApiError | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchesStatus, setBranchesStatus] = useState<LoadStatus>('loading')
  const [branchSelection, setBranchSelection] = useState('HEAD')
  const [limit, setLimitState] = useState(DEFAULT_LIMIT)
  const [hasMore, setHasMore] = useState(false)
  const [nextOffset, setNextOffset] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<CommitDetail | null>(null)
  const [detailStatus, setDetailStatus] = useState<DetailStatus>('idle')
  const [detailError, setDetailError] = useState<ApiError | null>(null)
  const [copied, setCopied] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsStatus, setProjectsStatus] = useState<LoadStatus>('loading')
  const [projectsTruncated, setProjectsTruncated] = useState(false)
  const [recentProjects, setRecentProjects] = useState<string[]>([])
  const [selectedProjectPath, setSelectedProjectPath] = useState('')

  const logAbort = useRef<AbortController | null>(null)
  const detailAbort = useRef<AbortController | null>(null)
  const projectAbort = useRef<AbortController | null>(null)
  const branchAbort = useRef<AbortController | null>(null)
  const recentLoaded = useRef(false)

  const scanWorkspaceProjects = useCallback(async (signal: AbortSignal): Promise<Project[]> => {
    const payload = await requestJson<ProjectsPayload>({ mode: 'projects' }, signal)
    if (signal.aborted) return []
    const list = Array.isArray(payload.projects)
      ? payload.projects.filter(project => project && typeof project.path === 'string' && project.path !== '')
      : []
    setProjects(list)
    setProjectsTruncated(payload.truncated === true)
    setProjectsStatus('ready')
    return list
  }, [])

  const rememberProject = useCallback((path: string) => {
    setRecentProjects(current => addRecentProject(current, path))
  }, [])

  const loadBranches = useCallback(async (path: string | undefined): Promise<void> => {
    branchAbort.current?.abort()
    const controller = new AbortController()
    branchAbort.current = controller
    setBranchesStatus('loading')
    try {
      const payload = await requestJson<BranchesPayload>({ mode: 'branches', path }, controller.signal)
      if (controller.signal.aborted) return
      setBranches(Array.isArray(payload.branches) ? payload.branches : [])
      setBranchesStatus('ready')
    } catch {
      if (!controller.signal.aborted) setBranchesStatus('error')
    }
  }, [])

  const loadLog = useCallback(async (options: LoadLogOptions): Promise<void> => {
    const append = options.append === true
    const offset = options.offset ?? 0
    const selection = options.selection ?? 'HEAD'
    logAbort.current?.abort()
    detailAbort.current?.abort()
    const controller = new AbortController()
    logAbort.current = controller
    setStatus('loading')
    setError(null)
    try {
      const payload = await requestJson<LogPayload>({
        mode: 'log',
        path: options.path,
        limit: String(options.limit),
        offset: String(offset),
        ...(selection === '__all__' ? { scope: 'all' as const } : selection === '__remotes__' ? { scope: 'remotes' as const } : selection !== 'HEAD' ? { ref: selection } : {}),
      }, controller.signal)
      if (controller.signal.aborted) return
      const incoming = Array.isArray(payload.commits) ? payload.commits : []
      setCommits(current => append ? [...current, ...incoming] : incoming)
      setHasMore(payload.hasMore === true)
      setNextOffset(typeof payload.nextOffset === 'number' ? payload.nextOffset : offset + incoming.length)
      if (!append) {
        setRepo({
          repoRoot: payload.repoRoot,
          repoName: payload.repoName,
          branch: payload.branch,
          defaultPath: payload.defaultPath,
        })
        setPathInput(payload.repoRoot)
        setSelectedProjectPath(payload.repoRoot)
        setBranchSelection(selection)
        rememberProject(payload.repoRoot)
        setSelected(null)
        setDetail(null)
        setDetailStatus('idle')
        setDetailError(null)
        void loadBranches(payload.repoRoot)
      }
      setStatus('ready')
    } catch (loadError) {
      if (controller.signal.aborted || isAbortError(loadError)) return
      const apiError = toApiError(loadError)
      setError(apiError)
      if (apiError.details?.path && !append) setPathInput(apiError.details.path)
      setStatus('error')
    }
  }, [loadBranches, rememberProject])

  useEffect(() => {
    const controller = new AbortController()
    projectAbort.current = controller
    let active = true

    const start = async (): Promise<void> => {
      let scanned: Project[] = []
      try {
        scanned = await scanWorkspaceProjects(controller.signal)
      } catch {
        if (!controller.signal.aborted && active) setProjectsStatus('error')
      }
      if (!active) return
      const remembered = readRecentProjects()
      setRecentProjects(remembered)
      recentLoaded.current = true
      const initialPath = remembered[0] || scanned[0]?.path || ''
      setSelectedProjectPath(initialPath)
      setBranchSelection('HEAD')
      void loadLog({ path: initialPath, limit: DEFAULT_LIMIT, offset: 0, selection: 'HEAD' })
    }

    void start()
    return () => {
      active = false
      controller.abort()
      logAbort.current?.abort()
      detailAbort.current?.abort()
      branchAbort.current?.abort()
    }
  }, [loadLog, scanWorkspaceProjects])

  useEffect(() => {
    if (!copied) return undefined
    const timer = setTimeout(() => setCopied(false), 1400)
    return () => clearTimeout(timer)
  }, [copied])

  useEffect(() => {
    if (!recentLoaded.current) return
    writeRecentProjects(recentProjects)
  }, [recentProjects])

  const rescanProjects = useCallback(async (): Promise<void> => {
    projectAbort.current?.abort()
    const controller = new AbortController()
    projectAbort.current = controller
    setProjectsStatus('loading')
    try {
      await scanWorkspaceProjects(controller.signal)
    } catch {
      if (!controller.signal.aborted) setProjectsStatus('error')
    }
  }, [scanWorkspaceProjects])

  const setLimit = useCallback((value: number) => {
    setLimitState(value)
  }, [])

  const changePathText = useCallback((value: string) => {
    setPathInput(value)
    setSelectedProjectPath('')
  }, [])

  const selectProject = (event: ChangeEvent<HTMLSelectElement>): void => {
    const path = event.target.value
    if (path === '') {
      setSelectedProjectPath('')
      return
    }
    setSelectedProjectPath(path)
    setPathInput(path)
    setBranches([])
    setBranchesStatus('loading')
    setBranchSelection('HEAD')
    void loadLog({ path, limit, offset: 0, selection: 'HEAD' })
  }

  const selectBranch = (event: ChangeEvent<HTMLSelectElement>): void => {
    const selection = event.target.value
    setBranchSelection(selection)
    void loadLog({
      path: repo?.repoRoot ?? pathInput.trim(),
      limit,
      offset: 0,
      selection,
    })
  }

  const selectCommit = async (commit: Commit): Promise<void> => {
    setSelected(commit.hash)
    setDetailStatus('loading')
    setDetail(null)
    setDetailError(null)
    detailAbort.current?.abort()
    const controller = new AbortController()
    detailAbort.current = controller
    try {
      const payload = await requestJson<CommitPayload>({
        mode: 'commit',
        path: repo?.repoRoot ?? pathInput,
        hash: commit.hash,
      }, controller.signal)
      if (controller.signal.aborted) return
      setDetail(payload.commit)
      setDetailStatus('ready')
    } catch (loadError) {
      if (controller.signal.aborted || isAbortError(loadError)) return
      setDetailError(toApiError(loadError))
      setDetailStatus('error')
    }
  }

  const closeDetail = (): void => {
    detailAbort.current?.abort()
    setSelected(null)
    setDetail(null)
    setDetailStatus('idle')
    setDetailError(null)
  }

  const copyHash = (): void => {
    if (detail === null || !navigator.clipboard?.writeText) return
    navigator.clipboard.writeText(detail.hash).then(() => setCopied(true)).catch(() => {})
  }

  const submitPath = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    setBranches([])
    setBranchesStatus('loading')
    setBranchSelection('HEAD')
    void loadLog({ path: pathInput.trim(), limit, offset: 0, selection: 'HEAD' })
  }

  const refresh = (): void => {
    void loadLog({ path: pathInput.trim(), limit, offset: 0, selection: branchSelection })
  }

  const loadMore = (): void => {
    if (!hasMore || status === 'loading') return
    void loadLog({
      path: repo?.repoRoot ?? pathInput.trim(),
      limit,
      offset: nextOffset,
      append: true,
      selection: branchSelection,
    })
  }

  const graph = useMemo(() => layoutGraph(commits), [commits])
  const geometry = useMemo(() => graphGeometry(graph.maxLanes), [graph.maxLanes])
  const projectGroups = useMemo(() => buildProjectGroups(projects, recentProjects), [projects, recentProjects])
  const currentProject = findCurrentProject(projectGroups, selectedProjectPath)
  const localBranches = useMemo(() => branches.filter(branch => branch.kind === 'local'), [branches])
  const remoteBranches = useMemo(() => branches.filter(branch => branch.kind === 'remote'), [branches])
  const customBranch = customBranchOf(branches, branchSelection)
  const branchLabel = branchLabelFor({ selection: branchSelection, branches, repo, customBranch }, t)

  const scanNote = projectsStatus === 'error'
    ? t('scanFailed')
    : projectsStatus === 'ready' && projects.length === 0
      ? t('noWorkspaceProjects')
      : projectsTruncated
        ? t('scanTruncated')
        : null
  const branchesNote = branchesStatus === 'error' ? t('branchesFailed') : null

  return {
    repo,
    projectsStatus,
    projectGroups,
    currentProject,
    selectedProjectPath,
    pathInput,
    limit,
    status,
    commits,
    error,
    hasMore,
    selected,
    detail,
    detailStatus,
    detailError,
    copied,
    branchesStatus,
    branches,
    localBranches,
    remoteBranches,
    branchSelection,
    customBranch,
    currentBranchLabel: currentBranchLabel(repo, t),
    branchLabel,
    branchesNote,
    scanNote,
    graph,
    geometry,
    changePathText,
    setLimit,
    selectProject,
    selectBranch,
    submitPath,
    refresh,
    loadMore,
    rescanProjects: () => { void rescanProjects() },
    selectCommit,
    closeDetail,
    copyHash,
  }
}
