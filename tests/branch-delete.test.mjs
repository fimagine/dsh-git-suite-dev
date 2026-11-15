import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

const dist = pathToFileURL(join(process.cwd(), 'dist')).href + '/'
const { createBranchActionHandler } = await import(`${dist}branch-action-handler.js`)

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' })
}

async function call(handler, root, body) {
  const server = http.createServer((req, res) => { void handler(req, res) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}`, {
      method: 'POST',
      headers: { 'x-dsh-git-suite': '1', 'content-type': 'application/json' },
      body: JSON.stringify({ path: root, ...body }),
    })
    return { status: response.status, payload: await response.json() }
  } finally {
    server.closeAllConnections()
    server.close()
  }
}

test('branch delete requires force for an unmerged branch', async () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-branch-delete-'))
  try {
    git(root, ['init', '-q', '-b', 'main'])
    git(root, ['config', 'user.email', 'test@example.com'])
    git(root, ['config', 'user.name', 'Test'])
    writeFileSync(join(root, 'main.txt'), 'main\n')
    git(root, ['add', '.'])
    git(root, ['commit', '-q', '-m', 'main'])
    git(root, ['switch', '-q', '-c', 'side'])
    writeFileSync(join(root, 'side.txt'), 'side\n')
    git(root, ['add', '.'])
    git(root, ['commit', '-q', '-m', 'side'])
    git(root, ['switch', '-q', 'main'])

    const handler = createBranchActionHandler({ workspaces: () => [], defaultPath: () => root })
    const refused = await call(handler, root, { action: 'delete', branch: 'side' })
    assert.notEqual(refused.status, 200)
    assert.match(refused.payload.error.message, /not fully merged/i)

    const forced = await call(handler, root, { action: 'delete', branch: 'side', force: true })
    assert.equal(forced.status, 200)
    assert.equal(git(root, ['branch', '--list', 'side']).trim(), '')
  } finally {
    try {
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 })
    } catch {
      // Windows can hold a transient git handle.
    }
  }
})
