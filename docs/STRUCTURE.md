# Structure and build

English | [中文](STRUCTURE.zh.md)

The README keeps installation and usage; this document records the layout, module responsibilities, and build pipeline.

## Layout

```text
src/
  host/
    index.ts
    resource.ts
    switch-handler.ts
    workspace-action.ts
    clone-handler.ts
    commit-actions.ts
    generate-handler.ts
    pick-handler.ts
    sync-handler.ts
    remote-handler.ts
    remote-url.ts
    branch-action-handler.ts
    http.ts
    git.ts
    repository.ts
    scan.ts
    parsers.ts
    types.ts
    dsh.ts
    errors.ts
    routes/
      branches.ts
      refs.ts
      log.ts
      commit.ts
      status.ts
      workspace-diff.ts
      switch.ts
  client/
    index.tsx
    plugin.ts
    runtime.ts
    dsh.ts
    GitLogPanel.tsx
    SidebarPanel.tsx
    hooks/
      useGitLogView.ts
      useWorkspace.ts
    components/
      AddBranchDialog.tsx
      AddRemoteDialog.tsx
      AddTagDialog.tsx
      BranchDialogs.tsx
      BranchMenu.tsx
      Button.tsx
      CommitActions.tsx
      CommitColumnsMenu.tsx
      CommitGraph.tsx
      CommitList.tsx
      CommitRefField.tsx
      CommitRow.tsx
      DeleteRemoteBranchDialog.tsx
      DeleteRemoteDialog.tsx
      DeleteTagDialog.tsx
      DetailPane.tsx
      DialogShell.tsx
      Dropdown.tsx
      EditRemoteDialog.tsx
      EditTagDialog.tsx
      ForcePushTagDialog.tsx
      FetchTagDialog.tsx
      FileActionDialog.tsx
      ErrorState.tsx
      FetchDialog.tsx
      GitLogIcon.tsx
      IgnoreFileDialog.tsx
      PanelControls.tsx
      PushDialog.tsx
      Refs.tsx
      RefsTree.tsx
      RemoteBranchMenu.tsx
      RemoteMenu.tsx
      RepoActions.tsx
      RepositoryMenu.tsx
      SettingsDialog.tsx
      Splitter.tsx
      States.tsx
      SyncDialog.tsx
      TagMenu.tsx
      Toast.tsx
      Tooltip.tsx
      TreeIcons.tsx
      WorkspacePane.tsx
    lib/
      api.ts
      format.ts
      graph.ts
      patch.ts
      projects.ts
      recent-projects.ts
      refs-tree.ts
      selection.ts
      ui-state.ts
    locales/
      en.ts
      zh.ts
    styles.scss
    styles.ts
scripts/build-client.mjs
tsconfig.json
tsconfig.host.json
cordis.patch.yml
locale/
icon.svg
docs/
  STRUCTURE.md
  STRUCTURE.zh.md
README.md
README.zh.md
LICENSE
```

## Host half

