# Personalized Movie Recommendation System

A Gen AI-powered movie recommendation application that learns your taste through reviews and ratings, continuously adapting its recommendation algorithm to provide personalized movie suggestions.

## Features

- **Personalized Taste Formula**: Builds a unique mathematical formula representing your movie preferences
- **Watchlist Management**: Add, track, and review movies you've watched or plan to watch
- **Smart Recommendations**: Get personalized movie suggestions based on your evolving taste profile, or 10 shuffled popular/trending picks before rating anything
- **Natural Language Search**: Describe what kind of movie you want and get tailored recommendations
- **Real-time Algorithm Adjustment**: Formula updates with every rating and review
- **Privacy First**: All data stored locally - no information leaves your device
- **Offline Capable**: Works completely offline once loaded

## How It Works

1. **Add Movies**: Search and add movies to your watchlist
2. **Rate & Review**: After watching, rate movies (1-10) and write reviews describing what you liked
3. **Formula Evolution**: The system analyzes your reviews to update your personalized taste formula
4. **Get Recommendations**: Receive movie suggestions scored against your unique formula
5. **Natural Language Search**: Type prompts like "I want a sci-fi movie with strong female lead" to get targeted suggestions

With no rated movies, Recommendations starts with 10 shuffled picks from TMDB's popular and trending lists. Configure `TMDB_READ_ACCESS_TOKEN` for live catalogue data; without it, development uses the small built-in mock catalogue.

## Technical Stack

- **Frontend**: Next.js 14 (React) with TypeScript and Tailwind CSS
- **Backend**: Next.js API Routes with localStorage (for demo) / SQLite (production ready)
- **State Management**: React hooks with localStorage persistence
- **Styling**: Tailwind CSS with custom components
- **Authentication**: NextAuth.js (credentials provider for demo)
- **Movie Data**: TMDB API (with fallback mock data for development)

## Core Innovation: Mathematical Taste Formula

The application represents your movie taste as a dynamic weighted formula:

```
Score = w₁×f₁ + w₂×f₂ + ... + wₙ×fₙ + b
```

Where:
- Each `fᵢ` is a movie feature (genre, director, actors, themes, etc.)
- Each `wᵢ` is a weight representing your preference for that feature
- `b` is a baseline score
- Weights update automatically based on your ratings and reviews

### Example Formula Evolution

**Initial**: `Score = 0.5` (neutral baseline)

**After rating Inception 9/10**: 
```
Score = 0.5 + 0.8×sci_fi + 0.6×thriller + 0.4×complexity
```

**After mentioning "great cinematography" in review**:
```
Score = 0.5 + 0.8×sci_fi + 0.6×thriller + 0.4×complexity + 0.7×cinematography
```

## Project Structure

