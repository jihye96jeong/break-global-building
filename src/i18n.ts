// UI languages. Korean is the default; the browser language picks another on first visit, the choice is remembered.
export const LANGS = ['ko', 'en', 'ja', 'zh'] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_LABEL: Record<Lang, string> = { ko: '한국어', en: 'English', ja: '日本語', zh: '中文' };
export const STORAGE_LANG = 'world-breaker-lang';

const ko = {
  subtitle: '세계 건물 부수기',
  best: '최고 기록',
  start: '게임 시작',
  loading: '불러오는 중…',
  assetError: '에셋 오류',
  assetErrorHint: 'public/assets 에셋을 확인하세요.',
  imageError: '이미지를 불러오지 못했습니다',
  help: '조작 방법',
  soundOn: '사운드 켜짐',
  soundOff: '사운드 꺼짐',
  language: '언어',
  move: '이동',
  attack: '공격',
  ultimate: '필살기',
  pause: '일시 정지',
  or: '또는',
  holdRepeat: '누르고 있으면 연속',
  gaugeFull: '게이지 100%',
  touchMove: '터치: ◀ ▶ 누르고 있기',
  touchAttack: '터치: 공격',
  touchUlt: '터치: BREAK!',
  touchPause: '우상단 Ⅱ',
  rule1: '캐릭터 위쪽 가까운 구역이 부서집니다. 좌우로 움직여 다른 곳을 노리세요.',
  rule2: '<b class="danger">붉게 빛나는 잔해</b>와 바닥의 <b class="danger">!</b> 표시를 피하세요. 맞으면 하트가 하나 줄어요.',
  rule3: '적중할 때마다 SUPER 게이지가 오릅니다. 가득 차면 BREAK!로 남은 건물을 통째로 무너뜨립니다.',
  rule4: '1.5초 안에 연속으로 맞히면 콤보 배수가 올라갑니다.',
  ok: '확인',
  resume: '계속하기',
  quit: '처음으로',
  stageScore: '스테이지 점수',
  clearBonus: '클리어 보너스',
  noDamageBonus: '노데미지 보너스',
  total: '총점',
  nextPlace: '다음 장소',
  next: '다음으로',
  gameOver: '게임 오버',
  worldCleared: '세계 일주 완파!',
  score: '이번 점수',
  stageReached: '도달 스테이지',
  restart: '다시 시작',
  toTitle: '타이틀로',
  tutorialKeys: '← → 이동    Space 공격    ↓ 버티기(내려오는 건물 멈추기)    게이지 100%면 K',
  tutorialTouch: '◀ ▶ 이동 · 공격으로 부수기 · ▼ 로 내려오는 건물 멈추기!',
  rotate: '가로로 돌리면 더 크게 플레이할 수 있어요',
  lives: '목숨',
  moveLeft: '왼쪽으로 이동',
  moveRight: '오른쪽으로 이동',
  gaugeLabel: '필살기 게이지',
  guardLabel: '방어 게이지',
  guardKey: '버티기',
  touchGuard: '터치: ▼',
  rule5: '건물은 천천히 내려옵니다. 머리까지 닿으면 하트가 하나 줄어요. <b>↓ / S</b>로 밑동을 받쳐 잠시 멈추세요(GUARD 게이지 사용).',
  rule6: '층마다 <b>약한 곳(무늬 없음, 1타)</b>, <b class="mid">중간(주황 줄무늬, 2타)</b>, <b class="hard">단단한 곳(철판·리벳, 3타)</b>이 섞여 있어요. 도시마다 건물 여러 채를 연달아 부숩니다.',
};
export type Key = keyof typeof ko;

