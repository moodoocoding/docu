# Notes

Last updated: 2026-05-04

## Project Snapshot
- Repo: `moodoocoding/docu`
- Stack: Vite + plain HTML/JS/CSS, plus a small React template scaffold in `src/`
- Main app entry: `index.html`
- Document editor: `create.html` + `app.js`
- Document archive: `history.html` + `history.js`
- Auth: `login.html` + `auth.js` + `supabase.js`

## What Changed Recently
- Renamed the top-level history area to `내 문서함`.
- Updated the main navigation and related pages to point to `내 문서함`.
- Updated the archive page copy so it reads like a document storage area instead of a raw history log.
- Kept the existing storage model:
  - Supabase table: `documents`
  - Local fallback: `localStorage` key `docHistory`

## Important Behavior
- Creating a document in `app.js` saves to Supabase first.
- If Supabase save fails, the app falls back to local storage.
- `history.js` reads from Supabase `documents` by `user_id`, then falls back to local storage.
- `auth.js` redirects non-logged-in users to `login.html` except on landing and login pages.

## Auth / Local Dev Notes
- Local login requires these Vite env vars:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - optional `VITE_AUTH_REDIRECT_URL`
- For local OAuth testing, Supabase redirect URL should include:
  - `http://localhost:5173/login.html`
- The project currently has no checked-in `.env.local`.

## Dev Server
- Local dev server was run with:
  - `npm run dev -- --host 0.0.0.0`
- Vite served the app on port `5173` during the last session.

## Git / Deploy Notes
- Local changes were committed on `master`.
- Commit: `b29c752 Rename history to my document box`
- Changes were pushed to GitHub successfully.

## Caution
- Do not store GitHub tokens or Supabase secrets in the repo.
- If auth or pushes fail again, check:
  - GitHub credential helper
  - GitHub token scope
  - Supabase env vars
  - redirect URLs in Supabase

## Good Starting Files For Next Time
- `index.html`
- `history.html`
- `history.js`
- `app.js`
- `auth.js`
- `supabase.js`
- `login.html`
