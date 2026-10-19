# CPSync

A full-stack competitive programming workspace for a development course project. It brings contest schedules, coding profiles, a code editor, and optional AI assistance into one app.

The frontend uses React, JavaScript, and handwritten CSS. The backend uses Node's HTTP server. Charts, heatmaps, SVG icons, form handling, and provider adapters are implemented in the project; Three.js renders the dashboard artwork. There is no UI component library or charting framework.

## Features

- Contest schedules for Codeforces, LeetCode, and CodeChef, with search, platform/status filters, countdowns, and Google Calendar links.
- Linked profiles, solved totals, rating charts, and submission heatmaps. Missing or partial provider data is labelled.
- Java, C++, and Python execution through Wandbox, with input/output panels, downloads, cancellation, and keyboard indentation.
- Optional AI code help through a server-side Groq integration.
- Light/dark themes, responsive layouts, keyboard navigation, and reduced-motion support.

## Local setup

Requires Node.js **22.13+ (22.x) or 24+** and npm. `.nvmrc` selects Node 22 for developers using nvm.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Internet access is needed for live provider data. Fonts have system fallbacks when Google Fonts is unavailable.

For AI help, copy the example configuration once and add your own key:

```sh
cp .env.example .env
```

Set `GROQ_API_KEY` in `.env`, then restart the server. `GROQ_MODEL` is optional and defaults to `openai/gpt-oss-120b`. Without a key, the app still works and AI displays a configuration message. Never use a `VITE_` prefix for a secret: Vite exposes those values to the browser. Local `.env` files are ignored by Git; `.env.example` contains placeholders only.

## Commands

| Command           | Purpose                                                   |
| ----------------- | --------------------------------------------------------- |
| `npm run dev`     | Frontend and API development server                       |
| `npm run build`   | Generate the production frontend in `dist/`               |
| `npm start`       | Serve `dist/` and the API through Node                    |
| `npm run preview` | Preview a production build with the API middleware        |
| `npm test`        | Run unit and HTTP integration tests                       |
| `npm run lint`    | Check JavaScript and React hooks; warnings fail the check |
| `npm run format`  | Format maintained project files                           |
| `npm run check`   | Check formatting, lint, tests, and production build       |

Production setup:

```sh
npm ci
npm run check
npm start
```

The production server defaults to `127.0.0.1:3000`. Set `HOST` and `PORT` in the hosting environment as needed. Deploy the Node server, not just `dist/`: static hosting cannot run the official profile adapters or AI endpoint. Hash-based navigation works without server route rewrites.

## Structure

```text
src/
  components/   Shared presentation and interactive controls
  pages/        Dashboard, contests, profile, compiler, and missing-page views
  hooks/        Request lifecycles and persisted preferences
  services/     Browser requests and platform data adapters
  utils/        Validation, storage, calendar links, and editor indentation
  data/         Supported platforms and starter programs
  styles/       Shared theme tokens and component styles
server/         HTTP routing, official provider requests, and AI integration
shared/         Dates and request limits used by frontend and backend
tests/          Unit and local HTTP integration tests
public/         Static favicon
.github/        Continuous integration workflow
```

## Data flow and API

React pages call service functions. Hooks manage loading, cancellation, retries, and stale data. The Node API handles official CodeChef/LeetCode requests and keeps the Groq key server-side. Codeforces, public LeetCode schedule fallbacks, and Wandbox are called from the browser.

| Method | Endpoint                           | Purpose                                               |
| ------ | ---------------------------------- | ----------------------------------------------------- |
| GET    | `/api/codechef/contests`           | Official CodeChef schedules                           |
| GET    | `/api/codechef/profile?handle=...` | CodeChef profile and recent activity                  |
| GET    | `/api/leetcode/profile?handle=...` | Official LeetCode profile and ranking history         |
| POST   | `/api/ai/help`                     | AI help for the supplied language, code, and question |

AI accepts `language`, `code`, `question`, optional `input`/`output`, and bounded user/assistant `history`. Shared limits keep frontend and backend validation aligned. API failures return JSON with an `error` message and an appropriate HTTP status. Unknown API routes return 404. Unsupported methods, invalid handles, oversized bodies, provider failures, and rate limits have explicit responses.

Successful schedules are cached for one minute and official profiles for five minutes. Client profile snapshots are validated before reuse. Failed refreshes retain valid existing data and display the failure. External data is rendered as text; profile and contest links use official domains.

## Design and accessibility

Barlow Condensed is used for headings, DM Sans for body text and controls, and Space Mono for code and technical metadata. The theme tokens in `src/styles/global.css` define typography, surfaces, feedback colors, and platform colors. Codeforces is blue, LeetCode golden orange, and CodeChef green. Text shades are adjusted separately where bright brand accents would reduce readability.

The theme follows the operating system until explicitly changed, then remembers the choice on the device. Controls have labels and visible focus. Graph details work with pointer and keyboard focus. Decorative motion stops for reduced-motion preferences or hidden/offscreen content. The dashboard has an SVG fallback for unavailable WebGL.

Editor shortcuts: **Tab** indents, **Shift+Tab** unindents, **Ctrl/Cmd+Enter** runs code, and **Escape then Tab/Shift+Tab** leaves the editor. Native undo is preserved where supported; a text-insertion fallback handles browsers without that API.

## Verification and limitations

Run `npm run check` before committing. Tests use controlled provider responses and local HTTP servers; no real AI key or live provider calls are needed. The GitHub workflow runs the checks on Node 22 and 24. Its [checkout](https://github.com/actions/checkout) and [setup-node](https://github.com/actions/setup-node) actions are pinned to release commit hashes.

Live providers can change their schemas, throttle requests, or become unavailable. The UI distinguishes failures, missing values, and genuine zero counts. Codeforces submission totals cover up to 50,000 submissions; CodeChef activity covers up to four recent pages. Google Calendar opens a prefilled event for the user to save.

There is **no login system or database**. Handles, profile snapshots, filters, and theme settings use browser localStorage. Compiler code stays in memory and is lost on navigation/reload; download important work. This scope should be checked against the course rubric if authentication or database persistence is required.

Code execution happens at Wandbox, not on this server. Cancelling stops waiting for a response and cannot guarantee termination of a remote job. AI sends code/input/output to Groq only when submitted. Its limits are one active request, five per minute per connection address, twenty per minute for the app, and one hundred per UTC day. Counters reset when the server restarts. Public deployment would need authenticated access and persistent quota enforcement.

## Git workflow

Keep changes focused and use descriptive commits, for example `fix: preserve compiler selection after indentation`. Formatting is reproducible through Prettier; `.editorconfig` and `.gitattributes` keep indentation and line endings consistent. Dependencies, builds, local credentials, and test reports stay outside version control.

After creating an empty remote repository, connect and push from this folder:

```sh
git remote add origin <your-repository-url>
git push -u origin main
```

Review `git status` and `git log --oneline` before pushing. The committed lockfile makes `npm ci` reproducible.
