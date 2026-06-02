'use strict';
const http    = require('http');
const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const { execSync } = require('child_process');

const VERSION  = '2.5.0';
const PORT     = Number(process.env.KM_PORT) || 7432;
const DIR      = __dirname;
const CFG_PATH     = path.join(DIR, 'app-config.json');
const HISTORY_PATH = path.join(DIR, 'rotation-log.json');
const HISTORY_MAX  = 30;

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

  // ── AI providers ───────────────────────────────────────────
  anthropicApi: {
    label: 'Anthropic (Claude)',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true, highlight: true, placeholder: 'sk-ant-api03-...' }]
  },
  huggingFaceApi: {
    label: 'HuggingFace',
    docsUrl: 'https://huggingface.co/settings/tokens',
    fields: [{ key: 'accessToken', label: 'Access Token', type: 'password', required: true, highlight: true, placeholder: 'hf_...' }]
  },
  mistralCloudApi: {
    label: 'Mistral AI',
    docsUrl: 'https://console.mistral.ai/api-keys/',
    fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true, highlight: true }]
  },
  groqApi: {
    label: 'Groq',
    docsUrl: 'https://console.groq.com/keys',
    fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true, highlight: true, placeholder: 'gsk_...' }]
  },
  replicateApi: {
    label: 'Replicate',
    docsUrl: 'https://replicate.com/account/api-tokens',
    fields: [{ key: 'apiKey', label: 'API Token', type: 'password', required: true, highlight: true, placeholder: 'r8_...' }]
  },
  stabilityAiApi: {
    label: 'Stability AI',
    docsUrl: 'https://platform.stability.ai/account/keys',
    fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true, highlight: true, placeholder: 'sk-...' }]
  },
  cohereApi: {
    label: 'Cohere',
    docsUrl: 'https://dashboard.cohere.com/api-keys',
    fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true, highlight: true }]
  },
  togetherAiApi: {
    label: 'Together AI',
    docsUrl: 'https://api.together.xyz/settings/api-keys',
    fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true, highlight: true }]
  },
  perplexityApi: {
    label: 'Perplexity AI',
    docsUrl: 'https://www.perplexity.ai/settings/api',
    fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true, highlight: true, placeholder: 'pplx-...' }]
  },
  openRouterApi: {
    label: 'OpenRouter',
    docsUrl: 'https://openrouter.ai/keys',
    fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true, highlight: true, placeholder: 'sk-or-v1-...' }]
  },

  // ── Vector DBs & data ──────────────────────────────────────
  pineconeApi: {
    label: 'Pinecone',
    docsUrl: 'https://app.pinecone.io/',
    fields: [
      { key: 'apiKey',       label: 'API Key',     type: 'password', required: true, highlight: true },
      { key: 'environment',  label: 'Environment', type: 'text',     required: false, placeholder: 'us-east1-gcp' },
    ]
  },
  supabaseApi: {
    label: 'Supabase',
    docsUrl: 'https://app.supabase.com/project/_/settings/api',
    fields: [
      { key: 'host',        label: 'Project URL',  type: 'url',      required: true,  placeholder: 'https://xxx.supabase.co' },
      { key: 'serviceRole', label: 'Service Role Key', type: 'password', required: true, highlight: true },
    ]
  },

  // ── Productivity ───────────────────────────────────────────
  notionApi: {
    label: 'Notion',
    docsUrl: 'https://www.notion.so/my-integrations',
    fields: [{ key: 'apiKey', label: 'Internal Integration Token', type: 'password', required: true, highlight: true, placeholder: 'secret_...' }]
  },
  airtableApi: {
    label: 'Airtable',
    docsUrl: 'https://airtable.com/create/tokens',
    fields: [{ key: 'apiKey', label: 'Personal Access Token', type: 'password', required: true, highlight: true, placeholder: 'pat...' }]
  },
  linearApi: {
    label: 'Linear',
    docsUrl: 'https://linear.app/settings/api',
    fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true, highlight: true }]
  },
  discordApi: {
    label: 'Discord Bot',
    docsUrl: 'https://discord.com/developers/applications',
    fields: [{ key: 'botToken', label: 'Bot Token', type: 'password', required: true, highlight: true }]
  },
  sendGridApi: {
    label: 'SendGrid',
    docsUrl: 'https://app.sendgrid.com/settings/api_keys',
    fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true, highlight: true, placeholder: 'SG...' }]
  },
  resendApi: {
    label: 'Resend',
    docsUrl: 'https://resend.com/api-keys',
    fields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true, highlight: true, placeholder: 're_...' }]
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

  // ── Claude Code CLI ────────────────────────────────────────
  {
    id: 'claudeCode', label: 'Claude Code CLI', icon: '🔶', group: 'AI Tools',
    defaultPath: path.join(HOME, '.claude', 'settings.json'),
    configurable: true,
    read(p) {
      try { return JSON.parse(fs.readFileSync(p, 'utf8')).apiKey || null; }
      catch { return null; }
    },
    write(p, newKey) {
      if (!fs.existsSync(p)) return { ok: false, error: 'File not found' };
      try {
        const d = JSON.parse(fs.readFileSync(p, 'utf8'));
        d.apiKey = newKey;
        backupAndWrite(p, JSON.stringify(d, null, 2));
        return { ok: true };
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

  // ── Zed ────────────────────────────────────────────────────
  {
    id: 'zed', label: 'Zed', icon: '⚡', group: 'Editors',
    defaultPath: process.platform === 'darwin'
      ? path.join(HOME, 'Library', 'Application Support', 'Zed', 'settings.json')
      : process.platform === 'win32'
        ? path.join(APPDATA, 'Zed', 'settings.json')
        : path.join(HOME, '.config', 'zed', 'settings.json'),
    configurable: true,
    read(p) {
      try {
        const lm = JSON.parse(fs.readFileSync(p, 'utf8'))?.language_models || {};
        return Object.values(lm).find(m => m?.api_key)?.api_key || null;
      } catch { return null; }
    },
    write(p, newKey) {
      if (!fs.existsSync(p)) return { ok: false, error: 'File not found' };
      try {
        const d  = JSON.parse(fs.readFileSync(p, 'utf8'));
        const lm = d?.language_models;
        if (!lm) return { ok: true, detail: 'skipped — no language_models in settings' };
        let n = 0;
        for (const provider of Object.values(lm)) {
          if (provider && 'api_key' in provider && provider.api_key) { provider.api_key = newKey; n++; }
        }
        if (!n) return { ok: true, detail: 'skipped — no api_key found in language_models' };
        backupAndWrite(p, JSON.stringify(d, null, 2));
        return { ok: true, detail: `${n} provider(s) updated` };
      } catch (e) { return { ok: false, error: e.message }; }
    },
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

  // ── Codex CLI ──────────────────────────────────────────────
  {
    id: 'codex', label: 'Codex CLI', icon: '🧩', group: 'AI Tools',
    defaultPath: path.join(HOME, '.codex', 'config.toml'),
    configurable: true,
    // Codex stores the key as `experimental_bearer_token` inside a
    // [model_providers.<name>] section of config.toml.
    // (Standard usage relies on OPENAI_API_KEY / OPENROUTER_API_KEY env vars;
    //  this driver targets users who have an explicit inline token.)
    read(p) {
      try {
        const m = fs.readFileSync(p, 'utf8').match(/experimental_bearer_token\s*=\s*"([^"]+)"/);
        return m ? m[1] : null;
      } catch { return null; }
    },
    write(p, newKey) {
      if (!fs.existsSync(p)) return { ok: false, error: 'File not found' };
      try {
        const txt    = fs.readFileSync(p, 'utf8');
        const newTxt = txt.replace(/(experimental_bearer_token\s*=\s*")[^"]+(")/g, `$1${newKey}$2`);
        if (newTxt === txt) return { ok: true, detail: 'skipped — experimental_bearer_token not found in config.toml' };
        backupAndWrite(p, newTxt);
        return { ok: true };
      } catch (e) { return { ok: false, error: e.message }; }
    },
  },

  // ── OpenClaw ────────────────────────────────────────────────
  {
    id: 'openclaw', label: 'OpenClaw', icon: '🦞', group: 'AI Tools',
    defaultPath: path.join(HOME, '.openclaw', 'openclaw.json'),
    configurable: true,
    // OpenClaw stores provider API keys inside its JSON5 config under
    // the `env` object, e.g. { env: { OPENROUTER_API_KEY: "sk-or-..." } }
    // Keys may be quoted or unquoted (JSON5 format).
    read(p) {
      try {
        const m = fs.readFileSync(p, 'utf8').match(/"?OPENROUTER_API_KEY"?\s*:\s*"([^"]+)"/);
        return m ? m[1] : null;
      } catch { return null; }
    },
    write(p, newKey) {
      if (!fs.existsSync(p)) return { ok: false, error: 'File not found' };
      try {
        const txt    = fs.readFileSync(p, 'utf8');
        const newTxt = txt.replace(/("?OPENROUTER_API_KEY"?\s*:\s*")[^"]+(")/g, `$1${newKey}$2`);
        if (newTxt === txt) return { ok: true, detail: 'skipped — OPENROUTER_API_KEY not found in openclaw.json' };
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
  schedule: {
    enabled:     false,
    intervalDays: 7,
    nextRunAt:   null,   // ISO string or null
    keyName:     'key-manager-auto',
    deleteOld:   false,
  },
};

// ─── Config helpers ────────────────────────────────────────────
function loadCfg() {
  if (!fs.existsSync(CFG_PATH)) return JSON.parse(JSON.stringify(DEFAULTS));
  try {
    const base = JSON.parse(JSON.stringify(DEFAULTS));
    const user = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
    if (user.paths         && typeof user.paths         === 'object') { Object.assign(base.paths,         user.paths);         delete user.paths;         }
    if (user.driverEnabled && typeof user.driverEnabled === 'object') { Object.assign(base.driverEnabled, user.driverEnabled); delete user.driverEnabled; }
    if (user.schedule      && typeof user.schedule      === 'object') { Object.assign(base.schedule,      user.schedule);      delete user.schedule;      }
    return Object.assign(base, user);
  } catch { return JSON.parse(JSON.stringify(DEFAULTS)); }
}
function saveCfg(c) { fs.writeFileSync(CFG_PATH, JSON.stringify(c, null, 2), 'utf8'); }

// ─── Rotation history ──────────────────────────────────────────
function loadHistory() {
  try { return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8')); }
  catch { return []; }
}
function appendHistory(entry) {
  const h = loadHistory();
  h.unshift({ ts: new Date().toISOString(), ...entry });
  if (h.length > HISTORY_MAX) h.length = HISTORY_MAX;
  try { fs.writeFileSync(HISTORY_PATH, JSON.stringify(h, null, 2), 'utf8'); } catch {}
}

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
      // dotenv: show error only when a path was set but the file is missing
      // (empty path = user hasn't configured it → silent skip, same as uninstalled tools)
      if (d.id === 'dotenv') {
        if (p) results.push({ label: d.label, ok: false, error: 'File not found' });
        continue;
      }
      // Other drivers: show error only for explicit non-default paths that don't exist
      if (p && p !== d.defaultPath) {
        results.push({ label: d.label, ok: false, error: 'File not found' });
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

// ─── Key validation helper ─────────────────────────────────────
function pingKey(key, targetUrl) {
  return new Promise(resolve => {
    try {
      const base       = new URL((targetUrl || 'http://localhost:1234/v1').replace(/\/+$/, ''));
      const mod        = base.protocol === 'https:' ? https : http;
      const modelsPath = base.pathname.replace(/\/+$/, '') + '/models';
      const opts = {
        hostname: base.hostname,
        port:     base.port || (base.protocol === 'https:' ? 443 : 80),
        path: modelsPath, method: 'GET',
        headers: { 'Authorization': `Bearer ${key}`, 'Accept': 'application/json' },
      };
      const r = mod.request(opts, resp => {
        let data = '';
        resp.on('data', c => data += c);
        resp.on('end', () => {
          if (resp.statusCode === 200) {
            try {
              const body  = JSON.parse(data);
              const count = (body.data || body.models || []).length;
              resolve({ ok: true,  status: 200, message: `${count} model(s) available` });
            } catch { resolve({ ok: true,  status: 200, message: 'Endpoint OK' }); }
          } else if (resp.statusCode === 401) {
            resolve({ ok: false, status: 401, message: 'Invalid key (401 Unauthorized)' });
          } else {
            resolve({ ok: false, status: resp.statusCode, message: `HTTP ${resp.statusCode}` });
          }
        });
      });
      r.setTimeout(5000, () => { r.destroy(); resolve({ ok: false, message: 'Timeout (5 s)' }); });
      r.on('error', e => resolve({ ok: false, message: e.message }));
      r.end();
    } catch(e) { resolve({ ok: false, message: e.message }); }
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

// ─── Scheduled auto-rotation ──────────────────────────────────
async function runScheduledRotation() {
  const cfg = loadCfg();
  if (!cfg.openRouterMgmtKey) return;

  console.log(`[scheduler] Running scheduled rotation…`);
  try {
    const label    = cfg.schedule.keyName || `key-manager-auto-${new Date().toISOString().slice(0,10)}`;
    const createR  = await orReq('POST', '/api/v1/keys', cfg.openRouterMgmtKey, { name: label });
    if (createR.status !== 200 && createR.status !== 201) {
      console.error(`[scheduler] Failed to create key: HTTP ${createR.status}`);
      return;
    }
    const newKey  = createR.body.key;
    const newHash = createR.body.hash || createR.body.data?.hash || '';
    if (!newKey) return;

    const results = rotateDrivers(cfg, newKey);

    if (cfg.n8nApiKey && cfg.n8nCredentials.length > 0) {
      for (const cred of cfg.n8nCredentials) {
        try {
          const meta    = await n8nReq(cfg, 'GET', `/api/v1/credentials/${cred.id}?includeData=true`, null);
          const existing = (meta.status === 200 && meta.body?.data) ? meta.body.data : {};
          const rawData  = { ...existing, apiKey: newKey };
          if (cred.baseUrl) rawData.url = cred.baseUrl;
          const credName = (meta.status === 200 && meta.body?.name) ? meta.body.name : cred.name;
          const r = await n8nReq(cfg, 'PATCH', `/api/v1/credentials/${cred.id}`, { name: credName, data: rawData });
          results.push({ label: `n8n › ${cred.name}`, ok: r.status < 300, error: r.status >= 300 ? n8nErrMsg(r.body) : null, detail: r.status < 300 ? 'updated' : null });
        } catch (e) { results.push({ label: `n8n › ${cred.name}`, ok: false, error: e.message }); }
      }
    }

    if (cfg.schedule.deleteOld && cfg.openRouterLastKeyHash) {
      await orReq('DELETE', `/api/v1/keys/${cfg.openRouterLastKeyHash}`, cfg.openRouterMgmtKey, null).catch(() => {});
    }

    cfg.openRouterLastKeyHash = newHash;
    // Schedule next run
    const next = new Date(Date.now() + cfg.schedule.intervalDays * 24 * 60 * 60 * 1000);
    cfg.schedule.nextRunAt = next.toISOString();
    saveCfg(cfg);

    const ok = results.every(r => r.ok);
    appendHistory({ source: 'scheduled', keyPreview: mask(newKey), ok, results });
    console.log(`[scheduler] Done — ${ok ? 'all OK' : 'some failed'}. Next run: ${cfg.schedule.nextRunAt}`);
  } catch (e) {
    console.error(`[scheduler] Error:`, e.message);
  }
}

function checkSchedule() {
  const cfg = loadCfg();
  if (!cfg.schedule.enabled || !cfg.schedule.nextRunAt) return;
  if (new Date() >= new Date(cfg.schedule.nextRunAt)) {
    runScheduledRotation();
  }
}

// Check on startup + every hour
setTimeout(checkSchedule, 5000);
setInterval(checkSchedule, 60 * 60 * 1000);

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

  // ── GET /api/history ──────────────────────────────────────
  if (method === 'GET' && url === '/api/history') {
    json(res, loadHistory());
    return;
  }

  // ── POST /api/history/clear ────────────────────────────────
  if (method === 'POST' && url === '/api/history/clear') {
    try { fs.writeFileSync(HISTORY_PATH, '[]', 'utf8'); } catch {}
    json(res, { ok: true });
    return;
  }

  // ── GET /api/health ───────────────────────────────────────
  // Per-driver health check: reads each key, validates unique keys in parallel
  // Status values: valid | invalid | not_set | not_installed | disabled
  if (method === 'GET' && url.split('?')[0] === '/api/health') {
    try {
      const qs        = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
      const targetUrl = new URLSearchParams(qs).get('url') || 'http://localhost:1234/v1';
      const cfg       = loadCfg();

      // Pass 1: read keys from all drivers
      const driverInfo = DRIVERS.map(d => {
        const p       = driverPath(d, cfg);
        const enabled = isEnabled(d, cfg);
        const exists  = Boolean(p) && fs.existsSync(p);
        const key     = (enabled && exists) ? d.read(p) : null;
        return { d, enabled, exists, key, keyPreview: mask(key) };
      });

      // Pass 2: validate each unique key once (parallel)
      const uniqueKeys = [...new Set(driverInfo.map(x => x.key).filter(Boolean))];
      const pings      = await Promise.all(uniqueKeys.map(k => pingKey(k, targetUrl)));
      const keyMap     = new Map(uniqueKeys.map((k, i) => [k, pings[i]]));

      // Pass 3: build result
      const drivers = driverInfo.map(({ d, enabled, exists, key, keyPreview }) => {
        let status, message = null;
        if      (!enabled) { status = 'disabled'; }
        else if (!exists)  { status = 'not_installed'; }
        else if (!key)     { status = 'not_set'; }
        else {
          const v = keyMap.get(key);
          status  = v?.ok ? 'valid' : 'invalid';
          message = v?.message || null;
        }
        return { id: d.id, label: d.label, icon: d.icon, group: d.group,
                 status, keyPreview, message };
      });

      json(res, { url: targetUrl, checkedAt: new Date().toISOString(), drivers });
    } catch(e) { json(res, { ok: false, error: e.message }, 500); }
    return;
  }

  // ── POST /api/validate-key ────────────────────────────────
  if (method === 'POST' && url === '/api/validate-key') {
    try {
      const { key, url: targetUrl } = JSON.parse(await readBody(req));
      if (!key) return json(res, { ok: false, message: 'No key provided' }, 400);
      json(res, await pingKey(key, targetUrl));
    } catch(e) { json(res, { ok: false, message: e.message }, 500); }
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
      if (body.schedule && typeof body.schedule === 'object') {
        const s = cfg.schedule;
        const prev = s.enabled;
        Object.assign(s, body.schedule);
        // Recalculate nextRunAt when enabling or interval changed
        if (s.enabled && (!s.nextRunAt || !prev || body.schedule.intervalDays !== undefined)) {
          s.nextRunAt = new Date(Date.now() + s.intervalDays * 24 * 60 * 60 * 1000).toISOString();
        }
        if (!s.enabled) s.nextRunAt = null;
      }
      saveCfg(cfg);
      json(res, { ok: true });
    } catch (e) { json(res, { ok: false, error: e.message }, 400); }
    return;
  }

  // ── POST /api/schedule ────────────────────────────────────
  if (method === 'POST' && url === '/api/schedule') {
    try {
      const body = JSON.parse(await readBody(req));
      const cfg  = loadCfg();
      const s    = cfg.schedule;
      if (body.enabled      !== undefined) s.enabled      = Boolean(body.enabled);
      if (body.intervalDays !== undefined) s.intervalDays = Math.max(1, Number(body.intervalDays) || 7);
      if (body.keyName      !== undefined) s.keyName      = body.keyName;
      if (body.deleteOld    !== undefined) s.deleteOld    = Boolean(body.deleteOld);
      // Recalculate nextRunAt when enabling or changing interval
      if (s.enabled && (!s.nextRunAt || body.intervalDays !== undefined || body.enabled === true)) {
        s.nextRunAt = new Date(Date.now() + s.intervalDays * 24 * 60 * 60 * 1000).toISOString();
      }
      if (!s.enabled) s.nextRunAt = null;
      saveCfg(cfg);
      json(res, { ok: true, schedule: s });
    } catch (e) { json(res, { ok: false, error: e.message }, 400); }
    return;
  }

  // ── POST /api/schedule/run-now ─────────────────────────────
  if (method === 'POST' && url === '/api/schedule/run-now') {
    const cfg = loadCfg();
    if (!cfg.openRouterMgmtKey)
      return json(res, { ok: false, error: 'OpenRouter Management API key not configured' });
    json(res, { ok: true, message: 'Rotation triggered — check history in a moment' });
    runScheduledRotation();   // fire-and-forget
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
            const existing = (meta.status === 200 && meta.body?.data) ? meta.body.data : {};
            // Only overlay apiKey (and baseUrl if set) — preserve all other fields as-is
            // This avoids schema-validation errors from n8n when fields differ across versions
            const rawData  = { ...existing, apiKey: newKey };
            if (cred.baseUrl) rawData.url = cred.baseUrl;
            const credName = (meta.status === 200 && meta.body?.name) ? meta.body.name : cred.name;
            const r = await n8nReq(cfg, 'PATCH', `/api/v1/credentials/${cred.id}`, { name: credName, data: rawData });
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

      const allOk = results.every(r => r.ok);
      appendHistory({ source: 'manual', keyPreview: mask(newKey), ok: allOk, results });
      json(res, { ok: allOk, results });
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
            const existing = (meta.status === 200 && meta.body?.data) ? meta.body.data : {};
            const rawData  = { ...existing, apiKey: newKey };
            if (cred.baseUrl) rawData.url = cred.baseUrl;
            const credName = (meta.status === 200 && meta.body?.name) ? meta.body.name : cred.name;
            const r = await n8nReq(cfg, 'PATCH', `/api/v1/credentials/${cred.id}`, { name: credName, data: rawData });
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

      const allOk = results.every(r => r.ok);
      appendHistory({ source: 'openrouter', keyPreview: mask(newKey), ok: allOk, results });
      json(res, { ok: allOk, newKeyMasked: mask(newKey), newKeyHash: newHash, results, deleteResult });
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
