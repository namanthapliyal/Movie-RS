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

test('local AI status stays global while movie enrichments wait in the worker queue', async ({ page }) => {
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
  await page.route('**/movie-enrichment-worker.js', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: `
      let queue = Promise.resolve();
      let modelLoaded = false;
      self.addEventListener('message', ({ data }) => {
        if (data.type !== 'ENRICH_MOVIE') return;
        queue = queue.then(async () => {
          if (!modelLoaded) {
            self.postMessage({ type: 'status', requestId: data.requestId, phase: 'loading', message: 'Preparing test model…', progress: null });
            await new Promise(resolve => setTimeout(resolve, 100));
            self.postMessage({ type: 'status', requestId: data.requestId, phase: 'downloading', message: 'Downloading local AI model: model_quantized.onnx 64%', progress: 64 });
            await new Promise(resolve => setTimeout(resolve, 900));
            modelLoaded = true;
            self.postMessage({ type: 'status', requestId: data.requestId, phase: 'ready', message: 'Model is loaded and ready on this device.', progress: null });
          }
          self.postMessage({ type: 'status', requestId: data.requestId, phase: 'enriching', message: 'Enriching movie locally…', progress: null });
          await new Promise(resolve => setTimeout(resolve, 150));
          self.postMessage({ type: 'result', requestId: data.requestId, movie: data.movie });
        });
      });
    `,
  }));

  await page.goto('/');

  async function addMovie(title: string) {
    await page.getByRole('button', { name: 'Add Movie' }).click();
    await page.getByRole('combobox', { name: 'Search for a movie' }).fill(title);
    await page.getByRole('button', { name: 'Add to Watchlist' }).click();
  }

  await addMovie('First Film');
  const globalStatus = page.getByLabel('Local AI model status');
  await expect(globalStatus.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '64');
  await expect(globalStatus).toContainText('model_quantized.onnx');
  const firstCard = page.locator('.movie-card').filter({ hasText: 'First Film' });
  await expect(firstCard.getByRole('status')).toContainText('Waiting for local AI enrichment');
  await expect(firstCard).not.toContainText('model_quantized.onnx');

  await addMovie('Second Film');
  await expect(globalStatus).toContainText('2 movies queued');
  await expect(page.locator('.movie-card').filter({ hasText: 'First Film' })).toContainText('First Film synopsis.');
  await expect(page.locator('.movie-card').filter({ hasText: 'Second Film' })).toContainText('Second Film synopsis.');
  await expect(globalStatus).toHaveCount(0);
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
