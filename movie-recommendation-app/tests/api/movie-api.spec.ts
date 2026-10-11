import { expect, test } from '@playwright/test';
import {
  isConfidentMovieTitleMatch,
  rankMovieTitleMatches,
  scoreMovieTitleMatch,
} from '../../src/lib/movie-title-match';

test('hyphenated title normalizes to words and ranks in title sequence', () => {
  expect(scoreMovieTitleMatch('ex-machina', 'Ex Machina')).toBe(100);
  expect(scoreMovieTitleMatch('ex machina', 'Ex Machina (film)')).toBe(100);
  expect(scoreMovieTitleMatch('machina ex', 'Ex Machina')).toBeLessThan(100);
  expect(isConfidentMovieTitleMatch('ex', 'Ex Machina', 100)).toBe(false);
  expect(isConfidentMovieTitleMatch('ex-machina', 'Ex Machina', 100)).toBe(true);

  const ranked = rankMovieTitleMatches('ex-machina', [
    { title: 'Machina Ex' },
    { title: 'Ex Machina' },
  ]);
  expect(ranked[0].candidate.title).toBe('Ex Machina');
});

test('TMDB search rejects a missing query', async ({ request }) => {
  const response = await request.get('/api/tmdb?action=search');
  expect(response.status()).toBe(400);
  expect(await response.json()).toMatchObject({ error: 'Query required' });
});

test('TMDB search returns matching movie records', async ({ request }) => {
  const response = await request.get('/api/tmdb?action=search&q=Inception');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.data.results.some((movie: { title: string }) => movie.title === 'Inception')).toBeTruthy();
});

test('movie lookup validates an empty query', async ({ request }) => {
  const response = await request.post('/api/movie-lookup', { data: {} });
  expect(response.status()).toBe(400);
});

test('movie details endpoint returns the requested movie', async ({ request }) => {
  const response = await request.get('/api/tmdb?action=movie&id=27205');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.data).toMatchObject({ id: 27205, title: 'Inception' });
});

test('recommendations return ten shuffled discovery movies without a taste profile', async ({ request }) => {
  const response = await request.get('/api/recommendations?mode=random');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.data).toMatchObject({ mode: 'random', limit: 10, total: 10 });
  expect(body.data.movies).toHaveLength(10);
  expect(body.data.movies.every((movie: { title: string }) => movie.title.length > 0)).toBeTruthy();
});

test('prompt recommendations are handled by the recommendations route', async ({ request }) => {
  const response = await request.post('/api/recommendations', {
    data: { prompt: 'sci-fi movies', page: 1, limit: 20 },
  });
  expect(response.status()).not.toBe(404);
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).data.movies).toBeDefined();
});
