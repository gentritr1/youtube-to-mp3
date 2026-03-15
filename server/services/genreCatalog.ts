import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { GenreDefinition, parseGenreDefinition } from '../data/genres/schema.js';

let genresCache: GenreDefinition[] | null = null;
let loadPromise: Promise<GenreDefinition[]> | null = null;
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

const reloadGenreCatalog = async (): Promise<GenreDefinition[]> => {
    await fs.promises.mkdir(config.GENRES_DIR, { recursive: true });

    const files = await fs.promises.readdir(config.GENRES_DIR);
    const nextGenres = await Promise.all(
        files
            .filter(fileName => !shouldSkipFile(fileName))
            .map(async (fileName) => {
                const fullPath = path.join(config.GENRES_DIR, fileName);

                try {
                    const raw = await fs.promises.readFile(fullPath, 'utf8');
                    const parsed = JSON.parse(raw) as unknown;
                    const genre = parseGenreDefinition(getGenreIdFromFile(fileName), parsed);

                    return genre.enabled ? genre : null;
                } catch (error: any) {
                    console.error(`[GenreCatalog] Skipping ${fileName}: ${error.message}`);
                    return null;
                }
            })
    );

    genresCache = sortGenres(nextGenres.filter((genre): genre is GenreDefinition => genre !== null));
    console.log(`[GenreCatalog] Loaded ${genresCache.length} genre files`);
    return genresCache;
};

export const loadGenreCatalog = async (): Promise<GenreDefinition[]> => {
    if (!loadPromise) {
        loadPromise = reloadGenreCatalog().finally(() => {
            loadPromise = null;
        });
    }

    return loadPromise;
};

export const initializeGenreCatalog = async (): Promise<void> => {
    await getGenres();

    if (!config.WATCH_GENRES || watcher) {
        return;
    }

    // fs.watch is lightweight but can miss events on atomic-save editors,
    // network filesystems, or containerized mounts. Keep reloads debounced.
    watcher = fs.watch(config.GENRES_DIR, (_eventType, fileName) => {
        if (!fileName || shouldSkipFile(fileName)) {
            return;
        }

        if (reloadTimer) {
            clearTimeout(reloadTimer);
        }

        reloadTimer = setTimeout(() => {
            console.log(`[GenreCatalog] Detected change in ${fileName}, reloading catalog`);
            loadGenreCatalog().catch((error: Error) => {
                console.error('[GenreCatalog] Reload failed:', error.message);
            });
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

export const getGenres = async (): Promise<GenreDefinition[]> => {
    if (genresCache !== null) {
        return genresCache;
    }

    return loadGenreCatalog();
};

export const getGenreById = async (genreId: string): Promise<GenreDefinition | undefined> =>
    (await getGenres()).find(genre => genre.id === genreId.toLowerCase());
