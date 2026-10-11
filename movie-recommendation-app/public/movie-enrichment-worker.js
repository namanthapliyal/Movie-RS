const runtimeUrl = 'https://esm.sh/@huggingface/transformers@3.7.2';
let modelPromise;
let queue = Promise.resolve();

function sendStatus(requestId, phase, message, progress = null) {
  self.postMessage({ type: 'status', requestId, phase, message, progress });
}

async function getModel(requestId) {
  if (!modelPromise) {
    sendStatus(requestId, 'loading', 'Preparing the local AI runtime…');
    modelPromise = (async () => {
      const { env, pipeline } = await import(runtimeUrl);
      env.useBrowserCache = typeof globalThis.caches !== 'undefined';
      env.useWasmCache = env.useBrowserCache;
      return pipeline('text-generation', 'onnx-community/Qwen2.5-0.5B-Instruct', {
        dtype: 'q4',
        progress_callback: progress => {
          const file = progress.file?.split('/').pop();
          if (progress.status === 'progress' || progress.status === 'done' || progress.status === 'initiate') {
            const percent = typeof progress.progress === 'number' ? Math.round(progress.progress) : null;
            const detail = `${progress.status === 'done' ? 'Downloaded' : 'Downloading'} local AI model${file ? `: ${file}` : ''}${percent === null ? '' : ` ${percent}%`}`;
            sendStatus(requestId, 'downloading', detail, percent);
          }
        },
      });
    })().catch(error => {
      modelPromise = undefined;
      throw error;
    });
  }
  return modelPromise;
}

async function enrichMovie(requestId, movie) {
  const model = await getModel(requestId);
  sendStatus(requestId, 'ready', 'Model is loaded and ready on this device.');
  sendStatus(requestId, 'enriching', `Enriching ${movie.title} locally…`);

  const sourceFacts = {
    title: movie.title,
    year: movie.release_date.slice(0, 4),
    synopsis: movie.overview,
    genres: movie.genres.map(genre => genre.name),
    cast: movie.credits.cast.map(member => member.name),
    director: movie.credits.crew.filter(member => member.job === 'Director').map(member => member.name),
  };
  const prompt = [
    'Normalize the sourced movie facts below into one concise factual synopsis.',
    'Do not add facts that are not in the source. Return only JSON with keys "synopsis", "genres", and "cast".',
    `Source facts: ${JSON.stringify(sourceFacts)}`,
  ].join('\n');
  const output = await model(prompt, { max_new_tokens: 220, do_sample: false });
  const firstResult = Array.isArray(output[0]) ? output[0][0] : output[0];
  const generatedValue = firstResult?.generated_text;
  const generated = typeof generatedValue === 'string' ? generatedValue : '';
  if (!generated) throw new Error('The local model returned no text.');
  const json = generated.slice(generated.lastIndexOf('{'));
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object') throw new Error('The local model returned invalid JSON.');

  const allowedGenres = new Set(sourceFacts.genres);
  const allowedCast = new Set(sourceFacts.cast);
  const genres = Array.isArray(parsed.genres)
    ? parsed.genres.filter(genre => typeof genre === 'string' && allowedGenres.has(genre))
    : [];
  const cast = Array.isArray(parsed.cast)
    ? parsed.cast.filter(name => typeof name === 'string' && allowedCast.has(name))
    : [];
  const synopsisCandidate = typeof parsed.synopsis === 'string' ? parsed.synopsis.trim() : '';
  const sourceSynopsis = movie.overview.replace(/\s+/g, ' ');
  const normalizedCandidate = synopsisCandidate.replace(/\s+/g, ' ');
  const synopsis = normalizedCandidate && sourceSynopsis.includes(normalizedCandidate)
    ? normalizedCandidate
    : movie.overview;

  return {
    ...movie,
    overview: synopsis,
    genres: genres.length ? movie.genres.filter(genre => genres.includes(genre.name)) : movie.genres,
    credits: {
      ...movie.credits,
      cast: cast.length ? movie.credits.cast.filter(member => cast.includes(member.name)) : movie.credits.cast,
    },
  };
}

self.addEventListener('message', event => {
  if (event.data?.type !== 'ENRICH_MOVIE') return;
  const { requestId, movie } = event.data;
  queue = queue.then(async () => {
    try {
      const enriched = await enrichMovie(requestId, movie);
      self.postMessage({ type: 'result', requestId, movie: enriched });
    } catch (error) {
      self.postMessage({
        type: 'error',
        requestId,
        message: error instanceof Error ? error.message : 'Local movie enrichment failed.',
      });
    }
  });
});
