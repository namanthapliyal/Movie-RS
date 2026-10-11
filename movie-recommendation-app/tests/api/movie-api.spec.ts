import { expect, test } from '@playwright/test';
import {
  isConfidentMovieTitleMatch,
  rankMovieTitleMatches,
  scoreMovieTitleMatch,
} from '../../src/lib/movie-title-match';
import { searchWikimediaMovies } from '../../src/lib/wikimedia';

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

test('local Ollama enrichment validates movie source facts', async ({ request }) => {
  const response = await request.post('/api/local-ai/enrich', { data: {} });
  expect(response.status()).toBe(400);
  expect(await response.json()).toMatchObject({ error: 'Valid movie source facts are required.' });
});

test('Wikimedia fallback sends expected Wikipedia and Wikidata requests and maps Dhoom response data', async () => {
  const requests: Array<{ url: URL; headers: Headers }> = [];
  const originalFetch = global.fetch;
  const responseBodies = [
    {
      query: {
        pages: [{
          pageid: 12345,
          title: 'Dhoom',
          extract: 'Dhoom is a 2004 Indian Hindi-language action thriller film.',
          pageprops: { wikibase_item: 'Q12345' },
        }],
      },
    },
    {
      entities: {
        Q12345: {
          claims: {
            P577: [{ mainsnak: { datavalue: { value: { time: '+2004-08-27T00:00:00Z' } } } }],
            P2047: [{ mainsnak: { datavalue: { value: { amount: '+129' } } } }],
            P161: [{ mainsnak: { datavalue: { value: { id: 'QACTOR' } } } }],
            P136: [{ mainsnak: { datavalue: { value: { id: 'QGENRE' } } } }],
            P57: [{ mainsnak: { datavalue: { value: { id: 'QDIRECTOR' } } } }],
          },
        },
      },
    },
    {
      entities: {
        QACTOR: { labels: { en: { value: 'Example Actor' } } },
        QGENRE: { labels: { en: { value: 'action film' } } },
        QDIRECTOR: { labels: { en: { value: 'Example Director' } } },
      },
    },
  ];

  global.fetch = async (input, init) => {
    requests.push({
      url: new URL(input instanceof Request ? input.url : String(input)),
      headers: new Headers(init?.headers),
    });
    const body = responseBodies[requests.length - 1];
    if (!body) throw new Error('Unexpected additional Wikimedia request.');
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const movies = await searchWikimediaMovies('Dhoom');

    expect(requests).toHaveLength(3);
    expect(requests[0].url.origin + requests[0].url.pathname).toBe('https://en.wikipedia.org/w/api.php');
    expect(Object.fromEntries(requests[0].url.searchParams)).toMatchObject({
      action: 'query',
      generator: 'search',
      gsrsearch: 'Dhoom film',
      gsrlimit: '5',
      prop: 'extracts|pageprops',
      format: 'json',
      formatversion: '2',
    });
    expect(requests[0].headers.get('User-Agent')).toBe('MovieRecommender/1.0 (personal movie metadata lookup)');

    expect(requests[1].url.origin + requests[1].url.pathname).toBe('https://www.wikidata.org/w/api.php');
    expect(Object.fromEntries(requests[1].url.searchParams)).toMatchObject({
      action: 'wbgetentities',
      ids: 'Q12345',
      props: 'claims',
      format: 'json',
    });
    expect(requests[2].url.searchParams.get('ids')).toBe('QACTOR|QGENRE|QDIRECTOR');
    expect(requests[2].url.searchParams.get('props')).toBe('labels');
    expect(requests[2].url.searchParams.get('languages')).toBe('en');

    expect(movies).toHaveLength(1);
    expect(movies[0]).toMatchObject({
      id: -12345,
      title: 'Dhoom',
      release_date: '2004-01-01',
      runtime: 129,
      overview: 'Dhoom is a 2004 Indian Hindi-language action thriller film.',
      metadata_source: 'wikimedia',
      genres: [{ name: 'action film' }],
      credits: {
        cast: [{ name: 'Example Actor' }],
        crew: [{ name: 'Example Director', job: 'Director' }],
      },
      metadata_sources: [
        { name: 'Wikipedia', url: 'https://en.wikipedia.org/?curid=12345' },
        { name: 'Wikidata', url: 'https://www.wikidata.org/wiki/Q12345' },
      ],
    });
  } finally {
    global.fetch = originalFetch;
  }
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
