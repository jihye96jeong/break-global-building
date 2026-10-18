# WORLD BREAKER — 앱 개요, 수익화·마케팅 방향, 소개 문구

> **결론: 무료 공개를 유지하면서 "결제 없는 후원 링크"로 시작하고, 반응이 확인되면 스토리 모드 구조에 맞는 "새 지역(10레벨) 확장팩" 일회성 구매를 검토한다. 먼저 할 일은 원작 영감(《斬るビル》)과 랜드마크 이미지의 권리 확인.**
> (아래 판단은 실제 이용자 반응이 아니라 **구현을 보고 내린 판단**이다.)

## 1. 어떤 앱인가

**하늘에서 떨어지는 세계 랜드마크를 닌자가 거대한 칼로 베어, 맨 아래층부터 무너뜨리는 브라우저용 2D 아케이드 게임.**

- 흐름: 타이틀 → 월드맵(낮→밤 10레벨) → 레벨 플레이(건물 3~6채) → 클리어·별 획득 → 다음 레벨 개방. 별도로 **엔드리스 모드**(6단계 난이도)
- 단계: **배포됨** (https://break-global-building.vercel.app, Vite 빌드 + Vercel). 결제·광고·로그인 **없음**
- 주요 기능 (README·코드 기준)
  - 좌·중·우 레인 이동, 점프(밑면에 닿으면 매달리기·낙하 중 재도약), 가드(지상/공중), 연타 공격, 게이지를 채우는 필살기
  - 맨 아래층의 한 레인만 깨도 층 전체가 붕괴, 칩의 점 개수 = 필요 타수
  - 실제 랜드마크 25종(일반 건물 없음), 콤보·ONE HIT BREAK·AERIAL FINISH·FULL BREAK 연출
  - 4개 언어(ko/en/ja/zh), PC 키보드 + 모바일 화면 버튼·레인 탭
  - README 기준 `npm test` 93개 통과(이 문서 작성 중 직접 실행하지는 않음)
- 현재 한계
  - 저장: 엔드리스 기록·설정(`world-breaker-save-v2`)과 스토리 진행(`world-breaker:story:v5`)이 **브라우저 localStorage**에만 저장 → 기기·브라우저를 바꾸면 사라짐. 계정·순위표 없음
  - 효과음은 코드로 합성한 8비트 사운드(음악 파일 없음)
  - 실제 휴대폰 성능·터치감은 **확인 필요**

## 2. 어떤 스타일이고, 무엇이 매력인가

- 첫인상: 밝은 카툰 일러스트의 랜드마크와 닌자, 레벨이 오를수록 **낮 → 노을 → 깊은 밤**으로 바뀌는 하늘. 큼직한 타격 문구와 파편
- 계속 하게 되는 이유: 약한 레인으로 **샥샥 이동 → 팍팍 베기 → 층째 와르르** 무너지는 손맛, 특히 **뛰어올라 공중에서 베고 재도약으로 연쇄 격파**하는 플레이. 레벨마다 빨라지는 낙하 속도와 별 3개 목표(구현을 보고 내린 판단)
- 처음 겨냥할 사용자: 짧고 타격감 있는 아케이드를 좋아하는 캐주얼 게이머, 세계 여행·랜드마크에 흥미 있는 사용자, 레트로 아케이드 팬
- 비교하면 이해되는 서비스: 고전 《斬るビル(키루비루)》의 "건물 부수기"에 세계 랜드마크와 점프 액션을 더한 것(README에 영감 출처로 명시)
- 대표 특징(키우자는 제안): **점프 공중 베기 → 재도약 연쇄**. 다른 건물 부수기 게임과 구별되는 장면이라 영상·튜토리얼·마케팅의 중심으로 키운다

## 3. 돈은 어떻게 벌면 좋을까

| 상품 | 파는 것 | 어울리는 이유 |
|---|---|---|
| 후원(팁) 링크 — **향후 제안** | 결제 없이 외부 후원 페이지로 연결 | 서버·결제 개발 없이 붙일 수 있고 플레이를 방해하지 않음 |
| 새 지역 확장팩 — **향후 제안** | 기존 월드맵 구조(10레벨·별 30개)에 맞춘 새 랜드마크 지역 일회성 구매 | 스토리 모드가 이미 "지역 진행" 구조라 콘텐츠 판매가 자연스럽고, 난이도·공정성을 건드리지 않음 |

- 먼저 검토할 것: **후원 링크**. 반응(재방문·완주율)이 확인된 뒤 확장팩
- 피해야 할 방식: 목숨·이어하기 판매, **필살기 게이지 충전 판매**, 칼 공격력 강화 판매 → "약한 레인을 찾아 정확히 베는" 핵심 재미를 돈으로 건너뛰게 함
- 지금 보류: **광고**(타격 리듬과 히트스톱 연출을 끊음), **구독**(지속 콘텐츠 공급 계획이 확인되지 않음)
- 결제 도입 시 필요한 기술 사항 (향후 제안)
  - 서버 측 **결제 확인**(결제사 웹훅으로 결제 완료 검증)
  - **구매 복구**: localStorage만으로는 기기 변경 시 구매가 사라짐 → 계정 또는 복구 코드
  - 확장팩 콘텐츠의 접근 제어(현재 `?level=N` 같은 URL·코드 검사는 잠금 노드만 막는 수준), 환불·영수증 처리

## 4. 어떻게 퍼뜨리면 좋을까

- 홍보 문장: **"Leap, slash, and bring down the world's landmarks."** (뛰어올라 베어라, 세계 랜드마크를 무너뜨려라.)
- 처음 만들 짧은 콘텐츠 3개
  1. 점프 공중 베기 연쇄 하이라이트 (이미 있음: 실제 속도 4개 구간 20초 — 저장소에는 포함 안 됨)
  2. 필살기 컷인으로 랜드마크를 통째로 베는 FULL BREAK 장면
  3. "에펠탑·부르즈 할리파·빅벤을 차례로 무너뜨리기" 랜드마크 순회 클립
- 채널: X(트위터), 유튜브 쇼츠·틱톡(세로 편집본 필요), Reddit r/WebGames·r/IndieGaming, itch.io(브라우저 게임 등록), 국내 개발자·게임 커뮤니티
- 현재 앱 안의 공유·유입 기능: **없음**(공유 버튼·순위표·분석 도구 없음). `<head>`의 `moa-verify` 메타 태그는 외부 플랫폼 소유 확인용
  - 성과로 계산하면 안 되는 지표: SNS 조회수·좋아요, 자동 큐레이션 계정의 소개 글은 **실제 플레이 수가 아님**. 플레이·완주율을 보려면 분석 도구 도입 필요(향후 제안, 개인정보 고지 필요)
- 권장 환경: PC 데스크톱 브라우저(키보드 조작이 가장 정확), 모바일은 화면 버튼 지원(실기기 확인 필요)

## 5. 돈 받기 전에 확인할 것

- **AI 생성 에셋**: 랜드마크·배경·닌자·이펙트를 xAI `grok-imagine-image-2.0`으로 개발 단계에서 생성(README: 46회 호출). 생성물 **상업 이용 조건 확인 필요**. 런타임 AI 호출은 없음
- **원작 영감**: README에 《斬るビル》 영감을 명시 → 게임 규칙 자체보다 **이름·화면 구성·연출의 유사성**이 문제 될 수 있어 유료화 전 **확인 필요**
- **랜드마크 이미지**: 실제 건축물 25종을 그림으로 사용. 일부(예: 에펠탑 야간 조명, 시드니 오페라 하우스 등)는 이미지 상업 이용에 권리 주장이 있어 **확인 필요**
- **폰트·음악**: 시스템 폰트만 사용(웹폰트 없음), 음악 파일 없음(효과음은 코드 합성) → 별도 라이선스 이슈는 확인되지 않음
- **외부 서비스**: Vercel(요금제·상업 이용 조건 확인 필요), xAI API(개발 시 비용만 발생, `.env`는 gitignore)
- **개인정보·결제·데이터**: 현재 개인정보·쿠키 수집 없음, 저장은 기기 내 localStorage뿐. 결제·분석을 붙이면 개인정보 처리방침·환불 정책 필요
- **내부 정책 문서**: 저장소에 개인정보·이용약관·라이선스 문서 **없음**(확인함). 공개 저장소이므로 LICENSE 지정 여부 결정 필요
- **제작 정보**: 명세 문서가 "Claude Code 전달용"으로 쓰여 있으나 사용한 **모델명·제작 기간은 확인 필요**(MVP 명세 날짜 2026-10-15)

## 6. 스토어·소개 페이지용 문구와 태그

- 배포: https://break-global-building.vercel.app
- 한 줄 소개: **Leap, slash, and bring down the world's landmarks.**
  (한국어: 뛰어올라 베어라, 세계 랜드마크를 무너뜨려라.)

### 상세 소개 (English)

**Don't wait for the building — jump into it.**

WORLD BREAKER is a 2D arcade game that runs right in your browser. World landmarks fall from the sky one by one, and your ninja brings them down with a giant blade, floor by floor.

**How to play**
- ← → to dash between three lanes, Z to slash, ↑ to jump, ↓ to guard, X for the special.
- Break any lane of the bottom floor and the whole floor collapses. The dots on each chip show how many hits it needs.
- Leap up, slash in mid-air, and re-leap while falling to chain whole towers down.

**Features**
- 25 real landmarks: Eiffel Tower, Burj Khalifa, Big Ben, Gyeongbokgung, Sydney Opera House and more.
- A 10-level world map from morning to deep night, plus an endless mode.
- Combos, ONE HIT BREAK, AERIAL FINISH and a full-screen special attack.
- PC keyboard and mobile touch controls, 4 languages, no install.

Art generated with Grok Imagine; built with Claude Code.

### 상세 소개 (한국어)

**건물이 내려오길 기다리지 마세요. 뛰어올라 베세요.**

WORLD BREAKER는 브라우저에서 바로 즐기는 2D 아케이드 게임입니다. 하늘에서 세계 랜드마크가 한 채씩 떨어지고, 닌자가 거대한 칼로 맨 아래층부터 베어 무너뜨립니다.

**조작**
- ← →로 세 레인을 샥샥 이동, Z로 베기, ↑ 점프, ↓ 가드, X 필살기.
- 맨 아래층의 한 레인만 깨도 층 전체가 와르르. 칩의 점 개수가 필요한 타수예요.
- 뛰어올라 공중에서 베고, 떨어지면서 재도약해 탑 전체를 연쇄로 무너뜨리세요.

**특징**
- 에펠탑·부르즈 할리파·빅벤·경복궁·시드니 오페라 하우스 등 실제 랜드마크 25종.
- 아침부터 깊은 밤까지 이어지는 10레벨 월드맵 + 엔드리스 모드.
- 콤보, ONE HIT BREAK, AERIAL FINISH, 화면을 가르는 필살기.
- PC 키보드·모바일 터치, 4개 언어, 설치 없이 바로 플레이.

그림은 Grok Imagine으로 생성, Claude Code로 제작.

### 태그

- English: `arcade` `action` `ninja` `landmarks` `building-breaker` `jump` `combo` `browser-game` `casual` `retro` `mobile` `html5` `ai-made` `grok-imagine`
- 한국어: `아케이드` `액션` `닌자` `랜드마크` `건물부수기` `점프` `콤보` `브라우저게임` `캐주얼` `레트로` `모바일` `AI제작`
- 개수 제한이 있으면 앞에서부터: `arcade` `action` `ninja` `landmarks` `building-breaker`

### 스크린샷 (공개 URL)

`https://raw.githubusercontent.com/jihye96jeong/break-global-building/main/media/screenshots/` 아래
`01-title` `02-world-map` `03-jump-slash` `04-chain-cut` `05-special` `06-aerial-finish` `07-full-break` `08-one-hit-break` (.jpg, 1280×720)

---

이 게임은 명세 문서(v1~v5)를 단계적으로 다듬어 AI와 함께 완성한 과정이 문서로 남아 있어, 제작자의 **AI 협업 기획·구현 역량을 보여 주는 포트폴리오**가 될 수 있다. 다만 **게임 유입(플레이 수)**과 **제작 문의(외주·협업 연락)**는 다른 성과이므로 링크와 문의 경로를 분리해 각각 측정하는 것을 권장한다.
