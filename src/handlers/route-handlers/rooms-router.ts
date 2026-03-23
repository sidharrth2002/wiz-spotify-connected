import express, { Request, Response } from 'express';
import NodeCache from 'node-cache';
import { Bulb } from '../../classes/type-definitions.js';
import { getRooms, setRoom } from '../../services/wiz/lights-service.js';
import { getLayout, saveLayout } from '../../services/layout-service.js';
import { container } from '../../utils/inversify-orchestrator.js';
import { Logger } from '../../utils/logger.js';
import { TYPES } from '../../utils/types.js';

const roomsRouter = express.Router();
const cacheManager = container.get<NodeCache>(TYPES.CacheManager);
const logger = container.get<Logger>(TYPES.Logger);

roomsRouter.use(express.json());

roomsRouter.get('/rooms', async (_req: Request, res: Response) => {
  try {
    const cached = cacheManager.get<Record<string, any>>('rooms') ?? {};
    const rooms = await getRooms();

    if (rooms && Object.keys(rooms).length > 0) {
      cacheManager.set('rooms', rooms);
      res
        .header('Content-type', 'application/json')
        .status(200)
        .send(JSON.stringify(rooms, null, 4));
      return;
    }

    res
      .header('Content-type', 'application/json')
      .status(200)
      .send(JSON.stringify(cached, null, 4));
  } catch (err: any) {
    res.status(500).send('Error occurred');
    logger.error('Error occurred', err.message);
  }
});

roomsRouter.post('/rooms/:roomId', async (req: Request, res: Response) => {
  try {
    const config: Bulb = {
      state: req.query.state === 'true',
      color: {
        red: Number.parseInt(<string>req.query.red),
        green: Number.parseInt(<string>req.query.green),
        blue: Number.parseInt(<string>req.query.blue)
      },
      brightness: Number.parseFloat(<string>req.query.brightness),
      coldWhite: Number.parseFloat(<string>req.query.coldWhite),
      warmWhite: Number.parseFloat(<string>req.query.warmWhite),
      temp: Number.parseFloat(<string>req.query.temp)
    };

    await setRoom(req.params.roomId, config);

    res.status(200).header('Content-type', 'application/json').send(JSON.stringify(config));
  } catch (err: any) {
    res.status(500).send('Error occurred');
    logger.error('Error occurred', err.message);
  }
});

roomsRouter.get('/layout', async (_req: Request, res: Response) => {
  try {
    const layout = await getLayout();
    res.status(200).header('Content-type', 'application/json').send(JSON.stringify(layout, null, 2));
  } catch (err: any) {
    res.status(500).send('Error occurred');
    logger.error('Error occurred while reading layout', err.message);
  }
});

roomsRouter.post('/layout', async (req: Request, res: Response) => {
  try {
    const saved = await saveLayout(normalizeLayoutPayload(req.body));
    res.status(200).header('Content-type', 'application/json').send(JSON.stringify(saved, null, 2));
  } catch (err: any) {
    res.status(500).send('Error occurred');
    logger.error('Error occurred while saving layout', err.message);
  }
});

const normalizeLayoutPayload = (payload: any) => {
  if (!payload || typeof payload !== 'object') return {};

  const normalized = Object.entries(payload as Record<string, any>).reduce((acc, [roomId, pos]: [string, any]) => {
    if (!pos || typeof pos !== 'object') return acc;
    const x = Number((pos as any).x);
    const y = Number((pos as any).y);
    if (Number.isNaN(x) || Number.isNaN(y)) return acc;
    return { ...acc, [roomId]: { x: clamp01(x), y: clamp01(y) } };
  }, {} as Record<string, { x: number; y: number }>);

  return normalized;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export default roomsRouter;
