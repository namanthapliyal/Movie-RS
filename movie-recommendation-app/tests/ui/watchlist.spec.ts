import { expect, test } from '@playwright/test';

const userId = 'playwright-test-user';

async function seedWatchlist(page: import('@playwright/test').Page, watched = false) {
  await page.goto('/');
  await page.evaluate(({ userId, watched }) => {
    localStorage.clear();
    localStorage.setItem('movie_app_user_id', JSON.stringify(userId));
    localStorage.setItem(`movie_app_watchlist_${userId}`, JSON.stringify([{
      id: 'test-entry-1',
      user_id: userId,
      tmdb_id: 27205,
      title: 'Test Movie',
      overview: 'A test movie overview',
      poster_path: '/test-poster.jpg',
      backdrop_path: null,
      release_date: '2010-07-16',
      vote_average: 8,
      vote_count: 100,
      genres: ['Sci-Fi'],
      runtime: 120,
      keywords: [],
      cast: [],
      directors: [],
      has_female_lead: false,
      complexity: 0,
      rating: null,
      review: null,
      liked_elements: [],
      watched,
      watched_at: watched ? new Date().toISOString() : null,
      added_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }]));
  }, { userId, watched });
  await page.reload();
}

test('watched movie opens a detail page where rating and review can be saved on mobile', async ({ page }) => {
  await page.route('https://image.tmdb.org/t/p/w500/test-poster.jpg', route => route.fulfill({
    status: 200,
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750"><rect width="500" height="750" fill="#333"/></svg>',
  }));
  await page.setViewportSize({ width: 390, height: 844 });
  await seedWatchlist(page, true);
  await page.getByRole('link', { name: 'View details for Test Movie' }).click();
  await expect(page).toHaveURL(/\/movies\/test-entry-1$/);
  await expect(page.getByRole('heading', { name: 'Your rating & review' })).toBeVisible();
  const poster = page.getByRole('img', { name: 'Test Movie poster' });
  await expect(poster).toBeVisible();
  const mobilePosterSize = await poster.evaluate(image => {
    const { width, height } = image.getBoundingClientRect();
    return { width, height };
  });
  expect(mobilePosterSize.width).toBeLessThanOrEqual(200);
  expect(mobilePosterSize.height).toBeLessThanOrEqual(300);

  await page.setViewportSize({ width: 1280, height: 900 });
  const desktopPosterSize = await poster.evaluate(image => {
    const { width, height } = image.getBoundingClientRect();
    return { width, height };
  });
  expect(desktopPosterSize.width).toBeLessThanOrEqual(200);
  expect(desktopPosterSize.height).toBeLessThanOrEqual(300);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.getByRole('button', { name: 'Rate 8 out of 10' }).click();
  await page.getByLabel('Review').fill('Excellent test review');
  await expect(page.getByRole('group', { name: 'Like or dislike' })).toBeVisible();
  await expect(page.getByText('Strength:', { exact: true })).toHaveCount(0);
  await page.getByPlaceholder('Describe what you liked...').fill('Strong performances');
  await page.getByRole('button', { name: '👍 Like' }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByPlaceholder('Describe what you liked...').fill('Overlong final act');
  await page.getByRole('button', { name: '👎 Dislike' }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Save rating and review' }).click();

  const saved = await page.evaluate((key) => {
    const entries = JSON.parse(localStorage.getItem(key) || '[]');
    return entries[0];
  }, `movie_app_watchlist_${userId}`);
  expect(saved.rating).toBe(8);
  expect(saved.review).toBe('Excellent test review');
  expect(saved.liked_elements).toEqual([
    { type: 'acting', description: 'Strong performances', sentiment: 'positive' },
    { type: 'acting', description: 'Overlong final act', sentiment: 'negative' },
  ]);
  expect(saved.watched).toBe(true);
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);

  await page.getByRole('link', { name: 'Back to watchlist' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.locator('.movie-card').getByText('Your rating: 8/10')).toBeVisible();
});

test('watched state toggles both ways with visible mobile controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedWatchlist(page, true);
  const card = page.locator('.movie-card').filter({ hasText: 'Test Movie' });

  await card.getByRole('button', { name: 'Unwatch' }).click();
  await expect(page.getByRole('heading', { name: 'To Watch (1)' })).toBeVisible();
  await card.getByRole('button', { name: 'Mark Watched' }).click();
  await expect(page.getByRole('heading', { name: 'Watched (1)' })).toBeVisible();
});

test('arbitrary title gets a temporary tile and is removed after failed lookup acknowledgement', async ({ page }) => {
  await page.route('**/api/movie-lookup', async route => {
    await new Promise(resolve => setTimeout(resolve, 500));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ candidates: [] }),
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Add Movie' }).click();
  await page.getByRole('combobox', { name: 'Search for a movie' }).fill('Imaginary Untitled');
  await page.getByRole('button', { name: 'Add to Watchlist' }).click();

  const movieCard = page.locator('.movie-card').filter({ hasText: 'Imaginary Untitled' });
  await expect(movieCard).toBeVisible();
  await expect(movieCard.getByRole('status')).toContainText('Searching TMDB and Wikipedia/Wikidata');
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'OK' }).click();
  await expect(page.locator('.movie-card').filter({ hasText: 'Imaginary Untitled' })).toHaveCount(0);
});

