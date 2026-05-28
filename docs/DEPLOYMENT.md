# Deployment

uatchit deploys as a Docker Compose stack behind a Cloudflare Tunnel. **No ports are published to the host** — the tunnel reaches the web container over the internal Docker network and Cloudflare's edge terminates TLS. This keeps the origin unreachable by IP and means you don't manage certificates.

```
Internet ──▶ Cloudflare edge ──(tunnel)──▶ cloudflared ──▶ web:3000
                                                              │
                              db (postgres) ◀── web · migrate · cron
```

| Service | Role |
|---|---|
| `db` | Postgres 17, persisted in a named volume |
| `migrate` | one-shot — runs Drizzle migrations, then exits |
| `web` | the Next.js app (dashboard + marketing + API + MCP) |
| `cron` | loops `scripts/cron-loop.sh`, POSTing the tick endpoint every 60 s |
| `cloudflared` | the tunnel connector |

## Prerequisites

- A Linux VPS (2 vCPU / 4 GB+ RAM is plenty) with Docker Engine + Compose plugin.
- A domain on Cloudflare (nameservers pointed at Cloudflare).
- API keys: Resend, the AI/ML API, and Bright Data.

## 1. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
# optional: run docker as a non-root user
sudo usermod -aG docker "$USER" && newgrp docker
```

## 2. Get the code

```bash
git clone https://github.com/GPT-64590/uatchit.git
cd uatchit
```

## 3. Create the production `.env`

Copy the template and fill it in. Beyond the app keys in [`.env.example`](../.env.example), the compose stack needs four extra values:

```bash
cp .env.example .env
```

```ini
# App keys (from .env.example) — Resend, AI/ML API, Bright Data, AUTH_SECRET, CRON_SECRET…
AUTH_RESEND_KEY=re_…
RESEND_API_KEY=re_…
EMAIL_FROM=uatchit <noreply@uatchit.com>     # use a verified domain (step 5)
AIMLAPI_KEY=…
BRIGHTDATA_API_KEY=…
AUTH_SECRET=…            # openssl rand -base64 32
CRON_SECRET=…            # openssl rand -hex 32
AUTH_TRUST_HOST=true

# Public URLs — baked into the client bundle at build time
NEXT_PUBLIC_APP_URL=https://app.uatchit.com
NEXT_PUBLIC_MARKETING_URL=https://uatchit.com

# Compose-only
POSTGRES_PASSWORD=…      # openssl rand -hex 24
TUNNEL_TOKEN=…           # from step 4
```

`DATABASE_URL` is set automatically by compose to point at the `db` service — leave the `.env` value as-is; it's overridden.

## 4. Create the Cloudflare Tunnel

In the Cloudflare dashboard → **Zero Trust → Networks → Tunnels → Create a tunnel** (choose *Cloudflared*). Copy the tunnel **token** into `TUNNEL_TOKEN` in `.env`. Then add two **public hostnames** to the tunnel, both pointing at the internal service:

| Hostname | Service |
|---|---|
| `uatchit.com` | `http://web:3000` |
| `app.uatchit.com` | `http://web:3000` |

Cloudflare creates the proxied DNS records for you. (Both hostnames hit the same Next.js app, which routes by path.)

## 5. Verify the email domain in Resend

The default `onboarding@resend.dev` sender only delivers to your own Resend account address — fine for a smoke test, useless for real users. To send login + notification emails to anyone:

1. Resend dashboard → **Domains → Add Domain** → `uatchit.com`.
2. Add the DKIM / SPF / return-path records Resend gives you as DNS records in Cloudflare (DKIM `CNAME`s are typically left **DNS-only**, not proxied).
3. Once Resend shows the domain **Verified**, set `EMAIL_FROM="uatchit <noreply@uatchit.com>"`.

## 6. Build and start

```bash
docker compose up -d --build
```

This builds the image, waits for Postgres to be healthy, runs migrations (`migrate` exits 0), then starts `web`, `cron`, and `cloudflared`. Your site is live at `https://uatchit.com` once the tunnel connects — usually under a minute.

## 7. Verify

```bash
docker compose ps                 # all services up; migrate = exited (0)
docker compose logs -f web        # watch the app boot
curl -sf https://app.uatchit.com  # 200 from the edge
```

Then exercise the golden path: sign up (confirm the email arrives), create a watch, and confirm a cron tick runs (`docker compose logs cron`).

## Operations

```bash
# Update to the latest code
git pull && docker compose up -d --build

# Tail logs
docker compose logs -f web cron

# Run migrations manually (also runs automatically on every up)
docker compose run --rm migrate

# Back up the database
docker compose exec db pg_dump -U uatchit uatchit > backup-$(date +%F).sql

# Stop / tear down (the pgdata volume survives `down`; add -v to wipe it)
docker compose down
```

## Notes & hardening

- **Secrets** live only in `.env` on the host (git-ignored, `chmod 600`) and are injected at runtime via `env_file`. They are never baked into the image.
- **No inbound ports**: the VPS firewall only needs SSH (22). The tunnel makes outbound connections to Cloudflare, so 80/443 stay closed on the origin.
- **Run app processes as a non-root user** and keep the OS patched (`unattended-upgrades`).
- **`NEXT_PUBLIC_*` are build-time**: changing the public URLs requires a rebuild (`--build`), not just a restart.
