'use strict';
const http    = require('http');
const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const { execSync } = require('child_process');

const VERSION  = '2.2.0';
const PORT     = Number(process.env.KM_PORT) || 7432;
const DIR      = __dirname;
const CFG_PATH = path.join(DIR, 'app-config.json');

const APPDATA = process.env.APPDATA || path.join(os.homedir(), '.config');
const HOME    = os.homedir();

// ─── Known n8n credential type schemas ────────────────────────
const CRED_SCHEMAS = {
  openAiApi: {
    label: 'OpenAI / LM Studio',
    docsUrl: 'https://platform.openai.com/api-keys',
    fields: [
      { key: 'apiKey',         label: 'API Key',             type: 'password', required: true,  highlight: true, placeholder: 'sk-proj-...' },
      { key: 'url',            label: 'Base URL',            type: 'url',      required: false, placeholder: 'https://api.openai.com/v1'  },
      { key: 'headerName',     label: 'Custom Header Name',  type: 'text',     required: true,  default: ''                               },
      { key: 'headerValue',    label: 'Custom Header Value', type: 'password', required: true,  default: ''                               },
      { key: 'allowedDomains', label: 'Allowed Domains',     type: 'text',     required: true,  default: ''                               },
    ]
  },
  httpBasicAuth: {
    label: 'HTTP Basic Auth',
    fields: [
      { key: 'user',     label: 'Username', type: 'text',     required: true  },
      { key: 'password', label: 'Password', type: 'password', required: true, highlight: true },
    ]
  },
  httpHeaderAuth: {
    label: 'HTTP Header Auth',
    servicePresets: [
      { name: 'Brave Search', icon: '🦁', fields: { name: 'X-Subscription-Token' }, docsUrl: 'https://brave.com/search/api/', placeholder: 'BSA...' },
      { name: 'Serper',       icon: '🌐', fields: { name: 'X-API-KEY'             }, docsUrl: 'https://serper.dev/api-key',   placeholder: '' },
      { name: 'ElevenLabs',   icon: '🎙️', fields: { name: 'xi-api-key'            }, docsUrl: 'https://elevenlabs.io/app/settings/api-keys', placeholder: '' },
      { name: 'Tavily',       icon: '🔍', fields: { name: 'Authorization'          }, docsUrl: 'https://app.tavily.com', placeholder: 'tvly-...' },
      { name: 'Perplexity',   icon: '🔮', fields: { name: 'Authorization'          }, docsUrl: 'https://www.perplexity.ai/settings/api', placeholder: 'pplx-...' },
      { name: 'OpenRouter',   icon: '🔀', fields: { name: 'Authorization'          }, docsUrl: 'https://openrouter.ai/keys', placeholder: 'sk-or-v1-...' },
    ],
    fields: [
      { key: 'name',  label: 'Header Name',           type: 'text',     required: true  },
      { key: 'value', label: 'API Key / Header Value', type: 'password', required: true, highlight: true },
    ]
  },
  httpBearerAuth: {
    label: 'HTTP Bearer Auth',
    servicePresets: [
      { name: 'Groq',        icon: '⚡', fields: {}, docsUrl: 'https://console.groq.com/keys',              placeholder: 'gsk_...' },
      { name: 'Mistral',     icon: '🌊', fields: {}, docsUrl: 'https://console.mistral.ai/api-keys/',       placeholder: '' },
      { name: 'Together AI', icon: '🤝', fields: {}, docsUrl: 'https://api.together.xyz/settings/api-keys', placeholder: '' },
      { name: 'Cohere',      icon: '🧠', fields: {}, docsUrl: 'https://dashboard.cohere.com/api-keys',      placeholder: '' },
      { name: 'Anthropic',   icon: '🔬', fields: {}, docsUrl: 'https://console.anthropic.com/settings/keys',placeholder: 'sk-ant-...' },
    ],
    fields: [
      { key: 'token', label: 'Bearer Token', type: 'password', required: true, highlight: true },
    ]
  },
  bearerToken:   { label: 'Bearer Token',   fields: [{ key: 'token',  label: 'Token',   type: 'password', required: true, highlight: true }] },
  apiKeyAuth:    { label: 'API Key',        fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true, highlight: true }] },
  braveSearchApi: {
    label: 'Brave Search',
    docsUrl: 'https://brave.com/search/api/',
    fields: [{ key: 'apiKey', label: 'Subscription Token', type: 'password', required: true, highlight: true, placeholder: 'BSA...' }]
  },
  n8nApi: {
    label: 'n8n API',
    docsUrl: 'https://docs.n8n.io/api/authentication/',
    fields: [
      { key: 'apiKey',  label: 'API Key',  type: 'password', required: true,  highlight: true },
      { key: 'baseUrl', label: 'Base URL', type: 'url',      required: false                  },
    ]
  },
  slackApi:    { label: 'Slack',       docsUrl: 'https://api.slack.com/apps',           fields: [{ key: 'accessToken', label: 'Bot User OAuth Token',    type: 'password', required: true, highlight: true, placeholder: 'xoxb-...' }] },
  githubApi:   { label: 'GitHub',      docsUrl: 'https://github.com/settings/tokens',   fields: [{ key: 'accessToken', label: 'Personal Access Token',   type: 'password', required: true, highlight: true, placeholder: 'ghp_...'  }] },
  telegramApi: { label: 'Telegram Bot',docsUrl: 'https://t.me/BotFather',               fields: [{ key: 'accessToken', label: 'Bot Token',               type: 'password', required: true, highlight: true, placeholder: '123456:ABC-...' }] },
  googleOAuth2Api: {
    label: 'Google OAuth2',
    docsUrl: 'https://console.cloud.google.com/apis/credentials',
    fields: [
      { key: 'clientId',     label: 'Client ID',     type: 'text',     required: true  },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true, highlight: true },
    ]
  },
  ollamaApi:    { label: 'Ollama',     docsUrl: 'https://ollama.com',                    fields: [{ key: 'baseUrl', label: 'Base URL', type: 'url', required: true, placeholder: 'http://localhost:11434' }] },
  qdrantApi: {
    label: 'Qdrant',
    docsUrl: 'https://qdrant.tech/documentation/cloud/',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: false, highlight: true  },
      { key: 'url',    label: 'Host',    type: 'url',      required: true,  placeholder: 'http://localhost:6333' },
    ]
  },
  wordpressApi: {
    label: 'WordPress',
    docsUrl: 'https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/',
    fields: [
      { key: 'username', label: 'Username',             type: 'text',     required: true  },
      { key: 'password', label: 'Application Password', type: 'password', required: true, highlight: true },
      { key: 'url',      label: 'WordPress URL',        type: 'url',      required: true  },
    ]
  },
  postgres: {
    label: 'PostgreSQL',
    fields: [
      { key: 'host',     label: 'Host',     type: 'text',     required: true, placeholder: 'localhost' },
      { key: 'port',     label: 'Port',     type: 'text',     required: true, placeholder: '5432'      },
      { key: 'database', label: 'Database', type: 'text',     required: true  },
      { key: 'user',     label: 'Username', type: 'text',     required: true  },
      { key: 'password', label: 'Password', type: 'password', required: true, highlight: true },
    ]
  },
  mcpClientApi:  { label: 'MCP Client',             fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: false, highlight: true }, { key: 'baseUrl', label: 'Base URL', type: 'url', required: true }] },
  hostingerApi:  { label: 'Hostinger',              docsUrl: 'https://developers.hostinger.com', fields: [{ key: 'apiToken', label: 'API Token', type: 'password', required: true, highlight: true }] },
  gSuiteAdminOAuth2Api: {
    label: 'Google Workspace (GSuite)',
    docsUrl: 'https://console.cloud.google.com/apis/credentials',
    fields: [
      { key: 'clientId',     label: 'Client ID',     type: 'text',     required: true  },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true, highlight: true },
    ]
  },
  httpSslAuth: {
    label: 'HTTP SSL Auth',
    fields: [
      { key: 'cert',       label: 'SSL Certificate', type: 'text',     required: true                 },
      { key: 'key',        label: 'Private Key',     type: 'password', required: true, highlight: true },
      { key: 'passphrase', label: 'Passphrase',      type: 'password', required: false                },
    ]
  },
  httpMultipleHeadersAuth: {
    label: 'HTTP Multiple Headers',
    fields: [{ key: 'headers', label: 'Headers JSON (array of {name, value})', type: 'text', required: true }]
  },
};

