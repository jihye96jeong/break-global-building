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
  // more real landmarks (generated at development time); the small ones open the story mode
  { id: 'cheomseongdae', names: { ko: '첨성대', en: 'Cheomseongdae', ja: '瞻星台', zh: '瞻星台' },
    asset: art('cheomseongdae'), background: sky('day'), sky: 'day', displayHeight: 170,
    segments: [{ key: 'base', heightRatio: 0.15 }, { key: 'courses', heightRatio: 0.7 }, { key: 'top', heightRatio: 0.15 }],
    debrisPalette: ['#d8ccb4', '#b9aa8c', '#8f8268', '#5e5545'], material: 'stone', fallback: { shape: 'tower', color: '#d8ccb4', accent: '#8f8268' } },
  { id: 'sungnyemun', names: { ko: '숭례문', en: 'Sungnyemun Gate', ja: '崇礼門', zh: '崇礼门' },
    asset: art('sungnyemun'), background: sky('day'), sky: 'day', displayHeight: 180,
    segments: [{ key: 'stone_gate', heightRatio: 0.45 }, { key: 'pavilion', heightRatio: 0.3 }, { key: 'roof', heightRatio: 0.25 }],
    debrisPalette: ['#cfc6b4', '#8a6a4c', '#3f6b5c', '#c0392b'], material: 'mixed', fallback: { shape: 'wide', color: '#cfc6b4', accent: '#3f6b5c' } },
  { id: 'brandenburg_gate', names: { ko: '브란덴부르크 문', en: 'Brandenburg Gate', ja: 'ブランデンブルク門', zh: '勃兰登堡门' },
    asset: art('brandenburg_gate'), background: sky('day'), sky: 'day', displayHeight: 170,
    segments: [{ key: 'columns', heightRatio: 0.6 }, { key: 'entablature', heightRatio: 0.2 }, { key: 'quadriga', heightRatio: 0.2 }],
    debrisPalette: ['#e8dcc0', '#cdbd98', '#4f8a7a', '#8a7a5c'], material: 'stone', fallback: { shape: 'arches', color: '#e8dcc0', accent: '#4f8a7a' } },
  { id: 'arc_de_triomphe', names: { ko: '개선문', en: 'Arc de Triomphe', ja: '凱旋門', zh: '凯旋门' },
    asset: art('arc_de_triomphe'), background: sky('day'), sky: 'day', displayHeight: 200,
    segments: [{ key: 'pillars', heightRatio: 0.6 }, { key: 'frieze', heightRatio: 0.2 }, { key: 'attic', heightRatio: 0.2 }],
    debrisPalette: ['#efe6d2', '#d6c9ab', '#a99a7a', '#6e6450'], material: 'stone', fallback: { shape: 'arches', color: '#efe6d2', accent: '#a99a7a' } },
  { id: 'kinkakuji', names: { ko: '금각사', en: 'Kinkaku-ji', ja: '金閣寺', zh: '金阁寺' },
    asset: art('kinkakuji'), background: sky('day'), sky: 'day', displayHeight: 200,
    segments: [{ key: 'ground_floor', heightRatio: 0.35 }, { key: 'second', heightRatio: 0.3 }, { key: 'top', heightRatio: 0.35 }],
    debrisPalette: ['#f2c94c', '#d4a72c', '#5b3a29', '#2f2a26'], material: 'wood', fallback: { shape: 'stepped', color: '#f2c94c', accent: '#5b3a29' } },
  { id: 'himeji_castle', names: { ko: '히메지성', en: 'Himeji Castle', ja: '姫路城', zh: '姬路城' },
    asset: art('himeji_castle'), background: sky('day'), sky: 'day', displayHeight: 240,
    segments: [{ key: 'stone_base', heightRatio: 0.3 }, { key: 'keep', heightRatio: 0.5 }, { key: 'roof', heightRatio: 0.2 }],
    debrisPalette: ['#f4f4f0', '#9aa3ad', '#6b6f75', '#8a7f70'], material: 'mixed', fallback: { shape: 'stepped', color: '#f4f4f0', accent: '#6b6f75' } },
  { id: 'st_basils', names: { ko: '성 바실리 대성당', en: "Saint Basil's Cathedral", ja: '聖ワシリイ大聖堂', zh: '圣瓦西里大教堂' },
    asset: art('st_basils'), background: sky('sunset'), sky: 'sunset', displayHeight: 280,
    segments: [{ key: 'walls', heightRatio: 0.35 }, { key: 'drums', heightRatio: 0.3 }, { key: 'domes', heightRatio: 0.35 }],
    debrisPalette: ['#b5442f', '#e8c46a', '#3f8f5a', '#2f5fa8'], material: 'mixed', fallback: { shape: 'domes', color: '#b5442f', accent: '#e8c46a' } },
  { id: 'statue_of_liberty', names: { ko: '자유의 여신상', en: 'Statue of Liberty', ja: '自由の女神像', zh: '自由女神像' },
    asset: art('statue_of_liberty'), background: sky('sunset'), sky: 'sunset', displayHeight: 320,
    segments: [{ key: 'pedestal', heightRatio: 0.45 }, { key: 'robe', heightRatio: 0.35 }, { key: 'torch', heightRatio: 0.2 }],
    debrisPalette: ['#6fb3a0', '#4f8f7e', '#c9bfa8', '#8a8070'], material: 'mixed', fallback: { shape: 'tower', color: '#6fb3a0', accent: '#c9bfa8' } },
  { id: 'sagrada_familia', names: { ko: '사그라다 파밀리아', en: 'Sagrada Familia', ja: 'サグラダ・ファミリア', zh: '圣家堂' },
    asset: art('sagrada_familia'), background: sky('sunset'), sky: 'sunset', displayHeight: 320,
    segments: [{ key: 'facade', heightRatio: 0.4 }, { key: 'towers', heightRatio: 0.45 }, { key: 'pinnacles', heightRatio: 0.15 }],
    debrisPalette: ['#d9b98c', '#b8956a', '#e07a5f', '#5e8c61'], material: 'stone', fallback: { shape: 'lattice', color: '#d9b98c', accent: '#b8956a' } },
  { id: 'space_needle', names: { ko: '스페이스 니들', en: 'Space Needle', ja: 'スペース・ニードル', zh: '太空针塔' },
    asset: art('space_needle'), background: sky('night'), sky: 'night', displayHeight: 330,
    segments: [{ key: 'legs', heightRatio: 0.6 }, { key: 'saucer', heightRatio: 0.2 }, { key: 'spire', heightRatio: 0.2 }],
    debrisPalette: ['#f2f2f2', '#c7ccd3', '#e08a3c', '#5a6370'], material: 'steel', fallback: { shape: 'tower', color: '#f2f2f2', accent: '#e08a3c' } },
  { id: 'n_seoul_tower', names: { ko: 'N서울타워', en: 'N Seoul Tower', ja: 'Nソウルタワー', zh: 'N首尔塔' },
    asset: art('n_seoul_tower'), background: sky('night'), sky: 'night', displayHeight: 330,
    segments: [{ key: 'base', heightRatio: 0.15 }, { key: 'shaft', heightRatio: 0.45 }, { key: 'pod', heightRatio: 0.15 }, { key: 'antenna', heightRatio: 0.25 }],
    debrisPalette: ['#f4f4f4', '#cfd6de', '#7b8794', '#e05a5a'], material: 'steel', fallback: { shape: 'tower', color: '#f4f4f4', accent: '#7b8794' } },
  { id: 'cn_tower', names: { ko: 'CN 타워', en: 'CN Tower', ja: 'CNタワー', zh: '加拿大国家电视塔' },
    asset: art('cn_tower'), background: sky('night'), sky: 'night', displayHeight: 340,
    segments: [{ key: 'base', heightRatio: 0.15 }, { key: 'shaft', heightRatio: 0.45 }, { key: 'pod', heightRatio: 0.12 }, { key: 'antenna', heightRatio: 0.28 }],
    debrisPalette: ['#d9d4cc', '#b3aca0', '#6f6a62', '#3c3a36'], material: 'stone', fallback: { shape: 'tower', color: '#d9d4cc', accent: '#6f6a62' } },
];


export const landmarkById = (id: string) => LANDMARKS.find((l) => l.id === id)!;
export const REQUIRED_LANDMARKS = ['gyeongbokgung', 'lotte_world_tower', 'burj_khalifa'];
