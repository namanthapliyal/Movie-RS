# Movie Recommendation App

This repository contains the Movie Recommendation App in [`movie-recommendation-app`](./movie-recommendation-app/). The app is built with Next.js, TypeScript, and Tailwind CSS.

Run the commands below from the `movie-recommendation-app` directory unless a command says otherwise.

## Requirements

- Node.js 18.17 or newer (Node.js 20 LTS is recommended)
- npm (included with Node.js)
- Internet access for installing npm packages and, if using live movie search or local AI enrichment, accessing TMDB/Hugging Face resources
- A TMDB Read Access Token is optional; without one, the app uses its limited development catalogue

Playwright UI tests also require the Chromium browser. Install it with `npx playwright install chromium` if it is not already available.

## Installation

From the repository root:

```powershell
cd movie-recommendation-app
npm ci
```

Create `.env.local` from the example if you need to configure TMDB or NextAuth:

```powershell
Copy-Item .env.example .env.local
```

Edit `.env.local` and replace placeholder values. Keep secrets server-side: do not prefix them with `NEXT_PUBLIC_`, and do not commit `.env.local`.

## Local development

Start the development server from `movie-recommendation-app`:

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Add a TMDB read access token to `.env.local` for live movie catalogue data; without it, the app uses its limited development catalogue.

## Tests and production build

Run the TypeScript check and browser/API tests:

```powershell
npx tsc --noEmit
npm run test:ui
npm run test:api
npm run test:e2e
```

`test:e2e` runs both Playwright projects and starts the test server on port 3100. If Playwright reports that its browser is missing, install it with `npx playwright install chromium`.

Create an optimized production build:

```powershell
npm run build
```

To run and smoke-test the production app locally, first complete the build and provide production-like environment variables in the same PowerShell session:

```powershell
$env:NEXTAUTH_SECRET = "use-a-long-random-secret"
$env:NEXTAUTH_URL = "http://localhost:3000"
# Optional; enables live TMDB movie data
$env:TMDB_READ_ACCESS_TOKEN = "your-tmdb-read-access-token"
npm run start
```

Visit [http://localhost:3000](http://localhost:3000). Stop the server with `Ctrl+C`. Do not use a placeholder secret outside local testing.

## Package the standalone production server

The project configures Next.js `output: 'standalone'`. After `npm run build`, copy the static assets into the standalone output and archive it:

```powershell
Copy-Item public .next\standalone\public -Recurse -Force
New-Item -ItemType Directory -Force .next\standalone\.next\static | Out-Null
Copy-Item .next\static .next\standalone\.next\static -Recurse -Force
Compress-Archive -Path .next\standalone\* -DestinationPath movie-recommendation-app.zip -Force
```

Deploy and extract the archive on a Node.js 18+ host, then run `node server.js` from the extracted directory. Configure the production environment variables in the hosting provider (not in source control):

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXTAUTH_SECRET` | Yes for auth | Long, random secret used by NextAuth |
| `NEXTAUTH_URL` | Yes for auth | Public base URL, e.g. `https://movies.example.com` |
| `TMDB_READ_ACCESS_TOKEN` | Optional | Enables live TMDB catalogue/search data |
| `NEXT_PUBLIC_APP_NAME` | Optional | App display name |
| `NEXT_PUBLIC_APP_DESCRIPTION` | Optional | App description |

Set `PORT` if the host requires a specific listening port. The local AI worker and model assets are still loaded by the browser from esm.sh and Hugging Face on first use; they are not included in this server archive. See the [app README](./movie-recommendation-app/README.md) for feature details and model behavior.

## Repository files

The `.gitignore` is at this repository root and excludes generated build, dependency, test, local environment, and Graphify output. Keep `package.json`, `package-lock.json`, `.env.example`, and source files versioned.