| File | Responsibility |
|---|---|
| `host/index.ts` | Registers the read-only `/git-suite` route and the POST handlers for switch, actions, clone, message generation, directory picking, tag, branch, checkout, sync, remote, and branch actions |
| `host/resource.ts` | Admits requests, dispatches read modes, and maps errors to responses |
| `host/switch-handler.ts` | Node handler for branch switching (DSH resource routes are GET/HEAD only; a POST needs a handler) |
| `host/workspace-action.ts` | Node handler for stage/unstage, discard one file's unstaged changes (`checkout --`), delete one untracked file, append an ignore pattern to `.gitignore`, commit (optionally amend), and the optional push |
| `host/clone-handler.ts` | Node handler that validates the remote URL and destination, clones into a staging directory beside the destination, and renames it into place |
| `host/commit-actions.ts` | Validates names, creates tags and branches (at a commit hash or a ref), and checks out a local branch, a commit hash, or any ref as a detached HEAD (never forced) |
| `host/generate-handler.ts` | Node handler that reads the staged/unstaged diff and calls `ctx.llm` with the default model |
| `host/pick-handler.ts` | Opens the native `ctx.directoryPicker`; `mode: 'repo'` (default) resolves the Git root and checks the DSH workspace, while `mode: 'directory'` returns a plain directory for clone destinations |
| `host/sync-handler.ts` | `POST /git-suite/sync`: fetch supports fetchAll/prune/tags/forceTags (or one remote), pull a chosen remote branch, push per-ref local→remote mappings with optional tracking, single tags (`tagRefs`), all tags, and force; `fetch-tag` force-replaces one local tag from the remote |
| `host/remote-handler.ts` | `POST /git-suite/remote`: add (`action: 'add'`), rename and/or replace the URL (`action: 'set-url'`), or remove (`action: 'remove'`) one configured remote after validating the names, the URL, and whether they already exist |
| `host/branch-action-handler.ts` | `POST /git-suite/branch-action`: merge, rebase, rename, or delete a local branch; check out a remote-tracking branch as a new tracking branch (`track`); delete a branch on a remote (`delete-remote`, `push --delete`); with validation and git error details |
| `host/dsh.ts` | Local DSH host types, including `webServer`, workspaces, `directoryPicker`, `llm`, and `agentDefaultModel` |
| `host/http.ts` | JSON responses, error serialization, same-origin and private-header checks |
| `host/git.ts` | Runs read-only git commands and maps failures to error codes |
| `host/repository.ts` | Validates paths and resolves the repository root with `rev-parse` |
| `host/remote-url.ts` | Accepts https/ssh/git/file and absolute local remotes; rejects `ext::`-style transports |
| `host/reveal-handler.ts` | `POST /git-suite/reveal`: keeps the path inside the repository, reports `file-missing`, and opens the OS file browser with the file selected |
| `host/scan.ts` | Scans workspaces for Git projects with depth and entry limits |
| `host/parsers.ts` | Parses log output, commit headers, numstat, and refs |
| `host/routes/` | Readers for branches, the refs tree, paged log, commit detail, working-tree status/diff, plus local branch switching |
| `host/routes/status.ts` | Working-tree status: staged/unstaged files, branch/upstream/ahead/behind, and the Git author |
| `host/routes/workspace-diff.ts` | Per-file staged/unstaged diff; synthesizes an added-file patch for untracked files |
| `host/routes/switch.ts` | Runs `git switch` for a local-branch double-click (POST, local-only, never forced) |
| `host/routes/tag.ts` | `mode=tag`: one tag's commit, short hash, subject, annotation message, and whether it is annotated |
| `host/routes/tag-status.ts` | `mode=tag-status`: compares local tags with one remote (`ls-remote --tags`, annotated tags peeled to commits) and reports same/different/local-only plus remote-only names |
| `host/routes/resolve.ts` | `mode=resolve`: turns any ref (`HEAD~2`, a branch, a tag, a short hash) into its commit hash, short hash, author, date, and subject |
| `host/types.ts` | Host payload types |
| `host/errors.ts` | `RouteError` with status, code, and details |

## Client half

