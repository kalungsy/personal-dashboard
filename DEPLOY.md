# Deploying the personal dashboard (free tier + infra as code)

The app is **one Docker image**: FastAPI serves `/api/*` and the built React SPA from `dashboard/client/dist`. `signals.json` is copied into the image at `/app/signals.json` (configurable with `SIGNALS_JSON`).

## What you already have in the repo

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage build: `npm run build` + Python + Uvicorn |
| `.dockerignore` | Keeps images small and builds fast |
| `render.yaml` | **Render Blueprint** (declarative service on Render) |
| `fly.toml` | **Fly.io** app shape (machines, health check, region) |
| `docker-compose.yml` | Smoke-test locally: `docker compose up --build` → http://localhost:8000 |

## Choose a free host

### Option A — Render (simplest UI, free web service)

1. Push this repo to GitHub (or GitLab) if it is not already.
2. In [Render](https://render.com): **New +** → **Blueprint**.
3. Connect the repo and select `render.yaml`.
4. Adjust `name` / `region` in `render.yaml` if you want, then apply.
5. First deploy builds the Docker image (several minutes). Open the `.onrender.com` URL.

**Cursor + Render MCP:** To manage the service from Cursor (list services, deploy history, logs, metrics, env vars), follow [docs/RENDER_MCP.md](docs/RENDER_MCP.md) and Render’s [MCP server docs](https://render.com/docs/mcp-server). Note: MCP does not trigger deploys; use git push (auto-deploy) or the Dashboard **Manual Deploy**.

**Cold starts:** Free web services sleep after idle; first request can be slow.

**Updating `signals.json`:** Merge a commit that changes `signals.json`, or trigger **Manual Deploy** so the image rebuilds and picks up the new file.

### Option B — Fly.io (more control, free allowance)

1. Install [flyctl](https://fly.io/docs/hands-on/install-flyctl/).
2. From repo root: `fly auth login` then `fly launch`.
3. When prompted, reuse `fly.toml`; set a **unique** `app` name (globally unique on Fly).
4. Deploy: `fly deploy`.

**Scale-to-zero:** `min_machines_running = 0` and `auto_stop_machines = true` match a “free-style” sleep pattern; first request wakes the machine.

**Updating `signals.json`:** Commit changes and run `fly deploy` again (rebuilds the image).

### Option C — Any Docker host

Build and run:

```bash
docker build -t personal-dashboard .
docker run --rm -p 8000:8000 -e PORT=8000 personal-dashboard
```

Use the same image on Railway, Google Cloud Run (with small YAML), etc., if you outgrow one provider.

## Environment variables

| Variable | When to set |
|----------|-------------|
| `PORT` | Set automatically on Render; use `8000` locally / in Compose. |
| `CORS_ORIGINS` | Comma-separated origins. **Same host as the UI** (this Docker setup) → browser calls `/api` same-origin, so CORS is not critical. Set your real site URL if you later split frontend and API. |
| `SIGNALS_JSON` | Only if the file is not at `/app/signals.json` (e.g. mounted volume). |

## Infra as code summary

- **Render:** `render.yaml` is the service definition; link it as a Blueprint for reproducible creates/updates.
- **Fly.io:** `fly.toml` is versioned config; `fly deploy` applies it.
- **Docker:** `Dockerfile` is the portable unit; both platforms build from it.

Optional next step: add a GitHub Action that runs on push to `main` and calls **Render’s deploy hook** or runs `fly deploy` with `FLY_API_TOKEN` — only if you want fully automated deploys after every merge.

## Quick local check

```bash
docker compose up --build
```

Visit http://localhost:8000 — you should get the SPA; http://localhost:8000/api/health should return `{"ok":true}`.