```
movie-recommendation-app/
├── src/
│   ├── app/                 # Next.js 14 App Router
│   │   ├── (auth)/          # Authenticated routes
│   │   │   ├── dashboard/   # Main watchlist interface
│   │   │   ├── recommendations/ # Personalized recommendations
│   │   │   └── settings/    # Formula management
│   │   ├── api/             # API endpoints
│   │   │   ├── watchlist/   # Watchlist CRUD operations
│   │   │   ├── formula/     # Formula management
│   │   │   ├── recommendations/ # Recommendation engine
│   │   │   └── tmdb/        # TMDB API proxy
│   │   └── auth/            # Authentication pages
│   ├── components/          # Reusable UI components
│   │   ├── watchlist/       # Watchlist-specific components
│   │   ├── formula/         # Formula visualization/editing
│   │   ├── recommendations/ # Recommendation display
│   │   └── ui/              # Shared UI elements
│   ├── lib/                 # Utility libraries
│   │   ├── storage.ts       # LocalStorage/DB service
│   │   ├── formula.ts       # Mathematical formula engine
│   │   └── tmdb.ts          # TMDB API client
│   └── types/               # TypeScript definitions
├── public/                  # Static assets
└── .env.example             # Environment variables template
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
4. (Optional) Get a TMDB API Read Access Token from [themoviedb.org](https://www.themoviedb.org/) and add it to `.env.local`:
   ```
   TMDB_READ_ACCESS_TOKEN=your_read_access_token_here
   ```
   Keep this variable server-side (do not prefix it with `NEXT_PUBLIC_`). Adding a title saves a provisional watchlist tile immediately. If its details are missing, the app searches TMDB and then Wikipedia/Wikidata; matching sourced facts are processed on-device by a quantized Hugging Face model in a dedicated Web Worker. Enrichment requests are serialized through the worker, which keeps the model loaded and reuses it for the page session. The first enrichment downloads the Transformers.js runtime from esm.sh and model files from Hugging Face; Transformers.js stores model and WASM files in the browser's Cache API so later visits on the same origin can reuse them. The worker/model still initializes into memory after a page reload, and browser storage can be cleared or evicted. These files are outside the project directory, so they are not committed and do not need a `.gitignore` entry. Search queries go to the selected metadata provider; watchlist storage and model inference stay on the device. If no matching movie is verified, the app asks before removing the provisional tile. Wikimedia results include source links; ratings are shown only when supplied by TMDB.
5. Start the development server:
   ```bash
   npm run dev
   ```
6. Open [http://localhost:3000](http://localhost:3000) in your browser

The hamburger menu links to the Watchlist, Movie Explorer, Movie Recommendations, and Taste Formula pages. Open any watchlist card to view its details and edit a 1–10 star rating, review, and like/dislike notes at any time, including after marking it watched. Active movie lookups show a concise per-card state, while local model download/loading progress and queued movie count are shown in a global status banner. The model runs in a dedicated worker so inference does not block the page UI. Diagnostics can be enabled from the menu; enabled client-side logs are mirrored to the browser console and a bounded, session-only diagnostics panel (not a log file).

Movie-title matching normalizes punctuation such as hyphens into word boundaries (so `ex-machina` matches `Ex Machina`), ranks candidates by token coverage and original word order, and requires a confident score before using an automatic metadata match.

### Regression Tests

UI and API workflows are kept separate under `tests/ui` and `tests/api`. Run them with:

```bash
npm run test:ui
npm run test:api
# Run both suites
npm run test:e2e
```

## Usage

### Building Your Taste Profile

1. **Add Movies**: Use the search bar to find and add movies to your watchlist
2. **Watch & Rate**: Mark movies as watched and rate them 1-10 stars
3. **Write Reviews**: Describe what you liked about the movie (acting, story, visuals, etc.)
4. **Get Recommendations**: Visit the Recommendations tab to see personalized suggestions
5. **Search Naturally**: Try prompts like "I want a mind-bending thriller" or "Show me comedies with great dialogue"

### Understanding Your Formula

Visit the Settings → Formula tab to see:
- Your current mathematical formula
- How each feature contributes to your taste
- The evolution history of your preferences
- Ability to manually adjust parameters (advanced)

## Data Storage & Privacy

- **Local First**: All data (watchlist, reviews, formula) is stored in your browser's localStorage
- **No Tracking**: No data is sent to external servers (except TMDB for movie search, which is anonymized)
- **Export/Import**: Future versions will include data export/import functionality
- **Offline Work**: Once loaded, the app works completely offline

## Customization

### Adjusting Recommendation Sensitivity

In the Formula settings, you can:
- Increase/decrease genre preferences
- Adjust importance of specific features (female lead, director gender, etc.)
- Modify keyword weights for themes you like/dislike
- Reset to defaults if needed

### Formula Insights

The system shows you:
- Which movie features most strongly influence your recommendations
- How your tastes have evolved over time
- Confidence levels for different preference detections

## Future Enhancements

Planned features for future updates:
- [ ] Export/Import watchlist and formula data
- [ ] Multiple user profiles
- [ ] Social features (see friends' recommendations)
- [ ] Advanced filtering (by year, runtime, rating)
- [ ] Trailer playback integration
- [ ] Watchlist sharing
- [ ] Mobile app (React Native)
- [ ] Desktop app (Electron/Tauri)
- [ ] API for third-party integrations

## Privacy Statement

This application is designed with privacy as a core principle:
- All personal data (ratings, reviews, watchlist) stays on your device
- No user data is collected, stored, or transmitted to external servers
- Movie search queries are sent to TMDB, but no personal identifiers are included
- The recommendation algorithm runs entirely client-side
- You can use the app completely offline after initial load

## License

MIT License - feel free to modify and extend for your personal use.

---

**Enjoy discovering movies perfectly tailored to your unique taste!**