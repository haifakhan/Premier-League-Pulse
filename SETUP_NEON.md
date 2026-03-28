# Neon + Vercel Setup

This project can use a shared Neon Postgres database so everyone sees the same users, threads, posts, polls, and profile data.

## 1. Put secrets in `.env.local`

Create a file named `.env.local` in the project root. This file is ignored by git.

Add your shared Neon connection string and the other required secrets:

```env
DATABASE_URL="your_neon_connection_string_here"
JWT_SECRET="choose_a_shared_secret_for_your_team"
FOOTBALL_DATA_API_KEY="your_football_data_key"
HUGGINGFACE_API_KEY="your_huggingface_key"
ADMIN_EMAIL="admin@sportsdeck.local"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="admin12345"
```

Notes:
- `DATABASE_URL` should be the Neon connection string.
- `.env.local` should not be committed.

## 2. Run the database setup locally

After `.env.local` is created, run:

```bash
npm run db:setup
```

That command does three things:
- runs Prisma migrations on the database
- creates or updates the admin account
- syncs auto-generated match threads

You can also run the steps separately:

```bash
npm run db:migrate:deploy
npm run db:seed-admin
npm run db:sync-match-threads
```

## 3. Local vs deployed usage

- `.env.docker`: local Docker-only database setup
- `.env.local`: your private local machine secrets, including Neon
