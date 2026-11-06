# Deploying the Formora API

The API runs on one EC2 host behind Traefik. GitHub Actions builds
`gopalchoudhary/formora` and deploys it over SSH; the EC2 host only pulls and restarts
containers.

```text
GitHub push → verify → build/push Docker Hub → SSH → migrate → compose up → health check
                                                        │
EC2: Traefik :80/:443 ── TLS ──▶ api:8000 ──▶ postgres:5432 (internal only)
```

## What the workflow needs

Repository secrets:

| Secret                 | Value                                                            |
| ---------------------- | ---------------------------------------------------------------- |
| `SSH_KEY`              | Private key whose public half is in EC2 `~/.ssh/authorized_keys` |
| `SSH_HOST`             | `3.109.1.233` (or a repository variable)                         |
| `SSH_USER`             | `ubuntu`                                                         |
| `SSH_HOST_FINGERPRINT` | Optional but recommended; pin the host key                       |
| `DOCKERHUB_USERNAME`   | `gopalchoudhary`                                                 |
| `DOCKERHUB_TOKEN`      | Docker Hub token with push access to `gopalchoudhary/formora`    |

The image repo is public by default, so EC2 does not need a Docker Hub login. If it is made
private, run `docker login` on the host once with a read-only token.

## One-time EC2 setup

1. Give the instance an **Elastic IP** and point
   `formorabackend.gopalchoudhary.dev` at it with an A record. If Cloudflare is in front,
   use DNS-only while the first certificate is issued.
2. Security group: allow `22` from trusted addresses, and `80`/`443` from the internet.
3. Install Docker Engine and the Compose plugin, then add the deploy user to the `docker`
   group:

   ```sh
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker ubuntu
   # log out and back in, or run: newgrp docker
   docker compose version
   ```

4. Make sure nothing else is listening on `:80` or `:443`.
5. Create the deploy directory and the environment file:

   ```sh
   sudo mkdir -p /opt/formora
   sudo chown ubuntu:ubuntu /opt/formora
   cd /opt/formora
   cp /path/to/deploy/.env.production.example .env
   chmod 600 .env
   ```

   Generate `JWT_SECRET` and `POSTGRES_PASSWORD` with:

   ```sh
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

   Use the same generated password in `POSTGRES_PASSWORD` and the password portion of
   `DATABASE_URL`. Base64url avoids URL-encoding problems.

6. Create Traefik's certificate store with the permissions Traefik requires:

   ```sh
   docker volume create formora_traefik_letsencrypt
   docker run --rm \
     -v formora_traefik_letsencrypt:/letsencrypt \
     alpine sh -c 'touch /letsencrypt/acme.json && chmod 600 /letsencrypt/acme.json'
   ```

## First deploy

Push to `main` (or run **Deploy API** manually from the Actions tab). The workflow:

1. type-checks and lints the API dependency graph;
2. runs the backend tests against a temporary Postgres service;
3. builds and pushes `gopalchoudhary/formora:<commit-sha>` and `:latest`;
4. starts the pushed image once and checks `/health`;
5. copies `deploy/docker-compose.yml` to `/opt/formora`, runs migrations, restarts the API,
   and checks the public health endpoint.

The compose file is safe to overwrite. `/opt/formora/.env` is not touched by CI.

## Verification

```sh
curl -fsS https://formorabackend.gopalchoudhary.dev/health
curl -fsS https://formorabackend.gopalchoudhary.dev/openapi.json >/dev/null
```

Then check `/docs`, a CORS preflight from the web origin, the `authentication-token` cookie
attributes in the browser, and a live-poll Socket.IO update.

## Rollback

Every image is tagged with its commit SHA. To move back:

```sh
cd /opt/formora
IMAGE_TAG=<previous-sha> docker compose up -d --wait api
```

Migrations are forward-only. If a migration changed data incompatibly, restore the database
backup rather than only rolling back the image.

## Notes

- `/health` is a liveness check. It does not query Postgres.
- The database has no published port; only the API reaches it over `formora_internal`.
- Socket.IO works through Traefik without extra configuration. This setup assumes one API
  replica; multiple replicas would need sticky sessions and a Socket.IO Redis adapter.
- Back up the `formora_postgres_data` volume. A simple `pg_dump` cron is enough to start.
- The API and web app should be sibling subdomains of `gopalchoudhary.dev`. A web app on an
  unrelated domain cannot share the httpOnly auth cookie with the Next.js server.
