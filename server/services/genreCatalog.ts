import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { GenreDefinition, parseGenreDefinition } from '../data/genres/schema.js';

let genresCache: GenreDefinition[] = [];
let watcher: fs.FSWatcher | null = null;
let reloadTimer: NodeJS.Timeout | null = null;

const shouldSkipFile = (fileName: string): boolean =>
    !fileName.endsWith('.json') || fileName.startsWith('_');

const getGenreIdFromFile = (fileName: string): string =>
    path.basename(fileName, '.json').trim().toLowerCase();

const sortGenres = (genres: GenreDefinition[]): GenreDefinition[] =>
    [...genres].sort((left, right) => {
        if (left.order !== right.order) {
            return left.order - right.order;
        }
        return left.name.localeCompare(right.name);
    });

export const loadGenreCatalog = (): GenreDefinition[] => {
    if (!fs.existsSync(config.GENRES_DIR)) {
        fs.mkdirSync(config.GENRES_DIR, { recursive: true });
    }

    const files = fs.readdirSync(config.GENRES_DIR);
    const nextGenres: GenreDefinition[] = [];

    files.forEach(fileName => {
        if (shouldSkipFile(fileName)) {
            return;
        }

        const fullPath = path.join(config.GENRES_DIR, fileName);

        try {
            const raw = fs.readFileSync(fullPath, 'utf8');
            const parsed = JSON.parse(raw) as unknown;
            const genre = parseGenreDefinition(getGenreIdFromFile(fileName), parsed);

            if (!genre.enabled) {
                return;
            }

            nextGenres.push(genre);
        } catch (error: any) {
            console.error(`[GenreCatalog] Skipping ${fileName}: ${error.message}`);
        }
    });

    genresCache = sortGenres(nextGenres);
    console.log(`[GenreCatalog] Loaded ${genresCache.length} genre files`);
    return genresCache;
};

export const initializeGenreCatalog = (): void => {
    loadGenreCatalog();

    if (!config.WATCH_GENRES || watcher) {
        return;
    }

    watcher = fs.watch(config.GENRES_DIR, (_eventType, fileName) => {
        if (!fileName || shouldSkipFile(fileName)) {
            return;
        }

        if (reloadTimer) {
            clearTimeout(reloadTimer);
        }

        reloadTimer = setTimeout(() => {
            console.log(`[GenreCatalog] Detected change in ${fileName}, reloading catalog`);
            loadGenreCatalog();
            reloadTimer = null;
        }, 100);
    });

    watcher.on('error', (error) => {
        console.error('[GenreCatalog] Watcher error:', error.message);
    });

    console.log(`[GenreCatalog] Watching ${config.GENRES_DIR} for changes`);
};

export const stopGenreCatalogWatcher = (): void => {
    if (reloadTimer) {
        clearTimeout(reloadTimer);
        reloadTimer = null;
    }

    if (watcher) {
        watcher.close();
        watcher = null;
    }
};

export const getGenres = (): GenreDefinition[] => {
    if (genresCache.length === 0) {
        return loadGenreCatalog();
    }
    return genresCache;
};

export const getGenreById = (genreId: string): GenreDefinition | undefined =>
    getGenres().find(genre => genre.id === genreId.toLowerCase());