test('Ollama status stays global while movie enrichments wait in the request queue', async ({ page }) => {
  await page.route('**/api/tmdb?action=search**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { page: 1, results: [], total_pages: 1, total_results: 0 } }),
  }));
  await page.route('**/api/movie-lookup', async route => {
    const { query } = route.request().postDataJSON() as { query: string };
    const id = query === 'First Film' ? -401 : -402;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          id,
          title: query,
          original_title: query,
          overview: `${query} synopsis.`,
          poster_path: null,
          backdrop_path: null,
          release_date: '2024-01-01',
          vote_average: 0,
          vote_count: 0,
          genre_ids: [18],
          genres: [{ id: 18, name: 'Drama' }],
          runtime: 100,
          adult: false,
          original_language: 'en',
          popularity: 0,
          metadata_source: 'wikimedia',
          credits: { cast: [], crew: [] },
          keywords: { keywords: [] },
          videos: { results: [] },
        }],
      }),
    });
  });
  const ollamaRequests: Array<{ movie: { title: string; synopsis: string } }> = [];
  let activeRequests = 0;
  let maxActiveRequests = 0;
  await page.route('**/api/local-ai/enrich', async route => {
    const body = route.request().postDataJSON() as { movie: { title: string; synopsis: string } };
    ollamaRequests.push(body);
    activeRequests += 1;
    maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
    await new Promise(resolve => setTimeout(resolve, 1200));
    activeRequests -= 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        model: 'qwen2.5-coder:1.5b',
        enrichment: { synopsis: body.movie.synopsis, genres: ['Drama'], cast: [] },
      }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByRole('checkbox', { name: 'Enable diagnostics logging' }).check();
  await page.getByRole('button', { name: 'Open navigation menu' }).click();

  async function addMovie(title: string) {
    await page.getByRole('button', { name: 'Add Movie' }).click();
    await page.getByRole('combobox', { name: 'Search for a movie' }).fill(title);
    await page.getByRole('button', { name: 'Add to Watchlist' }).click();
  }

  await addMovie('First Film');
  const globalStatus = page.getByLabel('Local AI model status');
  await expect(globalStatus).toContainText('Sending sourced movie facts to local Ollama');
  const firstCard = page.locator('.movie-card').filter({ hasText: 'First Film' });
  await expect(firstCard.getByRole('status')).toContainText('Enriching movie details with local Ollama');

  await addMovie('Second Film');
  await expect(globalStatus).toContainText('2 movies queued');

  await expect(page.locator('.movie-card').filter({ hasText: 'First Film' })).toContainText('First Film synopsis.');
  await expect(page.locator('.movie-card').filter({ hasText: 'Second Film' })).toContainText('Second Film synopsis.');
  expect(ollamaRequests.map(request => request.movie.title)).toEqual(['First Film', 'Second Film']);
  expect(maxActiveRequests).toBe(1);
  await expect(globalStatus).toHaveCount(0);
});

