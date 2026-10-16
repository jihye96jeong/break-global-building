// Landmark metadata: art, display names, how the art is split into stacked destruction segments, debris colours
// and sky. Gameplay (floors × 3 lanes) never depends on the real building; segments only shape the visuals.

export type Sky = 'day' | 'sunset' | 'night';
export type Material = 'glass' | 'stone' | 'steel' | 'wood' | 'mixed';
export interface Segment { key: string; heightRatio: number }
export interface Landmark {
  id: string;
  names: { ko: string; en: string; ja: string; zh: string };
  asset: string;
  /** background plate: a city plate where one exists, else a generic sky */
  background: string;
  sky: Sky;
  /** visual height of the whole building in world units (tall towers come in partly above the screen) */
  displayHeight: number;
  /** bottom → top; ratios sum to 1 */
  segments: Segment[];
  debrisPalette: string[];
  /** what the building is made of: drives chip shapes and impact sounds (v2 §7.2) */
  material: Material;
  /** v5: a simple fictional starter building for the story mode's first levels (never in the endless rotation) */
  basic?: boolean;
  /** procedural fallback silhouette when the art cannot be loaded */
  fallback: { shape: 'tower' | 'stepped' | 'wide' | 'twin' | 'lattice' | 'shells' | 'arches' | 'domes'; color: string; accent: string };
}

const city = (id: string) => `assets/backgrounds/${id}.webp`;
const sky = (s: Sky) => `assets/backgrounds/sky_${s}.webp`;
const art = (id: string) => `assets/buildings/${id}.webp`;

