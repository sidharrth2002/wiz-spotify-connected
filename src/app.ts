import express, { Express } from 'express';
import path from 'path';
import NodeCache from 'node-cache';
import { appConfig } from './configs/app-config.js';
import authRouter from './handlers/route-handlers/auth-router.js';
import danceToSpotifyRouter from './handlers/route-handlers/dance-to-spotify-router.js';
import roomsRouter from './handlers/route-handlers/rooms-router.js';
import systemAudioRouter from './handlers/route-handlers/system-audio-router.js';
import { getRooms } from './services/wiz/lights-service.js';
import { container } from './utils/inversify-orchestrator.js';
import { Logger } from './utils/logger.js';
import { TYPES } from './utils/types.js';

const app: Express = express();
const cacheManager = container.get<NodeCache>(TYPES.CacheManager);
const logger = container.get<Logger>(TYPES.Logger);

app.use(express.static(path.join(process.cwd(), 'public')));
app.use('/', danceToSpotifyRouter, systemAudioRouter, roomsRouter, authRouter);

app.listen(appConfig.port, async () => {
  cacheManager.set('rooms', await getRooms());
  logger.info(`⚡️[server]: Server is running at http://localhost:${appConfig.port}`);
});
