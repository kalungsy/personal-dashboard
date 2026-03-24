# Render hosting + Render MCP (Cursor)

This app is meant to run on [Render](https://render.com) as a **single Docker web service** using the repo-root `render.yaml` Blueprint and `Dockerfile`.

Use Render’s **hosted MCP server** so Cursor can list services, inspect deploys, read logs/metrics, and adjust environment variables in natural language. Official guide: [Render MCP Server](https://render.com/docs/mcp-server).

## 1. One-time: create a Render API key

1. Open [Render → Account Settings → API keys](https://dashboard.render.com/settings#api-keys).
2. Create a key and store it somewhere safe (password manager).

Render’s docs note that API keys are **broadly scoped** across workspaces you can access. Only put this key in trusted tools. See [Render MCP Server — Setup](https://render.com/docs/mcp-server#2-configure-your-tool).

## 2. Wire Cursor to the Render MCP server

Add this to your **user** MCP config (recommended so the key stays out of git):

**macOS / Linux:** `~/.cursor/mcp.json`

Merge with any existing `mcpServers` you already have:

```json
{
  "mcpServers": {
    "render": {
      "url": "https://mcp.render.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_RENDER_API_KEY_HERE"
      }
    }
  }
}
```

Replace `YOUR_RENDER_API_KEY_HERE` with your key. Cursor’s MCP docs: [Using MCP in Cursor](https://docs.cursor.com/context/mcp).

Restart Cursor after editing `mcp.json`.

A **template without secrets** lives in this repo at `.cursor/mcp.json.example` (copy values into `~/.cursor/mcp.json`).

## 3. Select your Render workspace in chat

Before MCP tools can see your services, tell the agent (in Cursor):

> Set my Render workspace to **YOUR_WORKSPACE_NAME**

If you skip this, Cursor will usually prompt you when you first ask for Render actions. Details: [Render MCP — Set your workspace](https://render.com/docs/mcp-server#3-set-your-workspace).

## 4. First deploy (Blueprint + Git)

Render MCP can **create** web services, but the smoothest path for **this** repo is still:

1. Push the repository to GitHub (or GitLab) with `render.yaml` and `Dockerfile` on the default branch (e.g. `main`).
2. In the [Render Dashboard](https://dashboard.render.com): **New +** → **Blueprint** → connect the repo → apply `render.yaml`.

After that, **automatic deploys on push** (if enabled on the service) rebuild the image so updates to `signals.json` ship on the next successful build.

## 5. What the Render MCP server can and cannot do

Per [Render MCP — Limitations](https://render.com/docs/mcp-server#limitations):

| You can (via MCP) | You cannot (via MCP) |
|-------------------|----------------------|
| List / describe services | Trigger a new deploy (use git push or Dashboard **Manual Deploy**) |
| List deploy history & deploy details | Change scaling/instance count |
| Query logs and metrics | Delete most resources (use Dashboard or REST API) |
| **Update environment variables** on a service | Full parity with every Blueprint/Docker option |

So **“manage”** = observability + env tuning + service discovery; **“deploy”** = Git → auto-deploy, or manual deploy in the dashboard when you need it.

## 6. Example prompts to use in Cursor (with Render MCP enabled)

After your workspace is set:

- “List my Render services and show which one is `personal-dashboard`.”
- “Show the latest deploy for my `personal-dashboard` web service and whether it succeeded.”
- “Pull recent error-level logs for `personal-dashboard`.”
- “What does CPU/memory look like for `personal-dashboard` today?”
- “Set `CORS_ORIGINS` on `personal-dashboard` to `https://my-custom-domain.com`” (only if you split frontend/API later; same-origin `.onrender.com` does not need this.)

## 7. This repo’s Render contract

- **Health check:** `GET /api/health`
- **Runtime:** Docker (`Dockerfile` at repo root)
- **Blueprint:** `render.yaml`
- **Port:** Render sets `PORT`; the image uses `${PORT:-8000}`

For generic Docker deploy steps without MCP, see `DEPLOY.md` in the repo root.
