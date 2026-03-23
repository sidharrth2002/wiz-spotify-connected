import express, { NextFunction, Request, Response } from 'express';
import NodeCache from 'node-cache';
import { Bulb, Mode } from '../../classes/type-definitions.js';
import { emitDanceToSystemAudioEvent } from '../emitters/system-audio-emitter.js';
import { listenToDanceToSpotifyEvent } from '../listeners/dance-to-spotify-listener.js';
import { setRoom } from '../../services/wiz/lights-service.js';
import { ColorThemeName, getColorTheme, listThemes, setColorTheme } from '../../services/color-theme-service.js';
import { container } from '../../utils/inversify-orchestrator.js';
import { Logger } from '../../utils/logger.js';
import { TYPES } from '../../utils/types.js';

const systemAudioRouter = express.Router();
const cacheManager = container.get<NodeCache>(TYPES.CacheManager);
const logger = container.get<Logger>(TYPES.Logger);

const ensureNotRunning = (_req: Request, res: Response, next: NextFunction) => {
  if (cacheManager.get('instance') === 'running') {
    res.status(200).send('Already running!!!');
  } else {
    next();
  }
};

systemAudioRouter.get('/dance-to-system-audio', ensureNotRunning);

systemAudioRouter.get('/dance-to-system-audio', (_req: Request, res: Response, next: NextFunction) => {
  cacheManager.set('instance', 'running');
  res.status(200).send('Started Mac audio sync...');
  next();
});

systemAudioRouter.get('/dance-to-system-audio', async (req: Request) => {
  try {
    const roomIds = resolveRoomIds(req.query.roomIds);
    const mode = resolveMode(req.query.mode);
    const sensitivity = resolveSensitivity(req.query.sensitivity);

    cacheManager.set('activeRooms', roomIds);
    cacheManager.set('activeMode', mode);

    if (!roomIds.length) {
      logger.warn('No rooms selected or discovered; skipping audio sync start.');
      return;
    }

    await kickRooms(roomIds);

    await listenToDanceToSpotifyEvent(roomIds, mode);
    await emitDanceToSystemAudioEvent(mode, { sensitivity });
  } catch (err: any) {
    logger.error('Error while running Mac audio sync', err.message);
  } finally {
    cacheManager.set('instance', 'stopped');
  }
});

systemAudioRouter.get('/dance-to-system-audio/abort', (_req: Request, res: Response) => {
  cacheManager.set('instance', 'stopped');
  res.status(200).send('Aborted Mac audio sync!');
});

const updateMode = async (req: Request, res: Response) => {
  const currentState = cacheManager.get('instance');
  if (currentState !== 'running') {
    res.status(400).send('No active audio sync to update.');
    return;
  }

  const mode = resolveMode(req.query.mode ?? req.body?.mode);
  const rooms = cacheManager.get<Array<string>>('activeRooms') ?? resolveRoomIds(undefined);

  cacheManager.set('activeMode', mode);

  try {
    await listenToDanceToSpotifyEvent(rooms, mode);
    res.status(200).send(`Updated mode to ${mode}`);
  } catch (err: any) {
    logger.error('Failed to update mode mid-session', err.message);
    res.status(500).send('Failed to update mode');
  }
};

systemAudioRouter.post('/dance-to-system-audio/mode', updateMode);
systemAudioRouter.get('/dance-to-system-audio/mode', updateMode);

const isColorTheme = (value: unknown): value is ColorThemeName => listThemes().includes(value as ColorThemeName);

systemAudioRouter.get('/color-theme', (_req: Request, res: Response) => {
  res.json({ current: getColorTheme(), available: listThemes() });
});

systemAudioRouter.post('/color-theme', (req: Request, res: Response) => {
  const incoming = (req.body?.theme ?? req.query.theme) as string | undefined;
  if (!incoming || !isColorTheme(incoming)) {
    res.status(400).send('Invalid color theme');
    return;
  }

  const applied = setColorTheme(incoming);
  res.json({ current: applied, available: listThemes() });
});

const resolveRoomIds = (roomQuery: unknown): Array<string> => {
  if (roomQuery) {
    return (<string>roomQuery).split(',');
  }

  const rooms = cacheManager.get<Record<string, any>>('rooms');
  return rooms ? Object.keys(rooms) : [];
};

const kickRooms = async (roomIds: Array<string>) => {
  const pulse: Bulb = {
    state: true,
    brightness: 40,
    color: { red: 255, green: 120, blue: 40 }
  };

  try {
    await Promise.all(roomIds.map((roomId) => setRoom(roomId, pulse)));
    logger.debug('Kick pulse sent to rooms', roomIds);
  } catch (err: any) {
    logger.error('Kick pulse failed', err?.message ?? err);
  }
};

const resolveMode = (modeQuery: unknown): Mode => {
  const normalized = typeof modeQuery === 'string' ? modeQuery.toLowerCase() : '';
  switch (normalized) {
    case Mode.calm:
      return Mode.calm;
    case Mode.party:
      return Mode.party;
    case Mode.auto:
      return Mode.auto;
    case Mode.surround:
      return Mode.surround;
    default:
      return Mode.auto;
  }
};

const resolveSensitivity = (sensitivityQuery: unknown): number | undefined => {
  if (!sensitivityQuery) return undefined;
  const parsed = Number.parseFloat(<string>sensitivityQuery);
  if (Number.isNaN(parsed)) return undefined;
  return Math.min(2.5, Math.max(1, parsed));
};

export default systemAudioRouter;