const en: Record<Key, string> = {
  subtitle: 'Smash the world’s landmarks',
  best: 'BEST',
  start: 'START',
  loading: 'Loading…',
  assetError: 'Asset error',
  assetErrorHint: 'check the files in public/assets.',
  imageError: 'Could not load image',
  help: 'How to play',
  soundOn: 'Sound on',
  soundOff: 'Sound off',
  language: 'Language',
  move: 'Move',
  attack: 'Attack',
  ultimate: 'Super',
  pause: 'Pause',
  or: 'or',
  holdRepeat: 'hold to repeat',
  gaugeFull: 'gauge at 100%',
  touchMove: 'Touch: hold ◀ ▶',
  touchAttack: 'Touch: Attack',
  touchUlt: 'Touch: BREAK!',
  touchPause: 'Ⅱ top right',
  rule1: 'You smash the nearest part above you. Move left and right to aim elsewhere.',
  rule2: 'Dodge <b class="danger">red glowing rubble</b> and the <b class="danger">!</b> marks on the ground. Each hit costs a heart.',
  rule3: 'Every hit charges the SUPER gauge. When it is full, BREAK! brings the rest of the building down at once.',
  rule4: 'Hit again within 1.5 s to build a combo multiplier.',
  ok: 'OK',
  resume: 'Resume',
  quit: 'Quit to title',
  stageScore: 'Stage score',
  clearBonus: 'Clear bonus',
  noDamageBonus: 'No-damage bonus',
  total: 'Total',
  nextPlace: 'Next stop',
  next: 'Next',
  gameOver: 'Game over',
  worldCleared: 'World tour smashed!',
  score: 'Score',
  stageReached: 'Stage reached',
  restart: 'Play again',
  toTitle: 'Title',
  tutorialKeys: '← → move    Space attack    ↓ hold the sinking building back    K when the gauge is full',
  tutorialTouch: 'Move with ◀ ▶, smash with Attack, ▼ holds the building back!',
  rotate: 'Turn your device sideways for a bigger view',
  lives: 'Lives',
  moveLeft: 'Move left',
  moveRight: 'Move right',
  gaugeLabel: 'Super gauge',
  guardLabel: 'Guard gauge',
  guardKey: 'Hold back',
  touchGuard: 'Touch: ▼',
  rule5: 'The building slowly sinks. If it reaches your head you lose a heart. Press <b>↓ / S</b> to brace against its base and halt it for a moment (uses GUARD).',
  rule6: 'Every floor mixes <b>weak (plain, 1 hit)</b>, <b class="mid">middle (amber stripes, 2 hits)</b> and <b class="hard">hard (steel plate with rivets, 3 hits)</b> parts. Each city is a series of buildings.',
};

const ja: Record<Key, string> = {
  subtitle: '世界の建物こわし',
  best: 'ハイスコア',
  start: 'ゲームスタート',
  loading: '読み込み中…',
  assetError: 'アセットエラー',
  assetErrorHint: 'public/assets のファイルを確認してください。',
  imageError: '画像を読み込めませんでした',
  help: '操作方法',
  soundOn: 'サウンド オン',
  soundOff: 'サウンド オフ',
  language: '言語',
  move: '移動',
  attack: '攻撃',
  ultimate: '必殺技',
  pause: '一時停止',
  or: 'または',
  holdRepeat: '長押しで連続',
  gaugeFull: 'ゲージ100%',
  touchMove: 'タッチ: ◀ ▶ を長押し',
  touchAttack: 'タッチ: 攻撃',
  touchUlt: 'タッチ: BREAK!',
  touchPause: '右上の Ⅱ',
  rule1: 'キャラクターの上にあるいちばん近い部分がこわれます。左右に動いてねらいを変えましょう。',
  rule2: '<b class="danger">赤く光るがれき</b>と地面の<b class="danger">!</b>マークをよけよう。当たるとハートが1つ減ります。',
  rule3: '当てるたびにSUPERゲージがたまります。満タンになったらBREAK!で残りの建物を一気にくずします。',
  rule4: '1.5秒以内に続けて当てるとコンボ倍率が上がります。',
  ok: 'OK',
  resume: 'つづける',
  quit: 'タイトルへ',
  stageScore: 'ステージスコア',
  clearBonus: 'クリアボーナス',
  noDamageBonus: 'ノーダメージボーナス',
  total: '合計',
  nextPlace: '次の場所',
  next: '次へ',
  gameOver: 'ゲームオーバー',
  worldCleared: '世界一周、完全破壊!',
  score: 'スコア',
  stageReached: '到達ステージ',
  restart: 'もう一度',
  toTitle: 'タイトルへ',
  tutorialKeys: '← → 移動    Space 攻撃    ↓ 下りてくる建物を止める    ゲージ満タンで K',
  tutorialTouch: '◀ ▶ で移動、攻撃でこわす、▼ で建物を止める!',
  rotate: '横向きにすると大きな画面で遊べます',
  lives: 'ライフ',
  moveLeft: '左へ移動',
  moveRight: '右へ移動',
  gaugeLabel: '必殺技ゲージ',
  guardLabel: 'ガードゲージ',
  guardKey: 'ふんばる',
  touchGuard: 'タッチ: ▼',
  rule5: '建物はゆっくり下りてきます。頭まで来るとハートが1つ減ります。<b>↓ / S</b>で土台を支えて少しの間止めよう(GUARDゲージを使用)。',
  rule6: '各階に<b>弱い所(模様なし・1発)</b>、<b class="mid">ふつう(オレンジのしま・2発)</b>、<b class="hard">かたい所(鉄板とリベット・3発)</b>がまざっています。都市ごとに何棟も続けてこわします。',
};

