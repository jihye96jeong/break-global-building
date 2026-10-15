# WORLD BREAKER — 세계 랜드마크 부수기

> **Claude Code 전달용 MVP 구현 명세서 / v1.0 / 2026-10-15**  
> 한 페이지 HTML5 2D 아케이드 액션 · 모바일 우선 · 데스크톱 지원 · xAI는 **개발 시 에셋 생성에만** 사용  
> 이 문서는 구현 지시서다. 기능 설명이나 목업만 만들지 말고, 실제 조작·파괴·게임오버·다음 스테이지까지 동작하는 앱을 완성할 것.

---

## 0. 최우선 불변 조건 (반드시 지킬 것)

1. **게임을 플레이할 때 xAI API를 호출하지 않는다.** 이미지 생성은 개발/에셋 제작 단계에서만 수행한다. 게임 런타임과 production 빌드에는 API 키, xAI SDK, 이미지 생성 fetch, 외부 생성 URL이 존재하면 안 된다.
2. xAI API로 **실제 사용할** 세계 랜드마크 건물 원화, 배경, 주인공 캐릭터를 제작한다. 생성 결과를 저장·정리하여 `public/assets/`에 포함한다. 단순히 xAI 호출 코드만 만들어두고 임시 도형으로 게임을 완성했다고 주장하지 않는다.
3. **싱글 페이지**: `index.html`에서 메뉴/플레이/일시정지/게임오버/스테이지 결과를 모두 전환한다. 페이지 이동 없음, 로그인 없음, 서버 없음, DB 없음.
4. **진짜 게임플레이**가 우선이다. 타격 반응, 건물의 부분 파괴, 잔해 낙하, 점수 증가, 3개 목숨, 필살기, 스테이지 이동은 실제 상태 기반으로 구현한다. 하드코딩한 영상/가짜 파괴 애니메이션으로 대체하지 않는다.
5. 모바일 터치와 데스크톱 키보드 양쪽에서 플레이 가능해야 한다. 랜드마크가 바뀌어도 파괴 시스템은 재사용한다.
6. 첨부된 3장의 옛날 「건물 부수기」 이미지에서는 **경쾌한 타격감, 하늘 위 건물, 작은 캐릭터, 하트와 점수 HUD, 속도감 있는 붕괴 연출**만 참고한다. 원본 스프라이트·UI·텍스트·배경을 그대로 베끼지 말고 독자적인 아트를 만든다.
8. 에셋 생성에 사용할 API 키가 없으면 `.env` 설정을 요청하고 해당 단계가 미완료임을 분명히 표시한다. 사용자의 키를 웹 클라이언트에 넣거나 로그에 출력하지 않는다.

참고 원본 이미지는 함께 전달된 `references/reference_01.png`, `reference_02.png`, `reference_03.png`에 포함되어 있다. 원본의 감각과 조작 재미를 해석하되 이미지 자체를 게임에 사용하지 말 것.

### 범위 구분

- **MVP 필수(P0)**: 실제 xAI 생성/로컬 저장 파이프라인, 플레이 가능한 8개 랜드마크, 각 배경, 한 명의 캐릭터, 건물 부분 파괴 및 잔해, 목숨 3, 점수, 필살기, 스테이지 진행, 모바일/PC 컨트롤, 사운드, 게임오버, 최고 점수 로컬 저장.
- **후속(P1)**: 4개 추가 랜드마크, 업적, 선택 가능한 캐릭터, 스킨, 스테이지 선택 월드맵, 고급 물리, 공유 카드, PWA 오프라인 설치.
- **제외**: 멀티플레이, 계정, 결제, 광고, AI 채팅, 런타임 이미지 생성, 분석 서버, 랭킹 서버, 3D 엔진.

---

## 1. 게임 콘셉트

**제목:** WORLD BREAKER (서브타이틀: 세계 건물 부수기)  
**장르:** 2D 아케이드 파괴 액션 / 점수 경쟁 / 월드투어  
**핵심 재미:** 공격 버튼을 누를 때마다 눈앞의 랜드마크가 진짜로 조금씩 부서지고, 파편이 쏟아지고, 콤보가 터지고, 필살기 게이지가 채워진다. 100%가 되면 한 번의 기술로 남은 건물을 통째로 붕괴시킨다.

### 30초 플레이 루프

1. 화면 중앙에 세계적인 랜드마크가 나타난다. 예: 서울 경복궁.
2. 건물 아래의 주인공이 좌우로 이동하며 공격한다.
3. 공격 위치에 가까운 **건물 파괴 구역**이 깨지고 `+100`, `2 COMBO` 등 점수가 뜬다.
4. 벽돌·기왓장·유리·철골 조각이 떨어지며 일부는 위험한 낙하물이다. 피하지 못하면 하트가 하나 줄어든다.
5. 공격이 성공할 때 필살기 게이지가 올라간다. 100%가 되면 `BREAK!`가 활성화된다.
6. 필살기를 사용하면 **아직 남은** 랜드마크의 구역들을 연쇄적으로 전부 파괴한다.
7. 건물을 완전히 부수면 클리어 → 보너스 점수 → 다음 랜드마크. 목숨 0이면 게임오버. 최고점 갱신 시 강조.

**중요:** 이 게임은 실제 폭력이나 재난 시뮬레이터가 아니라, 현실과 무관한 만화풍 장난감 랜드마크를 부수는 판타지 아케이드 게임이다. 사람/부상자/테러/실제 재난을 묘사하지 않는다.

---

## 2. 화면 구성 — 단일 HTML 페이지

### 2.1 디자인 방향

- 레트로 플래시 게임의 손맛 + 현대적이고 깔끔한 모바일 게임 UI.
- 생기 있는 파스텔 하늘색, 도시별 다른 하늘/원경, 굵고 단정한 윤곽선, 산뜻한 셀 셰이딩.
- 건물은 실루엣만 보고도 알아볼 수 있어야 한다. 디테일을 지나치게 복잡하게 만들지 않는다.
- 과도한 카드형 웹사이트/랜딩페이지처럼 만들지 않는다. 화면의 70% 이상은 **실제 게임 장면**.
- 랜드마크/배경/캐릭터는 제작 단계 xAI 원화 사용. 점수, 하트, 게이지, 버튼은 HTML/CSS/Canvas로 선명하게 그린다.
- 모든 UI 텍스트 기본 한국어. 랜드마크 아래 작은 영문 표기는 허용.

### 2.2 게임 화면 와이어프레임 (가상 좌표 480×800)

```text
┌────────────────────────────────────┐
│ ♡ ♡ ♡    STAGE 03       00124500 │  HUD 상단
│              PARIS                 │
│                                    │
│       구름 / 도시별 배경            │
│               ▲                    │
│               │                    │
│          [에펠탑 원화]              │
│          [부술 수 있는]             │
│          [실제 파편 셀]             │
│        +100   3 COMBO!             │
│                                    │
│           ↗ 충격 이펙트            │
│        ─── 👤 주인공 ───           │  캐릭터 + 지면
│                                    │
│  SUPER  ███████░░░  75%           │  필살기 게이지
│                                    │
│ [ ◀ ] [ ▶ ]   [공격]  [BREAK!]     │  모바일 터치 컨트롤
└────────────────────────────────────┘
```