test('unavailable local Ollama keeps verified metadata and explains how to start it', async ({ page }) => {
  await page.route('**/api/tmdb?action=search**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { page: 1, results: [], total_pages: 1, total_results: 0 } }),
  }));
  await page.route('**/api/movie-lookup', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      candidates: [{
        id: -702,
        title: 'Ollama Fallback Film',
        original_title: 'Ollama Fallback Film',
        overview: 'Verified source synopsis.',
        poster_path: null,
        backdrop_path: null,
        release_date: '2024-01-01',
        vote_average: 0,
        vote_count: 0,
        genre_ids: [],
        genres: [],
        runtime: null,
        adult: false,
        original_language: 'en',
        popularity: 0,
        metadata_source: 'wikimedia',
        credits: { cast: [], crew: [] },
        keywords: { keywords: [] },
        videos: { results: [] },
      }],
    }),
  }));
  await page.route('**/api/local-ai/enrich', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({
      error: 'Cannot connect to Ollama at http://127.0.0.1:11434. Start Ollama and ensure model "qwen2.5-coder:1.5b" is installed.',
    }),
  }));

  await page.goto('/');
  await page.getByRole('button', { name: 'Add Movie' }).click();
  await page.getByRole('combobox', { name: 'Search for a movie' }).fill('Ollama Fallback Film');
  await page.getByRole('button', { name: 'Add to Watchlist' }).click();

  const card = page.locator('.movie-card').filter({ hasText: 'Ollama Fallback Film' });
  await expect(card).toContainText('Verified source synopsis.');
  await expect(card.getByRole('status')).toHaveCount(0);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByRole('alert').filter({ hasText: 'Cannot connect to Ollama' })).toHaveCount(1);
  await expect(page.getByLabel('Local AI model status')).toContainText('Cannot connect to Ollama');
});