function buildCredData(type, providedData) {
  const schema = CRED_SCHEMAS[type];
  if (!schema) return providedData;
  const out = {};
  for (const f of schema.fields) {
    const v = providedData[f.key];
    if (v !== undefined && v !== null) { out[f.key] = v; }
    else if ('default' in f)           { out[f.key] = f.default; }
  }
  return out;
}

// ─── Shared driver utilities ───────────────────────────────────
const LOCAL_LLM_REGEX = /lmstudio|ollama|jan|gpt4all|llamafile|anythingllm/i;

function readVscodeKey(p) {
  try {
    const m = fs.readFileSync(p, 'utf8').match(/"n8n\.agent\.apiKey"\s*:\s*"([^"]*)"/);
    return m ? m[1] : null;
  } catch { return null; }
}
function writeVscodeKey(p, newKey) {
  if (!fs.existsSync(p)) return { ok: false, error: 'File not found' };
  try {
    const txt    = fs.readFileSync(p, 'utf8');
    const newTxt = txt.replace(/"n8n\.agent\.apiKey"\s*:\s*"[^"]*"/, `"n8n.agent.apiKey": "${newKey}"`);
    if (newTxt === txt) return { ok: true, detail: 'skipped — n8n.agent.apiKey not present' };
    backupAndWrite(p, newTxt);
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

function readChatModelsKey(p) {
  try {
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    const e = d.find(x => LOCAL_LLM_REGEX.test(x.name));
    return e?.apiKey || null;
  } catch { return null; }
}
function writeChatModelsKey(p, newKey) {
  if (!fs.existsSync(p)) return { ok: false, error: 'File not found' };
  try {
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    let n = 0;
    for (const e of d) { if (LOCAL_LLM_REGEX.test(e.name)) { e.apiKey = newKey; n++; } }
    backupAndWrite(p, JSON.stringify(d, null, 2));
    return { ok: true, detail: `${n} entry(ies) updated` };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ─── Driver registry ───────────────────────────────────────────
// Each driver: { id, label, icon, group, defaultPath, configurable, read(p), write(p, newKey) }
// read()  → string key or null
// write() → { ok, detail?, error? }
const DRIVERS = [

  // ── Claude Desktop ─────────────────────────────────────────
  {
    id: 'claudeDesktop', label: 'Claude Desktop (MCP)', icon: '🤖', group: 'AI Tools',
    defaultPath: path.join(APPDATA, 'Claude', 'claude_desktop_config.json'),
    configurable: true,
    read(p) {
      try {
        const env = JSON.parse(fs.readFileSync(p, 'utf8'))?.mcpServers?.['local-llm']?.env || {};
        return env.LMSTUDIO_API_KEY || env.OLLAMA_API_KEY || null;
      } catch { return null; }
    },
    write(p, newKey) {
      if (!fs.existsSync(p)) return { ok: false, error: 'File not found' };
      try {
        const d = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (!d?.mcpServers?.['local-llm']?.env)
          return { ok: false, error: 'mcpServers[local-llm].env not found' };
        const env = d.mcpServers['local-llm'].env;
        const updated = [];
        if ('LMSTUDIO_API_KEY' in env) { env.LMSTUDIO_API_KEY = newKey; updated.push('LMSTUDIO_API_KEY'); }
        if ('OLLAMA_API_KEY'   in env) { env.OLLAMA_API_KEY   = newKey; updated.push('OLLAMA_API_KEY');   }
        if (!updated.length)           { env.LMSTUDIO_API_KEY = newKey; updated.push('LMSTUDIO_API_KEY'); }
        backupAndWrite(p, JSON.stringify(d, null, 2));
        return { ok: true, detail: updated.join(', ') + ' updated' };
      } catch (e) { return { ok: false, error: e.message }; }
    },
  },

  // ── VS Code ────────────────────────────────────────────────
  {
    id: 'vscodeSettings', label: 'VS Code — settings.json', icon: '💙', group: 'Editors',
    defaultPath: path.join(APPDATA, 'Code', 'User', 'settings.json'),
    configurable: true,
    read: readVscodeKey, write: writeVscodeKey,
  },
  {
    id: 'chatModels', label: 'VS Code — chatLanguageModels', icon: '💙', group: 'Editors',
    defaultPath: path.join(APPDATA, 'Code', 'User', 'chatLanguageModels.json'),
    configurable: true,
    read: readChatModelsKey, write: writeChatModelsKey,
  },

  // ── Cursor ─────────────────────────────────────────────────
  {
    id: 'cursor', label: 'Cursor — settings.json', icon: '🖱️', group: 'Editors',
    defaultPath: path.join(APPDATA, 'Cursor', 'User', 'settings.json'),
    configurable: false,
    read: readVscodeKey, write: writeVscodeKey,
  },
  {
    id: 'cursorChatModels', label: 'Cursor — chatLanguageModels', icon: '🖱️', group: 'Editors',
    defaultPath: path.join(APPDATA, 'Cursor', 'User', 'chatLanguageModels.json'),
    configurable: false,
    read: readChatModelsKey, write: writeChatModelsKey,
  },

  // ── Windsurf ───────────────────────────────────────────────
  {
    id: 'windsurf', label: 'Windsurf — settings.json', icon: '🌊', group: 'Editors',
    defaultPath: path.join(APPDATA, 'Windsurf', 'User', 'settings.json'),
    configurable: false,
    read: readVscodeKey, write: writeVscodeKey,
  },

  // ── Continue.dev ───────────────────────────────────────────
  {
    id: 'continuedev', label: 'Continue.dev', icon: '▶️', group: 'AI Tools',
    defaultPath: path.join(HOME, '.continue', 'config.json'),
    configurable: true,
    read(p) {
      try {
        const d = JSON.parse(fs.readFileSync(p, 'utf8'));
        const entries = [...(d.models || []), d.tabAutocompleteModel, d.embeddingsProvider].filter(Boolean);
        return entries.find(m => m.apiKey)?.apiKey || null;
      } catch { return null; }
    },
    write(p, newKey) {
      if (!fs.existsSync(p)) return { ok: false, error: 'File not found' };
      try {
        const d = JSON.parse(fs.readFileSync(p, 'utf8'));
        let n = 0;
        const upd = obj => { if (obj && 'apiKey' in obj && obj.apiKey) { obj.apiKey = newKey; n++; } };
        (d.models || []).forEach(upd);
        upd(d.tabAutocompleteModel);
        upd(d.embeddingsProvider);
        backupAndWrite(p, JSON.stringify(d, null, 2));
        return { ok: true, detail: `${n} model(s) updated` };
      } catch (e) { return { ok: false, error: e.message }; }
    },
  },

  // ── Aider ──────────────────────────────────────────────────
  {
    id: 'aider', label: 'Aider', icon: '🤝', group: 'AI Tools',
    defaultPath: path.join(HOME, '.aider.conf.yml'),
    configurable: true,
    read(p) {
      try {
        const m = fs.readFileSync(p, 'utf8').match(/^openai-api-key\s*:\s*(.+)$/m);
        return m ? m[1].trim() : null;
      } catch { return null; }
    },
    write(p, newKey) {
      if (!fs.existsSync(p)) return { ok: false, error: 'File not found' };
      try {
        const txt    = fs.readFileSync(p, 'utf8');
        const newTxt = txt.replace(/^(openai-api-key\s*:\s*)(.+)$/m, `$1${newKey}`);
        if (newTxt === txt) return { ok: true, detail: 'skipped — openai-api-key not present' };
        backupAndWrite(p, newTxt);
        return { ok: true };
      } catch (e) { return { ok: false, error: e.message }; }
    },
  },

  // ── .env file ──────────────────────────────────────────────
  {
    id: 'dotenv', label: '.env file', icon: '📄', group: 'Custom',
    defaultPath: '',
    configurable: true,
    read(p) {
      if (!p) return null;
      try {
        const m = fs.readFileSync(p, 'utf8').match(/^OPENAI_API_KEY\s*=\s*(.+)$/m);
        return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
      } catch { return null; }
    },
    write(p, newKey) {
      if (!p)                return { ok: false, error: 'Path not configured' };
      if (!fs.existsSync(p)) return { ok: false, error: 'File not found' };
      try {
        const txt    = fs.readFileSync(p, 'utf8');
        const newTxt = txt.replace(/^(OPENAI_API_KEY\s*=\s*)(.*)$/m, `$1${newKey}`);
        if (newTxt === txt) return { ok: true, detail: 'skipped — OPENAI_API_KEY not found' };
        backupAndWrite(p, newTxt);
        return { ok: true };
      } catch (e) { return { ok: false, error: e.message }; }
    },
  },
];

// ─── Defaults (paths auto-generated from driver registry) ─────
const DEFAULTS = {
  n8nBaseUrl:            'http://localhost:5678',
  n8nApiKey:             '',
  n8nCredentials:        [],
  openRouterMgmtKey:     '',
  openRouterLastKeyHash: '',
  paths:         Object.fromEntries(DRIVERS.map(d => [d.id, d.defaultPath])),
  driverEnabled: {},   // empty = all drivers enabled (auto-detect)
};

// ─── Config helpers ────────────────────────────────────────────
function loadCfg() {
  if (!fs.existsSync(CFG_PATH)) return JSON.parse(JSON.stringify(DEFAULTS));
  try {
    const base = JSON.parse(JSON.stringify(DEFAULTS));
    const user = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
    if (user.paths         && typeof user.paths         === 'object') { Object.assign(base.paths,         user.paths);         delete user.paths;         }
    if (user.driverEnabled && typeof user.driverEnabled === 'object') { Object.assign(base.driverEnabled, user.driverEnabled); delete user.driverEnabled; }
    return Object.assign(base, user);
  } catch { return JSON.parse(JSON.stringify(DEFAULTS)); }
}
function saveCfg(c) { fs.writeFileSync(CFG_PATH, JSON.stringify(c, null, 2), 'utf8'); }

// ─── Misc helpers ──────────────────────────────────────────────
function mask(k) {
  if (!k) return null;
  return k.length <= 12 ? k.substring(0, 4) + '...' : k.substring(0, 10) + '...' + k.slice(-4);
}
function backupAndWrite(filePath, content) {
  fs.copyFileSync(filePath, filePath + '.bak');
  fs.writeFileSync(filePath, content, 'utf8');
}

// ─── Driver helpers ────────────────────────────────────────────
function driverPath(driver, cfg)     { return cfg.paths[driver.id] ?? driver.defaultPath; }
function isEnabled(driver, cfg)      { return cfg.driverEnabled[driver.id] !== false; }

function statusForDrivers(cfg) {
  return DRIVERS.map(d => {
    const p       = driverPath(d, cfg);
    const enabled = isEnabled(d, cfg);
    const exists  = Boolean(p) && fs.existsSync(p);
    const key     = (enabled && exists) ? d.read(p) : null;
    return { id: d.id, label: d.label, icon: d.icon, group: d.group,
             configurable: d.configurable, path: p, enabled, exists, preview: mask(key) };
  });
}

// Run all enabled+found drivers; return result array for rotation log
function rotateDrivers(cfg, newKey) {
  const results = [];
  for (const d of DRIVERS) {
    if (!isEnabled(d, cfg)) continue;
    const p      = driverPath(d, cfg);
    const exists = Boolean(p) && fs.existsSync(p);
    if (!exists) {
      // Show error only for user-configured non-default paths or dotenv (must be explicit)
      if (d.id === 'dotenv' || (p && p !== d.defaultPath)) {
        results.push({ label: d.label, ok: false, error: p ? 'File not found' : 'Path not configured' });
      }
      continue;
    }
    results.push({ label: d.label, ...d.write(p, newKey) });
  }
  return results;
}

// ─── OpenRouter helper ─────────────────────────────────────────
function orReq(method, reqPath, mgmtKey, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'openrouter.ai', port: 443, path: reqPath, method,
      headers: { 'Authorization': `Bearer ${mgmtKey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try   { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ─── n8n REST helper ───────────────────────────────────────────
function n8nReq(cfg, method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const base = new URL(cfg.n8nBaseUrl);
    const mod  = base.protocol === 'https:' ? https : http;
    const opts = {
      hostname: base.hostname,
      port:     base.port || (base.protocol === 'https:' ? 443 : 80),
      path:     endpoint, method,
      headers: { 'X-N8N-API-KEY': cfg.n8nApiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' }
    };
    const req = mod.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try   { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ─── HTTP helpers ──────────────────────────────────────────────
function readBody(req) {
  return new Promise((ok, fail) => {
    let b = '';
    req.on('data', c => b += c);
    req.on('end',   () => ok(b));
    req.on('error', fail);
  });
}
function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}
function n8nErrMsg(body) {
  return typeof body === 'object' ? (body?.message || JSON.stringify(body)) : String(body);
}

// ─── HTTP server ───────────────────────────────────────────────
const srv = http.createServer(async (req, res) => {
  const { method, url } = req;

  if (method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' });
    res.end();
    return;
  }

  // ── Static HTML ────────────────────────────────────────────
  if (method === 'GET' && url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(DIR, 'index.html'), 'utf8'));
    return;
  }

  // ── GET /api/status ────────────────────────────────────────
  if (method === 'GET' && url === '/api/status') {
    const cfg    = loadCfg();
    const status = statusForDrivers(cfg);
    status.push({
      id: 'n8n', label: 'n8n credentials (REST API)', icon: '🔗', group: 'n8n',
      exists: true, enabled: true, configurable: false,
      configured: !!cfg.n8nApiKey,
      credCount:  cfg.n8nCredentials.length,
      preview:    cfg.n8nCredentials.length ? cfg.n8nCredentials.map(c => c.name).join(', ') : null,
    });
    json(res, status);
    return;
  }

  // ── GET /api/drivers  (driver metadata for Settings UI) ────
  if (method === 'GET' && url === '/api/drivers') {
    const cfg = loadCfg();
    json(res, DRIVERS.map(d => ({
      id:          d.id,
      label:       d.label,
      icon:        d.icon,
      group:       d.group,
      configurable: d.configurable,
      defaultPath: d.defaultPath,
      currentPath: driverPath(d, cfg),
      enabled:     isEnabled(d, cfg),
      detected:    Boolean(driverPath(d, cfg)) && fs.existsSync(driverPath(d, cfg)),
    })));
    return;
  }

  // ── GET /api/config  (masked) ──────────────────────────────
  if (method === 'GET' && url === '/api/config') {
    const cfg  = loadCfg();
    const safe = JSON.parse(JSON.stringify(cfg));
    if (safe.n8nApiKey)         safe.n8nApiKey         = safe.n8nApiKey.substring(0, 8) + '...';
    if (safe.openRouterMgmtKey) safe.openRouterMgmtKey = safe.openRouterMgmtKey.substring(0, 10) + '...';
    json(res, safe);
    return;
  }

  // ── POST /api/config ───────────────────────────────────────
  if (method === 'POST' && url === '/api/config') {
    try {
      const body = JSON.parse(await readBody(req));
      const cfg  = loadCfg();
      const notMasked = v => typeof v === 'string' && !v.endsWith('...');
      if (body.n8nApiKey  !== undefined && notMasked(body.n8nApiKey))         cfg.n8nApiKey         = body.n8nApiKey;
      if (body.n8nBaseUrl !== undefined)                                        cfg.n8nBaseUrl        = body.n8nBaseUrl;
      if (body.n8nCredentials !== undefined)                                    cfg.n8nCredentials    = body.n8nCredentials;
      if (body.paths !== undefined && typeof body.paths === 'object')           Object.assign(cfg.paths, body.paths);
      if (body.driverEnabled !== undefined && typeof body.driverEnabled === 'object') Object.assign(cfg.driverEnabled, body.driverEnabled);
      if (body.openRouterMgmtKey !== undefined && notMasked(body.openRouterMgmtKey)) cfg.openRouterMgmtKey = body.openRouterMgmtKey;
      saveCfg(cfg);
      json(res, { ok: true });
    } catch (e) { json(res, { ok: false, error: e.message }, 400); }
    return;
  }

  // ── GET /api/n8n/schemas ───────────────────────────────────
  if (method === 'GET' && url === '/api/n8n/schemas') {
    json(res, CRED_SCHEMAS);
    return;
  }

  // ── GET /api/n8n/credentials ───────────────────────────────
  if (method === 'GET' && url === '/api/n8n/credentials') {
    const cfg = loadCfg();
    if (!cfg.n8nApiKey) { json(res, { ok: false, error: 'n8n API key not configured' }); return; }
    try {
      const r = await n8nReq(cfg, 'GET', '/api/v1/credentials?limit=100', null);
      if (r.status !== 200) { json(res, { ok: false, error: `n8n returned HTTP ${r.status}` }); return; }
      const all = (r.body.data || []).map(c => ({
        id: c.id, name: c.name, type: c.type,
        schemaKnown: !!CRED_SCHEMAS[c.type],
        typeLabel:   CRED_SCHEMAS[c.type]?.label || c.type,
        createdAt: c.createdAt, updatedAt: c.updatedAt,
      }));
      all.sort((a, b) => {
        if (a.type === 'openAiApi' && b.type !== 'openAiApi') return -1;
        if (b.type === 'openAiApi' && a.type !== 'openAiApi') return  1;
        return a.name.localeCompare(b.name);
      });
      json(res, { ok: true, credentials: all });
    } catch (e) { json(res, { ok: false, error: e.message }); }
    return;
  }

  // ── POST /api/n8n/credentials/:id ─────────────────────────
  const credUpdMatch = method === 'POST' && url.match(/^\/api\/n8n\/credentials\/([^/]+)$/);
  if (credUpdMatch) {
    const credId = credUpdMatch[1];
    const cfg    = loadCfg();
    if (!cfg.n8nApiKey) { json(res, { ok: false, error: 'n8n API key not configured' }); return; }
    try {
      const { name, type, data } = JSON.parse(await readBody(req));
      if (!name || !type || !data || typeof data !== 'object')
        return json(res, { ok: false, error: 'Missing or invalid name / type / data' }, 400);
      const r = await n8nReq(cfg, 'PATCH', `/api/v1/credentials/${credId}`, { name, data: buildCredData(type, data) });
      if (r.status < 300) json(res, { ok: true, detail: 'Credential updated successfully' });
      else json(res, { ok: false, error: n8nErrMsg(r.body) }, r.status >= 400 ? 400 : 500);
    } catch (e) { json(res, { ok: false, error: e.message }, 500); }
    return;
  }

  // ── GET /api/n8n/discover  (legacy alias) ─────────────────
  if (method === 'GET' && url === '/api/n8n/discover') {
    const cfg = loadCfg();
    if (!cfg.n8nApiKey) { json(res, { ok: false, error: 'n8n API key not configured' }); return; }
    try {
      const r = await n8nReq(cfg, 'GET', '/api/v1/credentials?limit=100', null);
      if (r.status !== 200) { json(res, { ok: false, error: `n8n returned HTTP ${r.status}` }); return; }
      const all = (r.body.data || []).map(c => ({ id: c.id, name: c.name, type: c.type }));
      json(res, { ok: true, credentials: [
        ...all.filter(c => c.type === 'openAiApi'),
        ...all.filter(c => c.type !== 'openAiApi'),
      ]});
    } catch (e) { json(res, { ok: false, error: e.message }); }
    return;
  }

  // ── POST /api/rotate  (bulk rotation) ─────────────────────
  if (method === 'POST' && url === '/api/rotate') {
    try {
      const { newKey } = JSON.parse(await readBody(req));
      if (!newKey || newKey.length < 6)
        return json(res, { ok: false, error: 'Key too short (min 6 characters)' }, 400);

      const cfg     = loadCfg();
      const results = rotateDrivers(cfg, newKey);

      // n8n credentials
      if (cfg.n8nApiKey && cfg.n8nCredentials.length > 0) {
        for (const cred of cfg.n8nCredentials) {
          try {
            const meta     = await n8nReq(cfg, 'GET', `/api/v1/credentials/${cred.id}?includeData=true`, null);
            const credType = meta.status === 200 ? (meta.body?.type || 'openAiApi') : 'openAiApi';
            const existing = (meta.status === 200 && meta.body?.data) ? meta.body.data : {};
            const rawData  = { ...buildCredData(credType, existing), apiKey: newKey };
            if (cred.baseUrl) rawData.url = cred.baseUrl;
            const r = await n8nReq(cfg, 'PATCH', `/api/v1/credentials/${cred.id}`, { name: cred.name, data: rawData });
            results.push({
              label:  `n8n › ${cred.name}`,
              ok:     r.status < 300,
              error:  r.status >= 300 ? n8nErrMsg(r.body) : null,
              detail: r.status < 300 ? 'updated' : null,
            });
          } catch (e) { results.push({ label: `n8n › ${cred.name}`, ok: false, error: e.message }); }
        }
      } else {
        results.push({
          label: 'n8n credentials', ok: false,
          error: cfg.n8nApiKey
            ? 'No rotation targets — add credentials in Settings'
            : 'n8n API key not configured — see Settings',
        });
      }

      json(res, { ok: results.every(r => r.ok), results });
    } catch (e) { json(res, { ok: false, error: e.message }, 500); }
    return;
  }

  // ── GET /api/openrouter/keys ───────────────────────────────
  if (method === 'GET' && url === '/api/openrouter/keys') {
    const cfg = loadCfg();
    if (!cfg.openRouterMgmtKey) { json(res, { ok: false, error: 'OpenRouter Management API key not configured' }); return; }
    try {
      const r = await orReq('GET', '/api/v1/keys', cfg.openRouterMgmtKey, null);
      if (r.status !== 200) { json(res, { ok: false, error: `OpenRouter API error HTTP ${r.status}` }); return; }
      json(res, { ok: true, keys: r.body.data || [] });
    } catch (e) { json(res, { ok: false, error: e.message }); }
    return;
  }

  // ── POST /api/openrouter/rotate ────────────────────────────
  if (method === 'POST' && url === '/api/openrouter/rotate') {
    try {
      const { keyName, deleteOld } = JSON.parse(await readBody(req));
      const cfg = loadCfg();
      if (!cfg.openRouterMgmtKey)
        return json(res, { ok: false, error: 'OpenRouter Management API key not configured' });

      const label   = keyName || `key-manager-${new Date().toISOString().slice(0, 10)}`;
      const createR = await orReq('POST', '/api/v1/keys', cfg.openRouterMgmtKey, { name: label });
      if (createR.status !== 200 && createR.status !== 201)
        return json(res, { ok: false, error: `Failed to create key: ${n8nErrMsg(createR.body)} (HTTP ${createR.status})` });

      const newKey  = createR.body.key;
      const newHash = createR.body.hash || createR.body.data?.hash || '';
      if (!newKey) return json(res, { ok: false, error: 'OpenRouter did not return a key value' });

      const results = rotateDrivers(cfg, newKey);

      // n8n credentials
      if (cfg.n8nApiKey && cfg.n8nCredentials.length > 0) {
        for (const cred of cfg.n8nCredentials) {
          try {
            const meta     = await n8nReq(cfg, 'GET', `/api/v1/credentials/${cred.id}?includeData=true`, null);
            const credType = meta.status === 200 ? (meta.body?.type || 'openAiApi') : 'openAiApi';
            const existing = (meta.status === 200 && meta.body?.data) ? meta.body.data : {};
            const rawData  = { ...buildCredData(credType, existing), apiKey: newKey };
            if (cred.baseUrl) rawData.url = cred.baseUrl;
            const r = await n8nReq(cfg, 'PATCH', `/api/v1/credentials/${cred.id}`, { name: cred.name, data: rawData });
            results.push({ label: `n8n › ${cred.name}`, ok: r.status < 300, error: r.status >= 300 ? n8nErrMsg(r.body) : null, detail: r.status < 300 ? 'updated' : null });
          } catch (e) { results.push({ label: `n8n › ${cred.name}`, ok: false, error: e.message }); }
        }
      }

      let deleteResult = null;
      const oldHash = cfg.openRouterLastKeyHash;
      if (deleteOld && oldHash) {
        try {
          const delR = await orReq('DELETE', `/api/v1/keys/${oldHash}`, cfg.openRouterMgmtKey, null);
          deleteResult = { ok: delR.status < 300, detail: delR.status < 300 ? `Old key deleted (${oldHash.slice(0, 12)}…)` : `HTTP ${delR.status}` };
        } catch (e) { deleteResult = { ok: false, error: e.message }; }
      }

      cfg.openRouterLastKeyHash = newHash;
      saveCfg(cfg);

      json(res, { ok: results.every(r => r.ok), newKeyMasked: mask(newKey), newKeyHash: newHash, results, deleteResult });
    } catch (e) { json(res, { ok: false, error: e.message }, 500); }
    return;
  }

  res.writeHead(404); res.end('Not Found');
});

srv.listen(PORT, '127.0.0.1', () => {
  const banner = `🔑 Key Manager v${VERSION}  →  http://localhost:${PORT}`;
  console.log('\n' + '─'.repeat(banner.length + 4));
  console.log('  ' + banner);
  console.log('─'.repeat(banner.length + 4) + '\n');
  try { execSync(process.platform === 'win32' ? `start http://localhost:${PORT}` : `open http://localhost:${PORT}`); } catch {}
});
