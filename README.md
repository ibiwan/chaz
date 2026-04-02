# Chaz - Full-Stack TypeScript App (Vercel)

A minimal Next.js full-stack starter with TypeScript for Vercel deployment.

## Features

- Frontend: `app` directory (React components)
- Backend: `app/api/*` routes (serverless handlers)
- TypeScript + ESLint + Prettier

## Setup

1. Install
   - `npm install`
2. Run locally
   - `npm run dev`
3. Build
   - `npm run build`
4. Start
   - `npm run start`

## Relevant endpoints

- `GET /api/hello`
- Home page: `/`
- `POST /api/sessions` - create session
- `GET /api/sessions?id=<sessionId>` - get session
- `PATCH /api/sessions` - update session fields

## Session data model

- `id: string`
- `player1_token?: string`
- `player2_token?: string`
- `keyword: string`
- `white: 'player1' | 'player2'`
- `started: boolean`
- `moves: string` (comma-separated SAN or long algebraic)

## API auth behavior

- `POST /api/sessions` with `keyword` returns:
  - role: `player1` | `player2` | `observer`
  - `token` for player roles
  - session payload
- `PATCH /api/sessions` requires:
  - `keyword`, `token`, `action`
  - actions: `sit_white`, `sit_black`, `ready`, `move`
- `GET /api/sessions` read-only board view via `id` or `keyword`, no token required
