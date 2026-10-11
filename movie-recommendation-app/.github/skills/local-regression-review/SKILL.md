---
name: local-regression-review
description: Review uncommitted or committed local changes for bugs and regressions, then validate the movie app with its TypeScript/build checks, Playwright UI/API regression suites, and localhost curl smoke tests.
---

# Local regression review

Use this workflow when asked to review local code changes, review a new commit, or check for regressions before committing. Inspect and validate the code; do not edit files, stage changes, or create commits unless explicitly requested.

## 1. Establish review scope

- Confirm the repository root, current branch, worktree status, and latest commit.
- For a commit review, compare the requested commit with its parent. For uncommitted work, review staged and unstaged diffs separately; include untracked files that are part of the requested change.
- Read the changed code and adjacent callers/tests. Follow important changed behavior to its API, persistence, and UI boundaries.
- Use Graphify to estimate each changed symbol's blast radius and identify connected callers, dependents, routes, and shared abstractions. If `graphify-out/graph.json` exists, refresh its code graph first with `graphify update .`; inspect the diff/status afterward because graph artifacts may change. Then use `graphify affected "<symbol-or-file>" --depth 2` for reverse dependencies and `graphify query "<question about changed behavior and its callers>"` or `graphify explain "<symbol>"` to trace relevant connections. Increase depth or use focused queries for high-connectivity nodes such as shared storage/services.
- Treat Graphify as a navigation aid, not proof: its graph can be stale, incomplete, or inferred. Verify important edges and impact conclusions against current source, imports/call sites, tests, and runtime behavior. If Graphify is unavailable or refresh fails, state that and continue with direct code tracing.
- Do not reset, check out, clean, or otherwise discard user changes. Do not expose secrets from environment files or diffs.
- Treat pre-existing warnings and unrelated failures as baseline issues, not findings caused by the change. Report them separately only if they block validation.

## 2. Select targeted checks

Inspect `package.json` and the actual diff first. Add or update regression tests for a confirmed defect only when the user asks for implementation; during a review, report the missing coverage instead.

For this app, run the relevant checks:

```powershell
npx tsc --noEmit
npm run test:api
npm run test:ui
npm run build
```

Run these serially, not concurrently: Next's build and type generation share `.next`, which can make parallel checks fail spuriously. Prefer the narrowest relevant Playwright test while iterating, then run the affected full project suite. Run `npm run test:e2e` for both UI and API suites when the change crosses layers or the complete regression pass is appropriate.

The Playwright configuration starts the local Next development server automatically and uses the `ui` and `api` projects. Keep tests deterministic: stub remote lookups/model downloads and isolate browser `localStorage` when a test does not need real providers. Use the installed Playwright test runner (`npx playwright test ...`) for repeatable regressions. Use Playwright CLI/browser interaction only for exploratory UI diagnosis, then encode confirmed failures in `tests/ui` or `tests/api`.

## 3. Smoke-test localhost with curl

The Playwright web server may stop after its run. Start a development server in its own PowerShell session:

```powershell
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Once it reports ready, check the affected routes. For the current app, a basic smoke pass is:

```powershell
curl.exe -sS -o NUL -w "watchlist HTTP %{http_code}`n" http://127.0.0.1:3000/
curl.exe -sS -o NUL -w "explorer HTTP %{http_code}`n" http://127.0.0.1:3000/movie-explorer
curl.exe -sS -o NUL -w "recommendations HTTP %{http_code}`n" http://127.0.0.1:3000/recommendations
curl.exe -sS -o NUL -w "formula HTTP %{http_code}`n" http://127.0.0.1:3000/formula
curl.exe -sS -o NUL -w "search API HTTP %{http_code}`n" "http://127.0.0.1:3000/api/tmdb?action=search&q=Inception"
curl.exe -sS -o NUL -w "lookup validation HTTP %{http_code}`n" -H "Content-Type: application/json" -d "{}" http://127.0.0.1:3000/api/movie-lookup
```

Expect `200` for the pages and valid search, and `400` for the invalid lookup. Check response bodies as needed; a status-only check is insufficient for behavior under review. Stop only the dev-server process started for this review. Do not kill processes by name or terminate a server that was already running.

## 4. Report evidence

- Report only actionable, change-related bugs with severity, file/line, concrete impact, and confidence. Separate verified findings from risks or missing test coverage.
- A passing build or test suite is validation evidence, not proof that no bugs exist. Mention which checks passed and any checks blocked or skipped.
- Include concise reproduction steps for a confirmed UI/API finding. Do not claim a test or curl check ran unless it actually did.
- Preserve the user's worktree. Do not fix findings during a review unless asked.