| File | Responsibility |
|---|---|
| `client/index.tsx` | Registers the lazy factory with `window.__ModuleLoader__` |
| `client/plugin.ts` | Registers the `gitSuite` dictionaries, the `main` panel, the `sidebar.panellist` entry, and the right-sidebar `git` tab type |
| `client/runtime.ts` | Binds the React instance from DSH and exposes `h` plus hook wrappers |
| `client/dsh.ts` | Local declarations for the DSH client API used here |
| `client/GitLogPanel.tsx` | Panel shell: header, controls, notes, history/commit view switch, and body |
| `client/SidebarPanel.tsx` | Right-sidebar tab wrapper with the narrow single-column layout |
| `client/hooks/useGitLogView.ts` | Project scan, refs tree, paged log, detail selection, and actions |
| `client/hooks/useWorkspace.ts` | Working-tree status, per-file diff, stage/unstage, commit actions, and AI message generation |
| `client/components/` | Presentational components for the list, rows, graph, history toolbar (branch/remotes/sort), refs tree (double-click switches branches, **+** in the branches and remotes rows adds one), draggable splitters, detail, settings dialog, working-tree/commit pane, second-line action row (history/commit switch then pull/push/fetch), repository + menu (clone/select), add/delete remote dialogs, edit remote dialog (name + URL), add-branch dialog, `Dropdown` (optional name search, enabled for repositories), commit context menu (tag/branch/checkout), tag context menu (checkout), remote-branch context menu (checkout/merge/rebase/pull/delete), column-visibility menu, file context menu (open in file explorer), toast, commit-ref field (editable commit id with live resolution), shared `Button`/`DialogActions` (28px/12px), errors, and states |
| `client/lib/api.ts` | Fetch wrapper with the private header and `AbortSignal` |
| `client/lib/graph.ts` | Lane layout and geometry for the commit graph |
| `client/lib/patch.ts` | Splits a commit's combined patch into one section per file for the file list |
| `client/lib/refs-tree.ts` | Branch folder folding, remote/stash nodes, and tree search filtering |
| `client/lib/selection.ts` | Maps the selection model to request parameters and labels |
| `client/lib/projects.ts` | Pure helpers for project groups, labels, and branch labels |
| `client/lib/recent-projects.ts` | Recent-project persistence across localStorage and a cookie |
| `client/lib/ui-state.ts` | Persisted panel UI state (view, sort, page size, splitters, tree expansion) in localStorage, with validation |
| `client/lib/format.ts` | Absolute date-time formatting (`2026-10-25 03:10:45` in Chinese, `Oct 25, 2026, 03:10:45` in English) |
| `client/locales/` | English and Chinese strings, with the English key set as the source of truth |
| `client/styles.scss` | SCSS stylesheet source |
| `client/styles.ts` | Exports the CSS string inlined into the artifact |

## Refs tree

The tree reads `mode=tree`, which returns local branches, tags, remote groups, stashes, and submodules. On the client, `buildRefSections` folds names like `feat/x` into folders and `filterTree` implements search; tags, stashes, or submodules with no entries produce no section, and the submodule section sits last. Clicking a ref node produces a `Selection` (`head` / `all` / `remotes` / `branch` / `tag` / `stash`) that `selectionParams` turns into log request parameters; clicking a submodule node opens that submodule directory (`openPath`). The log payload reports `superproject` via `git rev-parse --show-superproject-working-tree`; opening a submodule shows `[submodule]name` in the project selector and a **← Parent** button back to the superproject.

- Branches and tags → `ref=<ref>`; tags may use `refs/tags/*`.
- Stashes → `scope=stash&ref=<commit hash>`; the host runs `--no-walk -n 1` to load only that commit, and its detail still uses `mode=commit`.
- Branch groups list local branches directly; remote groups list their remote branches directly; the tree no longer offers "all branches" or "all remotes" entries.
- A local branch row shows `↑N` / `↓N` after its name when it is ahead of or behind its upstream (read from `%(upstream:track)`), and `gone` when the upstream no longer exists.
- Tag rows are compared with the upstream remote (or the first remote) automatically once the tree loads and again whenever the tag set changes; the **+** on the tags row opens the new-tag dialog instead of a manual compare. Tags that exist only locally get an upload-arrow icon and tags whose commit differs get an inequality icon; there is no summary line. Comparisons stay silent when the remote is unreachable.
- The **Remotes** section row ends with a **+** button that opens the add-remote dialog and POSTs `{ action: 'add', name, url }` to `/git-suite/remote`; the section opens itself when a remote is added.
- The **Branches** section row carries the same **+** button: the new-branch dialog sends `{ name, base }` to `/git-suite/branch`, where `base` defaults to `HEAD` and may be any branch, tag, or revision.
- Right-clicking a remote-tracking branch offers **Checkout** (as a new tracking branch), merge / rebase it into the current branch, pull it into the current branch (through `/git-suite/sync`), and delete it on the remote (confirmation, `push --delete`).
- Right-clicking a remote group opens fetch / pull / push, **Edit remote** (rename and URL, `POST /git-suite/remote { action: 'set-url', newName }`), and remove; hovering the group row shows its configured URL.
- Right-clicking the log header opens a checkbox menu for the graph, date, author, and commit columns (the description column always stays); the choice is persisted and a panel narrower than 760px forces the author and commit columns off.
- Row hints (remote URL, submodule path, branch switch hint, and truncated labels) use the plugin's own `useTooltip` box instead of the browser `title` bubble, so they render the same on Windows, macOS, and embedded webviews.
- Right-clicking a tag opens **Checkout {tag}**, **Edit {tag}**, **Push {tag}** / **Force push {tag}**, **Replace local {tag} with the remote** (only when the automatic comparison reports a mismatch), and **Delete {tag}**: checkout detaches HEAD at the tag through `POST /git-suite/checkout { ref }`; edit loads the tag through `mode=tag` and saves a rename, a new commit, and/or a rewritten message; push sends `{ action: 'push', tagRefs: [name] }`; force push and the remote→local replacement both rewrite a tag, so each goes through a warning dialog first; delete runs `POST /git-suite/tag { action: 'delete' }` after a confirmation.

