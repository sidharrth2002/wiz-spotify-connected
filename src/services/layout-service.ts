import fs from 'node:fs/promises';
import path from 'node:path';
import NodeCache from 'node-cache';
import { container } from '../utils/inversify-orchestrator.js';
import { Logger } from '../utils/logger.js';
import { TYPES } from '../utils/types.js';

export type RoomLayout = Record<string, { x: number; y: number }>;

const LAYOUT_CACHE_KEY = 'layout';
const layoutPath = path.join(process.cwd(), 'data', 'layout.json');

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const sanitizeLayout = (layout: unknown): RoomLayout => {
  if (!layout || typeof layout !== 'object') return {};

  const entries: Array<[string, { x: number; y: number }]> = [];

  for (const [roomId, pos] of Object.entries(layout as Record<string, any>)) {
    if (!pos || typeof pos !== 'object') continue;

    const x = Number(pos.x);
    const y = Number(pos.y);

    if (Number.isNaN(x) || Number.isNaN(y)) continue;

    entries.push([roomId, { x: clamp01(x), y: clamp01(y) }]);
  }

  return Object.fromEntries(entries);
};

export const getLayout = async (): Promise<RoomLayout> => {
  const cacheManager = container.get<NodeCache>(TYPES.CacheManager);
  const cached = cacheManager.get<RoomLayout>(LAYOUT_CACHE_KEY);
  if (cached) return cached;

  const logger = container.get<Logger>(TYPES.Logger);

  try {
    const raw = await fs.readFile(layoutPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const sanitized = sanitizeLayout(parsed);

    cacheManager.set(LAYOUT_CACHE_KEY, sanitized);
    return sanitized;
  } catch (err: any) {
    if (err?.code !== 'ENOENT') {
      logger.warn('Could not read layout file', err?.message ?? err);
    }

    const fallback: RoomLayout = {};
    cacheManager.set(LAYOUT_CACHE_KEY, fallback);
    return fallback;
  }
};

export const saveLayout = async (layout: unknown): Promise<RoomLayout> => {
  const cacheManager = container.get<NodeCache>(TYPES.CacheManager);
  const logger = container.get<Logger>(TYPES.Logger);

  const sanitized = sanitizeLayout(layout);

  try {
    await fs.mkdir(path.dirname(layoutPath), { recursive: true });
    await fs.writeFile(layoutPath, JSON.stringify(sanitized, null, 2), 'utf-8');
    cacheManager.set(LAYOUT_CACHE_KEY, sanitized);
  } catch (err: any) {
    logger.error('Could not persist layout', err?.message ?? err);
  }

  return sanitized;
};