test('Dhoom Wikimedia lookup logs request/response and completes enrichment from Wikidata-backed data', async ({ page }) => {
  let lookupRequest: { method: string; url: string; body: unknown } | undefined;
  await page.route('**/api/tmdb?action=search**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { page: 1, results: [], total_pages: 1, total_results: 0 } }),
  }));
  await page.route('**/api/movie-lookup', async route => {
    lookupRequest = {
      method: route.request().method(),
      url: route.request().url(),
      body: route.request().postDataJSON(),
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        source: 'wikimedia',
        candidates: [{
          id: -12345,
          title: 'Dhoom',
          original_title: 'Dhoom',
          overview: 'Dhoom is a 2004 Indian Hindi-language action thriller film.',
          poster_path: null,
          backdrop_path: null,
          release_date: '2004-01-01',
          vote_average: 0,
          vote_count: 0,
          genre_ids: [1],
          genres: [{ id: 1, name: 'action film' }],
          runtime: 129,
          adult: false,
          original_language: 'en',
          popularity: 0,
          metadata_source: 'wikimedia',
          metadata_sources: [
            { name: 'Wikipedia', url: 'https://en.wikipedia.org/?curid=12345' },
            { name: 'Wikidata', url: 'https://www.wikidata.org/wiki/Q12345' },
          ],
          credits: {
            cast: [{ id: 1, name: 'Example Actor', character: '', gender: 0, order: 0, profile_path: null }],
            crew: [{ id: 1, name: 'Example Director', job: 'Director', department: 'Directing', gender: 0, profile_path: null }],
          },
          keywords: { keywords: [] },
          videos: { results: [] },
        }],
      }),
    });
  });
  let ollamaRequest: { movie: { title: string; year: string; synopsis: string; genres: string[]; cast: string[] } } | undefined;
  await page.route('**/api/local-ai/enrich', async route => {
    ollamaRequest = route.request().postDataJSON();
    await new Promise(resolve => setTimeout(resolve, 500));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        model: 'qwen2.5-coder:1.5b',
        enrichment: {
          synopsis: 'Dhoom is a 2004 Indian Hindi-language action thriller film.',
          genres: ['action film'],
          cast: ['Example Actor'],
        },
      }),
    });
  });

  await page.addInitScript(id => {
    localStorage.setItem('movie_app_user_id', JSON.stringify(id));
  }, userId);
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByRole('checkbox', { name: 'Enable diagnostics logging' }).check();
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByRole('button', { name: 'Add Movie' }).click();
  await page.getByRole('combobox', { name: 'Search for a movie' }).fill('Dhoom');
  await page.getByRole('button', { name: 'Add to Watchlist' }).click();

  const globalStatus = page.getByLabel('Local AI model status');
  await expect(globalStatus).toContainText('Sending sourced movie facts to local Ollama');
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByText(/Recent diagnostics/).click();
  const diagnosticLog = page.getByRole('log');
  await expect(diagnosticLog).toContainText('Movie metadata request: POST /api/movie-lookup; body: { query }.');
  await expect(diagnosticLog).toContainText('Movie metadata response: HTTP 200; source=wikimedia; candidates=1.');
  await expect(diagnosticLog).toContainText('Selected metadata candidate source=wikimedia.');
  await expect(diagnosticLog).toContainText('Movie lookup: Enriching movie details with local Ollama…');

  expect(lookupRequest).toEqual({
    method: 'POST',
    url: expect.stringContaining('/api/movie-lookup'),
    body: { query: 'Dhoom' },
  });
  expect(ollamaRequest).toEqual({
    movie: {
      title: 'Dhoom',
      year: '2004',
      synopsis: 'Dhoom is a 2004 Indian Hindi-language action thriller film.',
      genres: ['action film'],
      cast: ['Example Actor'],
    },
  });

  const movieCard = page.locator('.movie-card').filter({ hasText: 'Dhoom' });
  await expect(movieCard).toContainText('Dhoom is a 2004 Indian Hindi-language action thriller film.');
  await expect(movieCard.getByRole('status')).toHaveCount(0);
  const savedEntry = await page.evaluate((key) => {
    const entries = JSON.parse(localStorage.getItem(key) || '[]');
    return entries.find((entry: { title: string }) => entry.title === 'Dhoom');
  }, `movie_app_watchlist_${userId}`);
  expect(savedEntry).toMatchObject({
    title: 'Dhoom',
    runtime: 129,
    lookup_status: 'complete',
    genres: ['action film'],
    cast: ['Example Actor'],
    directors: ['Example Director'],
    metadata_sources: [
      { name: 'Wikipedia', url: 'https://en.wikipedia.org/?curid=12345' },
      { name: 'Wikidata', url: 'https://www.wikidata.org/wiki/Q12345' },
    ],
  });
});

test('Ollama response errors keep source metadata and remain visible', async ({ page }) => {
  await page.route('**/api/tmdb?action=search**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { page: 1, results: [], total_pages: 1, total_results: 0 } }),
  }));
  await page.route('**/api/movie-lookup', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      source: 'wikimedia',
      candidates: [{
        id: -445,
        title: 'Ollama Failure Film',
        original_title: 'Ollama Failure Film',
        overview: 'A sourced movie overview.',
        poster_path: null,
        backdrop_path: null,
        release_date: '2024-01-01',
        vote_average: 0,
        vote_count: 0,
        genre_ids: [],
        genres: [],
        runtime: null,
        adult: false,
        original_language: 'en',
        popularity: 0,
        metadata_source: 'wikimedia',
        credits: { cast: [], crew: [] },
        keywords: { keywords: [] },
        videos: { results: [] },
      }],
    }),
  }));
  await page.route('**/api/local-ai/enrich', route => route.fulfill({
    status: 502,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Ollama did not return the required JSON fields.' }),
  }));

  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByRole('checkbox', { name: 'Enable diagnostics logging' }).check();
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByRole('button', { name: 'Add Movie' }).click();
  await page.getByRole('combobox', { name: 'Search for a movie' }).fill('Ollama Failure Film');
  await page.getByRole('button', { name: 'Add to Watchlist' }).click();

  const globalStatus = page.getByLabel('Local AI model status');
  await expect(globalStatus).toContainText('Ollama did not return the required JSON fields.');
  await expect(page.locator('.movie-card').filter({ hasText: 'Ollama Failure Film' })).toContainText('A sourced movie overview.');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByRole('alert').filter({ hasText: 'Ollama did not return the required JSON fields.' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByText(/Recent diagnostics/).click();
  await expect(page.getByRole('log')).toContainText(
    'Local Ollama enrichment failed: Ollama did not return the required JSON fields.'
  );
});