const zh: Record<Key, string> = {
  subtitle: '摧毁世界地标',
  best: '最高纪录',
  start: '开始游戏',
  loading: '加载中…',
  assetError: '资源错误',
  assetErrorHint: '请检查 public/assets 中的文件。',
  imageError: '无法加载图片',
  help: '操作说明',
  soundOn: '声音 开',
  soundOff: '声音 关',
  language: '语言',
  move: '移动',
  attack: '攻击',
  ultimate: '必杀技',
  pause: '暂停',
  or: '或',
  holdRepeat: '按住连续攻击',
  gaugeFull: '能量槽 100%',
  touchMove: '触屏: 按住 ◀ ▶',
  touchAttack: '触屏: 攻击',
  touchUlt: '触屏: BREAK!',
  touchPause: '右上角 Ⅱ',
  rule1: '会打碎角色上方最近的部分。左右移动来瞄准其他位置。',
  rule2: '躲开<b class="danger">发红光的碎块</b>和地面上的<b class="danger">!</b>标记。被砸中会失去一颗心。',
  rule3: '每次命中都会积累 SUPER 能量槽。满了以后用 BREAK! 一口气推倒整栋建筑。',
  rule4: '1.5 秒内连续命中可以提高连击倍率。',
  ok: '确定',
  resume: '继续',
  quit: '返回标题',
  stageScore: '关卡得分',
  clearBonus: '通关奖励',
  noDamageBonus: '无伤奖励',
  total: '总分',
  nextPlace: '下一站',
  next: '下一关',
  gameOver: '游戏结束',
  worldCleared: '环游世界,全部摧毁!',
  score: '本次得分',
  stageReached: '到达关卡',
  restart: '再玩一次',
  toTitle: '返回标题',
  tutorialKeys: '← → 移动    Space 攻击    ↓ 顶住下沉的建筑    能量槽满时按 K',
  tutorialTouch: '◀ ▶ 移动，攻击打碎建筑，▼ 顶住建筑!',
  rotate: '横屏游玩画面更大',
  lives: '生命',
  moveLeft: '向左移动',
  moveRight: '向右移动',
  gaugeLabel: '必杀技能量槽',
  guardLabel: '防御槽',
  guardKey: '顶住',
  touchGuard: '触屏: ▼',
  rule5: '建筑会慢慢下沉。碰到头顶会失去一颗心。按 <b>↓ / S</b> 顶住底部，让它暂停片刻(消耗 GUARD)。',
  rule6: '每层都混有<b>脆弱部分(无花纹，1 击)</b>、<b class="mid">中等(橙色条纹，2 击)</b>和<b class="hard">坚硬部分(钢板铆钉，3 击)</b>。每座城市要连续摧毁多栋建筑。',
};

const DICT: Record<Lang, Record<Key, string>> = { ko, en, ja, zh };

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_LANG);
    if (saved && (LANGS as readonly string[]).includes(saved)) return saved as Lang;
  } catch { /* storage blocked */ }
  for (const l of navigator.languages ?? [navigator.language]) {
    const base = l.toLowerCase().split('-')[0];
    if ((LANGS as readonly string[]).includes(base)) return base as Lang;
  }
  return 'ko';
}

export let lang: Lang = typeof navigator === 'undefined' ? 'ko' : detect();
export const t = (k: Key) => DICT[lang][k];

const listeners: (() => void)[] = [];
export function onLangChange(fn: () => void) { listeners.push(fn); }

export function setLang(l: Lang) {
  lang = l;
  try { localStorage.setItem(STORAGE_LANG, l); } catch { /* storage blocked */ }
  applyDom();
  for (const fn of listeners) fn();
}

/** Fill every [data-i18n] (text), [data-i18n-html] (markup) and [data-i18n-aria] (aria-label) element. */
export function applyDom() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n as Key); });
  document.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml as Key); });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria as Key)); });
  document.querySelectorAll<HTMLSelectElement>('.lang-select').forEach((s) => { s.value = lang; });
}
