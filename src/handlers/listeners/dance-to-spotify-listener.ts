import { EventEmitter } from 'node:events';
import { Bulb, ColorSpace, Mode } from '../../classes/type-definitions.js';
import { RoomLayout, getLayout } from '../../services/layout-service.js';
import { setRoom } from '../../services/wiz/lights-service.js';
import { container } from '../../utils/inversify-orchestrator.js';
import { Logger } from '../../utils/logger.js';
import { TYPES } from '../../utils/types.js';

export const listenToDanceToSpotifyEvent = async (roomIds: Array<string>, mode?: Mode) => {
  const eventBus = container.get<EventEmitter>(TYPES.EventBus);
  const logger = container.get<Logger>(TYPES.Logger);

  eventBus.removeAllListeners('changeLights');
  eventBus.removeAllListeners('changeLightsSurround');

  eventBus.on('changeLights', async (brightness: number, colorSpace: ColorSpace) => {
    logger.debug('changeLights', { rooms: roomIds.length, brightness, colorSpace });
    const bulb: Bulb = {
      state: true,
      brightness
    };

    const promises = roomIds.map(roomId => setRoom(roomId, bulb, colorSpace));

    await Promise.all(promises);
  });

  if (mode !== Mode.surround) return;

  const layout = await getLayout();
  const { leftRooms, rightRooms } = buildSurroundSides(roomIds, layout);
  logger.debug('changeLightsSurround: sides ready', { leftRooms, rightRooms });

  eventBus.on('changeLightsSurround', async (payload: { side: 'left' | 'right'; brightness: number; colorSpace: ColorSpace }) => {
    let primaryRooms = payload.side === 'left' ? leftRooms : rightRooms;
    let secondaryRooms = (payload.side === 'left' ? rightRooms : leftRooms).filter(roomId => !primaryRooms.includes(roomId));

    if (!primaryRooms.length && secondaryRooms.length) {
      primaryRooms = secondaryRooms;
      secondaryRooms = [];
    }

    logger.debug('changeLightsSurround event', {
      side: payload.side,
      brightness: payload.brightness,
      primaryRooms,
      secondaryRooms,
      colorSpace: payload.colorSpace
    });

    if (!primaryRooms.length) return;

    const leadBulb: Bulb = { state: true, brightness: payload.brightness };
    const trailBulb: Bulb = { state: true, brightness: Math.max(8, Math.round(payload.brightness * 0.35)) };

    const updates = [
      ...primaryRooms.map(roomId => setRoom(roomId, leadBulb, payload.colorSpace)),
      ...secondaryRooms.map(roomId => setRoom(roomId, trailBulb, payload.colorSpace))
    ];

    await Promise.all(updates);
  });
};

const buildSurroundSides = (roomIds: Array<string>, layout: RoomLayout) => {
  if (!roomIds.length) return { leftRooms: [], rightRooms: [] };

  const hasLayout = Object.keys(layout || {}).length > 0;

  // If no layout yet, respect selection order: first is left, rest right.
  if (!hasLayout) {
    return {
      leftRooms: roomIds.length ? [roomIds[0]] : [],
      rightRooms: roomIds.slice(1).length ? roomIds.slice(1) : roomIds.length ? [roomIds[0]] : []
    };
  }

  // Use layout when available, but still fall back to order if all x are identical.
  const positioned = roomIds.map((roomId, index) => {
    const fallbackX = roomIds.length > 1 ? index / (roomIds.length - 1) : 0.5;
    const pos = layout?.[roomId];
    const x = typeof pos?.x === 'number' ? clamp01(pos.x) : fallbackX;
    return { roomId, x };
  });

  const center = positioned.reduce((acc, item) => acc + item.x, 0) / positioned.length;
  let leftRooms = positioned.filter(item => item.x <= center).map(item => item.roomId);
  let rightRooms = positioned.filter(item => item.x > center).map(item => item.roomId);

  const allSame = positioned.every(p => Math.abs(p.x - positioned[0].x) < 0.001);
  if (allSame) {
    leftRooms = roomIds.length ? [roomIds[0]] : [];
    rightRooms = roomIds.slice(1);
  }

  if (!leftRooms.length && rightRooms.length) leftRooms = [...rightRooms];
  if (!rightRooms.length && leftRooms.length) rightRooms = [...leftRooms];
  if (!leftRooms.length && !rightRooms.length) {
    leftRooms = [...roomIds];
    rightRooms = [...roomIds];
  }

  return { leftRooms, rightRooms };
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
