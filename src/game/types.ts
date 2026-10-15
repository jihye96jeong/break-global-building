export type TileState = 'intact' | 'damaged' | 'unsupported' | 'fallen' | 'inactive';
export type DebrisKind = 'roof' | 'glass' | 'steel' | 'stone' | 'marble';
export type Point = { x: number; y: number };

export interface DestructibleTile {
  id: number;
  col: number;
  row: number;
  state: TileState;
  hp: number;
  maxHp: number;
  /** polygon in normalised building space (0..1), shared edges with neighbours */
  poly: Point[];
  /** cell centre in normalised building space */
  cx: number;
  cy: number;
  coverage: number;
  grounded: boolean;
  /** ms left before an unsupported tile drops */
  shakeMs: number;
  scored: boolean;
}

export interface StageConfig {
  id: string;
  names: Record<'ko' | 'en' | 'ja' | 'zh', string>;
  nameEn: string;
  city: string;
  buildingSrc: string;
  backgroundSrc: string;
  aspect: 'wide' | 'normal' | 'tall';
  breakGrid: { cols: number; rows: number; hpPerTile: number };
  /** share of middle (2-hit) and hard (3-hit) pieces; every floor gets at least one of each kind */
  hardness: { middle: number; hard: number };
  /** buildings in this city's series (fewer for taller landmarks) */
  buildings: number;
  /** how fast the building sinks toward the hero, px/s */
  sinkSpeed: number;
  debris: DebrisKind;
  hazardRate: number;
  /** SUPER gauge per successful hit (spec default 8; later stages charge slower so BREAK! is earned) */
  gaugeGain: number;
  scoreMultiplier: number;
  skyTint: string;
}

export type GameStatus = 'TITLE' | 'STAGE_INTRO' | 'PLAYING' | 'PAUSED' | 'STAGE_CLEAR' | 'GAME_OVER' | 'WORLD_CLEAR';