- 위 내용은 배치 설명일 뿐. 모바일 실기기에서 안전 영역(safe area)을 반영해 최적화한다.
- 내부 논리 좌표계 `480 × 800`, CSS로 전체 화면에 **contain 방식의 비율 유지**. 9:16 전후 세로 화면 우선.
- 데스크톱에서는 게임 영역을 최대 560px 폭으로 중앙 정렬하며, 주변은 배경과 어울리는 매트 처리. 가로로 늘어져 게임이 찌그러지면 안 된다.
- HUD는 Canvas 또는 DOM 오버레이 중 성능/가독성에 유리한 쪽으로 구현하되 터치 목표 48px 이상.
- 모바일 브라우저 하단 바, 노치, 스크롤 방지, `touch-action: none`(게임 입력 영역 한정), 포인터 취소 대응.
- 세로/가로 회전 시 논리 상태 유지. 가로 화면에서는 조작 가능한 레터박스 또는 회전 안내 표시.

### 2.3 단일 페이지 내 UI 상태

`TITLE → STAGE_INTRO → PLAYING → STAGE_CLEAR → STAGE_INTRO ... → GAME_OVER`

별도 `PAUSED` 오버레이. `TITLE`에는 타이틀 아트, `게임 시작`, `조작 방법`, 사운드 on/off. `STAGE_INTRO`는 1.2초 정도 랜드마크 이름을 시원하게 보여주고 바로 시작. `STAGE_CLEAR`는 이번 스테이지 점수·보너스·다음 장소를 짧게 보여주며 탭 또는 자동 진행(2초). `GAME_OVER`는 총점, 도달한 스테이지, 최고 기록, 다시 시작.

초기 진입 시 불필요한 로딩/온보딩을 길게 보여주지 않는다. `게임 시작` 클릭 뒤 즉시 움직여야 한다.

---

## 3. 건물/스테이지 구성

### 3.1 P0 우선 구현할 8개 스테이지

| 순서 | 표시 이름 | 위치 | 특징 / 파괴 패턴 | 생성 파일 ID |
|---|---|---|---|---|
| 1 | 경복궁 근정전 | 서울, 한국 | 넓고 여러 층의 기와지붕; 기와 파편과 목재 잔해 | `gyeongbokgung` |
| 2 | 롯데월드타워 | 서울, 한국 | 길고 가는 마천루; 유리 깨짐 | `lotte_world_tower` |
| 3 | 도쿄 타워 | 도쿄, 일본 | 붉은 철골 격자; 격자와 볼트 파편 | `tokyo_tower` |
| 4 | 에펠탑 | 파리, 프랑스 | 철제 골조; 크로스빔 붕괴 | `eiffel_tower` |
| 5 | 빅 벤(엘리자베스 타워) | 런던, 영국 | 시계탑; 종과 시계 장식 잔해(만화풍) | `big_ben` |
| 6 | 콜로세움 | 로마, 이탈리아 | 넓은 아치형 건축물; 돌과 아치 파편 | `colosseum` |
| 7 | 타지마할 | 아그라, 인도 | 중앙 돔과 좌우 미나렛; 대리석 파편 | `taj_mahal` |
| 8 | 부르즈 할리파 | 두바이, UAE | 매우 높은 최종 스테이지; 단계별 연쇄 붕괴 | `burj_khalifa` |

### 3.2 P1 데이터만 미리 예약할 4개

- `sydney_opera_house` — 시드니 오페라하우스, 호주
- `statue_of_liberty` — 자유의 여신상, 미국
- `leaning_tower_pisa` — 피사의 사탑, 이탈리아
- `taipei_101` — 타이베이 101, 대만

P0는 8개 **실제로 생성·렌더링·클리어 가능**해야 한다. 남은 4개는 설정 구조만 만들어 확장 가능하게 한다. 에셋이 없는 P1 스테이지는 스테이지 순환에 넣지 않는다.

### 3.3 각 스테이지 데이터 스키마 (예시)

```ts
interface StageConfig {
  id: string;
  nameKo: string;
  nameEn: string;
  city: string;
  buildingSrc: string;       // 완성형 건물, 투명 배경
  backgroundSrc: string;     // 건물이 없는 원경
  groundSrc?: string;
  aspect: 'wide' | 'normal' | 'tall';
  spriteBounds: { x: number; y: number; width: number; height: number };
  breakGrid: { cols: number; rows: number; hpPerTile: number };
  debris: 'roof' | 'glass' | 'steel' | 'stone' | 'marble';
  hazardRate: number;        // 0 ~ 1, 실제 위험한 잔해 비율
  scoreMultiplier: number;
  backgroundTint?: string;
}
```

*가상의 실제 건축물 크기와 게임 내 HP가 1:1로 비례할 필요는 없다.* 넓은 랜드마크는 가로 파괴 영역을 많게, 높은 랜드마크는 세로 영역을 많게 둔다. 모든 스테이지의 체감 플레이 시간은 약 20~60초를 목표로 초기 밸런스를 맞춘다(실제 게임 결과 보고 조정).

**기본 그리드 제안:** 넓은 건물 9열×5행, 보통 7열×7행, 긴 타워 5열×12행. 단, 투명 영역만 차지하는 셀은 제외하고 실제 아트 픽셀이 일정 비율 이상 존재하는 셀만 파괴 가능한 구역으로 인정한다. 유효 셀 수가 25개 미만이면 그리드를 자동으로 촘촘하게 조정하거나 수동 메타데이터로 보정한다.

---

## 4. 주인공 조작과 공격

### 4.1 입력

| 행동 | PC | 모바일 |
|---|---|---|
| 좌우 이동 | `A / D` 또는 `← / →` | 좌/우 버튼을 누르고 있기 |
| 일반 공격 | `Space` 또는 `J` | 큼직한 `공격` 버튼 |
| 필살기 | `K` | 게이지 100% 때 활성화되는 `BREAK!` 버튼 |
| 일시 정지 | `Esc` 또는 `P` | 화면 우상단 `Ⅱ` |

- 공격 버튼은 연타/누르고 있기 모두 지원. 눌러둔 동안 쿨다운마다 반복 공격.
- `keydown` 반복 처리로 1프레임에 중복 공격하지 말 것. 키와 터치 `pointerdown`/`pointerup` 상태를 입력 매니저에서 통합한다.
- 기본 플레이어는 지면에 서 있고, 이동하면서 목표 건물 열(column)을 고른다.
- 공격 시 캐릭터가 **짧게 튀어 올라 베거나 주먹을 휘두르고**, 타격 궤적이 건물 쪽으로 날아간다. 공격이 최상단까지 닿는 이유는 스타일화된 아케이드 충격파이므로 현실적인 점프 높이를 구현할 필요는 없다.
- 공격 목표: 플레이어 수평 좌표에서 가장 가까운 `intact` 타일 중 `|tile.centerX - hero.x| ≤ 85`인 것을 고른다. 같은 거리에 여러 개면 **가장 아래의 타일**부터. 없다면 타격 실패 피드백(짧은 휙 모션)만 주고 점수/게이지 증가 없음.
- 캐릭터 이동 범위는 건물 양끝에 약간의 마진을 더한 구간으로 제한한다.

