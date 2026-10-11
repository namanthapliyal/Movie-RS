const IGNORED_TITLE_WORDS = new Set(['film', 'movie']);

function titleTokens(value: string): string[] {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .match(/[\p{L}\p{N}]+/gu)
    ?.filter(token => !IGNORED_TITLE_WORDS.has(token)) ?? [];
}

function tokenSimilarity(query: string, title: string): number {
  if (query === title) return 1;
  if (query.length >= 2 && (title.includes(query) || query.includes(title))) {
    return Math.min(query.length, title.length) / Math.max(query.length, title.length);
  }
  return 0;
}

export function scoreMovieTitleMatch(query: string, title: string): number {
  const queryTokens = titleTokens(query);
  const titleWords = titleTokens(title);
  if (!queryTokens.length || !titleWords.length) return 0;

  if (queryTokens.join('') === titleWords.join('')) return 100;

  const bestMatches = queryTokens.map(queryWord =>
    Math.max(0, ...titleWords.map(titleWord => tokenSimilarity(queryWord, titleWord)))
  );
  const coverage = bestMatches.reduce((sum, score) => sum + score, 0) / queryTokens.length;

  const orderedMatches = Array.from({ length: queryTokens.length + 1 }, () =>
    Array<number>(titleWords.length + 1).fill(0)
  );
  for (let queryIndex = 1; queryIndex <= queryTokens.length; queryIndex++) {
    for (let titleIndex = 1; titleIndex <= titleWords.length; titleIndex++) {
      orderedMatches[queryIndex][titleIndex] = Math.max(
        orderedMatches[queryIndex - 1][titleIndex],
        orderedMatches[queryIndex][titleIndex - 1],
        orderedMatches[queryIndex - 1][titleIndex - 1] +
          tokenSimilarity(queryTokens[queryIndex - 1], titleWords[titleIndex - 1])
      );
    }
  }

  const sequence = orderedMatches[queryTokens.length][titleWords.length] / queryTokens.length;
  return Math.round((coverage * 0.8 + sequence * 0.2) * 100);
}

export function isConfidentMovieTitleMatch(query: string, title: string, score: number): boolean {
  const normalizedQuery = titleTokens(query).join('');
  const normalizedTitle = titleTokens(title).join('');
  return normalizedQuery === normalizedTitle ||
    (normalizedQuery.length >= 4 && score >= 70);
}

export function rankMovieTitleMatches<T extends { title: string }>(
  query: string,
  candidates: T[]
): Array<{ candidate: T; score: number }> {
  return candidates
    .map(candidate => ({ candidate, score: scoreMovieTitleMatch(query, candidate.title) }))
    .sort((left, right) => right.score - left.score);
}
