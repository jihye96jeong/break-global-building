// v5 story mode: ten levels from a sunny morning to the deepest night. This table is the ONLY source of story-mode
// speed, floors, weak-spot guarantees and landmark pools — the endless mode's destroyed-count tiers never mix in.
import { MAX_FALL_SPEED } from '../config/balance';

export type TimeOfDay = 'morning' | 'noon' | 'afternoon' | 'golden_hour' | 'sunset' | 'twilight' | 'evening' | 'night' | 'midnight' | 'deep_night';

export interface StoryStage {
  level: number; // 1..10
  title: { ko: string; en: string; ja: string; zh: string };
  timeOfDay: TimeOfDay;
  palette: { skyTop: string; skyBottom: string };
  /** background plate drawn over the sky gradient, and how strongly */
  plate: string;
  plateAlpha: number;
  stars: number; // 0..1
  windowLights: number; // 0..1 lit city windows
  sun: boolean;
  moon: boolean;
  baseFallSpeed: number; // absolute wu/s for the first building
  waveCount: number;
  floorsRange: [number, number];
  weakFloorGuarantee: number; // share of floors with at least one HP1 lane
  hpWeights: [number, number, number]; // HP1 / HP2 / HP3
  landmarkPool: string[];
  finalWaveLandmark?: string;
  ttcTarget: [number, number]; // seconds from spawn to first contact with the guard blade
  /** creep speed while being struck (wu/s): how hard the building presses down on the hero's blade */
  pressure: number;
  finalIntro: boolean; // short FINAL BUILDING card before the last wave
}

const plate = (id: string) => `assets/backgrounds/${id}.webp`;
const W12: [number, number, number] = [75, 23, 2];
const W34: [number, number, number] = [60, 33, 7];
const W56: [number, number, number] = [45, 42, 13];
const W78: [number, number, number] = [32, 48, 20];
const W910: [number, number, number] = [25, 45, 30];

