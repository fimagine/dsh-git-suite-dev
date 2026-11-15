import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import { withForgePost } from '../dist/forge-post.js'

const dist = pathToFileURL(join(process.cwd(), 'dist')).href + '/'
const { createPullDeleteHandler } = await import(`${dist}pr-delete-handler.js`)
const { createGiteeDecisionHandler } = await import(`${dist}pr-gitee-decision-handler.js`)

function tempRepo(remote) {
  const root = mkdtempSync(join(tmpdir(), 'dsh-pr-action-'))
  execFileSync('git', ['init', '-q', '-b', 'main', root])
  execFileSync('git', ['-C', root, 'remote', 'add', 'origin', remote])
  return root
}

function cleanup(root) {
  try {
    rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 })
  } catch {
    // Windows can keep a transient handle after the aborting git process.
  }
}

function restoreEnv(t, key) {
  const previous = process.env[key]
  t.after(() => {
    if (previous === undefined) delete process.env[key]
    else process.env[key] = previous
  })
}

async function call(handler, root, body) {
  const server = http.createServer((req, res) => { void handler(req, res) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}`, {
      method: 'POST',
      headers: { 'x-dsh-git-suite': '1', 'content-type': 'application/json' },
      body: JSON.stringify({ path: root, remote: 'origin', ...body }),
    })
    return { status: response.status, payload: await response.json() }
  } finally {
    server.closeAllConnections()
    server.close()
  }
}

test('delete handler rejects non-GitLab forges and missing tokens', async (t) => {
  restoreEnv(t, 'GITLAB_TOKEN')
  const gitee = tempRepo('https://gitee.com/acme/demo.git')
  const giteeResult = await call(createPullDeleteHandler({ workspaces: () => [], defaultPath: () => gitee }), gitee, { number: 1 })
  assert.equal(giteeResult.status, 400)
  assert.equal(giteeResult.payload.error.code, 'forge-unsupported')

  const gitlab = tempRepo('https://gitlab.com/acme/demo.git')
  delete process.env.GITLAB_TOKEN
  const tokenResult = await call(createPullDeleteHandler({ workspaces: () => [], defaultPath: () => gitlab }), gitlab, { number: 1 })
  assert.equal(tokenResult.status, 401)
  assert.equal(tokenResult.payload.error.code, 'forge-auth-required')
  cleanup(gitee)
  cleanup(gitlab)
})

test('Gitee handler validates action and number', async (t) => {
  restoreEnv(t, 'GITEE_TOKEN')
  const root = tempRepo('https://gitee.com/acme/demo.git')
  process.env.GITEE_TOKEN = 'token'
  const handler = createGiteeDecisionHandler({ workspaces: () => [], defaultPath: () => root })
  const badAction = await call(handler, root, { number: 1, action: 'merge' })
  assert.equal(badAction.status, 400)
  assert.equal(badAction.payload.error.code, 'invalid-action')
  const badNumber = await call(handler, root, { number: 0, action: 'review' })
  assert.equal(badNumber.status, 400)
  assert.equal(badNumber.payload.error.code, 'invalid-number')
  cleanup(root)
})

test('withForgePost returns 504 when the handler exceeds its timeout', async (t) => {
  restoreEnv(t, 'GITLAB_TOKEN')
  const root = tempRepo('https://gitlab.com/acme/demo.git')
  process.env.GITLAB_TOKEN = 'token'
  const req = Readable.from([Buffer.from(JSON.stringify({ path: root, remote: 'origin', number: 1 }))])
  req.headers = { 'x-dsh-git-suite': '1', 'content-length': '55' }
  req.method = 'POST'
  const res = {
    statusCode: 0,
    headers: {},
    body: null,
    writableEnded: false,
    destroyed: false,
    setHeader(key, value) { this.headers[key] = value },
    end(value) { this.body = value; this.writableEnded = true },
    once() {},
    off() {},
  }
  await withForgePost(req, res, { workspaces: () => [], defaultPath: () => root }, {
    timeoutMs: 20,
    forbidden: 'no',
    methodMessage: 'post only',
    handle: async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
      return {}
    },
  })
  assert.equal(res.statusCode, 504)
  assert.equal(JSON.parse(Buffer.from(res.body).toString()).error.code, 'forge-timeout')
  cleanup(root)
})