test('navigation exposes explorer, recommendations, and formula without formula on the watchlist', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your Taste Formula' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByRole('link', { name: 'Taste Formula' }).click();
  await expect(page).toHaveURL(/\/formula$/);
  await expect(page.getByRole('heading', { name: 'Taste Formula', exact: true })).toBeVisible();
  await expect(page.getByText('How your score is calculated')).toBeVisible();

  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.route('**/api/tmdb?action=popular', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: [], message: 'Popular movies retrieved successfully' }),
  }));
  await page.route('**/api/tmdb?action=search&q=Ex%20Machina', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: { page: 1, results: [], total_pages: 1, total_results: 0 },
      message: 'Found 0 movies for "Ex Machina"',
    }),
  }));
  await page.route('**/api/movie-lookup', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      source: 'wikimedia',
      candidates: [{
        id: -123,
        title: 'Ex Machina',
        original_title: 'Ex Machina',
        overview: 'A programmer is invited to test an intelligent robot.',
        poster_path: null,
        backdrop_path: null,
        release_date: '2014-12-16',
        vote_average: 0,
        vote_count: 0,
        genre_ids: [18, 878],
        genres: [{ id: 1, name: 'Science fiction film' }],
        runtime: null,
        adult: false,
        original_language: 'en',
        popularity: 0,
        credits: { cast: [], crew: [] },
        keywords: { keywords: [] },
        videos: { results: [] },
        metadata_source: 'wikimedia',
        metadata_sources: [{ name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Ex_Machina_(film)' }],
      }],
    }),
  }));
  await page.getByRole('link', { name: 'Movie Explorer' }).click();
  await expect(page).toHaveURL(/\/movie-explorer$/);
  await expect(page.getByRole('heading', { name: 'Movie Explorer' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your Movie Watchlist' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Popular movies' })).toBeVisible();
  await expect(page.getByText('The movie catalogue is empty.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Search movies' }).fill('Ex Machina');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByRole('heading', { name: 'Ex Machina' })).toBeVisible();
  await expect(page.getByText('A programmer is invited to test an intelligent robot.')).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);

  const fallbackCard = page.getByRole('link', { name: 'View complete details for Ex Machina' });
  await fallbackCard.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/movie-explorer\/-123\?/);
  await expect(page.getByRole('heading', { name: 'Synopsis' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Wikipedia' })).toBeVisible();
  await page.getByRole('link', { name: '← Back to Movie Explorer' }).click();
  await expect(page).toHaveURL(/\/movie-explorer$/);
});

test('TMDB movie cards open complete details and return to the explorer', async ({ page }) => {
  await page.route('**/api/tmdb?action=popular', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: [{
      id: 42,
      title: 'Detailed Movie',
      original_title: 'Detailed Movie',
      overview: 'A detailed movie synopsis.',
      poster_path: null,
      backdrop_path: null,
      release_date: '2024-03-01',
      vote_average: 8.2,
      vote_count: 120,
      genre_ids: [18],
      runtime: 110,
      adult: false,
      original_language: 'en',
      popularity: 10,
    }] }),
  }));
  await page.route('**/api/tmdb?action=movie&id=42', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: {
      id: 42,
      title: 'Detailed Movie',
      original_title: 'Detailed Movie',
      overview: 'A detailed movie synopsis.',
      poster_path: null,
      backdrop_path: null,
      release_date: '2024-03-01',
      vote_average: 8.2,
      vote_count: 120,
      genre_ids: [18],
      genres: [{ id: 18, name: 'Drama' }],
      runtime: 110,
      adult: false,
      original_language: 'en',
      popularity: 10,
      credits: {
        cast: [{ id: 1, name: 'Example Actor', character: 'Avery', gender: 0, order: 0, profile_path: null }],
        crew: [{ id: 2, name: 'Example Director', job: 'Director', department: 'Directing', gender: 0, profile_path: null }],
      },
      keywords: { keywords: [{ id: 3, name: 'mystery' }] },
      videos: { results: [] },
    } }),
  }));

  await page.goto('/movie-explorer');
  const movieCard = page.getByRole('link', { name: 'View complete details for Detailed Movie' });
  await expect(movieCard).toBeVisible();
  await movieCard.click();
  await expect(page).toHaveURL(/\/movie-explorer\/42\?/);
  await expect(page.getByText('A detailed movie synopsis.')).toBeVisible();
  await expect(page.getByText('Example Actor as Avery')).toBeVisible();
  await expect(page.getByText('Example Director')).toBeVisible();
  await expect(page.getByText('mystery')).toBeVisible();
  await page.getByRole('link', { name: '← Back to Movie Explorer' }).click();
  await expect(page).toHaveURL(/\/movie-explorer$/);
});