export const STORY_STAGES: StoryStage[] = [
  { level: 1, title: { ko: '햇살 아래 첫 타격', en: 'First Strike in the Sun', ja: '陽ざしの中の初撃', zh: '阳光下的第一击' },
    timeOfDay: 'morning', palette: { skyTop: '#78CBFF', skyBottom: '#DDF4FF' }, plate: plate('sky_day'), plateAlpha: 1, stars: 0, windowLights: 0, sun: true, moon: false,
    baseFallSpeed: 190, waveCount: 3, floorsRange: [3, 4], weakFloorGuarantee: 1, hpWeights: W12,
    landmarkPool: ['cheomseongdae', 'sungnyemun', 'brandenburg_gate'], ttcTarget: [1.55, 1.95], finalIntro: false, pressure: 0 },
  { level: 2, title: { ko: '깨어나는 도시', en: 'The City Wakes', ja: '目覚める街', zh: '苏醒的城市' },
    timeOfDay: 'noon', palette: { skyTop: '#58BFF6', skyBottom: '#CDEEFF' }, plate: plate('sky_day'), plateAlpha: 1, stars: 0, windowLights: 0, sun: true, moon: false,
    baseFallSpeed: 225, waveCount: 3, floorsRange: [3, 5], weakFloorGuarantee: 1, hpWeights: W12,
    landmarkPool: ['arc_de_triomphe', 'kinkakuji', 'sungnyemun'], ttcTarget: [1.35, 1.7], finalIntro: false, pressure: 20 },
  { level: 3, title: { ko: '거리 위의 첫 탑', en: 'The First Tower', ja: '街に立つ最初の塔', zh: '街上的第一座塔' },
    timeOfDay: 'afternoon', palette: { skyTop: '#57A8ED', skyBottom: '#D4E6F8' }, plate: plate('sky_day'), plateAlpha: 0.85, stars: 0, windowLights: 0, sun: true, moon: false,
    baseFallSpeed: 260, waveCount: 4, floorsRange: [4, 6], weakFloorGuarantee: 0.95, hpWeights: W34,
    landmarkPool: ['leaning_tower_pisa', 'himeji_castle', 'kinkakuji'], ttcTarget: [1.2, 1.5], finalIntro: true, pressure: 40 },
  { level: 4, title: { ko: '황금빛 유적', en: 'Golden Ruins', ja: '黄金色の遺跡', zh: '金色遗迹' },
    timeOfDay: 'golden_hour', palette: { skyTop: '#74A4DA', skyBottom: '#F5D3A3' }, plate: plate('sky_golden'), plateAlpha: 1, stars: 0, windowLights: 0, sun: true, moon: false,
    baseFallSpeed: 305, waveCount: 4, floorsRange: [5, 7], weakFloorGuarantee: 0.9, hpWeights: W34,
    landmarkPool: ['gyeongbokgung', 'colosseum', 'taj_mahal'], ttcTarget: [1.05, 1.35], finalIntro: false, pressure: 60 },
  { level: 5, title: { ko: '붉은 철골 숲', en: 'Red Steel Forest', ja: '赤い鉄骨の森', zh: '红色钢铁森林' },
    timeOfDay: 'sunset', palette: { skyTop: '#C676A7', skyBottom: '#FFBC82' }, plate: plate('sky_sunset'), plateAlpha: 1, stars: 0, windowLights: 0.1, sun: false, moon: false,
    baseFallSpeed: 355, waveCount: 4, floorsRange: [6, 8], weakFloorGuarantee: 0.85, hpWeights: W56,
    landmarkPool: ['tokyo_tower', 'st_basils', 'eiffel_tower'], finalWaveLandmark: 'eiffel_tower', ttcTarget: [0.92, 1.2], finalIntro: true, pressure: 80 },
  { level: 6, title: { ko: '땅거미의 고층군', en: 'Towers at Dusk', ja: '黄昏の高層群', zh: '暮色高楼' },
    timeOfDay: 'twilight', palette: { skyTop: '#544E9E', skyBottom: '#CE83A6' }, plate: plate('sky_twilight'), plateAlpha: 1, stars: 0.3, windowLights: 0.35, sun: false, moon: false,
    baseFallSpeed: 405, waveCount: 5, floorsRange: [6, 9], weakFloorGuarantee: 0.8, hpWeights: W56,
    landmarkPool: ['elizabeth_tower', 'empire_state', 'statue_of_liberty'], ttcTarget: [0.82, 1.1], finalIntro: false, pressure: 100 },
  { level: 7, title: { ko: '불 켜진 도시', en: 'City Lights', ja: '灯りのともる街', zh: '灯火之城' },
    timeOfDay: 'evening', palette: { skyTop: '#233F82', skyBottom: '#765B9F' }, plate: plate('sky_twilight'), plateAlpha: 0.75, stars: 0.5, windowLights: 0.6, sun: false, moon: false,
    baseFallSpeed: 455, waveCount: 5, floorsRange: [7, 10], weakFloorGuarantee: 0.7, hpWeights: W78,
    landmarkPool: ['taipei_101', 'sydney_opera_house', 'sagrada_familia'], ttcTarget: [0.72, 1.0], finalIntro: false, pressure: 120 },
  { level: 8, title: { ko: '빛나는 야경', en: 'Shining Night', ja: '輝く夜景', zh: '璀璨夜景' },
    timeOfDay: 'night', palette: { skyTop: '#142A61', skyBottom: '#345A89' }, plate: plate('sky_night'), plateAlpha: 1, stars: 0.75, windowLights: 0.8, sun: false, moon: true,
    baseFallSpeed: 505, waveCount: 5, floorsRange: [8, 11], weakFloorGuarantee: 0.65, hpWeights: W78,
    landmarkPool: ['lotte_world_tower', 'petronas_towers', 'n_seoul_tower', 'space_needle'], ttcTarget: [0.65, 0.9], finalIntro: true, pressure: 140 },
  { level: 9, title: { ko: '심야의 마천루', en: 'Midnight Skyscrapers', ja: '真夜中の摩天楼', zh: '午夜摩天楼' },
    timeOfDay: 'midnight', palette: { skyTop: '#0C183D', skyBottom: '#273767' }, plate: plate('sky_deepnight'), plateAlpha: 0.85, stars: 0.9, windowLights: 0.9, sun: false, moon: true,
    baseFallSpeed: 560, waveCount: 5, floorsRange: [9, 12], weakFloorGuarantee: 0.6, hpWeights: W910,
    landmarkPool: ['petronas_towers', 'cn_tower', 'empire_state', 'lotte_world_tower'], ttcTarget: [0.58, 0.82], finalIntro: false, pressure: 160 },
  { level: 10, title: { ko: '마지막 밤, 하늘의 끝', en: 'The Last Night, Edge of the Sky', ja: '最後の夜、空の果て', zh: '最后之夜·天空尽头' },
    timeOfDay: 'deep_night', palette: { skyTop: '#080F2B', skyBottom: '#203E68' }, plate: plate('sky_deepnight'), plateAlpha: 1, stars: 1, windowLights: 1, sun: false, moon: true,
    baseFallSpeed: 620, waveCount: 6, floorsRange: [9, 14], weakFloorGuarantee: 0.55, hpWeights: W910,
    landmarkPool: ['lotte_world_tower', 'taipei_101', 'petronas_towers', 'cn_tower', 'burj_khalifa'], finalWaveLandmark: 'burj_khalifa', ttcTarget: [0.55, 0.76], finalIntro: true, pressure: 175 },
];

export const STORY_LEVELS = STORY_STAGES.length;
export const stageFor = (level: number) => STORY_STAGES[level - 1];

/** v5 §3: the speed is fixed when the building spawns: +4% over the level from its first to its last wave, ≤ 650. */
export function resolveStageFallSpeed(stage: StoryStage, waveIndex: number) {
  const last = Math.max(1, stage.waveCount - 1);
  const t = Math.min(1, Math.max(0, waveIndex / last));
  return Math.min(MAX_FALL_SPEED, Math.round(stage.baseFallSpeed * (1 + 0.04 * t)));
}

export const TIME_NAMES: Record<TimeOfDay, { ko: string; en: string; ja: string; zh: string }> = {
  morning: { ko: '오전', en: 'Morning', ja: '朝', zh: '上午' },
  noon: { ko: '한낮', en: 'Midday', ja: '昼', zh: '正午' },
  afternoon: { ko: '오후', en: 'Afternoon', ja: '午後', zh: '下午' },
  golden_hour: { ko: '황금빛 늦은 오후', en: 'Golden hour', ja: '夕方の金色', zh: '金色傍晚' },
  sunset: { ko: '노을', en: 'Sunset', ja: '夕焼け', zh: '日落' },
  twilight: { ko: '땅거미', en: 'Twilight', ja: '黄昏', zh: '暮色' },
  evening: { ko: '저녁', en: 'Evening', ja: '夜のはじまり', zh: '傍晚' },
  night: { ko: '밤', en: 'Night', ja: '夜', zh: '夜晚' },
  midnight: { ko: '자정', en: 'Midnight', ja: '真夜中', zh: '午夜' },
  deep_night: { ko: '깊은 밤', en: 'Deep night', ja: '深夜', zh: '深夜' },
};
