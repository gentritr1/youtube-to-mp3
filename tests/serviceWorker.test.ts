import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SERVICE_WORKER_PATH = join(process.cwd(), 'service-worker.js');
const GENERATED_MANIFEST_PATH = join(process.cwd(), 'service-worker-assets.js');
const HTML_ENTRY_POINTS = ['index.html', 'time-sync-studio.html'];
const APP_ID_META = '<meta name="sw-app-id" content="youtube-to-mp3">';

const read = (filePath: string) => readFileSync(join(process.cwd(), filePath), 'utf-8');
const ATTRIBUTE_VALUE_PATTERN = `"([^"]+)"|'([^']+)'|([^\\s>]+)`;
const IMPORT_REGEX = /import\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g;
const CACHE_PREFIX = 'yt-converter-';

const toWebPath = (value: string, fromFile = '') => {
    if (!value || /^(https?:)?\/\//.test(value) || value.startsWith('data:') || value.startsWith('chrome-extension:')) {
        return null;
    }

    if (value.startsWith('/')) {
        return value;
    }

    const baseDir = fromFile.includes('/') ? fromFile.replace(/\/[^/]*$/, '') : '';
    const segments = `${baseDir ? `${baseDir}/` : ''}${value}`.split('/');
    const normalized: string[] = [];
    for (const segment of segments) {
        if (!segment || segment === '.') continue;
        if (segment === '..') {
            normalized.pop();
            continue;
        }
        normalized.push(segment);
    }

    return `/${normalized.join('/')}`;
};

const parseGeneratedAssets = () => {
    const source = readFileSync(GENERATED_MANIFEST_PATH, 'utf-8');
    const assetsMatch = source.match(/self\.__STATIC_ASSETS = (\[[\s\S]*?\]);/);
    const versionMatch = source.match(/self\.__STATIC_ASSET_VERSION = '([^']+)';/);
    if (!assetsMatch || !versionMatch) {
        throw new Error('Generated service worker assets not found');
    }

    return {
        assets: new Set(JSON.parse(assetsMatch[1]) as string[]),
        version: versionMatch[1]
    };
};

const collectLocalAssetRefs = (html: string, htmlFile: string) => {
    const refs = new Set<string>();
    const patterns = [
        new RegExp(`<link[^>]+href=(?:${ATTRIBUTE_VALUE_PATTERN})`, 'g'),
        new RegExp(`<script[^>]+src=(?:${ATTRIBUTE_VALUE_PATTERN})`, 'g'),
    ];

    for (const pattern of patterns) {
        for (const match of html.matchAll(pattern)) {
            const assetPath = toWebPath(match[1] || match[2] || match[3], htmlFile);
            if (assetPath) {
                refs.add(assetPath);
            }
        }
    }

    return refs;
};

const collectJsDependencies = (entryWebPath: string, refs: Set<string>, visited: Set<string>) => {
    if (visited.has(entryWebPath)) {
        return;
    }
    visited.add(entryWebPath);

    const relativePath = entryWebPath.replace(/^\//, '');
    let source: string;
    try {
        source = read(relativePath);
    } catch (error) {
        console.debug(`[service-worker.test] skipping missing JS dependency ${entryWebPath}`, error);
        return;
    }

    for (const match of source.matchAll(IMPORT_REGEX)) {
        const assetPath = toWebPath(match[1], relativePath);
        if (!assetPath || !assetPath.endsWith('.js')) {
            continue;
        }

        refs.add(assetPath);
        collectJsDependencies(assetPath, refs, visited);
    }
};

const collectManifestAssets = (manifestFile: string, refs: Set<string>) => {
    let manifest: { icons?: Array<{ src: string }> };
    try {
        manifest = JSON.parse(read(manifestFile));
    } catch (error) {
        throw new Error(`Failed to read or parse manifest ${manifestFile}: ${error instanceof Error ? error.message : String(error)}`);
    }

    const manifestWebPath = toWebPath(manifestFile);
    if (manifestWebPath) {
        refs.add(manifestWebPath);
    }

    for (const icon of manifest.icons || []) {
        const assetPath = toWebPath(icon.src, manifestFile);
        if (assetPath) {
            refs.add(assetPath);
        }
    }
};

describe('service worker manifest', () => {
    it('loads the generated asset manifest', () => {
        const source = readFileSync(SERVICE_WORKER_PATH, 'utf-8');
        expect(source).toContain("importScripts('/service-worker-assets.js')");
    });

    it('uses the generated cache version in CACHE_NAME', () => {
        const source = readFileSync(SERVICE_WORKER_PATH, 'utf-8');
        const { version } = parseGeneratedAssets();
        expect(source).toContain(`const CACHE_NAME = \`${CACHE_PREFIX}\${self.__STATIC_ASSET_VERSION || 'dev'}\`;`);
        expect(version).toMatch(/^[a-f0-9]{10}$/);
    });

    it('contains the app marker on every HTML entry point', () => {
        for (const htmlFile of HTML_ENTRY_POINTS) {
            expect(read(htmlFile)).toContain(APP_ID_META);
        }
    });

    it('generated manifest covers every local asset reachable from entry points', () => {
        const { assets: staticAssets } = parseGeneratedAssets();
        const expectedAssets = new Set<string>(['/', '/index.html', '/time-sync-studio.html']);
        const jsEntries = new Set<string>();

        for (const htmlFile of HTML_ENTRY_POINTS) {
            const html = read(htmlFile);
            for (const asset of collectLocalAssetRefs(html, htmlFile)) {
                expectedAssets.add(asset);
                if (asset.endsWith('.js')) {
                    jsEntries.add(asset);
                }
            }
        }

        for (const jsEntry of jsEntries) {
            collectJsDependencies(jsEntry, expectedAssets, new Set());
        }

        collectManifestAssets('manifest.json', expectedAssets);

        expect([...expectedAssets].filter((asset) => !staticAssets.has(asset))).toEqual([]);
    });
});