test('recommendations show ten discovery movies with no ratings and prompt search uses the available API route', async ({ page }) => {
  const randomMovies = Array.from({ length: 10 }, (_, index) => ({
    tmdb_id: index + 1,
    title: `Discovery Movie ${index + 1}`,
    overview: 'A movie to discover.',
    poster_path: null,
    backdrop_path: null,
    release_date: '2024-01-01',
    vote_average: 7,
    vote_count: 100,
    genres: ['Drama'],
    runtime: 100,
    score: 70,
    matched_features: [],
    formula_version: 1,
  }));
  await page.route('**/api/recommendations?**', async route => {
    if (route.request().method() === 'GET') {
      expect(route.request().url()).toContain('mode=random');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { movies: randomMovies, page: 1, limit: 10, total: 10, total_pages: 1, mode: 'random' },
        }),
      });
      return;
    }
    await route.continue();
  });
  let promptRequestPath = '';
  await page.route('**/api/recommendations', async route => {
    if (route.request().method() === 'POST') {
      promptRequestPath = new URL(route.request().url()).pathname;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { movies: randomMovies.slice(0, 1), total_pages: 1 },
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/recommendations');
  await expect(page.getByRole('heading', { name: 'Movies to Discover' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Discovery Movie/ })).toHaveCount(10);
  await page.getByPlaceholder('Describe what kind of movie you\'re in the mood for...').fill('sci-fi movies');
  await page.getByRole('button', { name: 'Get Recommendations' }).click();
  await expect.poll(() => promptRequestPath).toBe('/api/recommendations');
});

test('diagnostics can be enabled and viewed without recording search text', async ({ page }) => {
  await page.route('**/api/tmdb?action=search**', route => route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'test failure' }),
  }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByRole('checkbox', { name: 'Enable diagnostics logging' }).check();
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByRole('button', { name: 'Add Movie' }).click();
  await page.getByRole('combobox', { name: 'Search for a movie' }).fill('private test query');
  await expect(page.getByText('Could not search for movies. Please try again.')).toBeVisible();

  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await expect(page.getByText('Recent diagnostics (1)')).toBeVisible();
  await page.getByText('Recent diagnostics (1)').click();
  await expect(page.getByText('Movie suggestion search failed.')).toBeVisible();
  await expect(page.getByText('private test query')).toHaveCount(0);
});
