#!/usr/bin/env bash
set -euo pipefail

docker compose --env-file .env.docker up -d db
docker compose --env-file .env.docker --profile import run --rm --build importer
