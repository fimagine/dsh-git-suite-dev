window.__ModuleLoader__.load({
  id: '@local/dsh-git-log-viewer',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'gitLog'
    const CSS = `
.dsh-gitlog {
  --gitlog-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding: 24px 28px 0;
  gap: 16px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
}
.dsh-gitlog * { box-sizing: border-box; }
.dsh-gitlog h1, .dsh-gitlog h2, .dsh-gitlog h3, .dsh-gitlog p { margin: 0; }
.dsh-gitlog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.dsh-gitlog-heading { min-width: 0; }
.dsh-gitlog-heading h1 { font-size: 20px; line-height: 1.3; font-weight: 600; }
.dsh-gitlog-subtitle {
  margin-top: 4px;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 1.45;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-gitlog-controls {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 10px 12px;
}
.dsh-gitlog-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}
.dsh-gitlog-field.grow { flex: 1 1 340px; }
.dsh-gitlog-field > span {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 1.2;
}
.dsh-gitlog-field.project { flex: 0 1 230px; }
.dsh-gitlog-field.project select { width: 100%; }
.dsh-gitlog-field.branch { flex: 0 1 220px; }
.dsh-gitlog-field.branch select { width: 100%; }
.dsh-gitlog input[type="text"], .dsh-gitlog select {
  height: 34px;
  min-width: 0;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  padding: 0 10px;
  font: inherit;
  font-size: 13px;
  outline: none;
}
.dsh-gitlog input[type="text"]:focus, .dsh-gitlog select:focus {
  border-color: var(--dsw-alias-brand-primary);
}
.dsh-gitlog select { min-width: 84px; cursor: pointer; }
.dsh-gitlog-check {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
}
.dsh-gitlog-check input { accent-color: var(--dsw-alias-brand-primary); }
.dsh-gitlog-btn {
  height: 34px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  padding: 0 13px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}
.dsh-gitlog-btn:hover { background: var(--dsw-alias-bg-layer-2); }
.dsh-gitlog-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.dsh-gitlog-btn:disabled { opacity: .55; cursor: not-allowed; }
.dsh-gitlog-btn.primary {
  border-color: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-brand-primary);
}
.dsh-gitlog-body {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, .85fr);
  flex: 1 1 auto;
  min-height: 0;
  margin-bottom: 24px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 12px;
  overflow: hidden;
  background: var(--dsw-alias-bg-layer-1);
}
.dsh-gitlog-list { min-height: 0; overflow: auto; border-right: 1px solid var(--dsw-alias-border-l1); }
.dsh-gitlog-list-head {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
}
.dsh-gitlog-branch {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--gitlog-mono);
}
.dsh-gitlog-commit {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 48px;
  gap: 8px;
  padding: 0 16px 0 10px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  font: inherit;
  cursor: pointer;
  overflow: hidden;
  content-visibility: auto;
  contain-intrinsic-size: 48px;
}
.dsh-gitlog-commit:hover { background: var(--dsw-alias-bg-layer-2); }
.dsh-gitlog-commit:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.dsh-gitlog-commit.is-selected {
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: inset 3px 0 0 var(--dsw-alias-brand-primary);
}
.dsh-gitlog-graph {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  align-self: stretch;
  overflow: visible;
}
.dsh-gitlog-graph svg { display: block; overflow: visible; }
.dsh-gitlog-commit-main {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  flex: 1 1 auto;
  align-self: stretch;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.dsh-gitlog-commit:last-child .dsh-gitlog-commit-main { border-bottom: 0; }
.dsh-gitlog-subject {
  font-size: 13px;
  line-height: 1.4;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-gitlog-meta {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 4px 7px;
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  font-size: 11.5px;
  line-height: 1.4;
  white-space: nowrap;
}
.dsh-gitlog-hash {
  flex: 0 0 auto;
  font-family: var(--gitlog-mono);
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-gitlog-meta > span { flex: 0 0 auto; }
.dsh-gitlog-meta > span:last-child { flex: 0 1 auto; min-width: 0; overflow: hidden; }
.dsh-gitlog-refs { display: flex; flex-wrap: nowrap; gap: 4px; min-width: 0; overflow: hidden; }
.dsh-gitlog-merge {
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  padding: 0 6px;
  color: var(--dsw-alias-brand-primary);
  font-size: 10px;
  line-height: 16px;
}
.dsh-gitlog-ref {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  padding: 0 7px;
  color: var(--dsw-alias-label-secondary);
  font-size: 10.5px;
  line-height: 17px;
}
.dsh-gitlog-ref.is-head { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
.dsh-gitlog-detail { min-height: 0; overflow: auto; }
.dsh-gitlog-detail-inner { padding: 18px 20px 24px; display: flex; flex-direction: column; gap: 16px; }
.dsh-gitlog-detail-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.dsh-gitlog-detail-title { min-width: 0; }
.dsh-gitlog-detail-title h2 { margin-top: 5px; font-size: 15px; line-height: 1.45; font-weight: 600; overflow-wrap: anywhere; }
.dsh-gitlog-detail-sub { margin-top: 5px; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 1.45; overflow-wrap: anywhere; }
.dsh-gitlog-detail-actions { display: flex; flex: 0 0 auto; gap: 6px; }
.dsh-gitlog-small {
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
}
.dsh-gitlog-small:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dsh-gitlog-detail h3 {
  font-size: 12px;
  line-height: 1.3;
  font-weight: 600;
  color: var(--dsw-alias-label-secondary);
  text-transform: uppercase;
  letter-spacing: .04em;
}
.dsh-gitlog-meta-grid {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 6px 12px;
  font-size: 12px;
  line-height: 1.45;
}
.dsh-gitlog-meta-grid dt { color: var(--dsw-alias-label-secondary); }
.dsh-gitlog-meta-grid dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.dsh-gitlog-files { display: flex; flex-direction: column; gap: 1px; margin: 0; padding: 0; list-style: none; }
.dsh-gitlog-file {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content max-content;
  gap: 10px;
  align-items: baseline;
  padding: 4px 0;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  font-family: var(--gitlog-mono);
  font-size: 11.5px;
  line-height: 1.45;
}
.dsh-gitlog-file:last-child { border-bottom: 0; }
.dsh-gitlog-file-path { overflow-wrap: anywhere; }
.dsh-gitlog-add { color: var(--dsw-alias-state-success-primary); }
.dsh-gitlog-del { color: var(--dsw-alias-state-error-primary); }
.dsh-gitlog-binary { color: var(--dsw-alias-label-secondary); font-family: inherit; }
.dsh-gitlog-body-text {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 12px;
  line-height: 1.55;
}
.dsh-gitlog-patch {
  margin: 0;
  padding: 12px;
  max-height: 360px;
  overflow: auto;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-family: var(--gitlog-mono);
  font-size: 11.5px;
  line-height: 1.5;
  tab-size: 4;
  white-space: pre;
}
.dsh-gitlog-note { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 1.5; }
.dsh-gitlog-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex: 1 1 auto;
  min-height: 220px;
  padding: 32px;
  text-align: center;
}
.dsh-gitlog-state h2 { font-size: 16px; line-height: 1.4; font-weight: 600; }
.dsh-gitlog-state p { max-width: 560px; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 1.55; overflow-wrap: anywhere; }
.dsh-gitlog-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--dsw-alias-border-l2);
  border-top-color: var(--dsw-alias-brand-primary);
  border-radius: 50%;
  animation: dsh-gitlog-spin .8s linear infinite;
}
@keyframes dsh-gitlog-spin { to { transform: rotate(360deg); } }
.dsh-gitlog-more { display: flex; justify-content: center; padding: 14px; }
.dsh-gitlog-error-code { font-family: var(--gitlog-mono); font-size: 11.5px; color: var(--dsw-alias-label-secondary); }
.dsh-gitlog-loading-line {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  padding: 14px 20px;
}
@media (max-width: 900px) {
  .dsh-gitlog { padding: 18px 16px 0; }
  .dsh-gitlog-body { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) minmax(220px, .8fr); }
  .dsh-gitlog-list { border-right: 0; border-bottom: 1px solid var(--dsw-alias-border-l1); }
}
`

    const en = {
      panel: 'Git log',
      title: 'Git log',
      subtitle: 'Browse commit history, branches, and diffs for a local Git repository.',
      refresh: 'Refresh',
      project: 'Project',
      manualPath: 'Manual path',
      recentProjects: 'Recently opened',
      workspaceProjects: 'Workspace projects',
      scanningProjects: 'Scanning workspaces…',
      rescan: 'Scan workspaces',
      scanFailed: 'Could not scan registered workspaces.',
      noWorkspaceProjects: 'No Git repositories found in registered workspaces.',
      scanTruncated: 'The workspace scan was capped; some projects may be missing.',
      path: 'Repository path',
      pathPlaceholder: 'A directory inside a Git repository',
      branch: 'Branch',
      currentBranch: 'Current branch',
      allBranches: 'All branches (incl. remotes)',
      allRemoteBranches: 'All remote branches',
      localBranches: 'Local branches',
      remoteBranches: 'Remote branches',
      branchesFailed: 'Could not list branches.',
      limit: 'Commits',
      allCommits: 'All',
      load: 'Load',
      loadingCommits: 'Loading commits…',
      loadingCommit: 'Loading commit…',
      commits: 'commits',
      noCommits: 'No commits found',
      noCommitsHint: 'This repository has no commits on the selected refs yet.',
      selectCommit: 'Select a commit',
      selectCommitHint: 'Choose a commit from the list to inspect its files and patch.',
      changedFiles: 'Changed files',
      patch: 'Patch',
      noPatch: 'This commit has no textual patch to display.',
      patchTruncated: 'The patch is large and was truncated by the viewer.',
      author: 'Author',
      date: 'Date',
      parents: 'Parents',
      rootCommit: 'root commit',
      copyHash: 'Copy hash',
      copied: 'Copied',
      close: 'Close',
      tryAgain: 'Try again',
      errorTitle: 'Could not read the Git log',
      notRepoTitle: 'Not a Git repository',
      notRepoHint: 'Open a directory inside a Git repository, or initialize one with git init.',
      invalidPathTitle: 'Path not found',
      invalidPathHint: 'Enter an existing directory on this machine.',
      gitMissingTitle: 'Git is not available',
      gitMissingHint: 'Install Git and make sure the git command is on PATH, then reload this page.',
      emptyRepoTitle: 'No commits yet',
      emptyRepoHint: 'Make an initial commit, then refresh the viewer.',
      unknownError: 'The viewer received an unexpected error.',
      justNow: 'just now',
      binary: 'binary',
      loadMore: 'Load next page',
      commitBody: 'Commit message',
      details: 'Commit details',
      noSubject: '(no subject)',
      detached: 'detached',
      merge: 'merge',
    }

    const zh = {
      panel: 'Git 日志',
      title: 'Git 日志',
      subtitle: '查看本地 Git 仓库的提交历史、分支和差异。',
      refresh: '刷新',
      project: '项目',
      manualPath: '手动输入路径',
      recentProjects: '最近打开',
      workspaceProjects: '工作区项目',
      scanningProjects: '正在扫描工作区…',
      rescan: '扫描工作区',
      scanFailed: '无法扫描已注册的工作区。',
      noWorkspaceProjects: '已注册的工作区中没有发现 Git 仓库。',
      scanTruncated: '工作区扫描已达到上限，可能遗漏部分项目。',
      path: '仓库路径',
      pathPlaceholder: 'Git 仓库中的目录',
      branch: '分支',
      currentBranch: '当前分支',
      allBranches: '所有分支（含远端）',
      allRemoteBranches: '所有远端分支',
      localBranches: '本地分支',
      remoteBranches: '远端分支',
      branchesFailed: '无法列出分支。',
      limit: '提交数',
      allCommits: '全部',
      load: '加载',
      loadingCommits: '正在加载提交…',
      loadingCommit: '正在加载提交详情…',
      commits: '条提交',
      noCommits: '没有找到提交',
      noCommitsHint: '当前选择的引用上还没有提交。',
      selectCommit: '选择一个提交',
      selectCommitHint: '从左侧列表选择提交，查看改动的文件和补丁。',
      changedFiles: '改动的文件',
      patch: '补丁',
      noPatch: '这个提交没有可显示的文本补丁。',
      patchTruncated: '补丁较大，查看器已截断显示。',
      author: '作者',
      date: '时间',
      parents: '父提交',
      rootCommit: '根提交',
      copyHash: '复制哈希',
      copied: '已复制',
      close: '关闭',
      tryAgain: '重试',
      errorTitle: '无法读取 Git 日志',
      notRepoTitle: '不是 Git 仓库',
      notRepoHint: '请选择 Git 仓库中的目录，或先运行 git init。',
      invalidPathTitle: '路径不存在',
      invalidPathHint: '请输入这台机器上已存在的目录。',
      gitMissingTitle: '找不到 Git',
      gitMissingHint: '请安装 Git，并确认 git 命令在 PATH 中，然后刷新页面。',
      emptyRepoTitle: '还没有提交',
      emptyRepoHint: '请先创建初始提交，然后刷新查看器。',
      unknownError: '查看器遇到未知错误。',
      justNow: '刚刚',
      binary: '二进制',
      loadMore: '加载下一页',
      commitBody: '提交信息',
      details: '提交详情',
      noSubject: '（无标题）',
      detached: '分离头指针',
      merge: '合并',
    }

    function formatDate(value) {
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return value
      try {
        return new Intl.DateTimeFormat(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(date)
      } catch {
        return date.toLocaleString()
      }
    }

    function relativeTime(value, t) {
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return ''
      const seconds = Math.round((date.getTime() - Date.now()) / 1000)
      const abs = Math.abs(seconds)
      if (abs < 45) return t('justNow')
      const formatter = (() => {
        try {
          return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
        } catch {
          return null
        }
      })()
      const units = [
        ['year', 31536000],
        ['month', 2592000],
        ['week', 604800],
        ['day', 86400],
        ['hour', 3600],
        ['minute', 60],
      ]
      for (const [unit, size] of units) {
        if (abs >= size) {
          const amount = Math.round(seconds / size)
          return formatter === null ? `${Math.abs(amount)} ${unit}${Math.abs(amount) === 1 ? '' : 's'}` : formatter.format(amount, unit)
        }
      }
      return formatter === null ? `${abs} seconds` : formatter.format(seconds, 'second')
    }

    const RECENT_PROJECTS_KEY = 'dsh.git-log-viewer.recent-projects.v1'
    const RECENT_PROJECTS_COOKIE = 'dsh_git_log_recent_projects'
    const RECENT_PROJECTS_LIMIT = 8

    function pathName(path) {
      const parts = String(path).split(/[\\/]+/).filter(Boolean)
      return parts[parts.length - 1] || String(path)
    }

    function projectLabel(project) {
      const name = project.name || pathName(project.path)
      return project.workspaceTitle && project.workspaceTitle !== name
        ? `${name} — ${project.workspaceTitle}`
        : name
    }

    function readCookie(name) {
      try {
        const prefix = `${name}=`
        for (const part of document.cookie.split('; ')) {
          if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length))
        }
      } catch {
        return null
      }
      return null
    }

    function readRecentProjects() {
      let raw = null
      try {
        raw = window.localStorage.getItem(RECENT_PROJECTS_KEY)
      } catch {
        raw = null
      }
      if (raw === null || raw === '') raw = readCookie(RECENT_PROJECTS_COOKIE)
      if (raw === null || raw === '') return []
      try {
        const value = JSON.parse(raw)
        if (!Array.isArray(value)) return []
        const seen = new Set()
        return value
          .filter((item) => typeof item === 'string' && item.trim() !== '')
          .filter((item) => {
            const key = item.toLowerCase()
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
          .slice(0, RECENT_PROJECTS_LIMIT)
      } catch {
        return []
      }
    }

    function writeRecentProjects(projects) {
      const serialized = JSON.stringify(projects)
      try {
        document.cookie = `${RECENT_PROJECTS_COOKIE}=${encodeURIComponent(serialized)}; Max-Age=31536000; Path=/; SameSite=Lax`
      } catch {
        // Cookies can be disabled; localStorage below is the fallback.
      }
      try {
        window.localStorage.setItem(RECENT_PROJECTS_KEY, serialized)
      } catch {
        // Storage can be unavailable in a private or restricted browser context.
      }
    }

    const LANE_COLORS = [
      'var(--dsw-alias-brand-primary)',
      'var(--dsw-alias-state-success-primary)',
      'var(--dsw-alias-state-warn-primary)',
      'var(--dsw-alias-state-error-primary)',
      'var(--dsw-alias-state-idle-primary)',
      'var(--dsw-alias-label-secondary)',
    ]

    function laneColor(index) {
      return LANE_COLORS[index % LANE_COLORS.length]
    }

    /**
     * Lay commits out on lanes. Each lane carries the hash expected at the next
     * row; a commit takes its own lane, absorbs every lane that also expected
     * it, and starts lanes for its parents. Keeping vacant slots avoids moving
     * unrelated lines sideways, which is what makes merges readable.
     */
    function layoutGraph(commits) {
      const rows = []
      let lanes = []
      let maxLanes = 1

      for (const commit of commits) {
        let nodeLane = lanes.indexOf(commit.hash)
        if (nodeLane === -1) {
          nodeLane = lanes.indexOf(null)
          if (nodeLane === -1) {
            nodeLane = lanes.length
            lanes.push(null)
          }
        }

        const before = lanes.slice()
        const merged = []
        for (let index = 0; index < before.length; index += 1) {
          if (before[index] === commit.hash) merged.push(index)
        }
        for (const index of merged) lanes[index] = null

        const parentLanes = []
        for (let parentIndex = 0; parentIndex < commit.parents.length; parentIndex += 1) {
          const parent = commit.parents[parentIndex]
          let lane = lanes.indexOf(parent)
          if (lane === -1) {
            if (parentIndex === 0) {
              lane = nodeLane
            } else {
              lane = lanes.indexOf(null)
              if (lane === -1) {
                lane = lanes.length
                lanes.push(null)
              }
            }
            lanes[lane] = parent
          }
          parentLanes.push(lane)
        }

        const after = lanes.slice()
        maxLanes = Math.max(maxLanes, before.length, after.length, nodeLane + 1)
        for (const lane of parentLanes) maxLanes = Math.max(maxLanes, lane + 1)
        rows.push({ commit, before, after, nodeLane, merged, parentLanes })

        while (lanes.length > 0 && lanes[lanes.length - 1] === null) lanes.pop()
      }

      return { rows, maxLanes }
    }

    function graphGeometry(maxLanes) {
      const spacing = maxLanes <= 1 ? 0 : Math.min(16, 288 / (maxLanes - 1))
      const width = maxLanes <= 1 ? 24 : 16 + spacing * (maxLanes - 1)
      return {
        width,
        nodeRadius: Math.min(4.5, Math.max(2.2, spacing * 0.34)),
        mergeRadius: Math.min(6, Math.max(3, spacing * 0.45)),
        x(index) {
          return maxLanes <= 1 ? width / 2 : 8 + index * spacing
        },
      }
    }

    function CommitGraph({ row, geometry }) {
      const { commit, before, after, nodeLane, parentLanes } = row
      const x = geometry.x
      const elements = []
      const laneCount = Math.max(before.length, after.length)
      const lineProps = {
        fill: 'none',
        strokeWidth: 1.6,
        strokeLinecap: 'round',
        vectorEffect: 'non-scaling-stroke',
      }

      for (let index = 0; index < laneCount; index += 1) {
        const previous = before[index]
        const next = after[index]
        if (previous === undefined || previous === null) continue
        if (previous === commit.hash) {
          if (index !== nodeLane) {
            elements.push(h('path', {
              key: `incoming-${index}`,
              d: `M ${x(index)} 0 C ${x(index)} 14, ${x(nodeLane)} 10, ${x(nodeLane)} 24`,
              stroke: laneColor(index),
              ...lineProps,
            }))
          }
        } else if (previous === next) {
          elements.push(h('line', {
            key: `through-${index}`,
            x1: x(index),
            y1: 0,
            x2: x(index),
            y2: 48,
            stroke: laneColor(index),
            ...lineProps,
          }))
        }
      }

      if (before[nodeLane] === commit.hash) {
        elements.push(h('line', {
          key: 'node-in',
          x1: x(nodeLane),
          y1: 0,
          x2: x(nodeLane),
          y2: 24,
          stroke: laneColor(nodeLane),
          ...lineProps,
        }))
      }

      parentLanes.forEach((lane, parentIndex) => {
        if (lane === nodeLane) {
          elements.push(h('line', {
            key: `outgoing-${parentIndex}`,
            x1: x(nodeLane),
            y1: 24,
            x2: x(nodeLane),
            y2: 48,
            stroke: laneColor(lane),
            ...lineProps,
          }))
        } else {
          elements.push(h('path', {
            key: `outgoing-${parentIndex}`,
            d: `M ${x(nodeLane)} 24 C ${x(nodeLane)} 34, ${x(lane)} 38, ${x(lane)} 48`,
            stroke: laneColor(lane),
            ...lineProps,
          }))
        }
      })

      const nodeColor = laneColor(nodeLane)
      if (commit.parents.length > 1) {
        elements.push(h('circle', {
          key: 'node',
          cx: x(nodeLane),
          cy: 24,
          r: geometry.mergeRadius,
          fill: 'var(--dsw-alias-bg-layer-1)',
          stroke: nodeColor,
          strokeWidth: 2,
          vectorEffect: 'non-scaling-stroke',
        }))
        elements.push(h('circle', {
          key: 'node-core',
          cx: x(nodeLane),
          cy: 24,
          r: geometry.mergeRadius * 0.4,
          fill: nodeColor,
        }))
      } else {
        elements.push(h('circle', {
          key: 'node',
          cx: x(nodeLane),
          cy: 24,
          r: geometry.nodeRadius,
          fill: nodeColor,
          stroke: 'var(--dsw-alias-bg-layer-1)',
          strokeWidth: 2.5,
          vectorEffect: 'non-scaling-stroke',
        }))
      }

      return h('svg', {
        width: geometry.width,
        height: 48,
        viewBox: `0 0 ${geometry.width} 48`,
        'aria-hidden': true,
        focusable: false,
      }, elements)
    }

    function requestJson(params, signal) {
      const url = new URL('/git-log', window.location.origin)
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
      }
      return fetch(url, {
        method: 'GET',
        signal,
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'x-dsh-git-log': '1' },
      }).then(async (response) => {
        let payload = null
        try {
          payload = await response.json()
        } catch {
          payload = null
        }
        if (response.ok && payload?.ok === true) return payload
        const error = new Error(payload?.error?.message ?? `Request failed with HTTP ${response.status}`)
        error.code = payload?.error?.code ?? 'request-failed'
        error.details = payload?.error?.details
        throw error
      })
    }

    function Refs({ refs }) {
      if (!Array.isArray(refs) || refs.length === 0) return null
      return h('span', { className: 'dsh-gitlog-refs' },
        refs.map((ref) => h('span', {
          key: ref,
          className: `dsh-gitlog-ref${ref.startsWith('HEAD') ? ' is-head' : ''}`,
          title: ref,
        }, ref)),
      )
    }

    function CommitRow({ commit, selected, onSelect, t, row, geometry }) {
      const isMerge = commit.parents.length > 1
      return h('button', {
        type: 'button',
        className: `dsh-gitlog-commit${selected ? ' is-selected' : ''}`,
        'aria-pressed': selected,
        onClick: () => onSelect(commit),
        title: commit.subject,
      },
        h('span', {
          className: 'dsh-gitlog-graph',
          style: { width: geometry.width, minWidth: geometry.width },
          'aria-hidden': true,
        }, h(CommitGraph, { row, geometry })),
        h('span', { className: 'dsh-gitlog-commit-main' },
          h('span', { className: 'dsh-gitlog-subject' }, commit.subject || t('noSubject')),
          h('span', { className: 'dsh-gitlog-meta' },
            h('code', { className: 'dsh-gitlog-hash' }, commit.shortHash),
            isMerge ? h('span', { className: 'dsh-gitlog-merge' }, t('merge')) : null,
            h('span', { 'aria-hidden': true }, '·'),
            h('span', {}, commit.author),
            h('span', { 'aria-hidden': true }, '·'),
            h('span', { title: formatDate(commit.date) }, relativeTime(commit.date, t)),
            h(Refs, { refs: commit.refs }),
          ),
        ),
      )
    }

    function DetailPane({ detail, status, error, t, onClose, copied, onCopy }) {
      if (status === 'idle') {
        return h('div', { className: 'dsh-gitlog-state' },
          h('h2', {}, t('selectCommit')),
          h('p', {}, t('selectCommitHint')),
        )
      }
      if (status === 'loading') {
        return h('div', { className: 'dsh-gitlog-state' },
          h('span', { className: 'dsh-gitlog-spinner', 'aria-hidden': true }),
          h('p', {}, t('loadingCommit')),
        )
      }
      if (status === 'error' || detail === null) {
        return h('div', { className: 'dsh-gitlog-state' },
          h('h2', {}, t('errorTitle')),
          h('p', {}, error?.message || t('unknownError')),
          h('button', { type: 'button', className: 'dsh-gitlog-btn', onClick: onClose }, t('close')),
        )
      }

      return h('div', { className: 'dsh-gitlog-detail-inner' },
        h('div', { className: 'dsh-gitlog-detail-head' },
          h('div', { className: 'dsh-gitlog-detail-title' },
            h('code', { className: 'dsh-gitlog-hash' }, detail.shortHash),
            detail.parents.length > 1
              ? h('span', { className: 'dsh-gitlog-merge', style: { marginLeft: '7px' } }, t('merge'))
              : null,
            h('h2', {}, detail.subject || t('noSubject')),
            h('div', { className: 'dsh-gitlog-detail-sub' }, `${detail.author} · ${formatDate(detail.date)}`),
          ),
          h('div', { className: 'dsh-gitlog-detail-actions' },
            h('button', { type: 'button', className: 'dsh-gitlog-small', onClick: onCopy }, copied ? t('copied') : t('copyHash')),
            h('button', { type: 'button', className: 'dsh-gitlog-small', onClick: onClose }, t('close')),
          ),
        ),
        h(Refs, { refs: detail.refs }),
        h('dl', { className: 'dsh-gitlog-meta-grid' },
          h('dt', {}, t('author')),
          h('dd', {}, `${detail.author} <${detail.email}>`),
          h('dt', {}, t('date')),
          h('dd', {}, formatDate(detail.date)),
          h('dt', {}, t('parents')),
          h('dd', {}, detail.parents.length === 0 ? t('rootCommit') : detail.parents.map((parent) => parent.slice(0, 12)).join(', ')),
        ),
        detail.body ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
          h('h3', {}, t('commitBody')),
          h('pre', { className: 'dsh-gitlog-body-text' }, detail.body),
        ) : null,
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
          h('h3', {}, `${t('changedFiles')} (${detail.files.length})`),
          detail.files.length === 0
            ? h('p', { className: 'dsh-gitlog-note' }, t('noPatch'))
            : h('ul', { className: 'dsh-gitlog-files' },
                detail.files.map((file) => h('li', { key: file.path, className: 'dsh-gitlog-file' },
                  h('span', { className: 'dsh-gitlog-file-path' }, file.path),
                  file.binary
                    ? h('span', { className: 'dsh-gitlog-binary' }, t('binary'))
                    : h('span', { className: 'dsh-gitlog-add' }, `+${file.additions}`),
                  file.binary
                    ? h('span', {})
                    : h('span', { className: 'dsh-gitlog-del' }, `-${file.deletions}`),
                )),
              ),
        ),
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
          h('h3', {}, t('patch')),
          detail.patch
            ? h('pre', { className: 'dsh-gitlog-patch', spellCheck: false }, detail.patch)
            : h('p', { className: 'dsh-gitlog-note' }, t('noPatch')),
          detail.patchTruncated ? h('p', { className: 'dsh-gitlog-note' }, t('patchTruncated')) : null,
        ),
      )
    }

    function ErrorState({ error, t, onRetry }) {
      const code = error?.code
      const title = code === 'not-a-repo'
        ? t('notRepoTitle')
        : code === 'empty-repo'
          ? t('emptyRepoTitle')
          : code === 'invalid-path'
            ? t('invalidPathTitle')
            : code === 'git-missing'
              ? t('gitMissingTitle')
              : t('errorTitle')
      const hint = code === 'not-a-repo'
        ? t('notRepoHint')
        : code === 'empty-repo'
          ? t('emptyRepoHint')
          : code === 'invalid-path'
            ? t('invalidPathHint')
            : code === 'git-missing'
              ? t('gitMissingHint')
              : null
      return h('div', { className: 'dsh-gitlog-state' },
        h('h2', {}, title),
        hint ? h('p', {}, hint) : null,
        h('p', { className: 'dsh-gitlog-error-code' }, `${code ?? 'unknown'}${error?.message ? ` · ${error.message}` : ''}`),
        error?.details?.path ? h('p', { className: 'dsh-gitlog-error-code' }, error.details.path) : null,
        h('button', { type: 'button', className: 'dsh-gitlog-btn', onClick: onRetry }, t('tryAgain')),
      )
    }

    function GitLogPanel({ t }) {
      const [pathInput, setPathInput] = React.useState('')
      const [repo, setRepo] = React.useState(null)
      const [commits, setCommits] = React.useState([])
      const [status, setStatus] = React.useState('loading')
      const [error, setError] = React.useState(null)
      const [branches, setBranches] = React.useState([])
      const [branchesStatus, setBranchesStatus] = React.useState('loading')
      const [branchSelection, setBranchSelection] = React.useState('HEAD')
      const [limit, setLimit] = React.useState(50)
      const [hasMore, setHasMore] = React.useState(false)
      const [nextOffset, setNextOffset] = React.useState(0)
      const [selected, setSelected] = React.useState(null)
      const [detail, setDetail] = React.useState(null)
      const [detailStatus, setDetailStatus] = React.useState('idle')
      const [detailError, setDetailError] = React.useState(null)
      const [copied, setCopied] = React.useState(false)
      const [projects, setProjects] = React.useState([])
      const [projectsStatus, setProjectsStatus] = React.useState('loading')
      const [projectsTruncated, setProjectsTruncated] = React.useState(false)
      const [recentProjects, setRecentProjects] = React.useState([])
      const [selectedProjectPath, setSelectedProjectPath] = React.useState('')
      const logAbort = React.useRef(null)
      const detailAbort = React.useRef(null)
      const projectAbort = React.useRef(null)
      const branchAbort = React.useRef(null)
      const recentLoaded = React.useRef(false)
      const graph = React.useMemo(() => layoutGraph(commits), [commits])
      const geometry = React.useMemo(() => graphGeometry(graph.maxLanes), [graph.maxLanes])

      const scanWorkspaceProjects = React.useCallback(async (signal) => {
        const payload = await requestJson({ mode: 'projects' }, signal)
        if (signal.aborted) return []
        const list = Array.isArray(payload.projects)
          ? payload.projects.filter((project) => project && typeof project.path === 'string' && project.path !== '')
          : []
        setProjects(list)
        setProjectsTruncated(payload.truncated === true)
        setProjectsStatus('ready')
        return list
      }, [])

      const rememberProject = (path) => {
        setRecentProjects((current) => {
          const key = path.toLowerCase()
          return [path, ...current.filter((item) => item.toLowerCase() !== key)].slice(0, RECENT_PROJECTS_LIMIT)
        })
      }

      const loadBranches = React.useCallback(async (path) => {
        branchAbort.current?.abort()
        const controller = new AbortController()
        branchAbort.current = controller
        setBranchesStatus('loading')
        try {
          const payload = await requestJson({ mode: 'branches', path }, controller.signal)
          if (controller.signal.aborted) return
          setBranches(Array.isArray(payload.branches) ? payload.branches : [])
          setBranchesStatus('ready')
        } catch (branchError) {
          if (!controller.signal.aborted) setBranchesStatus('error')
        }
      }, [])

      const loadLog = React.useCallback(async (options) => {
        const append = options.append === true
        const offset = options.offset ?? 0
        const selection = options.selection ?? 'HEAD'
        const selectionParams = selection === '__all__'
          ? { scope: 'all' }
          : selection === '__remotes__'
            ? { scope: 'remotes' }
            : selection !== 'HEAD'
              ? { ref: selection }
              : {}
        logAbort.current?.abort()
        detailAbort.current?.abort()
        const controller = new AbortController()
        logAbort.current = controller
        setStatus('loading')
        setError(null)
        try {
          const payload = await requestJson({
            mode: 'log',
            path: options.path,
            limit: String(options.limit),
            offset: String(offset),
            ...selectionParams,
          }, controller.signal)
          if (controller.signal.aborted) return
          const incoming = Array.isArray(payload.commits) ? payload.commits : []
          setCommits((current) => append ? [...current, ...incoming] : incoming)
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
            loadBranches(payload.repoRoot)
          }
          setStatus('ready')
        } catch (loadError) {
          if (controller.signal.aborted || loadError?.name === 'AbortError') return
          setError(loadError)
          if (loadError?.details?.path && !append) setPathInput(loadError.details.path)
          setStatus('error')
        }
      }, [])

      React.useEffect(() => {
        const controller = new AbortController()
        projectAbort.current = controller
        let active = true

        const start = async () => {
          let scanned = []
          try {
            scanned = await scanWorkspaceProjects(controller.signal)
          } catch (scanError) {
            if (!controller.signal.aborted && active) setProjectsStatus('error')
          }
          if (!active) return
          const remembered = readRecentProjects()
          setRecentProjects(remembered)
          recentLoaded.current = true
          const initialPath = remembered[0] || scanned[0]?.path || ''
          setSelectedProjectPath(initialPath)
          setBranchSelection('HEAD')
          loadLog({ path: initialPath, limit: 50, offset: 0, selection: 'HEAD' })
        }

        start()
        return () => {
          active = false
          controller.abort()
          logAbort.current?.abort()
          detailAbort.current?.abort()
          branchAbort.current?.abort()
        }
      }, [loadLog, scanWorkspaceProjects])

      React.useEffect(() => {
        if (!copied) return undefined
        const timer = setTimeout(() => setCopied(false), 1400)
        return () => clearTimeout(timer)
      }, [copied])

      React.useEffect(() => {
        if (!recentLoaded.current) return
        writeRecentProjects(recentProjects)
      }, [recentProjects])

      const rescanProjects = async () => {
        projectAbort.current?.abort()
        const controller = new AbortController()
        projectAbort.current = controller
        setProjectsStatus('loading')
        try {
          await scanWorkspaceProjects(controller.signal)
        } catch (scanError) {
          if (!controller.signal.aborted) setProjectsStatus('error')
        }
      }

      const selectProject = (event) => {
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
        loadLog({ path, limit, offset: 0, selection: 'HEAD' })
      }

      const selectBranch = (event) => {
        const selection = event.target.value
        setBranchSelection(selection)
        loadLog({
          path: repo?.repoRoot ?? pathInput.trim(),
          limit,
          offset: 0,
          selection,
        })
      }

      const selectCommit = async (commit) => {
        setSelected(commit.hash)
        setDetailStatus('loading')
        setDetail(null)
        setDetailError(null)
        detailAbort.current?.abort()
        const controller = new AbortController()
        detailAbort.current = controller
        try {
          const payload = await requestJson({
            mode: 'commit',
            path: repo?.repoRoot ?? pathInput,
            hash: commit.hash,
          }, controller.signal)
          if (controller.signal.aborted) return
          setDetail(payload.commit)
          setDetailStatus('ready')
        } catch (loadError) {
          if (controller.signal.aborted || loadError?.name === 'AbortError') return
          setDetailError(loadError)
          setDetailStatus('error')
        }
      }

      const closeDetail = () => {
        detailAbort.current?.abort()
        setSelected(null)
        setDetail(null)
        setDetailStatus('idle')
        setDetailError(null)
      }

      const copyHash = () => {
        if (detail === null || !navigator.clipboard?.writeText) return
        navigator.clipboard.writeText(detail.hash).then(() => setCopied(true)).catch(() => {})
      }

      const submitPath = (event) => {
        event.preventDefault()
        setBranches([])
        setBranchesStatus('loading')
        setBranchSelection('HEAD')
        loadLog({ path: pathInput.trim(), limit, offset: 0, selection: 'HEAD' })
      }

      const refresh = () => {
        loadLog({ path: pathInput.trim(), limit, offset: 0, selection: branchSelection })
      }

      const loadMore = () => {
        if (!hasMore || status === 'loading') return
        loadLog({
          path: repo?.repoRoot ?? pathInput.trim(),
          limit,
          offset: nextOffset,
          append: true,
          selection: branchSelection,
        })
      }

      const projectGroups = React.useMemo(() => {
        const scannedByPath = new Map(projects.map((project) => [project.path.toLowerCase(), project]))
        const recentPaths = new Set()
        const recent = recentProjects.map((path) => {
          const key = path.toLowerCase()
          recentPaths.add(key)
          return scannedByPath.get(key) ?? {
            path,
            name: pathName(path),
            workspaceTitle: '',
            nested: false,
          }
        })
        const workspace = projects.filter((project) => !recentPaths.has(project.path.toLowerCase()))
        return { recent, workspace }
      }, [projects, recentProjects])

      const knownProjectPaths = new Set(
        [...projectGroups.recent, ...projectGroups.workspace].map((project) => project.path.toLowerCase()),
      )
      const currentProject = selectedProjectPath !== '' && !knownProjectPaths.has(selectedProjectPath.toLowerCase())
        ? { path: selectedProjectPath, name: pathName(selectedProjectPath) }
        : null
      const scanNote = projectsStatus === 'error'
        ? t('scanFailed')
        : projectsStatus === 'ready' && projects.length === 0
          ? t('noWorkspaceProjects')
          : projectsTruncated
            ? t('scanTruncated')
            : null

      const projectOption = (project) => h('option', {
        key: project.path,
        value: project.path,
        title: project.path,
      }, projectLabel(project))

      const localBranches = branches.filter((branch) => branch.kind === 'local')
      const remoteBranches = branches.filter((branch) => branch.kind === 'remote')
      const knownBranchRefs = new Set(branches.map((branch) => branch.ref))
      const customBranch = branchSelection !== 'HEAD' && branchSelection !== '__all__' && branchSelection !== '__remotes__' && !knownBranchRefs.has(branchSelection)
        ? {
            ref: branchSelection,
            name: branchSelection.replace(/^refs\/(?:heads|remotes)\//, ''),
          }
        : null
      const selectedBranch = branches.find((branch) => branch.ref === branchSelection)
      const currentBranchLabel = repo && repo.branch && repo.branch !== 'detached'
        ? `${t('currentBranch')}: ${repo.branch}`
        : t('currentBranch')
      const branchLabel = branchSelection === '__all__'
        ? t('allBranches')
        : branchSelection === '__remotes__'
          ? t('allRemoteBranches')
          : branchSelection === 'HEAD'
            ? currentBranchLabel
            : selectedBranch?.name ?? customBranch?.name ?? branchSelection.replace(/^refs\/(?:heads|remotes)\//, '')
      const branchesNote = branchesStatus === 'error' ? t('branchesFailed') : null
      const branchOption = (branch) => h('option', {
        key: branch.ref,
        value: branch.ref,
        title: branch.ref,
      }, branch.name)

      let body
      if (status === 'loading' && commits.length === 0) {
        body = h('div', { className: 'dsh-gitlog-state' },
          h('span', { className: 'dsh-gitlog-spinner', 'aria-hidden': true }),
          h('p', {}, t('loadingCommits')),
        )
      } else if (status === 'error' && commits.length === 0) {
        body = h(ErrorState, { error, t, onRetry: refresh })
      } else if (commits.length === 0) {
        body = h('div', { className: 'dsh-gitlog-state' },
          h('h2', {}, t('noCommits')),
          h('p', {}, t('noCommitsHint')),
          h('button', { type: 'button', className: 'dsh-gitlog-btn', onClick: refresh }, t('refresh')),
        )
      } else {
        body = h('div', { className: 'dsh-gitlog-body' },
          h('section', { className: 'dsh-gitlog-list', 'aria-label': t('commits') },
            h('div', { className: 'dsh-gitlog-list-head' },
              h('span', {}, `${commits.length} ${t('commits')}`),
              repo ? h('span', { className: 'dsh-gitlog-branch', title: branchLabel }, branchLabel) : null,
            ),
            commits.map((commit, index) => h(CommitRow, {
              key: commit.hash,
              commit,
              selected: selected === commit.hash,
              onSelect: selectCommit,
              t,
              row: graph.rows[index],
              geometry,
            })),
            status === 'loading'
              ? h('div', { className: 'dsh-gitlog-loading-line' },
                  h('span', { className: 'dsh-gitlog-spinner', 'aria-hidden': true }),
                  h('span', {}, t('loadingCommits')),
                )
              : null,
            hasMore
              ? h('div', { className: 'dsh-gitlog-more' },
                  h('button', {
                    type: 'button',
                    className: 'dsh-gitlog-btn',
                    onClick: loadMore,
                    disabled: status === 'loading',
                  }, t('loadMore')),
                )
              : null,
          ),
          h('aside', { className: 'dsh-gitlog-detail', 'aria-label': t('details') },
            h(DetailPane, {
              detail,
              status: detailStatus,
              error: detailError,
              t,
              onClose: closeDetail,
              copied,
              onCopy: copyHash,
            }),
          ),
        )
      }

      return h('div', { className: 'dsh-gitlog' },
        h('style', null, CSS),
        h('header', { className: 'dsh-gitlog-header' },
          h('div', { className: 'dsh-gitlog-heading' },
            h('h1', {}, t('title')),
            h('p', { className: 'dsh-gitlog-subtitle', title: repo ? repo.repoRoot : t('subtitle') },
              repo ? `${repo.repoName} · ${branchLabel} · ${repo.repoRoot}` : t('subtitle'),
            ),
          ),
          h('button', {
            type: 'button',
            className: 'dsh-gitlog-btn',
            onClick: refresh,
            disabled: status === 'loading',
          }, t('refresh')),
        ),
        h('form', { className: 'dsh-gitlog-controls', onSubmit: submitPath },
          h('label', { className: 'dsh-gitlog-field project' },
            h('span', {}, t('project')),
            h('select', {
              value: selectedProjectPath,
              onChange: selectProject,
              disabled: projectsStatus === 'loading',
              title: selectedProjectPath || t('manualPath'),
            },
              h('option', { value: '' }, projectsStatus === 'loading' ? t('scanningProjects') : t('manualPath')),
              currentProject ? projectOption(currentProject) : null,
              projectGroups.recent.length > 0
                ? h('optgroup', { label: t('recentProjects') }, projectGroups.recent.map(projectOption))
                : null,
              projectGroups.workspace.length > 0
                ? h('optgroup', { label: t('workspaceProjects') }, projectGroups.workspace.map(projectOption))
                : null,
            ),
          ),
          h('button', {
            type: 'button',
            className: 'dsh-gitlog-btn',
            onClick: rescanProjects,
            disabled: projectsStatus === 'loading',
          }, t('rescan')),
          h('label', { className: 'dsh-gitlog-field grow' },
            h('span', {}, t('path')),
            h('input', {
              type: 'text',
              value: pathInput,
              onChange: (event) => {
                setPathInput(event.target.value)
                setSelectedProjectPath('')
              },
              placeholder: t('pathPlaceholder'),
              spellCheck: false,
              autoComplete: 'off',
            }),
          ),
          h('label', { className: 'dsh-gitlog-field branch' },
            h('span', {}, t('branch')),
            h('select', {
              value: branchSelection,
              onChange: selectBranch,
              title: branchLabel,
            },
              h('option', { value: 'HEAD' }, currentBranchLabel),
              h('option', { value: '__all__' }, t('allBranches')),
              h('option', { value: '__remotes__' }, t('allRemoteBranches')),
              localBranches.length > 0
                ? h('optgroup', { label: t('localBranches') }, localBranches.map(branchOption))
                : null,
              remoteBranches.length > 0
                ? h('optgroup', { label: t('remoteBranches') }, remoteBranches.map(branchOption))
                : null,
              customBranch ? branchOption(customBranch) : null,
            ),
          ),
          h('label', { className: 'dsh-gitlog-field' },
            h('span', {}, t('limit')),
            h('select', {
              value: limit,
              onChange: (event) => setLimit(Number(event.target.value)),
            }, [25, 50, 100, 200, 0].map((value) => h('option', { key: value, value }, value === 0 ? t('allCommits') : String(value)))),
          ),
          h('button', { type: 'submit', className: 'dsh-gitlog-btn primary', disabled: status === 'loading' }, t('load')),
        ),
        scanNote !== null ? h('p', { className: 'dsh-gitlog-note' }, scanNote) : null,
        branchesNote !== null ? h('p', { className: 'dsh-gitlog-note' }, branchesNote) : null,
        error !== null && commits.length > 0
          ? h('p', { className: 'dsh-gitlog-note', role: 'status' }, `${t('errorTitle')} · ${error.message}`)
          : null,
        body,
      )
    }

    function GitLogIcon({ size }) {
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
        focusable: false,
      },
        h('circle', { cx: 6.5, cy: 5.5, r: 2 }),
        h('circle', { cx: 6.5, cy: 18.5, r: 2 }),
        h('circle', { cx: 17.5, cy: 8.5, r: 2 }),
        h('path', { d: 'M6.5 7.5v9' }),
        h('path', { d: 'M17.5 10.5c0 4-5 4.2-9 4.7' }),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'git-log-viewer: dictionaries')
        const t = ctx.locale.bind(NS)

        ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: 'git-log',
          locale: NS,
        }, GitLogPanel)), 'git-log-viewer: main panel')

        ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'git-log',
          order: 15,
          label: () => t('panel'),
          locale: NS,
        }, GitLogIcon)), 'git-log-viewer: sidebar entry')
      },
    }
  },
})