### 4.2 수치 기본값 (실제 플레이 테스트 후 데이터에서 튜닝)

```ts
const GAME_CONFIG = {
  maxLives: 3,
  playerSpeed: 255,         // logical px/sec
  attackCooldownMs: 175,
  attackRangeX: 85,
  tileBaseHP: 1,
  successfulHitScore: 100, // 타일 하나 파괴할 때 기본 점수
  damageOnlyScore: 20,    // HP>1 타일에 균열만 냈을 때
  ultimateGainPerHit: 8,  // 실제 타격 적중 시 8%
  ultimateMax: 100,
  invulnerabilityMs: 1250,
  comboWindowMs: 1500,
  maxComboMultiplier: 3,
  clearBonus: 1200,
};
```

- 타격 자체가 실패하면 `+0`.
- 성공한 타격마다 게이지 +8(최대 100). HP가 2 이상인 타일은 맞을 때마다 게이지가 오르지만 최종 파괴 점수는 실제 파괴 시만 크게 부여한다.
- 연속 타격 간격 1.5초 미만이면 콤보 누적. 배수 `min(1 + floor((combo-1)/4)*0.25, 3)`.
- 연속 콤보가 끊기면 표시만 리셋. 게이지는 유지.
- 각 스테이지에서 피격 위험을 올리되, 첫 스테이지 **첫 8초는 위험 잔해를 생성하지 않고 튜토리얼**을 진행한다.
- 목숨은 기본 3개로 시작하고 스테이지 진행 시 그대로 유지. 게임오버 외 강제 회복 없음(추후 밸런스 필요 시 스테이지 4 클리어 후 회복 한 번 허용하는 설정 가능, P0 기본 비활성).

---

## 5. 핵심 구현: 이미지 기반 실시간 건물 파괴

**이 부분이 게임의 가장 중요한 구현 과제다. 한 장의 AI 건물 이미지를 단순히 알파값 낮춰 사라지게 만드는 구현은 금지한다.**

### 5.1 원본 에셋 입력

xAI에서 생성한 건물 원화 1장을 개발 단계에서 후처리하여 **투명 배경 이미지(WebP 또는 PNG)** 로 저장한다. 건물 전체가 온전히 보이되, 뒤 배경/하늘은 포함하지 않는다. 배경 이미지는 별도 파일이며 **랜드마크가 들어 있으면 안 된다.**

예: `public/assets/buildings/eiffel_tower.webp`, `public/assets/backgrounds/eiffel_tower.webp`.

### 5.2 건물 파괴 구역 자동 분할

- 스테이지 설정에 따라 건물의 실제 visible bounding box를 기준으로 cols × rows 그리드 생성.
- 원본 이미지 픽셀은 그대로 유지하면서 그리드별 **조각에 해당하는 클리핑 영역**만 렌더링한다. 정상 상태에서는 모든 조각이 빈틈없이 합쳐져 원본 건물 1장처럼 보여야 한다.
- 가능하면 완전 직사각형 컷 대신 **이웃한 셀과 공유되는 경계점을 가진 톱니형/지그재그 분할선**을 사전 생성한다. 이웃하는 두 조각이 정확히 같은 경계를 공유하므로 원본 이미지를 붙였을 때 틈이 없고, 떨어질 때만 부서진 느낌을 얻는다.
- 건물 투명 영역(시계탑 바깥, 에펠탑 골조 사이 등)은 원본 이미지의 알파값을 유지한다. 100% 투명한 셀은 `inactive`로 생략.
- 같은 이미지가 바닥이나 배경 레이어에 중복 그려져 **파괴했는데도 건물이 남아 보이는 고스트 현상**이 절대 없어야 한다.
- 원본에 이미 있는 구름이나 지면이 파괴 셀에 포함되는 문제가 없도록 에셋 QA가 선행되어야 한다.

### 5.3 타격 시 파괴 단계

1. 플레이어 입력 → 목표 셀 선택.
2. **히트스톱 40~60ms**: 게임 캐릭터/건물 모션만 잠깐 정지. 입력 대기나 앱 전체 프리징 아님.
3. 하얀 타격 플래시 + 작은 화면 흔들림(3~6px / 100ms) + 타격음.
4. 해당 셀 HP 감소. HP가 남으면 검은 균열 선/붉은 테두리 등 짧은 파손 오버레이.
5. HP 0이면 셀을 `detaching` 처리하여 건물에서 분리, **원래 픽셀 모양의 조각**이 회전·낙하·페이드. 크기 큰 타일도 내부에 작은 파편 3~6개 추가 생성.
6. 해당 위치에 **실제 구멍**이 생겨 뒤의 하늘/원경이 보인다.
7. `+100`, 콤보, 슈퍼 게이지가 모두 올바르게 증가한다.
8. 구조 지지 연결 상태를 검사하여 공중에 매달린 큰 구획에 연쇄 붕괴를 적용할 수 있다.

### 5.4 구조 연쇄 붕괴 — 과도한 복잡도 없이

- 아래 지지 셀이 제거되면 위 타일이 바로 통째로 사라지는 게 아니라, 잠시 흔들린 후 떨어진다.
- **MVP 단순 알고리즘:** 아래쪽 지지 열의 유효 셀 중 70% 이상이 제거된 구간의 윗부분을 `unsupported`로 표기하고 250ms 후 연쇄 붕괴. 사라진 구역은 한꺼번에 페이드 금지. 순차적으로 떨어지는 물리 조각 애니메이션.
- 고도화 가능하면 그리드 연결 그래프를 사용하여 바닥에 닿은 연결 요소와 끊긴 요소를 분리해 낙하시킨다. 단, 일격에 90%가 날아가는 초기 밸런스를 막도록 지지점 규칙을 명시적으로 설정.
- 연결 규칙이 잘못되어 타일이 영원히 공중에 떠 있거나, 모든 셀이 사라졌는데 클리어가 안 되는 버그는 없어야 한다.

### 5.5 낙하 파편과 위험 잔해

- 비주얼 파편: 떨어지는 파괴 조각의 일부를 아트 조각으로 표시. 중력 `g≈900px/s²`, 속도/회전은 시드 랜덤으로 다양하게. 지면 착지 시 먼지 파티클과 작은 바운스 후 제거.
- 위험 잔해: 일부 파편은 붉은 빛나는 외곽선 또는 바닥의 작은 예고 표시가 있는 **충돌 가능한 별도 객체**. 모든 파편이 대미지를 주면 불합리하므로 명확히 구분.
- 스테이지 1은 위험 잔해 약 8%, 스테이지 8은 약 22% 수준으로 조정.
- 위험 잔해와 캐릭터 충돌 시 체력 `-1`, 약 1.25초 무적(캐릭터 점멸), 피격음 + 짧은 넉백.
- 체력 0이면 남은 파편 애니메이션을 정리한 뒤 GAME_OVER로 진입.
- 캐릭터가 피하기 불가능한 즉시 생성/즉시 피격은 금지한다. 낙하 궤적과 떨어지는 시간을 시각적으로 읽을 수 있어야 한다.
- 파편 수 상한: 화면 내 동시에 살아 있는 **시각 파편 100개**, 위험 잔해 12개. 오래된 파편부터 정리. 오브젝트 풀 사용 권장.

