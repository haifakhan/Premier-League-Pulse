# SportsDeck (PP2)

SportsDeck is a Premium League Football focused web app that combines live match data with community discussion. Users can follow teams, create and reply to threads, vote in polls, report content, and use moderation/appeals workflows.


## Quick Start (Docker, Recommended)

1. Configure `.env.docker` with your values (see Environment Variables below).
2. Build and start services:

```bash
./start.sh
```

3. Import/migrate/seed database data:

```bash
./import-data.sh
```

4. Open the app:

- `http://localhost:8012`
- PostgreSQL host port: `localhost:5432`

5. Stop everything:

```bash
./stop.sh
```



## Run Locally Without Docker

1. Install dependencies:

```bash
npm install
```

2. Configure `.env.local`.
3. Apply migrations + seed baseline/demo data:

```bash
npm run db:setup
```

4. Start dev server:

```bash
npm run dev
```

5. Open:

- `http://localhost:3000`

Note: `npm run dev` already runs `prisma generate` before starting Next.js.

## Environment Variables


### `.env.local` (local `npm run dev`) and .env file

this is pushed!

### `.env.docker` (Docker Compose)

this is also pushed! 

## Deployment link
https://sportsdeck-l1mz.vercel.app/



## Script Reference

- `npm run dev` -> generate Prisma client + run Next.js dev server
- `npm run build` -> generate Prisma client + production build
- `npm run start` -> run production server
- `npm run lint` -> run ESLint
- `npm run db:migrate:deploy` -> apply Prisma migrations
- `npm run db:seed-admin` -> create/update admin account
- `npm run db:seed-demo` -> seed demo users/threads/posts/polls/reports
- `npm run db:sync-match-threads` -> sync match-based threads
- `npm run db:setup` -> migrate + admin seed + demo seed + match-thread sync
- `./start.sh` -> `docker compose ... up -d --build`
- `./import-data.sh` -> start db + run importer (migrate/seed/sync)
- `./stop.sh` -> `docker compose down`