import express, { NextFunction, Request, Response } from 'express';
import NodeCache from 'node-cache';
import { Mode } from '../../classes/type-definitions.js';
import { emitDanceToSystemAudioEvent } from '../emitters/system-audio-emitter.js';
import { listenToDanceToSpotifyEvent } from '../listeners/dance-to-spotify-listener.js';
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

const resolveRoomIds = (roomQuery: unknown): Array<string> => {
  if (roomQuery) {
    return (<string>roomQuery).split(',');
  }

  const rooms = cacheManager.get<Record<string, any>>('rooms');
  return rooms ? Object.keys(rooms) : [];
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
