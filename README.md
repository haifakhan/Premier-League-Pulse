# Premier League Pulse

A Premier League community app for following matches, checking standings, and discussing football with other fans.

## Features

- Match schedules, results, standings, and team pages
- Match threads, posts, replies, and polls
- Personalized feeds and team follows
- Google sign-in and account authentication
- Content reporting, moderation, and appeals
- AI-assisted translation and sentiment analysis

## Built with

Next.js, React, TypeScript, Tailwind CSS, PostgreSQL, and Prisma. Docker Compose runs the app with PostgreSQL and Nginx.

## Run locally

Requires Node.js and a running PostgreSQL database.

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` with your database URL, a JWT secret, and the API credentials for the services you use. Set a unique admin password before seeding.

```bash
npm run db:setup
npm run dev
```

Open [localhost:3000](http://localhost:3000).

## Run with Docker

```bash
cp .env.docker.example .env.docker
```

Fill in `.env.docker`, then run:

```bash
./start.sh
bash ./import-data.sh
```

Open [localhost:8012](http://localhost:8012). Run `./stop.sh` to stop the containers.

## Other commands

```bash
npm run lint    # Check code style
npm run build   # Build for production
npm run start   # Serve the production build
```
