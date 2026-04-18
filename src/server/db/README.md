# kerf — Local Database Setup

PostgreSQL 16 runs in Docker. Follow these steps to get the database running locally.

## Prerequisites

- Docker Desktop installed and running
- Node.js 22 (`nvm use 22`)
- `.env` file configured (copy from `.env.example`)

## First-time setup

### 1. Copy environment file

```bash
cp .env.example .env
```

The defaults in `.env.example` work as-is for local development. No changes needed.

### 2. Start PostgreSQL

```bash
docker compose -f docker-compose.dev.yml up -d
```

Verify it's running:
```bash
docker compose -f docker-compose.dev.yml ps
```

Expected: `postgres` service shows `healthy`.

### 3. Apply migrations

```bash
npm run db:migrate
```

This creates all tables in the `kerf_dev` database.

### 4. Seed word corpus

```bash
npm run db:seed
```

Downloads ~8,500 words from the Google 10k English list and inserts them into `word_corpus`. Takes ~10 seconds on a normal connection.

### 5. Verify

Connect with any PostgreSQL client (psql, TablePlus, DBeaver):

```
Host:     localhost
Port:     5432
Database: kerf_dev
User:     kerf
Password: kerf_dev
```

Quick psql check:
```bash
psql postgresql://kerf:kerf_dev@localhost:5432/kerf_dev -c "SELECT count(*) FROM word_corpus;"
```

Expected: `count` ≈ 8500.

## Daily workflow

```bash
# Start DB (if not running)
docker compose -f docker-compose.dev.yml up -d

# Start dev server
npm run dev
```

## Generating new migrations

After modifying `src/server/db/schema.ts`:

```bash
npm run db:generate   # generates SQL in src/server/db/migrations/
npm run db:migrate    # applies to local DB
```

Always commit both the schema change and the generated migration together.

## Stopping / resetting

```bash
# Stop (data preserved)
docker compose -f docker-compose.dev.yml down

# Stop and wipe all data
docker compose -f docker-compose.dev.yml down -v
```
