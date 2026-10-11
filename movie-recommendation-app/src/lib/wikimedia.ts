import type { TMDBCast, TMDBCrew, TMDBMovieDetails, TMDBGenre } from '../types/db';

interface WikipediaPage {
  pageid: number;
  title: string;
  extract?: string;
  pageprops?: { wikibase_item?: string };
}

interface WikidataClaim {
  mainsnak?: {
    datavalue?: {
      value?: unknown;
    };
  };
}

interface WikidataEntity {
  claims?: Record<string, WikidataClaim[]>;
  labels?: Record<string, { value: string }>;
}

interface WikidataResponse {
  entities?: Record<string, WikidataEntity>;
}

export interface WikimediaMovie extends TMDBMovieDetails {
  metadata_source: 'wikimedia';
  metadata_sources: { name: string; url: string }[];
}

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const USER_AGENT = 'MovieRecommender/1.0 (personal movie metadata lookup)';

async function fetchJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`Wikimedia request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function entityIds(claims: Record<string, WikidataClaim[]> | undefined, property: string): string[] {
  return (claims?.[property] ?? [])
    .map((claim) => {
      const value = claim.mainsnak?.datavalue?.value;
      return value && typeof value === 'object' && 'id' in value
        ? String((value as { id: string }).id)
        : '';
    })
    .filter(Boolean);
}

function yearFromClaims(claims: Record<string, WikidataClaim[]> | undefined): string {
  const value = claims?.P577?.[0]?.mainsnak?.datavalue?.value;
  if (!value || typeof value !== 'object' || !('time' in value)) return '';
  const match = String((value as { time: string }).time).match(/[+-](\d{4})-/);
  return match?.[1] ?? '';
}

function runtimeFromClaims(claims: Record<string, WikidataClaim[]> | undefined): number | null {
  const value = claims?.P2047?.[0]?.mainsnak?.datavalue?.value;
  if (!value || typeof value !== 'object' || !('amount' in value)) return null;
  const amount = Number.parseFloat(String((value as { amount: string }).amount));
  return Number.isFinite(amount) ? Math.round(amount) : null;
}

export async function searchWikimediaMovies(query: string): Promise<WikimediaMovie[]> {
  const searchUrl = new URL(WIKIPEDIA_API);
  searchUrl.search = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `${query} film`,
    gsrlimit: '5',
    prop: 'extracts|pageprops',
    exintro: '1',
    explaintext: '1',
    exsentences: '4',
    redirects: '1',
    format: 'json',
    formatversion: '2',
  }).toString();

  const searchData = await fetchJson<{ query?: { pages?: WikipediaPage[] } }>(searchUrl);
  const pages = searchData.query?.pages ?? [];
  const qids = [...new Set(pages.map((page) => page.pageprops?.wikibase_item).filter((id): id is string => !!id))];
  if (qids.length === 0) return [];

  const entitiesUrl = new URL(WIKIDATA_API);
  entitiesUrl.search = new URLSearchParams({
    action: 'wbgetentities',
    ids: qids.join('|'),
    props: 'claims',
    format: 'json',
  }).toString();
  const entityData = await fetchJson<WikidataResponse>(entitiesUrl);
  const entityEntries = Object.entries(entityData.entities ?? {});
  const linkedIds = [...new Set(entityEntries.flatMap(([, entity]) => [
    ...entityIds(entity.claims, 'P161').slice(0, 6),
    ...entityIds(entity.claims, 'P136').slice(0, 4),
    ...entityIds(entity.claims, 'P57').slice(0, 1),
  ]))].slice(0, 50);

  const labels = new Map<string, string>();
  if (linkedIds.length > 0) {
    const labelsUrl = new URL(WIKIDATA_API);
    labelsUrl.search = new URLSearchParams({
      action: 'wbgetentities',
      ids: linkedIds.join('|'),
      props: 'labels',
      languages: 'en',
      format: 'json',
    }).toString();
    const labelData = await fetchJson<WikidataResponse>(labelsUrl);
    for (const [id, entity] of Object.entries(labelData.entities ?? {})) {
      const label = entity.labels?.en?.value;
      if (label) labels.set(id, label);
    }
  }

  return entityEntries.flatMap(([qid, entity]) => {
    const page = pages.find((item) => item.pageprops?.wikibase_item === qid);
    if (!page) return [];

    const castIds = entityIds(entity.claims, 'P161').slice(0, 6);
    const genreIds = entityIds(entity.claims, 'P136').slice(0, 4);
    const directorIds = entityIds(entity.claims, 'P57').slice(0, 1);
    const castNames = castIds.map((id) => labels.get(id)).filter((name): name is string => !!name);
    const genres: TMDBGenre[] = genreIds
      .map((id, index) => ({ id: index + 1, name: labels.get(id) ?? '' }))
      .filter((genre) => !!genre.name);
    const year = yearFromClaims(entity.claims);
    const overview = (page.extract ?? '').replace(/\s+/g, ' ').trim().slice(0, 1800);
    if (!overview || (!castNames.length && !year && !/film/i.test(overview))) return [];

    const cast: TMDBCast[] = castNames.map((name, index) => ({
      id: index + 1,
      name,
      character: '',
      gender: 0,
      order: index,
      profile_path: null,
    }));
    const crew: TMDBCrew[] = directorIds
      .map((id) => labels.get(id))
      .filter((name): name is string => !!name)
      .map((name, index) => ({
        id: index + 1,
        name,
        job: 'Director',
        department: 'Directing',
        gender: 0,
        profile_path: null,
      }));
    const wikipediaUrl = `https://en.wikipedia.org/?curid=${page.pageid}`;

    return [{
      id: -page.pageid,
      title: page.title,
      original_title: page.title,
      overview,
      poster_path: null,
      backdrop_path: null,
      release_date: year ? `${year}-01-01` : '',
      vote_average: 0,
      vote_count: 0,
      genre_ids: genres.map((genre) => genre.id),
      genres,
      runtime: runtimeFromClaims(entity.claims),
      adult: false,
      original_language: 'en',
      popularity: 0,
      credits: { cast, crew },
      keywords: { keywords: [] },
      videos: { results: [] },
      metadata_source: 'wikimedia' as const,
      metadata_sources: [
        { name: 'Wikipedia', url: wikipediaUrl },
        { name: 'Wikidata', url: `https://www.wikidata.org/wiki/${qid}` },
      ],
    }];
  });
}