While viewing HEAD, the tree highlights the checked-out branch (`head` itself has no node).

## Branch switching

Double-clicking a **local branch** in the tree POSTs to `/git-suite/switch`:

- Only `refs/heads/*` is accepted; remote branches, tags, and stashes never switch.
- The host runs `git switch <branch>` and never adds `--force`; a switch that would overwrite local changes returns 409 `worktree-dirty` and leaves the branch unchanged.
- On success the client reloads HEAD and the refs tree, resets the selection to `head`, and moves the current-branch highlight.
- The route accepts POST only (GET returns 405) and still requires the same-origin check and the private request header.

## Working tree and commits

The second row's **History / Commit** switch changes between history and the commit/file-status view in the same page (`WorkspacePane` + `useWorkspace`), sharing the repository/path controls, refs tree, and branch switching:

- `GET /git-suite?mode=status` reads `git status --porcelain=v2 -z --branch -uall`, plus staged/unstaged numstat and untracked line counts, returning staged/unstaged files, the branch, upstream, ahead/behind, and the Git author.
- `GET /git-suite?mode=workspace-diff&file=…&scope=staged|unstaged|untracked` returns one file's diff; untracked files get a synthesized `/dev/null → file` patch, capped at 400k characters per file.
- `POST /git-suite/action` (a Node handler, because DSH resource routes are GET/HEAD only) accepts JSON:
  - `stage` / `unstage` with `paths` or `all`, running `git add -A` / `git reset -q HEAD`.
  - `commit` with `message`, `amend`, and `push`, running `git commit -m` (optionally `--amend`) and optionally `git push` to the configured upstream.
- Staging is file-level (hunk-level staging is not available yet); each file row ends with a **+** (stage this file) or **−** (unstage it) button, and double-clicking a row flips it between staged and unstaged (its text is `user-select: none` so the double-click never selects the label). A successful commit refreshes the status and reloads HEAD/the refs tree. The toolbar's pull/push can pick a remote and branch, and force push is used only when explicitly checked; the push after committing still targets the configured upstream only.
- **Generate with AI** beside the commit message POSTs to `/git-suite/generate-message`, which reads the staged (otherwise unstaged) diff and calls `ctx.llm.stream()` with the provider/model from `ctx.agentDefaultModel.currentSelection()`; the file list and diff are sent to the configured model provider, and the generated text only fills the input. Missing default model, no changes, and model failures return explicit errors.
- The **+** menu beside the repository/path controls (click or hover) offers **Clone remote repository** and **Select local repository**: cloning POSTs to `/git-suite/clone`, which validates the URL (https / ssh / git / file / absolute local paths, rejecting `ext::` and similar) and the destination (absolute, existing parent, not already present), runs `git clone`; the clone dialog's destination can use `POST /git-suite/pick-directory` with `mode: 'directory'` to pick a parent folder and append the repository name. The select-local dialog offers **Choose folder** (`mode: 'repo'` native picker), scanned repositories, and a manual path; **Open** only opens the repository in this panel. Use DSH's own Workspaces add flow to register a DSH workspace. A non-native picker asks for a typed path.
- Right-clicking a changed file opens **Open in file explorer** plus one destructive entry: **Discard changes** for an unstaged modification (`git checkout --`, warning dialog) and **Delete file** for an untracked file (warning dialog; the host refuses tracked paths with `409 tracked-file`). Untracked files also offer **Ignore**, which appends one pattern to `.gitignore`: the exact path, the bare file name (matches at any depth), or `*.ext` for the extension. Staged files only offer the reveal action.
- Right-clicking a changed file opens a menu with **Open in file explorer** (`POST /git-suite/reveal`): the host refuses paths outside the repository, answers `404 file-missing` when the file is gone, and otherwise opens the OS browser with the file selected (`explorer /select,`, `open -R`, `xdg-open`). A missing file shows a toast instead of an inline error.
- Every write remains POST + same-origin + private request header; errors return as JSON and render in the workspace.

