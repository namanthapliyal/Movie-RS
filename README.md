# Movie Recommendation App

This repository contains the Movie Recommendation App in [`movie-recommendation-app`](./movie-recommendation-app/). The app is built with Next.js, TypeScript, and Tailwind CSS.

## Get started

```powershell
cd movie-recommendation-app
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Add a `TMDB_READ_ACCESS_TOKEN` to `.env.local` for live movie catalogue data; without it, the app uses its limited development catalogue.

## Checks

Run these from the `movie-recommendation-app` directory:

```powershell
npx tsc --noEmit
npm run test:ui
npm run test:api
npm run build
```

See the [app README](./movie-recommendation-app/README.md) for feature details, configuration, and additional project documentation.
