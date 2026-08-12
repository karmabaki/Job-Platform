# Global Remote Talent Marketplace

A platform connecting skilled professionals from lower-wage countries with remote
employers in the US and Europe. See [CLAUDE.md](./CLAUDE.md) for full project
context, scope, and rules.

**Status:** Phase 1 — Project Scaffolding. No auth, no database, no business
features yet — just the two apps booting.

## Prerequisites

- Node.js 20+ (developed against v24)
- npm 10+ (ships with Node)

## Install

From the repo root (this installs dependencies for both apps via npm workspaces):

```
npm install
```

Do not run `npm install` inside `apps/web` or `apps/api` individually — the
workspace root is the single install point.

## Running the frontend (apps/web)

```
npm run dev -w apps/web
```

Opens at http://localhost:3000

## Running the backend (apps/api)

```
npm run start:dev -w apps/api
```

Runs at http://localhost:3001 (port is env-overridable via `PORT`)

## Folder layout

```
apps/
  web/      Next.js frontend (TypeScript, App Router, Tailwind CSS)
  api/      NestJS backend (TypeScript, REST API)
packages/    Shared packages (created only when genuinely necessary)
docs/        Architecture, database, and technical decision docs
```

## Other useful commands

Run per-workspace using the `-w` flag, e.g.:

```
npm run typecheck -w apps/web
npm run typecheck -w apps/api
npm run lint -w apps/web
npm run lint -w apps/api
```
