import axios from 'axios';
import type { TMDBMovie, TMDBMovieDetails, TMDBSearchResponse, TMDBGenre } from '../types/db';

/**
 * TMDB (The Movie Database) API Client
 *
 * Fetches movie data from TMDB for:
 * 1. Searching movies
 * 2. Getting movie details (cast, crew, keywords, runtime)
 * 3. Discovering movies by genre/filters
 * 4. Getting trending movies
 */

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

// Genre mapping (TMDB ID → genre name)
export const GENRE_MAP: Record<number, string> = {
  10770: 'tv_movie',
  28: 'action',
  12: 'adventure',
  16: 'animation',
  35: 'comedy',
  80: 'crime',
  99: 'documentary',
  18: 'drama',
  10751: 'family',
  14: 'fantasy',
  36: 'history',
  27: 'horror',
  10402: 'music',
  9648: 'mystery',
  10749: 'romance',
  878: 'sci_fi',
  53: 'thriller',
  10752: 'war',
  37: 'western'
};

const GENRE_LIST: TMDBGenre[] = Object.entries(GENRE_MAP).map(([id, name]) => ({
  id: parseInt(id),
  name
}));

export interface TMDBClient {
  searchMovies: (query: string, page?: number) => Promise<TMDBSearchResponse>;
  getMovieDetails: (id: number) => Promise<TMDBMovieDetails>;
  getPopularMovies: (page?: number) => Promise<TMDBMovie[]>;
  getTrendingMovies: (page?: number) => Promise<TMDBMovie[]>;
  getDiscoverMovies: (params?: Record<string, string | number>, page?: number) => Promise<TMDBMovie[]>;
  getImage: (path: string | null, size?: 'w200' | 'w500' | 'original' | 'w1280') => string | null;
  getGenres: () => TMDBGenre[];
  isConfigured: () => boolean;
}

/**
 * Create TMDB client with API key
 * If no API key, returns a client that operates on local mock data
 */
export function createTMDBClient(): TMDBClient {
  const isConfigured = !!TMDB_API_KEY;
  const headers = {
    Authorization: `Bearer ${TMDB_API_KEY}`,
    'Content-Type': 'application/json'
  };

  return {
    isConfigured,

    getGenres() {
      return GENRE_LIST;
    },

    getImage(path: string | null, size: 'w200' | 'w500' | 'original' | 'w1280' = 'w500'): string | null {
      if (!path) return null;
      return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
    },

    async searchMovies(query: string, page = 1): Promise<TMDBSearchResponse> {
      if (!isConfigured) {
        // Use mock data for development
        return mockSearchMovies(query, page);
      }

      try {
        const response = await axios.get<{
          page: number;
          results: TMDBMovie[];
          total_pages: number;
          total_results: number;
        }>(
          `${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(query)}&page=${page}`,
          { headers }
        );

        return {
          page: response.data.page,
          results: response.data.results,
          total_pages: response.data.total_pages,
          total_results: response.data.total_results
        };
      } catch (error) {
        console.error('TMDB search error:', error);
        return mockSearchMovies(query, page);
      }
    },

    async getMovieDetails(id: number): Promise<TMDBMovieDetails> {
      if (!isConfigured) {
        return mockGetMovieDetails(id);
      }

      try {
        const response = await axios.get<TMDBMovieDetails>(
          `${TMDB_BASE_URL}/movie/${id}?append_to_response=credits,keywords,videos&language=en-US`,
          { headers }
        );

        return response.data;
      } catch (error) {
        console.error('TMDB get details error:', error);
        return mockGetMovieDetails(id);
      }
    },

    async getPopularMovies(page = 1): Promise<TMDBMovie[]> {
      if (!isConfigured) {
        return mockGetPopularMovies(page);
      }

      try {
        const response = await axios.get<{
          page: number;
          results: TMDBMovie[];
          total_pages: number;
          total_results: number;
        }>(
          `${TMDB_BASE_URL}/movie/popular?page=${page}`,
          { headers }
        );

        return response.data.results;
      } catch (error) {
        console.error('TMDB popular error:', error);
        return mockGetPopularMovies(page);
      }
    },

    async getTrendingMovies(page = 1): Promise<TMDBMovie[]> {
      if (!isConfigured) {
        return mockGetPopularMovies(page);
      }

      try {
        const response = await axios.get<{
          page: number;
          results: TMDBMovie[];
          total_pages: number;
          total_results: number;
        }>(
          `${TMDB_BASE_URL}/trending/movie/week?page=${page}`,
          { headers }
        );

        return response.data.results;
      } catch (error) {
        console.error('TMDB trending error:', error);
        return mockGetPopularMovies(page);
      }
    },

    async getDiscoverMovies(
      params: Record<string, string | number> = {},
      page = 1
    ): Promise<TMDBMovie[]> {
      if (!isConfigured) {
        return mockGetPopularMovies(page);
      }

      try {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          queryParams.append(key, String(value));
        });
        queryParams.append('page', String(page));
        queryParams.append('language', 'en-US');

        const response = await axios.get<{
          page: number;
          results: TMDBMovie[];
          total_pages: number;
          total_results: number;
        }>(
          `${TMDB_BASE_URL}/discover/movie?${queryParams.toString()}`,
          { headers }
        );

        return response.data.results;
      } catch (error) {
        console.error('TMDB discover error:', error);
        return mockGetPopularMovies(page);
      }
    }
  };
}

