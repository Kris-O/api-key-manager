# Security Policy

## Design principles

Key Manager is designed with security as the primary constraint:

| Property | Detail |
|----------|--------|
| **Localhost only** | Server binds strictly to `127.0.0.1`. It is **never** reachable from the network. |
| **Zero npm dependencies** | Only Node.js built-in modules (`http`, `https`, `fs`, `path`, `os`). No supply-chain risk. |
| **No key storage in memory beyond the request** | API keys are read from disk / sent to n8n and immediately discarded. They are never logged. |
| **Automatic backups** | Every file modified by the rotation gets a `.bak` copy first. |
| **Config file gitignored** | `app-config.json` (which contains your n8n API key and credential IDs) is excluded from git by default. |

## What Key Manager does NOT do

- It does **not** expose any endpoint to the internet.
- It does **not** store keys in browser storage (`localStorage`, cookies).
- It does **not** transmit data to third-party services.
- It does **not** require elevated / admin privileges.

## Threat model

Key Manager is a **local developer tool** intended for a single user on their own machine.
It is not designed for multi-user environments or shared systems.

### Covered

- Accidental git commit of secrets → `.gitignore` covers `app-config.json`
- File corruption during rotation → `.bak` backup before each write
- Invalid n8n schema breaking credentials → `buildCredData()` fills required defaults

### Not covered

- Malware with filesystem access on the same machine
- Other local processes connecting to port 7432 (no auth on the local server by design — if this concerns you, set `KM_PORT` to an obscure port)
- n8n API key stored in `app-config.json` readable by other local users on a shared system

## Reporting a vulnerability

Please open a GitHub issue marked **[security]** or contact the maintainer directly.
Do not disclose security issues publicly until a fix is available.
