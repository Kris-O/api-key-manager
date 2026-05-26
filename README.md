# 🔑 Key Manager

> One-click API key rotation across **Claude Desktop**, **VS Code** and **n8n** — plus a full n8n credential manager.

Built for AI developers who run LM Studio / Ollama locally and want to rotate their API keys without manually hunting down config files every time.

---

## Features

| | |
|-|-|
| 🔄 **Bulk key rotation** | Update LM Studio / OpenAI API keys across all config files in one click |
| 🗃️ **n8n credential manager** | Browse all n8n credentials and edit any of them directly from the UI |
| 🔒 **Localhost only** | Binds strictly to `127.0.0.1` — never reachable from the network |
| 📦 **Zero dependencies** | Pure Node.js built-ins only (`http`, `https`, `fs`, `path`, `os`) |
| 💾 **Automatic backups** | Every modified file gets a `.bak` copy before changes are written |
| 🧩 **Smart schema forms** | Built-in field schemas for common n8n credential types (OpenAI, HTTP Auth, Slack, GitHub…) |

---

## Supported sources

### Key rotation targets
| Source | Location |
|--------|----------|
| Claude Desktop MCP | `%APPDATA%\Claude\claude_desktop_config.json` |
| VS Code `n8n.agent.apiKey` | `%APPDATA%\Code\User\settings.json` |
| VS Code chat language models | `%APPDATA%\Code\User\chatLanguageModels.json` |
| n8n credentials | REST API v1 (`PATCH /api/v1/credentials/:id`) |

### n8n credential types with built-in schemas
`openAiApi` · `httpBasicAuth` · `httpHeaderAuth` · `bearerToken` · `apiKeyAuth` · `n8nApi` · `slackApi` · `githubApi` · `telegramApi` · `googleOAuth2Api`

Any other credential type can be edited using the raw JSON editor.

---

## Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- A running **n8n** instance (self-hosted) with the REST API enabled
- (Optional) Claude Desktop, VS Code with n8n/LM Studio extensions

---

## Quick start

```bash
git clone https://github.com/Kris-O/api-key-manager.git
cd key-manager
node server.js
```

The app opens automatically at **http://localhost:7432**.

On Windows you can also double-click `run.bat`.

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
  "n8nBaseUrl":     "http://localhost:5678",
  "n8nApiKey":      "eyJhbGci...",
  "n8nCredentials": [
    {
      "id":      "OczJe7i1CBL5e89f",
      "name":    "LM Studio account",
      "baseUrl": "http://host.docker.internal:1234/v1"
    }
  ],
  "paths": {
    "claudeDesktop":  "C:\\Users\\You\\AppData\\Roaming\\Claude\\claude_desktop_config.json",
    "vscodeSettings": "C:\\Users\\You\\AppData\\Roaming\\Code\\User\\settings.json",
    "chatModels":     "C:\\Users\\You\\AppData\\Roaming\\Code\\User\\chatLanguageModels.json"
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

All configured local files and n8n credentials update simultaneously.
The status dots turn green once a source is configured and has a key set.

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
- **Local file paths**: customise paths if your setup differs from defaults
- **Rotation targets**: select which n8n credentials are included in bulk rotation; use "Load from n8n" to discover them

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/status` | Status of all sources |
| `GET`  | `/api/config` | Current config (API key masked) |
| `POST` | `/api/config` | Save config |
| `POST` | `/api/rotate` | Bulk key rotation |
| `GET`  | `/api/n8n/credentials` | List all n8n credentials |
| `POST` | `/api/n8n/credentials/:id` | Update a single n8n credential |
| `GET`  | `/api/n8n/schemas` | Built-in credential type schemas |
| `GET`  | `/api/n8n/discover` | Legacy alias for credentials list |

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
├── LICENSE
└── SECURITY.md
```

---

## Security

See [SECURITY.md](SECURITY.md) for the full security model.

**TL;DR:** The server never listens on a public interface, stores no keys beyond the immediate request, and has zero third-party dependencies.

---

## Contributing

PRs welcome! Ideas:

- [ ] macOS / Linux default paths auto-detection
- [ ] More built-in credential schemas
- [ ] `.env` file support as an additional rotation target
- [ ] Docker secrets support
- [ ] Keyboard shortcut to trigger rotation

---

## License

[MIT](LICENSE)