### 5.6 클리어 판정

- `intact + damaged + detaching + unsupported` 중 **건물을 이루는 활성 정적 타일**이 0이 되면 클리어. 낙하 중 장식 잔해 때문에 클리어가 영원히 지연되면 안 된다.
- 파괴된 타일은 점수를 정확히 한 번만 준다. 연쇄 붕괴로 파괴된 타일에도 정해진 보너스(예: 40점/셀) 적용.
- 클리어 화면 진입 후 공격이나 필살기가 다시 입력되어 점수가 중복되는 현상 금지.

### 5.7 복잡한 랜드마크 형태별 대응

- **에펠탑/도쿄타워**: 구멍이 많은 원화. alpha-aware 분할과 디테일 유지 필수.
- **경복궁/콜로세움/타지마할**: 넓은 실루엣. 크로핑 및 화면 안쪽 배치 필요.
- **롯데월드타워/부르즈 할리파**: 세로로 높음. 이미지가 잘려 보이지 않도록 건물 상단 HUD 아래에서 시작하고 화면 바닥과 만날 것.
- 특수 건물을 위해 별도 엔진을 만들지 않는다. `StageConfig`와 분할 마스크/이미지로 구분한다.

---

## 6. 필살기 — FULL BREAK

### 6.1 게이지

- HUD에 `SUPER` 또는 `BREAK` 이름과 0~100% 게이지 표시.
- 실제 유효한 타격마다 +8%; 빈 공간 공격에는 충전 안 됨.
- 100%가 되면 게이지 번쩍임, 전용 사운드, `BREAK!` 버튼 강조. 버튼을 누르거나 PC에서 `K` 키.
- 스테이지 시작 시 게이지는 **유지**된다. 사용 후 0으로 리셋. 게임오버/새 게임에서는 0.

### 6.2 시전 연출 (총 약 1.5~2.3초)

1. 입력 잠금(중복 발동 방지). 캐릭터 크게 점프하거나 힘을 모으는 포즈.
2. 화면 채도 잠깐 낮아지고 200ms 긴장감 있는 정적 + 공격 중심에 에너지 원.
3. 큰 `FULL BREAK!` 텍스트와 함께 강한 광선/충격파가 건물 바닥에서 꼭대기로 관통.
4. 남은 모든 `intact/damaged` 구역을 약 500~900ms 동안 **아래에서 위로 또는 중심에서 바깥으로** 시차를 두어 분해.
5. 시각 파편, 먼지, 흔들림과 합성 효과. 화면 흔들림은 접근성 설정/`prefers-reduced-motion` 고려.
6. 필살기로 소멸한 각 **잔존 타일**에 예: 50점 보너스. 이미 부순 셀은 중복 점수 불가.
7. 잔여 파괴 구역 0 → 클리어. 기술 연출 도중 위험 잔해가 캐릭터를 치지 않도록 무적 상태 부여.

**반드시 실제 분할된 건물 조각이 파괴되어야 한다.** 화면 하얗게 플래시 후 건물 전체를 숨기는 트릭만으로 구현하지 않는다.

---

## 7. 점수/HUD/난이도

### 7.1 점수

```text
기본 타일 파괴         +100 × 콤보 배수 × 스테이지 점수 배수
HP 감소만 시킴        +20  (선택, 중복 점수 제한)
구조 연쇄 붕괴         +40 × 타일 수 × 스테이지 배수
필살기 잔존 타일      +50 × 타일 수 × 스테이지 배수
스테이지 클리어       +1,200 × 스테이지 배수
노데미지 보너스       +500
```

- 모두 정수 점수. 실제 부쉈을 때 마다 `+100` 같은 팝업이 표적 근처에서 위로 솟아올랐다 사라진다.
- 상단 우측 점수는 8자리 `00001234`처럼 구형 아케이드 느낌. 증가 시 숫자 튀는 연출.
- 4연속, 8연속, 12연속 성공 때마다 콤보 강조. 초보자에게 불쾌감을 주는 실패 페널티 금지.
- `localStorage`에 `world-breaker-best-score`, `world-breaker-sound-enabled`만 필수 저장. 새로고침 후 최고 기록 유지.

### 7.2 생명력

- 화면 좌상단 하트 3개: 꽉 찬 하트/빈 하트로 표시.
- 한 번 피격 시 하나씩만 감소하고 피격 중복 방지.
- 게임오버 시 `이번 점수`, `최고 기록`, `도달 스테이지`, `다시 시작` 버튼.

### 7.3 난이도 기초값

| 스테이지 | 체감 포인트 | 위험 잔해 비율 | 타일 HP 가이드 |
|---|---|---:|---|
| 1 | 튜토리얼, 손맛 학습 | 8% (첫 8초 0%) | 주로 1 |
| 2~3 | 파편 회피 학습 | 10~12% | 주로 1 |
| 4~5 | 조금 더 빠른 연속 타격 | 13~16% | 일부 2 |
| 6~7 | 콤보와 회피 중요 | 17~20% | 일부 2 |
| 8 | 최종 대형 붕괴 | 22% | 일부 2 |

- P0는 진행할수록 무조건 타일 수만 늘리는 것보다 **붕괴 패턴과 위험 잔해**로 난이도 차이를 만든다.
- 데스크톱 기준 60fps, 모바일 보급형 기준 체감 30fps 이상 목표. 중요한 건 물리/타격이 프레임 수와 독립적인 것.

---

## 8. xAI API — 개발 시에만 쓰는 에셋 생성 파이프라인 (필수)

### 8.1 설계 원칙

```text
                    [개발 / 아트 제작 단계에서만]
개발자 → npm run assets:generate → 로컬 Node 스크립트
                   → xAI Grok Imagine Image API
                   → 생성 이미지 다운로드 또는 base64 저장
                   → 배경 제거 / 리사이즈 / QA / 최적화
                   → public/assets/**/*.webp
                   → 에셋 매니페스트 / 크레딧 기록

                    [배포된 실제 플레이]
사용자 브라우저 → index.html / JS / CSS / 로컬 정적 에셋
               → Canvas 파괴 엔진 / 충돌 / 점수 / 사운드
               → 외부 AI API 요청: 정확히 0회
```

- 개발 도구로만 xAI를 사용한다. `npm run dev`, `npm run build`, `npm run preview`, 실제 게임 스타트, 스테이지 로딩에서는 에셋 생성 스크립트를 **절대 자동 실행하지 않는다**.
- `.env`의 `XAI_API_KEY`는 Node 전용이며 `VITE_` 접두사 금지. `index.html`, `src/`, dist 번들에 키를 싣지 말 것.
- 에셋은 공개 가능한 정적 이미지로만 배포하고, **xAI 응답 URL을 src로 사용하지 않는다.** 이미지 URL은 만료될 수 있다.
- 실제 플레이 통신은 정적 HTML/CSS/JS/WebP/SFX 파일 로드(선택적으로 서비스워커 캐시)만 허용. 광고/로그인/분석/외부 폰트/CDN 없음.

### 8.2 확인된 API 사양

