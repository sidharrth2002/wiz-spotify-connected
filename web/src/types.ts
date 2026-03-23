export type RoomsResponse = Record<string, Array<[string, string]>>;

export type Mode = 'auto' | 'calm' | 'party' | 'surround';

export type Layout = Record<string, { x: number; y: number }>;
