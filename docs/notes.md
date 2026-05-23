# Notes

Last updated: 2026-05-23

## Project Snapshot
- Repo: `moodoocoding/docu`
- Stack: Vite + plain HTML/JS/CSS, plus a small React template scaffold in `src/`
- Main app entry: `index.html`
- Document editor: `create.html` + `app.js`
- Document archive: `history.html` + `history.js`
- Auth: `login.html` + `auth.js` + `supabase.js`

## What Changed Recently (2026-05-23)
- **스마트 폴백 (Smart Fallback) 적용**:
  - Vercel API 및 Netlify Functions에 인메모리 쿨다운 라우터 탑재.
  - 특정 모델이 API 할당량 초과(429) 또는 네트워크 장애를 뱉으면 5분간 쿨다운 처리하여, 다음 요청 시 2~3초의 대기 지연 없이 곧바로 활성 모델로 자동 스위칭(Bypass)되도록 최적화.
  - 텍스트 생성(`api/gemini.js`, `netlify/functions/gemini.js`, `gemini.js`) 및 캐릭터 이미지 생성(`api/generate-character.js`, `netlify/functions/generate-character.js`, `leading.js`) 전체 흐름에 이중화 적용.
- **모바일 반응형 레이아웃 고도화 (768px 이하)**:
  - 메인 대시보드(`index.html`): 4열 문서 그리드(`.doc-grid`), 3열 특징 그리드(`.feature-grid`), 4열 푸터를 1열 세로형 카드 형태로 자동 재정렬되게 쿼리 주입.
  - 학사일정 관리(`calendar.css`): 상단 타이틀과 보라색 액션 버튼 3개가 뭉개지던 간섭 현상을 해결하여 수직 카드 정렬로 보정하고, 주간 시간표와 캘린더 모달을 모바일 뷰에 맞춰 터치 타깃 최적화.
- **기존 내 문서함 관리 및 동기화 유지**:
  - Supabase 테이블: `documents`
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
- Local dev server is run with:
  - `npm.cmd run dev` (PowerShell 실행 권한 우회)
- Vite served the app on port `5173` during the last session.

## Git / Deploy Notes
- Local changes were committed on `master`.
- Pushed to GitHub with commit `1023357` (스마트 폴백 및 모바일 레이아웃 고도화).

## Caution
- Do not store GitHub tokens or Supabase secrets in the repo.
- If auth or pushes fail again, check:
  - GitHub credential helper
  - GitHub token scope
  - Supabase env vars
  - redirect URLs in Supabase

## Good Starting Files For Next Time
- `index.html`
- `calendar.html`
- `calendar.js`
- `calendar.css`
- `gemini.js`
- `notes.md`