- Base URL: `https://api.x.ai/v1`
- Image generation: `POST /images/generations`
- Image editing(일관성 보정에만 필요 시): `POST /images/edits`
- 모델: **`grok-imagine-image-2.0`**
- 인증: 서버/로컬 개발 스크립트의 `Authorization: Bearer $XAI_API_KEY`
- 사용 가능 주요 옵션: `aspect_ratio`, `resolution` (`1k`/`2k`), `quality` (`low`/`medium`/`auto`), `response_format` (`b64_json` 등).
- 권장: 캐릭터/배경 초안 `1k`, 건물 디테일이 필요할 때 `2k` + `medium` 선택. 먼저 `1k/low` 샘플 3개로 스타일 확인 후 본 생성.
- API 반환 이미지가 base64이면 로컬 파일로 디코딩 저장. URL이면 **즉시 로컬 다운로드**. 저장을 확인한 뒤 파일을 최적화.
- 모델 이름/지원 옵션이 바뀌었을 경우 공식 문서 재확인 후 README에 기록하고 안전하게 업데이트.
- 공식 문서: https://docs.x.ai/developers/model-capabilities/images/generation
- 프롬프트 가이드: https://docs.x.ai/developers/model-capabilities/images/prompting-guide

### 8.3 빌드타임 이미지 생성 스크립트 인터페이스

```bash
# 최초 설치 (런타임 앱 종속성이 아닌 개발 의존성)
npm install
cp .env.example .env
# .env에 XAI_API_KEY=... 설정 후

# 전체 생성이 아닌 3개 샘플만 먼저 만들어 외관을 검수
npm run assets:generate -- --sample

# 검수한 스타일로 필요한 자산 생성 (기존 결과 재사용)
npm run assets:generate -- --all

# 특정 실패 항목만 재생성
npm run assets:generate -- --id=eiffel_tower --type=building --force

# 이미지 포스트프로세싱 / 품질검증
npm run assets:process
npm run assets:validate
```

- `--sample`: 경복궁 건물 1개, 서울 배경 1개, 주인공 기본 포즈 1개.
- `--all`: P0 8개 건물+8개 배경+캐릭터 최소 3포즈. 총 19개 원화 **첫 시도**. 필요 시 추가 편집/교체는 개별 단위.
- 각 요청마다 작업 ID, 프롬프트, 모델, 생성 시각, 저장 위치, 이미지 규격, 성공 여부를 `assets-manifest.json`에 기록. API 키/토큰 절대 기록 금지.
- 생성 결과 파일이 이미 존재하면 덮어쓰지 않는다(명시적 `--force`만 허용). 실패 시 자동 재시도는 **최대 2회**, backoff, 예산 상한과 초과 시 중단.
- Node 단독 실행이 가능해야 하며 브라우저 코드를 import하지 않는다.
- `.env.example`은 `XAI_API_KEY=` 빈 문자열만 포함하고 `.env`는 `.gitignore`로 차단.

### 8.4 구현 예시 (Claude Code가 실제 스크립트에 반영)

```js
// scripts/example-generate-one.mjs  (설명용: 실제로는 공통 생성기 작성)
// Node 20+ / dotenv 또는 --env-file 사용 / 브라우저에서 실행 금지
import 'dotenv/config';
import fs from 'node:fs/promises';

if (!process.env.XAI_API_KEY) {
  throw new Error('Missing XAI_API_KEY in local .env');
}
const res = await fetch('https://api.x.ai/v1/images/generations', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'grok-imagine-image-2.0',
    prompt: 'Original retro 2D arcade art of a single recognizable palace building, centered front view, solid chroma key magenta background, no text',
    aspect_ratio: '3:2',
    resolution: '1k',
    quality: 'low',
    response_format: 'b64_json',
    n: 1,
  }),
});
if (!res.ok) throw new Error(`xAI request failed: HTTP ${res.status}`);
const data = await res.json();
const bytes = Buffer.from(data.data[0].b64_json, 'base64');
await fs.mkdir('art-source', { recursive: true });
await fs.writeFile('art-source/palace-sample.png', bytes);
```

> 실제 생성 스크립트는 실패 응답 형식, MIME, 유효 파일 검사, rate limit, 에셋 매니페스트, 비용 상한, 로컬 파일 재사용을 처리해야 한다. xAI가 JPEG를 반환한 경우 PNG 확장자를 강제로 붙이지 말고 응답 MIME 또는 파일 매직 바이트를 확인한 후 적절하게 저장/변환한다.

### 8.5 xAI 프롬프트 — 공통 아트 디렉션

**STYLE ANCHOR** (모든 건물/배경/캐릭터 프롬프트에 의미를 유지하며 사용)

```text
Original 2D side-view arcade game illustration, joyful early-2000s browser-game energy,
clean thick dark outlines, expressive shapes, flat cel-shaded colors with subtle highlights,
crisp readable silhouette, painterly charm but no photorealism, no 3D render,
no realistic disaster, no injuries, no people, no weapons, no logos, no UI,
no captions, no words, consistent visual style across a world-tour game.
```

**건물 원화 생성 템플릿**

```text
[STYLE ANCHOR]
A SINGLE iconic, instantly recognizable [LANDMARK NAME] in [CITY, COUNTRY].
Show the complete landmark from its base to its highest point, full front-facing or
slightly elevated orthographic game view, all architectural parts visible,
centered with generous clean margins and a clearly readable silhouette.
This is a clean isolated building SPRITE intended for procedural destruction.
Solid flat vivid magenta (#FF00FF) chroma key studio background, uniform color,
no gradient, no clouds, no scenery, no ground, no cast shadow,
no adjacent buildings, no text, no watermark, no floating objects.
Keep the building recognizable and coherent, simplified into colorful arcade shapes.
```

- 넓은 건물: `aspect_ratio: '3:2'` 또는 `4:3`.
- 타워: `aspect_ratio: '2:3'` 또는 `1:2`.
- 랜드마크 특유의 형태와 지붕/돔/아치/철골 등 필수 디테일을 장소별로 추가.
- 이미지 모델이 `#FF00FF` 완전 단색을 항상 지킨다고 **가정하면 안 된다.** 생성 결과 QA에서 외곽 분리 결과를 확인해야 한다.

**배경 생성 템플릿**

```text
[STYLE ANCHOR]
A colorful illustrated atmospheric background for an arcade game stage set in [CITY].
Soft layered sky, distant scenery and subtle local atmosphere characteristic of the city.
The CENTER must stay visually quiet and mostly empty for a foreground landmark sprite.
Absolutely DO NOT include [LANDMARK NAME] or any dominant landmark in the scene.
Background plate only, no foreground character, no interface, no text, no watermark.
Vertical mobile composition, 9:16, with readable foreground separation.
```

- 배경은 건물이 제거될 때 뒤에 건물의 흔적이 나타나지 않아야 한다.
- 경복궁/서울: 하늘과 멀리 산 형태. 파리: 연한 하늘과 낮은 원경. 두바이: 밝은 사막빛 하늘과 현대도시 원경. 단, 해당 랜드마크 자체는 제외.
- 원경의 콘트라스트를 건물보다 약하게 후처리(밝기/채도/블러의 약한 차이).

**캐릭터 생성 템플릿**

```text
[STYLE ANCHOR]
An original small blue arcade demolition hero, simplified expressive humanoid character,
large clear head, compact torso, distinct arms and legs, bright cobalt-blue costume,
recognizable even at 48 pixels tall, friendly adventurous expression,
full body visible, neutral standing idle pose, plain solid magenta background,
character only, no props, no text, no extra limbs, no shadow.
```

