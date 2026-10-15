import { lang } from '../i18n';
import type { StageConfig } from './types';

const b = (id: string) => `assets/buildings/${id}.webp`;
const bg = (id: string) => `assets/backgrounds/${id}.webp`;

const WIDE = { cols: 12, rows: 6, hpPerTile: 1 };
const TALL = { cols: 5, rows: 12, hpPerTile: 1 };

export const STAGES: StageConfig[] = [
  { id: 'gyeongbokgung', names: { ko: '경복궁 근정전', en: 'Gyeongbokgung Palace', ja: '景福宮 勤政殿', zh: '景福宫 勤政殿' }, nameEn: 'GYEONGBOKGUNG', city: 'SEOUL', buildingSrc: b('gyeongbokgung'), backgroundSrc: bg('gyeongbokgung'),
    aspect: 'wide', breakGrid: WIDE, hardness: { middle: 0.25, hard: 0.08 }, buildings: 10, sinkSpeed: 11, debris: 'roof', gaugeGain: 8, hazardRate: 0.08, scoreMultiplier: 1, skyTint: '#9fd8ef' },
  { id: 'lotte_world_tower', names: { ko: '롯데월드타워', en: 'Lotte World Tower', ja: 'ロッテワールドタワー', zh: '乐天世界大厦' }, nameEn: 'LOTTE WORLD TOWER', city: 'SEOUL', buildingSrc: b('lotte_world_tower'), backgroundSrc: bg('lotte_world_tower'),
    aspect: 'tall', breakGrid: TALL, hardness: { middle: 0.3, hard: 0.1 }, buildings: 6, sinkSpeed: 13, debris: 'glass', gaugeGain: 6, hazardRate: 0.1, scoreMultiplier: 1.1, skyTint: '#8fcff0' },
  { id: 'tokyo_tower', names: { ko: '도쿄 타워', en: 'Tokyo Tower', ja: '東京タワー', zh: '东京塔' }, nameEn: 'TOKYO TOWER', city: 'TOKYO', buildingSrc: b('tokyo_tower'), backgroundSrc: bg('tokyo_tower'),
    aspect: 'tall', breakGrid: TALL, hardness: { middle: 0.3, hard: 0.12 }, buildings: 6, sinkSpeed: 14, debris: 'steel', gaugeGain: 5, hazardRate: 0.12, scoreMultiplier: 1.2, skyTint: '#a8d8f0' },
  { id: 'eiffel_tower', names: { ko: '에펠탑', en: 'Eiffel Tower', ja: 'エッフェル塔', zh: '埃菲尔铁塔' }, nameEn: 'EIFFEL TOWER', city: 'PARIS', buildingSrc: b('eiffel_tower'), backgroundSrc: bg('eiffel_tower'),
    aspect: 'tall', breakGrid: TALL, hardness: { middle: 0.32, hard: 0.14 }, buildings: 6, sinkSpeed: 16, debris: 'steel', gaugeGain: 5, hazardRate: 0.13, scoreMultiplier: 1.3, skyTint: '#c4def0' },
  { id: 'big_ben', names: { ko: '빅 벤', en: 'Big Ben', ja: 'ビッグ・ベン', zh: '大本钟' }, nameEn: 'BIG BEN · ELIZABETH TOWER', city: 'LONDON', buildingSrc: b('big_ben'), backgroundSrc: bg('big_ben'),
    aspect: 'tall', breakGrid: TALL, hardness: { middle: 0.34, hard: 0.16 }, buildings: 7, sinkSpeed: 17, debris: 'stone', gaugeGain: 4, hazardRate: 0.16, scoreMultiplier: 1.4, skyTint: '#b9cfe0' },
  { id: 'colosseum', names: { ko: '콜로세움', en: 'Colosseum', ja: 'コロッセオ', zh: '罗马斗兽场' }, nameEn: 'COLOSSEUM', city: 'ROME', buildingSrc: b('colosseum'), backgroundSrc: bg('colosseum'),
    aspect: 'wide', breakGrid: { cols: 12, rows: 6, hpPerTile: 1 }, hardness: { middle: 0.34, hard: 0.18 }, buildings: 10, sinkSpeed: 19, debris: 'stone', gaugeGain: 4, hazardRate: 0.17, scoreMultiplier: 1.5, skyTint: '#f3d7a6' },
  { id: 'taj_mahal', names: { ko: '타지마할', en: 'Taj Mahal', ja: 'タージ・マハル', zh: '泰姬陵' }, nameEn: 'TAJ MAHAL', city: 'AGRA', buildingSrc: b('taj_mahal'), backgroundSrc: bg('taj_mahal'),
    aspect: 'wide', breakGrid: { cols: 12, rows: 7, hpPerTile: 1 }, hardness: { middle: 0.36, hard: 0.2 }, buildings: 9, sinkSpeed: 20, debris: 'marble', gaugeGain: 3, hazardRate: 0.2, scoreMultiplier: 1.6, skyTint: '#f4dcc8' },
  { id: 'burj_khalifa', names: { ko: '부르즈 할리파', en: 'Burj Khalifa', ja: 'ブルジュ・ハリファ', zh: '哈利法塔' }, nameEn: 'BURJ KHALIFA', city: 'DUBAI', buildingSrc: b('burj_khalifa'), backgroundSrc: bg('burj_khalifa'),
    aspect: 'tall', breakGrid: { cols: 5, rows: 14, hpPerTile: 1 }, hardness: { middle: 0.38, hard: 0.24 }, buildings: 5, sinkSpeed: 22, debris: 'glass', gaugeGain: 3, hazardRate: 0.22, scoreMultiplier: 2, skyTint: '#f6e2b0' },
];

/** P1: reserved, not in the stage rotation until their art exists. */
export const RESERVED_STAGE_IDS = ['sydney_opera_house', 'statue_of_liberty', 'leaning_tower_pisa', 'taipei_101'];

/** Landmark name in the current UI language. */
export const stageName = (s: StageConfig) => s.names[lang];