## Commit context actions

Right-clicking a commit row opens the **Tag / Branch / Checkout** menu (`CommitActions`):

- **Tag** → `POST /git-suite/tag` (title **New tag**): validates with `git check-ref-format refs/tags/<name>`; a non-empty message uses `git tag -a -m`, otherwise a lightweight tag; `-f` is added only when `force: true` (the **Force an existing tag** checkbox) is set. Its commit field is prefilled with the right-clicked commit, editable, and resolves live like the branch dialog.
- **Branch** → `POST /git-suite/branch`: validates with `git check-ref-format --branch`, then runs `git branch <name> <start>`. The dialog's start-point field is prefilled with the right-clicked commit and stays editable; typing another ref resolves it live through `mode=resolve` and shows that commit's short hash and subject under the field. An empty field falls back to the clicked commit.
- **Checkout** → `POST /git-suite/checkout`: `branch` runs `git switch <branch>`, `hash` runs `git switch --detach <hash>`; never forced; a working tree that would be overwritten returns 409 `worktree-dirty`. The client asks for confirmation first, warns explicitly for a detached HEAD, and mentions the working-tree risk for a branch.
- Tag/branch/checkout refresh the log and refs tree; checkout resets the selection to HEAD.
- Right-clicking a branch or tag **chip** inside a commit row opens the same menu the refs tree uses (local branch menu, remote-tracking branch menu, or tag menu with its checkout/edit/push/replace/delete entries); unrelated refs fall back to the commit menu.
- All three routes are POST + same-origin + the private request header.

## Right-sidebar tab

The right sidebar's Start page belongs to `ui-sidebar-right`. The plugin joins it through the same two-stage registration any tab type uses:

1. `ctx.sidebarRightTabs.register(...)` registers the page type (`id` is the package name, `kind: 'git'`) and its Start-page entry; the entry's `order: 40` places it after files (10), terminal (20), and browser (30).
2. `ctx.slots.register({ name: 'sidebar.right.pane.tab', key: id, locale: 'gitSuite' }, SidebarGitLogPanel)` registers the tab body; `key` must equal the type's `id`.

The registration runs inside `ctx.inject(['sidebarRightTabs'], …)`, so the right sidebar is an optional dependency: without it, the main panel and the left-sidebar entry still work. The wrapper class `.dsh-gitlog-sidebar` switches the panel to the narrow layout (smaller padding, single-column list and detail, full-width path field).

## Build pipeline

`pnpm build` runs, in order:

1. `tsc -p tsconfig.json` typechecks everything (`noEmit`).
2. `tsc -p tsconfig.host.json` compiles `src/host/` into `dist/`, with `dist/index.js` as the entry.
3. `node scripts/build-client.mjs` compiles `src/client/styles.scss` to `src/client/styles.generated.css` with `sass.compile()`, then bundles `src/client/index.tsx` into `dist/client.js` (plus a source map) with esbuild; `--loader:.css=text` inlines the CSS into the artifact.

### Why the client is still bundled

DSH loads exactly one lazy factory per package through `exports["./client"]` (`window.__ModuleLoader__.load({ id, factory })`), and the browser does not resolve the plugin's internal relative imports as ESM. The split `src/client/` sources therefore have to be bundled into a single `dist/client.js`. React comes from the factory's `require('react')` (DSH's module table) and is not bundled.

### Artifacts and development

- `dist/` and `src/client/styles.generated.css` are build artifacts and are ignored by Git. After cloning, run `pnpm install && pnpm build` first; DSH Plugin Manager does not build a local directory for you.
- `pnpm watch:client` watches `src/client/` and `styles.scss`; a SCSS change recompiles it and triggers an esbuild rebuild, and DSH HMR watches `dist/client.js` to reload the plugin on the page.
- Changing entry paths in `package.json` requires restarting DSH (or disabling and re-enabling the plugin row), because the running Host caches the plugin manifest.
