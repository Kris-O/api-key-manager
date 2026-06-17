# 🔑 Key Manager

> One-click API key rotation across **Claude Desktop**, **VS Code**, **Cursor**, **Windsurf**, **Continue.dev**, **Aider**, and **n8n** — plus a full n8n credential manager.

Built for AI developers who run LM Studio / Ollama locally and want to rotate their API keys without manually hunting down config files every time.

---

## Features

| | |
|-|-|
| 🔄 **Bulk key rotation** | Update API keys across all configured tools in one click |
| 🔌 **Driver architecture** | Extensible plugin registry — each tool is a self-contained driver |
| 🗃️ **n8n credential manager** | Browse all n8n credentials and edit any of them directly from the UI |
| 🔒 **Localhost only** | Binds strictly to `127.0.0.1` — never reachable from the network |
| 📦 **Zero dependencies** | Pure Node.js built-ins only (`http`, `https`, `fs`, `path`, `os`) |
| 💾 **Automatic backups** | Every modified file gets a `.bak` copy before changes are written |
| 🧩 **Smart schema forms** | Built-in field schemas for common n8n credential types |
| ⚡ **OpenRouter auto-rotation** | Automatically generate a fresh key via OpenRouter Management API |

---

## Supported tools

### Key rotation targets

| Driver | File | Detection |
|--------|------|-----------|
| Claude Desktop (MCP) | `%APPDATA%\Claude\claude_desktop_config.json` | auto |
| VS Code — settings | `%APPDATA%\Code\User\settings.json` | auto |
| VS Code — chat models | `%APPDATA%\Code\User\chatLanguageModels.json` | auto |
| Cursor — settings | `%APPDATA%\Cursor\User\settings.json` | auto |
| Cursor — chat models | `%APPDATA%\Cursor\User\chatLanguageModels.json` | auto |
| Windsurf | `%APPDATA%\Windsurf\User\settings.json` | auto |
| Continue.dev | `%USERPROFILE%\.continue\config.json` | auto |
| Aider | `%USERPROFILE%\.aider.conf.yml` | auto |
| .env file | configurable path | manual |
| n8n credentials | REST API v1 (`PATCH /api/v1/credentials/:id`) | via API |

Auto-detected tools are silently skipped if not installed. Only configured tools (`.env`, custom paths) report an error when the file is missing.

### n8n credential types with built-in schemas

`openAiApi` · `httpBasicAuth` · `httpHeaderAuth` · `bearerToken` · `apiKeyAuth` · `n8nApi` · `slackApi` · `githubApi` · `telegramApi` · `googleOAuth2Api`

Any other credential type can be edited using the raw JSON editor.

---

## Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- A running **n8n** instance (self-hosted) with the REST API enabled
- (Optional) Any of the supported editors/tools listed above

---

## Quick start

```bash
git clone https://github.com/Kris-O/api-key-manager.git
cd api-key-manager
node server.js
```

The app opens automatically at **http://localhost:7432**.

On Windows you can also double-click `run.bat`.

### Tests

```bash
npm test
```

The test suite starts Key Manager on a temporary local port with browser auto-open disabled, then checks the main page and core API endpoints.

### Custom port

```bash
KM_PORT=8080 node server.js       # Linux / macOS
set KM_PORT=8080 && node server.js  # Windows CMD
$env:KM_PORT=8080; node server.js   # Windows PowerShell
```

---

## Configuration

Configuration is stored in `app-config.json` (auto-created on first save, **gitignored**).

Copy the example to get started:

```bash
# Linux / macOS
cp app-config.example.json app-config.json
# Windows CMD
copy app-config.example.json app-config.json
```

Then edit through the **⚙ Settings** tab in the UI, or manually:

