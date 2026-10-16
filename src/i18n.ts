// UI languages. Korean is the default; the browser language picks another on first visit; the choice is remembered.
export const LANGS = ['ko', 'en', 'ja', 'zh'] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_LABEL: Record<Lang, string> = { ko: '한국어', en: 'English', ja: '日本語', zh: '中文' };
const STORAGE_LANG = 'world-breaker-lang';

const ko = {
  subtitle: '건물 부수기',
  start: '게임 시작',
  help: '조작 방법',
  soundOn: '사운드 켜짐',
  soundOff: '사운드 꺼짐',
  language: '언어',
  best: '최고 점수',
  bestCombo: '최대 콤보',
  move: '레인 이동',
  jump: '점프',
  guard: '가드',
  attack: '공격',
  special: '필살기',
  pause: '일시정지',
  mute: '음소거',
  helpTitle: '조작과 규칙',
  rule1: '건물 맨 아래층의 <b>좌·중·우</b> 중 한 곳이라도 부서지면 <b>그 층 전체</b>가 무너집니다. 칼이 밑면에 <b>실제로 닿아야</b> 맞습니다. 멀리서 휘두르면 헛스윙!',
  rule2: '<b class="weak">금이 간 곳</b>은 1타, 보통 벽은 2타, <b class="hard">금테 철판</b>은 3타. 건물 아래 표시를 보고 약한 레인으로 이동하세요.',
  rule3: '건물이 머리에 닿으면 하트가 하나 줄어요. ↓를 <b>누르고 있으면</b> 칼에 닿는 순간 언제나 막습니다(횟수 무제한). <b>지상 가드</b>는 크게 밀어내지만 콤보가 끊기고, <b>공중 가드</b>(점프 중 ↓)는 적게 밀지만 콤보를 지킵니다.',
  rule4: '맞힐수록 필살기 게이지가 차고, 가득 차면 <b>X</b>로 지금 건물을 통째로 부숩니다. 부순 건물이 늘수록 더 높고 빨라집니다.',
  showTutorial: '튜토리얼 힌트 다시 보기',
  showHp: '레인 HP 숫자 표시(접근성)',
  effectsLow: '이펙트 낮음 (화면 흔들림 끄기, 파편 줄이기)',
  ok: '확인',
  score: '점수',
  combo: '콤보',
  next: '다음',
  specialReady: 'SPECIAL READY',
  paused: '일시정지',
  resume: '계속하기',
  quit: '타이틀로',
  gameOver: '게임 오버',
  destroyed: '파괴한 건물',
  maxCombo: '최대 콤보',
  newRecord: '최고 기록 갱신!',
  restart: '다시 시작',
  hint1: '← → 움직여 금이 간 곳을 공격하세요! (Z)',
  hint2: '약점 1곳만 부수면 한 층 전체가 무너집니다.',
  hint3: '↑ 점프 + ↓ 가드로 콤보 유지 / X 필살기',
  keyGuide: '← → 이동 · ↑ 점프 · ↓ 가드 · Z 공격 · X 필살기 · Esc 일시정지 · M 음소거',
  rotate: '가로로 돌리면 더 넓게 볼 수 있어요',
  floors: '층',
};
export type Key = keyof typeof ko;

const en: Record<Key, string> = {
  subtitle: 'Building Breaker',
  start: 'START',
  help: 'How to play',
  soundOn: 'Sound on',
  soundOff: 'Sound off',
  language: 'Language',
  best: 'Best score',
  bestCombo: 'Best combo',
  move: 'Change lane',
  jump: 'Jump',
  guard: 'Guard',
  attack: 'Attack',
  special: 'Special',
  pause: 'Pause',
  mute: 'Mute',
  helpTitle: 'Controls & rules',
  rule1: 'Break <b>any one</b> of the left, centre or right parts of the lowest floor and <b>the whole floor</b> comes down. The blade must <b>actually touch</b> the underside: swinging from afar only cuts air.',
  rule2: '<b class="weak">Cracked</b> parts take 1 hit, plain walls 2, <b class="hard">gold-framed steel</b> 3. Read the marks under the building and move to the weak lane.',
  rule3: 'If the building reaches your head you lose a heart. Hold ↓ and every touch on the blade is blocked — <b>unlimited</b>. <b>Ground guard</b> pushes it far but breaks your combo; <b>air guard</b> (↓ while jumping) pushes less but keeps it.',
  rule4: 'Hits charge the special gauge; when full, <b>X</b> destroys the whole building. The more you destroy, the taller and faster they get.',
  showTutorial: 'Show the tutorial hints again',
  showHp: 'Show lane HP numbers (accessibility)',
  effectsLow: 'Effects: low (no screen shake, fewer particles)',
  ok: 'OK',
  score: 'Score',
  combo: 'Combo',
  next: 'Next',
  specialReady: 'SPECIAL READY',
  paused: 'Paused',
  resume: 'Resume',
  quit: 'Title',
  gameOver: 'Game over',
  destroyed: 'Buildings destroyed',
  maxCombo: 'Best combo',
  newRecord: 'New record!',
  restart: 'Play again',
  hint1: 'Move with ← → and hit the cracked part! (Z)',
  hint2: 'Breaking one weak part brings the whole floor down.',
  hint3: '↑ jump + ↓ guard keeps your combo / X special',
  keyGuide: '← → move · ↑ jump · ↓ guard · Z attack · X special · Esc pause · M mute',
  rotate: 'Turn your phone sideways for a wider view',
  floors: 'floors',
};