- `hero_idle`, `hero_attack`, `hero_hit` 3개 포즈를 생성. 다른 자세에서 정체성이 변형되면 동일한 idle 원화를 기반으로 **개발 단계 xAI 이미지 편집** 또는 수작업 포즈 리깅을 활용하여 스타일 통일.
- 달리기와 점프는 가능하면 캐릭터 원화/부위 회전/위치 트윈으로 연출. 매 프레임 AI 이미지 생성은 절대 금지.
- 캐릭터를 45~75px 키로 축소해도 형태가 읽혀야 한다.

### 8.6 배경 제거·후처리·QA

1. 건물/캐릭터 원본을 `art-source/`에 저장(소스 아트는 앱에 전부 넣지 않아도 됨).
2. 로컬 Node/Sharp 기반 색상 키잉(Chroma-key)으로 마젠타를 알파 투명 처리. 모델이 마젠타를 제대로 만들지 못하면 **개발 단계에 한해서** 마스크 수동 정리 또는 로컬 세그멘테이션을 사용.
3. 건물 내부 빈 공간(아치, 철골 사이)은 원래 배경색을 제거해 투명하게. 얇은 끝부분에 마젠타 테두리가 남지 않게 edge-decontamination.
4. 실제 콘텐츠 바운딩 박스를 계산하여 과도한 외부 여백 제거. **원본의 건축 형태 비율은 유지**하며 게임 위치 메타데이터 업데이트.
5. 최종 건물/주인공 파일: 투명 WebP (손실 없는 알파 유지). 배경: 압축 WebP. 디테일 손상이 커지면 PNG 허용.
6. `npm run assets:validate`: 파일 존재, 디코딩 가능, 해상도, alpha 채널, 평균 비투명 비율, 바운딩 박스, 총 용량 검사. 이상하면 자동 실패.
7. 가능하면 `art-preview.html` 또는 contact sheet를 생성해 **8개 랜드마크 / 8개 배경 / 캐릭터 포즈를 한 화면에서 확인**하고 잘린 이미지, 오염된 배경, 중복 랜드마크, 색상 편차를 수정.
8. 접근성을 위해 UI 텍스트는 절대 이미지 안에 굽지 않는다. 글자/수치/버튼은 코드로 그린다.

### 8.7 에셋 생성 비용과 중단 조건

- 생성 전 예상 호출 횟수 및 예상 비용을 콘솔에 표시. 첫 샘플이 만족스럽지 않으면 전체 배치 호출 금지.
- `MAX_ASSET_REQUESTS` (기본 30회), `MAX_ASSET_BUDGET_USD` (기본 3달러) 같은 개발 설정을 두고 한도 초과 시 자동 중단. 한도는 임의로 높이지 않는다.
- 최신 가격은 xAI 공식 가격표를 실제 생성 시 확인. 이미지 품질·해상도·이미지 편집 입력 비용에 따라 다를 수 있다.
- **이 비용은 개발/제작 때만 발생하며 유저 플레이 수와 무관하다.**

---

## 9. 기술 스택과 프로젝트 구조

### 9.1 스택

- **HTML5 + CSS + TypeScript + Vite**. React/Next.js 불필요. HTML 단일 페이지에 Canvas 게임 뷰 삽입.
- **Canvas 2D API**로 건물 셀 마스킹/그리기, 캐릭터, 잔해, 충격 이펙트. 정적인 HUD 및 메뉴는 HTML/CSS 오버레이 권장.
- `requestAnimationFrame` 기반 프레임 루프. `dt` clamp + 고정 시뮬레이션 스텝(예: 1/60초) 또는 동등하게 안정적인 delta 설계.
- 브라우저 네이티브 Web Audio API: 히트, 붕괴, 콤보, 필살기, 피격 SFX를 간단한 합성 효과음으로 생성 또는 사전 제작한 로컬 오디오 사용. 재생은 첫 사용자 제스처 후 오디오 컨텍스트 초기화.
- `localStorage` 최고기록·사운드 설정.
- Dev-only: Node 20+, `dotenv`, `sharp`, 테스트 러너 `vitest` 권장. 프로덕션에 xAI 관련 패키지 불포함.
- 에셋 생성 도구가 별도 Node JS라도 런타임 클라이언트 import 경로와 완전히 분리할 것.

### 9.2 권장 폴더

```text
world-breaker/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── .env.example
├── .gitignore
├── README.md
├── public/
│   └── assets/
│       ├── buildings/         # xAI 생성 후 투명화·최적화한 건물
│       ├── backgrounds/       # 랜드마크 없는 도시 배경
│       ├── characters/        # hero_idle/attack/hit
│       ├── fx/                # 필요시 스태틱 VFX 아트
│       └── assets-manifest.json
├── src/
│   ├── main.ts
│   ├── style.css
│   ├── game/
│   │   ├── Game.ts           # 상태 머신, 업데이트 루프
│   │   ├── Renderer.ts       # Canvas 렌더 순서
│   │   ├── InputManager.ts   # PC+Pointer 통합 입력
│   │   ├── Player.ts
│   │   ├── Building.ts        # 핵심: 분할/셀 상태/실제 파괴
│   │   ├── Destruction.ts     # 그리드/연쇄 붕괴/포인트
│   │   ├── Debris.ts
│   │   ├── Ultimate.ts
│   │   ├── Particles.ts
│   │   ├── AudioManager.ts
│   │   ├── StageManager.ts
│   │   ├── StageConfigs.ts
│   │   ├── ScoreManager.ts
│   │   └── types.ts
│   └── ui/
│       ├── HUD.ts
│       ├── Overlay.ts
│       └── TouchControls.ts
├── scripts/
│   ├── generate-assets.mjs       # 개발 시에만 xAI 호출
│   ├── prompts.mjs
│   ├── process-assets.mjs
│   ├── validate-assets.mjs
│   └── preview-assets.mjs
├── art-source/                   # 원본 이미지, 배포 제외 가능
├── tests/
│   ├── scoring.test.ts
│   ├── destruction.test.ts
│   └── stage-progress.test.ts
└── references/
    ├── reference_01.png
    ├── reference_02.png
    └── reference_03.png
```

### 9.3 렌더링 순서 (뒤 → 앞)

1. 배경 이미지(하늘/원경, 패럴랙스는 선택)
2. 건물 뒤 먼지/구름 이펙트
3. **원본 건물 원화를 그리드 셀 단위로 그리기** (절대 불투명 원본 건물 전체를 중복으로 그리지 않음)
4. 건물 파괴 파편 + 위험 잔해
5. 플레이어 및 공격 궤적/피격/필살기 이펙트
6. 지면·착지 먼지
7. 점수 팝업/콤보
8. HUD, 컨트롤, 메뉴/오버레이(DOM)

### 9.4 파괴 엔진 타입 예시

