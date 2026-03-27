#!/usr/bin/env bash
set -euo pipefail

docker compose --env-file .env.docker up -d db
docker compose --env-file .env.docker run --rm importer
