#!/usr/bin/env bash
set -e

npm install
npx prisma generate
npx prisma migrate deploy

node -r dotenv/config scripts/seed-admin.cjs
node -r dotenv/config scripts/sync-match-threads.cjs || echo "sync failed, continuing"