```ts
type TileState = 'intact' | 'damaged' | 'detaching' | 'fallen' | 'inactive';

type DestructibleTile = {
  id: string;
  col: number;
  row: number;
  state: TileState;
  hp: number;
  maxHp: number;
  clipPolygon: { x: number; y: number }[]; // 원화의 동일 좌표계
  coverageRatio: number;
  worldX: number;
  worldY: number;
  vx: number;
  vy: number;
  rotation: number;
  angularVelocity: number;
  scored: boolean;
};

interface GameState {
  status: 'TITLE' | 'STAGE_INTRO' | 'PLAYING' | 'PAUSED' | 'STAGE_CLEAR' | 'GAME_OVER';
  lives: number;
  score: number;
  bestScore: number;
  combo: number;
  ultimateGauge: number;
  stageIndex: number;
  tiles: DestructibleTile[];
}
```

**중복 방지:** 모든 타일은 파괴→점수 부여 전환을 단 한 번만 경험한다. 필살기/일반 공격/연쇄붕괴가 같은 프레임에서 충돌할 수 있으므로 `scored` 및 상태 원자적 검사로 처리한다.

---

## 10. 리듬·애니메이션·사운드의 구체적 기준

| 이벤트 | 연출 | 지속 시간(가이드) |
|---|---|---|
| 일반 공격 | 영웅 상체 회전/도약, 파란 충격 궤적 | 120~220ms |
| 공격 적중 | 1프레임 흰 플래시, 히트스톱, 파편 | 40~150ms |
| 타일 파괴 | 실제 타일 이탈 + 3~6개 작은 파편 | 350~1100ms |
| 점수 표시 | `+100` 위로 뜨며 사라짐 | 550~800ms |
| 콤보 | 4콤보마다 크기/살짝 튀는 강조 | 200~350ms |
| 피격 | 하트 감소, 캐릭터 점멸, 짧은 넉백 | 무적 1250ms |
| 필살기 | 차징→타격→건물 전부 붕괴 | 1500~2300ms |
| 클리어 | 남은 파편 낙하→큰 CLEAR 타이포 | 1200~2000ms |

사운드 스타일: 가볍고 중독적인 8비트+아케이드. 공격은 휙, 파괴는 뽀각/와장창, 콤보는 상승 피치, 필살기는 저음 차징 + 큰 붕괴음. 타격 연타 시 소리가 지나치게 겹쳐 깨지지 않도록 오디오 풀/동시 발음 제한. 모바일 무음·재생 권한·백그라운드 탭 전환 대응.

### 성능 및 접근성

- 파괴 셀 마스크를 매 프레임 재계산하지 말 것. 건물별 clip 경로 및 필요한 오프스크린 이미지/조각은 초기화 때 캐시.
- 파편은 수명 기반 제거. 비활성 타일/파편 렌더 생략.
- DPR clamp (예: 최대 2), 화면 크기 축소 시 원본 이미지 리샘플 품질 유지.
- 포커스 유실/탭 숨김(`visibilitychange`) 시 자동 일시 정지.
- `prefers-reduced-motion: reduce` 시 화면 흔들림/강한 섬광/카메라 줌 축소.
- UI 글자·배경 간 명도 대비 확보. 모바일에서 게임 입력/버튼이 서로 가려지지 않도록 점검.

---

## 11. 반드시 구현하는 사용자 흐름 (Acceptance Scenarios)

### A. 첫 시작

1. `npm install && npm run dev`로 로컬에서 앱 실행.
2. 타이틀에 `WORLD BREAKER`, `게임 시작`, 최고 점수(없다면 0), 사운드 토글.
3. 게임 시작 → 스테이지 1 경복궁 배경/투명 원화/주인공이 등장.
4. 화면 상단 목숨 3개, 점수 `00000000`, 필살기 게이지 0%.

### B. 일반 공격과 진짜 파괴

1. `J` 1회 또는 `공격` 터치 → 캐릭터 액션·히트 VFX·SFX.
2. 타격된 지점의 **건물 조각만** 떨어지고, 그 자리에 구멍이 보임.
3. 점수 100(콤보/스테이지 배수 적용 시 조정) 증가하고 게이지 8% 증가.
4. 같은 위치를 계속 치면 다른 남은 구역이 타깃이 되어 건물이 실제로 점점 줄어든다.
5. 좌우 이동 후 공격하면 다른 구역을 파괴한다.
6. 4회 이상 연속 적중 시 콤보와 점수 배수 확인.

### C. 목숨 및 게임오버

1. 위험 잔해 아래로 플레이어를 움직이면 하트 3→2.
2. 무적 시간 내 다른 파편과 충돌해도 하트가 연속 감소하지 않는다.
3. 3번 피격하면 입력 중지 → GAME OVER.
4. `다시 시작` 누르면 스테이지 1부터 목숨 3, 점수 0, 게이지 0. 최고 점수는 유지.

### D. 필살기

1. 정상 타격을 13회 정도 성공시켜 게이지를 100%까지 채운다.
2. `BREAK!` 버튼 또는 `K` → 캐릭터 충전/충격파 → **남아 있던 셀 전부** 순차적으로 붕괴.
3. 필살기 사용 후 게이지 0, 점수 반영, 건물 잔존 조각 0, 중복 파괴 없음.
4. 클리어 화면을 거쳐 다음 랜드마크 이동.

### E. 모든 랜드마크

- 경복궁→롯데월드타워→도쿄 타워→에펠탑→빅 벤→콜로세움→타지마할→부르즈 할리파, 8개를 차례대로 진행할 수 있어야 함.
- 마지막 스테이지 클리어 시 `WORLD CLEARED!` 결과 화면. 게임을 다시 시작할 수 있어야 함.
- 각 건물/배경이 실제로 다른 xAI 생성 결과여야 한다. 텍스트만 바꾼 동일한 건물 이미지 사용 금지.
- 좁고 높은 건물이 HUD 바깥으로 잘리거나, 넓은 건물이 터치 버튼을 가리면 실패.

### F. xAI 호출이 **실제 게임에 0회**인지 확인

1. 개발 중 명시적으로 실행한 `npm run assets:generate`에서만 xAI 요청이 발생하는지 확인.
2. `npm run build` 후 `dist/` 결과에 `XAI_API_KEY` 문자열, `api.x.ai` 호출 주소, `images/generations` API 코드, dev-only generation 모듈이 포함되지 않는지 검사(README에 결과 기록).
3. 브라우저 개발자 도구 Network 탭에서 타이틀 로딩/시작/연타/필살기/8개 스테이지 전환까지 xAI 요청이 **0회**인지 확인.
4. 이미 받아둔 에셋만으로 게임이 실행되는지 검증. xAI 키를 삭제하거나 무효화한 뒤에도 게임 플레이는 정상이어야 한다.
5. 이미지 파일 경로가 xAI 단기 보관 URL이 아니라 앱의 `public/assets/` 로컬 파일 경로인지 확인.

### G. 모바일

- 최소 테스트 뷰포트: `390×844`, `360×800`, `430×932`; 데스크톱 `1366×768`.
- 좌우 버튼을 길게 누르면서 공격 터치 가능(멀티터치). 포인터를 놓으면 무한 이동 멈춤.
- 가상 버튼이 하트/건물/캐릭터를 가리지 않고, 확대/스크롤/텍스트 선택 때문에 게임이 멈추지 않음.
- iOS Safari/Android Chrome에서 소리·입력·레이아웃 정상.

---

## 12. 자동화 테스트 및 QA 계획