const ja: Record<Key, string> = {
  subtitle: 'ビルこわし',
  start: 'ゲームスタート',
  help: '操作方法',
  soundOn: 'サウンド オン',
  soundOff: 'サウンド オフ',
  language: '言語',
  best: 'ハイスコア',
  bestCombo: '最大コンボ',
  move: 'レーン移動',
  jump: 'ジャンプ',
  guard: 'ガード',
  attack: '攻撃',
  special: '必殺技',
  pause: '一時停止',
  mute: 'ミュート',
  helpTitle: '操作とルール',
  rule1: '一番下の階の<b>左・中・右</b>のどこか1か所でもこわれると、<b>その階全体</b>がくずれます。刀が底面に<b>本当に当たった時だけ</b>ヒット。離れて振ると空振り!',
  rule2: '<b class="weak">ひびの入った所</b>は1発、ふつうの壁は2発、<b class="hard">金わくの鉄板</b>は3発。建物の下の表示を見て弱いレーンへ移動しよう。',
  rule3: '建物が頭に着くとハートが1つ減ります。↓を<b>押している間</b>は刀に当たった瞬間に必ず防げます(回数無制限)。<b>地上ガード</b>は大きく押し返すけれどコンボが切れ、<b>空中ガード</b>(ジャンプ中に↓)は少しだけ押してコンボを守ります。',
  rule4: '当てるほど必殺技ゲージがたまり、満タンで<b>X</b>を押すと今の建物を丸ごとこわします。こわすほど建物は高く速くなります。',
  showTutorial: 'チュートリアルのヒントをもう一度表示',
  showHp: 'レーンのHPを数字で表示(アクセシビリティ)',
  effectsLow: 'エフェクト低 (画面の揺れなし・破片を減らす)',
  ok: 'OK',
  score: 'スコア',
  combo: 'コンボ',
  next: '次',
  specialReady: 'SPECIAL READY',
  paused: '一時停止',
  resume: 'つづける',
  quit: 'タイトルへ',
  gameOver: 'ゲームオーバー',
  destroyed: 'こわした建物',
  maxCombo: '最大コンボ',
  newRecord: 'ハイスコア更新!',
  restart: 'もう一度',
  hint1: '← → で動いて、ひびの入った所を攻撃しよう!(Z)',
  hint2: '弱点を1か所こわすだけで、その階全体がくずれます。',
  hint3: '↑ ジャンプ + ↓ ガードでコンボ維持 / X 必殺技',
  keyGuide: '← → 移動 · ↑ ジャンプ · ↓ ガード · Z 攻撃 · X 必殺技 · Esc 一時停止 · M ミュート',
  rotate: '横向きにすると広く見られます',
  floors: '階',
};

const zh: Record<Key, string> = {
  subtitle: '摧毁大楼',
  start: '开始游戏',
  help: '操作说明',
  soundOn: '声音 开',
  soundOff: '声音 关',
  language: '语言',
  best: '最高分',
  bestCombo: '最高连击',
  move: '换车道',
  jump: '跳跃',
  guard: '防御',
  attack: '攻击',
  special: '必杀技',
  pause: '暂停',
  mute: '静音',
  helpTitle: '操作与规则',
  rule1: '最底层的<b>左、中、右</b>只要有一处被打碎，<b>整层</b>都会塌掉。刀必须<b>真正碰到</b>底面才算命中，离得远挥刀只会挥空!',
  rule2: '<b class="weak">有裂缝的地方</b>打 1 下，普通墙 2 下，<b class="hard">金框钢板</b> 3 下。看建筑下方的标记，移动到弱的车道。',
  rule3: '建筑压到头上会失去一颗心。按住 ↓，碰到刀的瞬间一定能挡住(<b>无限次</b>)。<b>地面防御</b>推得远但会断连击；<b>空中防御</b>(跳起时按 ↓)推得少但能保住连击。',
  rule4: '命中会积累必杀技能量，满了按 <b>X</b> 摧毁整栋建筑。摧毁得越多，建筑越高、落得越快。',
  showTutorial: '再次显示新手提示',
  showHp: '用数字显示车道耐久(无障碍)',
  effectsLow: '低特效(关闭画面震动、减少碎片)',
  ok: '确定',
  score: '分数',
  combo: '连击',
  next: '下一个',
  specialReady: 'SPECIAL READY',
  paused: '暂停',
  resume: '继续',
  quit: '返回标题',
  gameOver: '游戏结束',
  destroyed: '摧毁的建筑',
  maxCombo: '最高连击',
  newRecord: '刷新最高纪录!',
  restart: '再玩一次',
  hint1: '用 ← → 移动，攻击有裂缝的地方!(Z)',
  hint2: '只要打碎一个弱点，整层都会塌掉。',
  hint3: '↑ 跳跃 + ↓ 防御保住连击 / X 必杀技',
  keyGuide: '← → 移动 · ↑ 跳跃 · ↓ 防御 · Z 攻击 · X 必杀技 · Esc 暂停 · M 静音',
  rotate: '横屏可以看得更宽',
  floors: '层',
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
