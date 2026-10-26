# nter.pro mobile

The phone app for **nter.pro**, Niyantran's research terminal for government, policy, law and
global affairs. One codebase builds the Android app, the iPhone app and an installable web app.

It is the mobile version of the website, on the same backend: the same accounts, plan and AI
credits, conversations and watchlist, the same eight desks and 120 modules, and the same AI.

## What is in it

- **Welcome** — the nter.pro home page on a phone, with the site's own WebGL globe and the live "record at a glance" figures. Browse without an account, sign in, or create one.
- **Home** — the nter.news feed first (lead story, sections, hot topics), then the desks carousel, markets, your watchlist and the morning briefing.
- **Library** — the eight desks → sectors → modules → records, from the same `/api/feature-feed` the website reads. Large modules page and search on the server.
- **Record** — every field, the AI brief nter.pro keeps for it (written on request), source link, PDF download, pin, watch, Ask AI and Quick Exit.
- **Ask AI** — three sections: *Desk*, *AI chat* (default) and *Studio*. Attach records, PDFs or text files; choose model, effort, focus and web search; answers stream in with tappable citations, follow-up questions, copy, PDF, Word, share and re-run. Conversations are the same as on the website.
- **Quick Exit** — the five-blade shutter with the 94 working documents for your perspective. Pick one, answer one question, and the AI writes it from the record with every gap marked.
- **Studio** — edit what Quick Exit or an answer made; fill gaps or mark them verified; export to PDF or Word.
- **Me** — profile, plan and credits, perspective, writing profile, watchlist, your library, light/dark theme, about and image credits.

## Technology (all free)

| Layer | Choice |
| --- | --- |
| UI | React 19 + Vite 8, plain JavaScript — the same stack as the website |
| Phone apps | Capacitor 8 (Android and iOS projects are in `android/` and `ios/`) |
| Backend | The existing Supabase project and nter.pro API — no new server |
| Documents | pdf-lib (with Inter) and docx, made on the phone; pdf.js reads attached PDFs |
| Builds | GitHub Actions: tests, web build and an Android APK on every push |

## Run it

```bash
npm install
npm run dev:sample   # offline, with the bundled read-only snapshot — no sign-in needed
npm run dev          # live: nter.pro's backend (sign in with your nter.pro account)
npm test             # 29 unit tests
npm run lint
```

`npm run dev` proxies `/api` to www.nter.pro, so the browser preview reads the live public feeds.

### Data modes

| `VITE_DATA_MODE` | What the app reads |
| --- | --- |
| `live` (default) | nter.pro's Supabase project and public API |
| `sample` | `src/sample/` — a read-only snapshot taken on 26 Oct 2026: 8 desks, 110 of 120 modules with real rows, 19 nter.news stories, markets, 40 AI briefs, the model list. Sign-in is simulated on the device and AI answers are canned and labelled. |

The snapshot was read with `SELECT` only and from the website's own archive files; nothing was
written to the database. `scripts/export-sample.mjs` regenerates the desk catalogue from the
website repository.

## Build the phone apps

```bash
npm run build          # web assets for the phone apps (in dist/)
npx cap sync           # copy them into android/ and ios/
npx cap open android   # Android Studio → Run, or Build → Generate Signed Bundle
npx cap open ios       # Xcode 26 (on a Mac) → Run, or Product → Archive
```

No Android Studio? Every push to GitHub builds `app-debug.apk` (Actions → CI → artifacts) that
installs on any Android phone.

Other builds: `npm run build:web` (installable web app with offline support, in `dist-web/`),
`npm run build:sample` (offline demo), `npm run build:preview` (demo that runs from any folder).

App id `pro.nter.app`; Google sign-in returns to `pro.nter.app://auth/callback`.

## Settings

Copy `.env.example` to `.env` to override:

| Variable | Default |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://vfgcppstyzjarlzyqdac.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | the website's publishable key (public by design) |
| `VITE_API_BASE` | `https://www.nter.pro` |
| `VITE_DATA_MODE` | `live` |
| `VITE_STREAM_CHAT` | `0` — set to `1` once the app's origins are in `ALLOWED_ORIGINS` |

No secret keys are used or needed. Never put a service-role key in this app.

## Layout

```
src/
  services/   live.js (nter.pro backend) · sample.js (snapshot) · shape.js · chatState.js
  state/      app.jsx (account, navigation, sheets) · chat.jsx (Ask AI) · studio.jsx
  screens/    Welcome, Auth, Persona, Home, Story, Library, Sector, Module, Record, Search, Ask, Studio, Make, Me
  sheets/     every bottom sheet, and the Quick Exit shutter
  ui/         icons, markdown with citations, shared pieces
  lib/        Supabase client, HTTP, event stream, storage, exports, files
  data/       desks, personas, plans, Quick Exit catalogue, stories
  sample/     the read-only snapshot
docs/
  backend-contract.md   every call the app makes, and its shape
  owner-actions.md      settings and accounts only the owner can change
```

## Before releasing

Read `docs/owner-actions.md`: Google sign-in redirect URL, optional streaming origins, store
accounts, the payment rule for phone apps, account deletion, and one database security advisory.

Formatted, not filed: documents the app makes are drafts to check before signing. Answers and
briefs are information, not advice.
