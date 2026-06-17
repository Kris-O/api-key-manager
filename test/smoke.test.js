'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { test, before, after } = require('node:test');

const PORT = 17432;
const BASE = `http://127.0.0.1:${PORT}`;
let server;

async function waitForServer() {
  const deadline = Date.now() + 8000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/status`);
      if (res.ok) return;
    } catch (err) {
      lastError = err;
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  throw lastError || new Error('Server did not become ready');
}

before(async () => {
  server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, KM_PORT: String(PORT), KM_NO_OPEN: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  server.on('exit', code => {
    if (code && code !== 0) {
      process.stderr.write(`Key Manager server exited with code ${code}\n`);
    }
  });

  await waitForServer();
});

after(() => {
  if (server && !server.killed) server.kill();
});

test('serves the single page app', async () => {
  const res = await fetch(`${BASE}/`);
  const html = await res.text();

  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(html, /Key Manager/);
});

test('returns driver status and masked config', async () => {
  const [statusRes, configRes, driversRes, schemasRes] = await Promise.all([
    fetch(`${BASE}/api/status`),
    fetch(`${BASE}/api/config`),
    fetch(`${BASE}/api/drivers`),
    fetch(`${BASE}/api/n8n/schemas`),
  ]);

  assert.equal(statusRes.status, 200);
  assert.equal(configRes.status, 200);
  assert.equal(driversRes.status, 200);
  assert.equal(schemasRes.status, 200);

  const status = await statusRes.json();
  const config = await configRes.json();
  const drivers = await driversRes.json();
  const schemas = await schemasRes.json();

  assert.ok(Array.isArray(status));
  assert.ok(status.some(item => item.id === 'n8n'));
  assert.equal(typeof config.n8nBaseUrl, 'string');
  assert.ok(Array.isArray(drivers));
  assert.ok(schemas.openAiApi);
});

test('rejects unsafe short rotation keys', async () => {
  const res = await fetch(`${BASE}/api/rotate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newKey: '123' }),
  });
  const body = await res.json();

  assert.equal(res.status, 400);
  assert.equal(body.ok, false);
  assert.match(body.error, /too short/i);
});