**단위 테스트**

- 생명력: 위험 잔해 충돌 시 1 감소, 무적 중 추가 감소 금지, 0 시 게임오버.
- 스코어: 같은 셀을 일반공격·연쇄붕괴·필살기로 동시에 부쉈을 때 한 번만 점수.
- 게이지: 유효 타격 +8, 무효 타격 +0, 상한 100, 필살기 시 0.
- 콤보: 1.5초 타이밍 기준, 최대 배수 제한.
- 파괴: 알파 없는 영역에 빈 셀 생성되지 않음, 타일 제거 시 실제 빈 구역 발생.
- 클리어: 모든 건물 정적 셀 소멸 시 STAGE_CLEAR로 단 한번 전환.
- 스테이지: 8개 순차/마지막 클리어 처리.

**시각/수동 QA**

- 8개 건물 에셋 contact sheet/배경 전환 확인.
- 처음 아무 것도 부수지 않은 상태의 건물이 온전히 연결되어 보여야 함(흰 선/미세 틈 금지).
- 타격 후 구멍이 원본과 일치하고, 비활성 영역에 가짜 조각이 생기지 않아야 함.
- 세로 건물/가로 건물 모두 조각이 자연스럽게 떨어지며 착지 후 메모리 누수 없음.
- 100회 이상 공격해도 화면 흔들림이 누적되거나 프레임이 급락하지 않음.
- 필살기가 발동하는 순간 잠시 흰 화면만 나오는 수준이 아니라 **조각 단위 연쇄붕괴**가 드러나야 함.
- 강제로 `requestAnimationFrame` 저속을 시뮬레이션해도 충돌/점수가 크게 왜곡되지 않음.
- 네트워크를 끊어도 이미 로드한 게임 상태에서는 에셋/게임 플레이가 계속 유지됨. 완전 오프라인 **새로고침**까지 보장하려면 별도 서비스 워커 캐싱(P1) 필요.

---

## 13. 개발 순서 — Claude Code 실행 플랜

> 파일만 생성하고 멈추지 말 것. 각 페이즈 후 직접 실행·화면 확인·테스트 및 수정. 필요한 자격 증명 없는 경우에만 사용자에게 요청.

### Phase 1 — 동작하는 미니 게임 코어

- Vite+TypeScript+HTML 한 페이지 부트스트랩.
- HUD/타이틀/플레이/일시정지/클리어/게임오버 상태 머신.
- 한 가지 **개발용 테스트 이미지 또는 간단 도형**으로만 먼저 건물 셀 분할, 공격, 실제 제거, 떨어지는 조각, 점수, 목숨, 필살기 구현.
- 키보드/터치 동시 지원. 이 단계에서 원화가 없더라도 게임성은 테스트 가능해야 한다.

### Phase 2 — xAI 에셋 파이프라인과 아트 스타일

- 개발 전용 이미지 생성 스크립트, 공통 프롬프트, 저장, `Sharp` 변환, 매니페스트, 검증.
- `.env`에 키가 있다면 **경복궁/서울 배경/주인공** 3개 샘플 생성.
- 실제 원화를 앱에 넣어 비율/마스킹/알파/색상 문제 확인. 필요한 프롬프트와 포스트프로세싱 개선.
- 샘플 QA 통과 시 나머지 P0 7개 건물·7개 배경 및 캐릭터 추가 포즈 생성. 불필요한 반복 생성 방지.

### Phase 3 — 8개 랜드마크 게임화

- stage config, 다른 건물 높이/넓이, 셀 자동 생성·타깃 선정·연쇄 붕괴, 잔해 유형 반영.
- 건물별 배경/원경 맞춤 배치. 순차 클리어와 타이틀/결과 흐름 완성.

### Phase 4 — 타격감/폴리싱

- 히트스톱, 화면 흔들림, 빛 효과, 파편 다양화, 콤보, 점수 팝업, 효과음, 필살기 시퀀스.
- 모바일 멀티터치, UI 선명도, 저장, 접근성, 로딩/오류 상태.

### Phase 5 — 검증/산출물

- `npm run build` 성공. 테스트 통과. 직접 여러 스테이지를 플레이해 버그 수정.
- 에셋 QA 이미지/결과와 실행 스크린샷 확인. API 키 번들 유출 확인.
- README에 실행/조작/에셋 재생성/커스텀 스테이지 추가법/기본 게임 규칙/테스트 결과 작성.
- **테스트 안 했거나 못한 항목은 테스트했다고 쓰지 말고 정확히 미검증으로 남긴다.**

---

## 14. 최종 완료 기준 (Definition of Done)

- [ ] **단일 HTML 페이지**에서 타이틀→플레이→다음 스테이지→게임오버/최종 클리어까지 연결됨.
- [ ] xAI로 실제 생성한 8종 건물 이미지, 8종 배경, 주인공 에셋이 로컬에 존재.
- [ ] 생성 원본/최종 에셋, 프롬프트 및 에셋 매니페스트 존재. 이미지 파일이 손상/누락되지 않음.
- [ ] 모든 건물이 **실제 파괴 구역별로** 부서지고 뒤에 배경이 드러남.
- [ ] 공격 시 타격 반응/점수 상승/게이지 상승/콤보 및 시각·음향 피드백.
- [ ] 위험 잔해를 피할 수 있으며 피격 시 하트 하나만 감소. 3회 피격 게임오버.
- [ ] 슈퍼 게이지 100% → `BREAK!` → 현재 건물의 모든 남은 셀 연쇄붕괴.
- [ ] 경복궁부터 부르즈 할리파까지 스테이지 8개 정상 클리어 가능.
- [ ] PC 키보드/모바일 터치 및 멀티터치 정상.
- [ ] 최고 점수 로컬 저장 및 재시작 정상.
- [ ] **실제 사용 시 xAI 호출 0회**, 키 포함 0개, xAI 리모트 이미지 URL 0개.
- [ ] 프로덕션 `npm run build`와 기본 테스트 통과. 배포 가능한 `dist/` 생성.
- [ ] 에셋이 생성되지 못했다면 키/비용/오류 원인을 보고하고 **완료라고 하지 않음**.

---

## 15. Claude Code에게 최종 지시

**이 프로젝트의 중심은 ‘랜드마크를 보여주는 웹페이지’가 아니라, 오래된 플래시 게임처럼 멈추지 않고 공격하게 되는 실제 아케이드 액션이다.**

기능을 과하게 늘리기보다 **(1) 건물 원화 퀄리티 (2) 타격할 때마다 일부가 확실하게 떨어지는 손맛 (3) 조작 반응성 (4) 3하트의 긴장감 (5) 게이지가 찬 뒤 건물을 통째로 분해하는 필살기**를 최우선으로 구현하라.

xAI는 **제작할 때만** 사용해 에셋을 만든다. 실제 게임 화면에서 프롬프트를 날리거나 이미지를 생성하거나 AI 서버에 요청하는 기능은 만들지 않는다. 이미지를 생성했다면 파일로 저장해 게임에 포함하라.

**가장 먼저 1개 건물로 엔진이 실제 작동함을 입증하고, 그다음 동일한 시스템으로 8개 랜드마크에 확장한 뒤, 화면을 실제로 실행하여 끝까지 검증하라.**
