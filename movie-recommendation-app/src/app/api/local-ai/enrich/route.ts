import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface MovieFacts {
  title: string;
  year: string;
  synopsis: string;
  genres: string[];
  cast: string[];
}

function isMovieFacts(value: unknown): value is MovieFacts {
  if (!value || typeof value !== 'object') return false;
  const movie = value as Record<string, unknown>;
  return typeof movie.title === 'string'
    && movie.title.length > 0
    && movie.title.length <= 200
    && typeof movie.year === 'string'
    && typeof movie.synopsis === 'string'
    && movie.synopsis.length <= 10_000
    && Array.isArray(movie.genres)
    && movie.genres.length <= 20
    && movie.genres.every(item => typeof item === 'string' && item.length <= 100)
    && Array.isArray(movie.cast)
    && movie.cast.length <= 50
    && movie.cast.every(item => typeof item === 'string' && item.length <= 200);
}

function parseEnrichment(content: string): unknown {
  const parsed: unknown = JSON.parse(content);
  if (!parsed || typeof parsed !== 'object') return null;
  const result = parsed as Record<string, unknown>;
  if (
    typeof result.synopsis !== 'string'
    || !Array.isArray(result.genres)
    || !result.genres.every(item => typeof item === 'string')
    || !Array.isArray(result.cast)
    || !result.cast.every(item => typeof item === 'string')
  ) {
    return null;
  }
  return {
    synopsis: result.synopsis,
    genres: result.genres,
    cast: result.cast,
  };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const movie = body && typeof body === 'object' && 'movie' in body
    ? (body as { movie: unknown }).movie
    : null;
  if (!isMovieFacts(movie)) {
    return NextResponse.json({ error: 'Valid movie source facts are required.' }, { status: 400 });
  }

  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
  const model = process.env.OLLAMA_MODEL || 'qwen2.5-coder:1.5b';
  let endpoint: URL;
  try {
    endpoint = new URL('/api/chat', baseUrl);
    if (endpoint.protocol !== 'http:' && endpoint.protocol !== 'https:') throw new Error('Unsupported protocol.');
  } catch {
    return NextResponse.json({ error: 'OLLAMA_BASE_URL must be a valid HTTP(S) URL.' }, { status: 500 });
  }

  let ollamaResponse: Response;
  try {
    ollamaResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        model,
        stream: false,
        format: 'json',
        keep_alive: '10m',
        options: { temperature: 0 },
        messages: [
          {
            role: 'system',
            content: 'Return only a JSON object with string synopsis and string-array genres and cast. Use only facts and exact names from the supplied source. The synopsis must be an exact substring of the supplied synopsis; if no shorter exact synopsis is appropriate, return the supplied synopsis unchanged. Include only genres and cast names present in the source.',
          },
          {
            role: 'user',
            content: JSON.stringify(movie),
          },
        ],
      }),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    return NextResponse.json({
      error: timedOut
        ? 'The local Ollama request timed out. Check that Ollama is running and try again.'
        : `Cannot connect to Ollama at ${endpoint.origin}. Start Ollama and ensure model "${model}" is installed.`,
    }, { status: timedOut ? 504 : 503 });
  }

  const responseBody: unknown = await ollamaResponse.json().catch(() => null);
  if (!ollamaResponse.ok) {
    const providerError = responseBody && typeof responseBody === 'object' && 'error' in responseBody
      && typeof responseBody.error === 'string'
      ? responseBody.error
      : `HTTP ${ollamaResponse.status}`;
    const message = ollamaResponse.status === 404
      ? `Ollama model "${model}" is not installed. Run "ollama pull ${model}".`
      : `Ollama request failed: ${providerError}`;
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const content = responseBody && typeof responseBody === 'object'
    && 'message' in responseBody
    && responseBody.message && typeof responseBody.message === 'object'
    && 'content' in responseBody.message
    && typeof responseBody.message.content === 'string'
    ? responseBody.message.content
    : null;
  if (!content) {
    return NextResponse.json({ error: 'Ollama returned an empty response.' }, { status: 502 });
  }

  let enrichment: unknown;
  try {
    enrichment = parseEnrichment(content);
  } catch {
    enrichment = null;
  }
  if (!enrichment) {
    return NextResponse.json({ error: 'Ollama did not return the required JSON fields.' }, { status: 502 });
  }

  return NextResponse.json({ model, enrichment });
}