// Export singleton instance
let _tmdbClient: TMDBClient | null = null;
export function getTMDBClient(): TMDBClient {
  if (!_tmdbClient) {
    _tmdbClient = createTMDBClient();
  }
  return _tmdbClient;
}

export const tmdbClient = new Proxy({} as TMDBClient, {
  get(_, prop) {
    const client = getTMDBClient();
    const value = client[prop as keyof TMDBClient];
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

// --- Mock Data for Development (no API key required) ---

const MOCK_MOVIES: TMDBMovie[] = [
  {
    id: 278,
    title: 'The Shawshank Redemption',
    original_title: 'The Shawshank Redemption',
    overview: 'Framed in the 1940s for two murders he didn\'t commit, Andy Dufresne begins a new life at Shawshank prison, where he puts his accounting skills to work for the warden, all the while working on a plan to escape.',
    poster_path: '/9gk7AdlUXzskJrJaF7kCr5r64vd.jpg',
    backdrop_path: '/m1xbUr0PFwewVtajJS6X0pIg0aE.jpg',
    release_date: '1994-09-23',
    vote_average: 9.3,
    vote_count: 25670,
    genre_ids: [18, 80, 36],
    genres: [{ id: 18, name: 'Drama' }, { id: 80, name: 'Crime' }, { id: 36, name: 'Biography' }],
    runtime: 142,
    adult: false,
    original_language: 'en',
    popularity: 104.419
  },
  {
    id: 278,
    title: 'The Dark Knight',
    original_title: 'The Dark Knight',
    overview: 'Batman raises the stakes in his war on crime and teams up with Lt. Jim Gordon and District Attorney Harvey Dent to take down the remaining criminal organizations.',
    poster_path: '/qJ2t-LBvJFYMCm8r4OSJa9jxgI.jpg',
    backdrop_path: '/g3ny9Z0X0g5hnQ5z9aXnX5b0Y0M.jpg',
    release_date: '2008-07-18',
    vote_average: 9.0,
    vote_count: 31234,
    genre_ids: [28, 80, 18, 53],
    genres: [{ id: 28, name: 'Action' }, { id: 80, name: 'Crime' }, { id: 18, name: 'Drama' }, { id: 53, name: 'Thriller' }],
    runtime: 152,
    adult: false,
    original_language: 'en',
    popularity: 125.876
  },
  {
    id: 155,
    title: 'Inception',
    original_title: 'Inception',
    overview: 'A thief who steals corporate secrets through the use of dream-sharing technology must plant an idea instead of extracting one.',
    poster_path: '/qmb8d2IrBL8T5BNzsMvC6J6Njkc.jpg',
    backdrop_path: '/9gk7AdlUXzskJrJaF7kCr5r64vd.jpg',
    release_date: '2010-07-16',
    vote_average: 8.7,
    vote_count: 25767,
    genre_ids: [28, 878, 53, 9648],
    genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Sci-Fi' }, { id: 53, name: 'Thriller' }, { id: 9648, name: 'Mystery' }],
    runtime: 148,
    adult: false,
    original_language: 'en',
    popularity: 114.876
  },
  {
    id: 13,
    title: 'Forrest Gump',
    original_title: 'Forrest Gump',
    overview: 'A man with a low IQ has made a successful life for himself. He is kind, brave, and intelligent in his own way.',
    poster_path: '/3h8ZcKay4S2qhPwD4P9aXaK0sN.jpg',
    backdrop_path: '/g3ny9Z0X0g5hnQ5z9aXnX5b0Y0M.jpg',
    release_date: '1994-06-23',
    vote_average: 8.8,
    vote_count: 25870,
    genre_ids: [18, 35, 36, 10749],
    genres: [{ id: 18, name: 'Drama' }, { id: 35, name: 'Comedy' }, { id: 36, name: 'Romance' }, { id: 10749, name: 'Romance' }],
    runtime: 142,
    adult: false,
    original_language: 'en',
    popularity: 102.876
  },
  {
    id: 644,
    title: 'Shutter Island',
    original_title: 'Shutter Island',
    overview: 'Two U.S. Marshals are sent to an island where a mental hospital is located. One of the patients goes missing.',
    poster_path: '/6bK0J3vQ7X5vQ4X6vQ8X5vQ4X6.jpg',
    backdrop_path: null,
    release_date: '2010-02-18',
    vote_average: 8.4,
    vote_count: 15678,
    genre_ids: [53, 9648, 18],
    genres: [{ id: 53, name: 'Thriller' }, { id: 9648, name: 'Mystery' }, { id: 18, name: 'Drama' }],
    runtime: 138,
    adult: false,
    original_language: 'en',
    popularity: 87.876
  },
  {
    id: 138,
    title: 'The Prestige',
    original_title: 'The Prestige',
    overview: 'After a tragic accident, two stage magicians engage in a bitter rivalry to create the ultimate illusion.',
    poster_path: '/k9X8N5mJ4Q8R2vN9L7P1jX5Q8.jpg',
    backdrop_path: null,
    release_date: '2006-10-20',
    vote_average: 8.6,
    vote_count: 11234,
    genre_ids: [53, 18, 9648],
    genres: [{ id: 53, name: 'Thriller' }, { id: 18, name: 'Drama' }, { id: 9648, name: 'Mystery' }],
    runtime: 130,
    adult: false,
    original_language: 'en',
    popularity: 72.876
  },
  {
    id: 93734,
    title: 'The Grand Budapest Hotel',
    original_title: 'The Grand Budapest Hotel',
    overview: 'A writer encounters the adventure of a lifetime in a famous European hotel between the wars.',
    poster_path: '/k9X8N5mJ4Q8R2vN9L7P1jX5Q8.jpg',
    backdrop_path: null,
    release_date: '2014-03-28',
    vote_average: 8.1,
    vote_count: 12345,
    genre_ids: [35, 18, 14, 10751],
    genres: [{ id: 35, name: 'Comedy' }, { id: 18, name: 'Drama' }, { id: 14, name: 'Fantasy' }, { id: 10751, name: 'Family' }],
    runtime: 99,
    adult: false,
    original_language: 'en',
    popularity: 65.876
  },
  {
    id: 112477,
    title: 'The Whale',
    original_title: 'The Whale',
    overview: 'A reclusive man struggles with his past and present life as he searches for redemption.',
    poster_path: '/9GKX0H2Q5R2vN9L7P1jX5Q8.jpg',
    backdrop_path: null,
    release_date: '2022-12-09',
    vote_average: 7.9,
    vote_count: 4567,
    genre_ids: [18, 10749],
    genres: [{ id: 18, name: 'Drama' }, { id: 10749, name: 'Romance' }],
    runtime: 112,
    adult: false,
    original_language: 'en',
    popularity: 52.876
  },
  {
    id: 385940,
    title: 'Mad Max: Fury Road',
    original_title: 'Mad Max: Fury Road',
    overview: 'In a post-apocalyptic wasteland, Max and Furiosa lead a group of survivors on a journey to find redemption.',
    poster_path: '/9GKX0H2Q5R2vN9L7P1jX5Q8.jpg',
    backdrop_path: null,
    release_date: '2015-05-15',
    vote_average: 8.1,
    vote_count: 16412,
    genre_ids: [28, 12, 878, 14, 263],
    genres: [{ id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }, { id: 878, name: 'Sci-Fi' }, { id: 14, name: 'Fantasy' }],
    runtime: 120,
    adult: false,
    original_language: 'en',
    popularity: 87.876
  },
  {
    id: 109416,
    title: 'Interstellar',
    original_title: 'Interstellar',
    overview: 'A team of explorers travel through wormholes to find a new home for humanity.',
    poster_path: '/3h8ZcKay4S2qhPwD4P9aXaK0sN.jpg',
    backdrop_path: null,
    release_date: '2014-11-07',
    vote_average: 8.6,
    vote_count: 27917,
    genre_ids: [28, 18, 878, 12, 10773],
    genres: [{ id: 28, name: 'Action' }, { id: 18, name: 'Drama' }, { id: 878, name: 'Sci-Fi' }, { id: 12, name: 'Adventure' }],
    runtime: 169,
    adult: false,
    original_language: 'en',
    popularity: 111.876
  }
];

function mockSearchMovies(query: string, page: number): Promise<TMDBSearchResponse> {
  const results = MOCK_MOVIES.filter(movie =>
    movie.title.toLowerCase().includes(query.toLowerCase()) ||
    movie.overview.toLowerCase().includes(query.toLowerCase())
  );

  return Promise.resolve({
    page,
    results: results.slice((page - 1) * 20, page * 20),
    total_pages: Math.ceil(results.length / 20) || 1,
    total_results: results.length
  });
}

function mockGetMovieDetails(id: number): Promise<TMDBMovieDetails> {
  const movie = MOCK_MOVIES.find(m => m.id === id);
  if (!movie) {
    throw new Error(`Movie with ID ${id} not found`);
  }

  return Promise.resolve({
    ...movie,
    genres: movie.genres || [{ id: 18, name: 'Drama' }],
    credits: {
      cast: [
        { id: 1, name: 'Actor Name', character: 'Lead Role', gender: 2, order: 0, profile_path: null },
        { id: 2, name: 'Actress Name', character: 'Supporting Role', gender: 1, order: 1, profile_path: null }
      ],
      crew: [
        { id: 3, name: 'Director Name', job: 'Director', department: 'Directing', gender: 2, profile_path: null }
      ]
    },
    keywords: {
      keywords: [
        { id: 1, name: 'based on novel' },
        { id: 2, name: 'friendship' },
        { id: 3, name: 'redemption' }
      ]
    },
    videos: {
      results: []
    }
  });
}

function mockGetPopularMovies(page: number): Promise<TMDBMovie[]> {
  const start = (page - 1) * 20;
  return Promise.resolve(MOCK_MOVIES.slice(start, start + 20));
}

export default tmdbClient;
