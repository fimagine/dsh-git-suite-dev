import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import test from 'node:test'
import { withForgePost, parsePullNumber } from '../dist/forge-post.js'
import { readJsonBody, sendResponse } from '../dist/http.js'

function request(body, headers = {}, method = 'POST') {
  const req = Readable.from(body === null ? [] : [Buffer.from(body)])
  req.headers = headers
  req.method = method
  return req
}

function response() {
  return {
    statusCode: 0,
    headers: {},
    body: null,
    writableEnded: false,
    destroyed: false,
    setHeader(key, value) { this.headers[key] = value },
    end(value) { this.body = value; this.writableEnded = true },
  }
}

test('readJsonBody parses an object', async () => {
  const body = await readJsonBody(request('{"number":5}'), 1024)
  assert.deepEqual(body, { number: 5 })
})

test('readJsonBody rejects empty, invalid, and non-object JSON', async () => {
  for (const raw of ['', '{', '[]', 'null', '"x"']) {
    await assert.rejects(readJsonBody(request(raw), 1024), error => error.status === 400)
  }
})

test('readJsonBody rejects a declared and an actual oversized body', async () => {
  await assert.rejects(
    readJsonBody(request('{}', { 'content-length': '20000' }), 1024),
    error => error.status === 413,
  )
  await assert.rejects(
    readJsonBody(request('x'.repeat(20_000)), 1024),
    error => error.status === 413,
  )
})

test('parsePullNumber accepts positive integers and rejects everything else', () => {
  assert.equal(parsePullNumber(5), 5)
  for (const value of [0, -1, 1.5, '5', null, undefined, 2_147_483_648]) {
    assert.throws(() => parsePullNumber(value), error => error.status === 400)
  }
})

test('withForgePost rejects missing private headers and non-POST requests', async () => {
  const forbidden = response()
  await withForgePost(request('{}'), forbidden, {}, {
    forbidden: 'no',
    methodMessage: 'post only',
    handle: async () => ({}),
  })
  assert.equal(forbidden.statusCode, 403)

  const wrongMethod = response()
  await withForgePost(
    request(null, { 'x-dsh-git-suite': '1' }, 'GET'),
    wrongMethod,
    {},
    { forbidden: 'no', methodMessage: 'post only', handle: async () => ({}) },
  )
  assert.equal(wrongMethod.statusCode, 405)
})

test('sendResponse does not write to a finished response', async () => {
  const finished = response()
  finished.writableEnded = true
  await sendResponse(finished, new Response('x'))
  assert.equal(finished.body, null)
})