```json
{
  "n8nBaseUrl": "http://localhost:5678",
  "n8nApiKey":  "eyJhbGci...",
  "n8nCredentials": [
    {
      "id":      "OczJe7i1CBL5e89f",
      "name":    "LM Studio account",
      "baseUrl": "http://host.docker.internal:1234/v1"
    }
  ],
  "openRouterMgmtKey": "sk-or-mgmt-...",
  "paths": {
    "claudeDesktop":  "C:\\Users\\You\\AppData\\Roaming\\Claude\\claude_desktop_config.json",
    "vscodeSettings": "C:\\Users\\You\\AppData\\Roaming\\Code\\User\\settings.json",
    "chatModels":     "C:\\Users\\You\\AppData\\Roaming\\Code\\User\\chatLanguageModels.json",
    "continuedev":    "C:\\Users\\You\\.continue\\config.json",
    "aider":          "C:\\Users\\You\\.aider.conf.yml",
    "dotenv":         "C:\\Users\\You\\projects\\myapp\\.env"
  },
  "driverEnabled": {
    "cursor": false
  }
}
```

### Getting your n8n API key

1. Open your n8n instance
2. Go to **Settings → n8n API**
3. Click **Create an API key**
4. Paste it in Key Manager → Settings → n8n API Key

---

## Usage

### Tab 1 — Key Rotation

1. Generate a new API key in LM Studio (Settings → API → Regenerate)
2. Paste it in the **New API key** field
3. Click **Apply to all sources**

All configured local files and n8n credentials update simultaneously. Only tools that are detected (file exists) or explicitly configured participate in rotation.

The status dots turn green once a source is detected and has a key set.

### Tab 2 — n8n Credentials

Browse all credentials in your n8n instance:

- **Search** by name or type
- **Filter** by credential type using the chips
- Click **Edit ▾** on any credential to expand an inline edit form
- For known types, a structured form with proper fields is shown
- For unknown types, a raw JSON editor is shown
- Click **Save** to PATCH the credential via the n8n REST API

### Tab 3 — Settings

- **n8n connection**: set API key and base URL, test the connection
- **Connected tools**: enable/disable individual drivers, override file paths for non-standard installs
- **OpenRouter auto-rotation**: paste a management key to auto-generate and rotate keys without copy-pasting
- **Rotation targets (n8n)**: select which n8n credentials are included in bulk rotation

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/status` | Status of all sources |
| `GET`  | `/api/config` | Current config (API keys masked) |
| `POST` | `/api/config` | Save config |
| `GET`  | `/api/drivers` | List all drivers with detection status |
| `POST` | `/api/rotate` | Bulk key rotation |
| `POST` | `/api/openrouter/rotate` | Auto-generate key via OpenRouter and rotate |
| `GET`  | `/api/n8n/credentials` | List all n8n credentials |
| `POST` | `/api/n8n/credentials/:id` | Update a single n8n credential |
| `GET`  | `/api/n8n/schemas` | Built-in credential type schemas |

---

## Project structure

```
key-manager/
├── server.js               # Node.js HTTP server — zero npm deps
├── index.html              # Single-page app (served by server.js)
├── app-config.json         # ❌ gitignored — runtime config with your keys
├── app-config.example.json # ✅ committed — config template
├── package.json
├── run.bat                 # Windows launcher
├── .gitignore
├── .gitattributes
├── LICENSE
└── SECURITY.md
```

---

## Driver architecture

Each tool integration is a driver — a self-contained object in the `DRIVERS` array in `server.js`:

```js
{
  id:          'continuedev',
  label:       'Continue.dev',
  icon:        '▶️',
  group:       'AI Tools',
  configurable: true,        // path can be overridden in Settings
  defaultPath: path.join(HOME, '.continue', 'config.json'),
  detect(p)  { return fs.existsSync(p); },
  read(p)    { /* return current key or null */ },
  write(p, newKey) { /* update file, return { ok, detail } */ }
}
```

To add a new tool, add one object to the array — no other changes needed.

---

## Security

See [SECURITY.md](SECURITY.md) for the full security model.

**TL;DR:** The server never listens on a public interface, stores no keys beyond the immediate request, and has zero third-party dependencies.

---

## Contributing

PRs welcome! Ideas:

- [ ] macOS / Linux default path auto-detection
- [ ] More built-in n8n credential schemas
- [ ] Docker secrets support
- [ ] Keyboard shortcut to trigger rotation
- [ ] Rotation history / audit log
- [ ] Zed editor integration
- [ ] Claude Code CLI (`~/.claude/settings.json`)

---

## License

[MIT](LICENSE)