export const LANDMARKS: Landmark[] = [
  { id: 'gyeongbokgung', names: { ko: '경복궁', en: 'Gyeongbokgung Palace', ja: '景福宮', zh: '景福宫' },
    asset: art('gyeongbokgung'), background: city('gyeongbokgung'), sky: 'day', displayHeight: 270,
    segments: [{ key: 'base', heightRatio: 0.26 }, { key: 'columns', heightRatio: 0.36 }, { key: 'roof', heightRatio: 0.38 }],
    debrisPalette: ['#5b382a', '#d6c0a6', '#34404b', '#2f7a55'], material: 'wood', fallback: { shape: 'wide', color: '#b8432f', accent: '#3a4250' } },
  { id: 'lotte_world_tower', names: { ko: '롯데월드타워', en: 'Lotte World Tower', ja: 'ロッテワールドタワー', zh: '乐天世界大厦' },
    asset: art('lotte_world_tower'), background: city('lotte_world_tower'), sky: 'day', displayHeight: 340,
    segments: [{ key: 'podium', heightRatio: 0.1 }, { key: 'glass', heightRatio: 0.75 }, { key: 'crown', heightRatio: 0.15 }],
    debrisPalette: ['#bfe7ff', '#7fc4ef', '#e8f7ff', '#5d7d99'], material: 'glass', fallback: { shape: 'tower', color: '#9cc6e8', accent: '#e8f4ff' } },
  { id: 'burj_khalifa', names: { ko: '부르즈 할리파', en: 'Burj Khalifa', ja: 'ブルジュ・ハリファ', zh: '哈利法塔' },
    asset: art('burj_khalifa'), background: city('burj_khalifa'), sky: 'sunset', displayHeight: 340,
    segments: [{ key: 'base', heightRatio: 0.3 }, { key: 'setbacks', heightRatio: 0.45 }, { key: 'spire', heightRatio: 0.25 }],
    debrisPalette: ['#a9c4e0', '#5d7fa3', '#e2ecf5', '#38506b'], material: 'glass', fallback: { shape: 'stepped', color: '#7fa6cc', accent: '#dfeaf5' } },
  { id: 'eiffel_tower', names: { ko: '에펠탑', en: 'Eiffel Tower', ja: 'エッフェル塔', zh: '埃菲尔铁塔' },
    asset: art('eiffel_tower'), background: city('eiffel_tower'), sky: 'day', displayHeight: 340,
    segments: [{ key: 'legs', heightRatio: 0.3 }, { key: 'second', heightRatio: 0.3 }, { key: 'top', heightRatio: 0.4 }],
    debrisPalette: ['#8a5a2b', '#5e3b1c', '#b07a45', '#3a2612'], material: 'steel', fallback: { shape: 'lattice', color: '#8a5a2b', accent: '#5e3b1c' } },
  { id: 'elizabeth_tower', names: { ko: '빅벤(엘리자베스 타워)', en: 'Elizabeth Tower', ja: 'エリザベス・タワー', zh: '伊丽莎白塔' },
    asset: art('big_ben'), background: city('big_ben'), sky: 'day', displayHeight: 340,
    segments: [{ key: 'shaft', heightRatio: 0.62 }, { key: 'clock', heightRatio: 0.16 }, { key: 'roof', heightRatio: 0.22 }],
    debrisPalette: ['#d9b56a', '#a8843f', '#2f4a3e', '#f2efe6'], material: 'stone', fallback: { shape: 'tower', color: '#caa357', accent: '#2f4a3e' } },
  { id: 'tokyo_tower', names: { ko: '도쿄 타워', en: 'Tokyo Tower', ja: '東京タワー', zh: '东京塔' },
    asset: art('tokyo_tower'), background: city('tokyo_tower'), sky: 'day', displayHeight: 340,
    segments: [{ key: 'legs', heightRatio: 0.35 }, { key: 'decks', heightRatio: 0.3 }, { key: 'antenna', heightRatio: 0.35 }],
    debrisPalette: ['#e8452c', '#ffffff', '#a3341f', '#6b6b6b'], material: 'steel', fallback: { shape: 'lattice', color: '#e8452c', accent: '#ffffff' } },
  { id: 'colosseum', names: { ko: '콜로세움', en: 'Colosseum', ja: 'コロッセオ', zh: '罗马斗兽场' },
    asset: art('colosseum'), background: city('colosseum'), sky: 'sunset', displayHeight: 250,
    segments: [{ key: 'ground_arches', heightRatio: 0.34 }, { key: 'middle_arches', heightRatio: 0.33 }, { key: 'attic', heightRatio: 0.33 }],
    debrisPalette: ['#d9c6a1', '#b9a17a', '#8e7a5c', '#efe3c8'], material: 'stone', fallback: { shape: 'arches', color: '#d2b98c', accent: '#8e7a5c' } },
  { id: 'taj_mahal', names: { ko: '타지마할', en: 'Taj Mahal', ja: 'タージ・マハル', zh: '泰姬陵' },
    asset: art('taj_mahal'), background: city('taj_mahal'), sky: 'sunset', displayHeight: 280,
    segments: [{ key: 'plinth', heightRatio: 0.25 }, { key: 'hall', heightRatio: 0.35 }, { key: 'dome', heightRatio: 0.4 }],
    debrisPalette: ['#ffffff', '#ece9e4', '#d8d3cc', '#c9b27a'], material: 'stone', fallback: { shape: 'domes', color: '#f2efe9', accent: '#c9b27a' } },
  { id: 'empire_state', names: { ko: '엠파이어 스테이트 빌딩', en: 'Empire State Building', ja: 'エンパイア・ステート・ビル', zh: '帝国大厦' },
    asset: art('empire_state'), background: sky('night'), sky: 'night', displayHeight: 340,
    segments: [{ key: 'base', heightRatio: 0.2 }, { key: 'shaft', heightRatio: 0.5 }, { key: 'deco_top', heightRatio: 0.3 }],
    debrisPalette: ['#b9b2a3', '#8b8475', '#e6e0d2', '#55504a'], material: 'stone', fallback: { shape: 'stepped', color: '#b3ab9a', accent: '#e8d9a8' } },
  { id: 'taipei_101', names: { ko: '타이베이 101', en: 'Taipei 101', ja: '台北101', zh: '台北101' },
    asset: art('taipei_101'), background: sky('day'), sky: 'day', displayHeight: 340,
    segments: [{ key: 'base', heightRatio: 0.22 }, { key: 'segments', heightRatio: 0.63 }, { key: 'spire', heightRatio: 0.15 }],
    debrisPalette: ['#5fae9a', '#2f6e62', '#bfe3d9', '#1f3f3a'], material: 'glass', fallback: { shape: 'stepped', color: '#4f9e8c', accent: '#bfe3d9' } },
  { id: 'petronas_towers', names: { ko: '페트로나스 트윈 타워', en: 'Petronas Towers', ja: 'ペトロナス・ツインタワー', zh: '双子塔' },
    asset: art('petronas_towers'), background: sky('night'), sky: 'night', displayHeight: 340,
    segments: [{ key: 'lower', heightRatio: 0.4 }, { key: 'bridge', heightRatio: 0.15 }, { key: 'upper', heightRatio: 0.45 }],
    debrisPalette: ['#c7ced6', '#8d97a3', '#eef2f6', '#4b5560'], material: 'steel', fallback: { shape: 'twin', color: '#b9c2cc', accent: '#eef2f6' } },
  { id: 'sydney_opera_house', names: { ko: '시드니 오페라 하우스', en: 'Sydney Opera House', ja: 'シドニー・オペラハウス', zh: '悉尼歌剧院' },
    asset: art('sydney_opera_house'), background: sky('sunset'), sky: 'sunset', displayHeight: 240,
    segments: [{ key: 'podium', heightRatio: 0.35 }, { key: 'shells', heightRatio: 0.65 }],
    debrisPalette: ['#ffffff', '#f1ede4', '#c9a27a', '#8f6b4a'], material: 'mixed', fallback: { shape: 'shells', color: '#f4f1ea', accent: '#c9a27a' } },
  { id: 'leaning_tower_pisa', names: { ko: '피사의 사탑', en: 'Leaning Tower of Pisa', ja: 'ピサの斜塔', zh: '比萨斜塔' },
    asset: art('leaning_tower_pisa'), background: sky('day'), sky: 'day', displayHeight: 340,
    segments: [{ key: 'base', heightRatio: 0.2 }, { key: 'galleries', heightRatio: 0.65 }, { key: 'belfry', heightRatio: 0.15 }],
    debrisPalette: ['#f3efe6', '#d9d2c3', '#b8ad97', '#7d7462'], material: 'stone', fallback: { shape: 'tower', color: '#ece6d8', accent: '#b8ad97' } },
  // v5 story-mode starter buildings (fictional, generated at development time)
  { id: 'basic_shop', basic: true, names: { ko: '골목 상가', en: 'Corner Shop', ja: '角のお店', zh: '街角小店' },
    asset: art('basic_shop'), background: sky('day'), sky: 'day', displayHeight: 150,
    segments: [{ key: 'shopfront', heightRatio: 0.45 }, { key: 'upper', heightRatio: 0.4 }, { key: 'roof', heightRatio: 0.15 }],
    debrisPalette: ['#f6d7b0', '#e98f6f', '#9fd3e6', '#6b5a4c'], material: 'mixed', fallback: { shape: 'wide', color: '#f6d7b0', accent: '#e98f6f' } },
  { id: 'basic_house', basic: true, names: { ko: '3층 주택', en: 'Town House', ja: '三階建ての家', zh: '三层小楼' },
    asset: art('basic_house'), background: sky('day'), sky: 'day', displayHeight: 200,
    segments: [{ key: 'ground', heightRatio: 0.3 }, { key: 'floors', heightRatio: 0.45 }, { key: 'roof', heightRatio: 0.25 }],
    debrisPalette: ['#f3e3c9', '#c9774f', '#8a5a3c', '#5b4636'], material: 'wood', fallback: { shape: 'stepped', color: '#f3e3c9', accent: '#c9774f' } },
  { id: 'basic_office', basic: true, names: { ko: '낮은 오피스', en: 'Office Block', ja: 'オフィスビル', zh: '办公楼' },
    asset: art('basic_office'), background: sky('day'), sky: 'day', displayHeight: 230,
    segments: [{ key: 'lobby', heightRatio: 0.2 }, { key: 'offices', heightRatio: 0.7 }, { key: 'roof', heightRatio: 0.1 }],
    debrisPalette: ['#cfd8e3', '#8fb7d9', '#5b7a99', '#3b4a5c'], material: 'glass', fallback: { shape: 'tower', color: '#cfd8e3', accent: '#8fb7d9' } },
  { id: 'basic_apartment', basic: true, names: { ko: '저층 아파트', en: 'Apartment Block', ja: 'マンション', zh: '公寓楼' },
    asset: art('basic_apartment'), background: sky('day'), sky: 'day', displayHeight: 280,
    segments: [{ key: 'entrance', heightRatio: 0.15 }, { key: 'balconies', heightRatio: 0.75 }, { key: 'roof', heightRatio: 0.1 }],
    debrisPalette: ['#efe6d8', '#c8b9a3', '#8d9db0', '#5d5a57'], material: 'stone', fallback: { shape: 'tower', color: '#efe6d8', accent: '#8d9db0' } },
  { id: 'basic_clocktower', basic: true, names: { ko: '시계탑', en: 'Clock Tower', ja: '時計塔', zh: '钟楼' },
    asset: art('basic_clocktower'), background: sky('day'), sky: 'day', displayHeight: 300,
    segments: [{ key: 'base', heightRatio: 0.35 }, { key: 'shaft', heightRatio: 0.35 }, { key: 'clock', heightRatio: 0.15 }, { key: 'roof', heightRatio: 0.15 }],
    debrisPalette: ['#c8664a', '#9b4a36', '#e9d8b8', '#4f8a7a'], material: 'stone', fallback: { shape: 'tower', color: '#c8664a', accent: '#4f8a7a' } },
];

/** Endless mode rotates through the real landmarks only. */
export const ENDLESS_LANDMARKS = () => LANDMARKS.filter((l) => !l.basic);

export const landmarkById = (id: string) => LANDMARKS.find((l) => l.id === id)!;
export const REQUIRED_LANDMARKS = ['gyeongbokgung', 'lotte_world_tower', 'burj_khalifa'];
