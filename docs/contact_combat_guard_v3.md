# WORLD BREAKER — 근접 타격 판정 & 초근접 가드 정밀 개선 v3.0

> **문서 성격:** 기존 게임에 적용하는 **P0 버그 수정 + 게임 필(손맛) 패치**. 신규 게임 제작 요청이 아님.
>
> **선행 문서:** `building_breaker_complete_implementation_spec.md`(v1.0), `world_breaker_game_feel_upgrade_v2.md`(v2.0).
>
> **우선순위:** 이 문서의 **공격·접촉·가드 판정 및 연출 관련 규칙은 이전 문서보다 우선**한다. 목숨 3개, 3레인, 층별 HP, 콤보, 필살기, 랜드마크, xAI 에셋 사전 생성 정책은 유지한다.
>
> **구현 대상:** 기존 저장소의 HTML5 Canvas / JavaScript 게임. **현 코드를 먼저 추적한 뒤 실제 수정·테스트**한다. 설명만 제출하거나 파티클만 더하는 것으로 완료 처리하지 않는다.

---

## 0. 해결해야 할 문제와 절대 불변 조건

### 지금 드러난 문제

1. **캐릭터와 건물이 상당히 떨어져 있는데도 공격하면 층이 파괴된다.** `현재 레인 === 타격 레인`만 검사하고 **물리적 접촉 거리 검사**가 누락된 것으로 추정된다.
2. **가드가 가까운 상황에서 몸으로 받아내는 느낌이 없다.** 건물이 아직 멀리 있는데 멈추거나 떠오르며, 실제 접촉·충격·정지·반발이 하나의 동작으로 이어지지 않는다.
3. **급속 낙하하는 건물에 가드가 박히는 순간의 대비가 약하다.** `빠른 낙하 → 쾅! 즉시 정지 → 짧은 버팀 → 밀어내기 → 재추락`이 한눈에 읽혀야 한다.

### 최우선 불변 조건 (MUST)

- **일반 공격으로 실제 HP가 감소하는 시점은 캐릭터의 눈에 보이는 타격 접촉면과 현재 최하층의 눈에 보이는 피격면이 실제로 맞닿은 순간뿐이다.** 10wu, 20wu, 80wu 떨어진 곳에서 공격이 맞는 판정은 **무조건 버그**다.
- **가드 성공은 실제 접촉이 발생한 순간에만 확정**된다. 접근 중에는 준비 자세만 가능하고, 건물 정지·반발·게이지 성공 소비·성공 이펙트가 발생하면 안 된다.
- **가드 성공 순간 건물의 낙하속도가 아무리 빨라도 해당 접촉 위치에서 잠깐 멈춘다.** 건물과 캐릭터 사이에 틈이 생기거나 캐릭터를 관통하는 연출을 금지한다.
- **판정 충돌박스와 그림의 접촉 위치는 서로 일치**한다. 렌더 스케일, 흔들림, 층 이미지 투명 여백 때문에 실제로 안 닿았는데 닿은 것으로 판정해서는 안 된다.
- **빠른 낙하에서 프레임 사이 접촉을 뛰어넘지 않는다.** 단일 프레임 현재 좌표 비교만으로 판정하지 말고 연속 충돌 판정(swept collision)을 사용한다.
- **허공 공격은 시각적인 헛스윙만** 표시한다. 건물 HP / 콤보 / 점수 / 필살기 게이지 변화 0, 적중음·균열·파괴 파편 0.
- 위 조건을 모두 만족하기 전에는 화면 효과, 사운드 증량, 카메라 쉐이크를 완료 기준으로 삼지 말 것.

---

## 1. 이전 버전에서 반드시 고칠 곳 (충돌 원인)

### v1.0 공격 함수의 구조적 결함

`attackCurrentFloor()` 예시가 **쿨다운 → 현재 건물 존재 → 최하층 → 레인 HP 감소** 순서이고, **캐릭터↔건물 접촉 조건이 없다.** 해당 패턴이 실제 코드에 남아 있으면 다른 이펙트가 아무리 좋아도 허공 타격이 발생한다.

**수정:** `floor.hp[lane] -= 1`보다 **반드시 앞에** `resolveVisibleMeleeContact(...)` 검증을 놓아야 한다. 성공 여부를 콤보·HP·파편·사운드의 **단일 진실 공급원**으로 사용한다.

### v1.0 가드 조건의 구조적 결함

`building.bottomY >= groundY - 95`는 **바닥에 가까운가**를 판단할 뿐, **캐릭터의 방어 자세와 닿았는가**를 판단하지 않는다. 이 식만으로 가드를 발동해서는 안 된다.

### v2.0 가드 사전 감지값의 혼동

`contactLookAhead: 16`은 **접촉을 준비할 후보 범위**이지, **16wu 떨어진 순간 건물을 멈춰도 되는 거리**가 아니다. `maxSnapCorrection: 7`도 시각적으로 크게 보일 수 있다. 새 기본값은 **접촉 오차 2wu, 수치적 관통 복구 상한 3wu**다.

### v2.0 반발 거리 재조정

기존의 지상 85wu / 공중 35wu 반발은 가드 후 캐릭터와 건물 사이가 과도하게 벌어져 보일 수 있다. 이 패치는 **지상 36wu / 공중 18wu**를 기본으로 시작한다. 무게감이 부족하면 지상 28~42wu, 공중 14~24wu 범위에서 실측 조정한다. **v3.0 수치를 우선하며 85/35를 추가 합산하지 않는다.**

---

## 2. 용어, 좌표, 시각적 접촉 기준

세계 좌표는 기존과 동일하게 **Y축 아래 방향이 +, 월드 높이 600wu**로 둔다. px는 화면 렌더 픽셀, wu는 게임 월드 단위다.

```txt
                  Y - (위)
              ┌─────────────┐
              │ 건물 윗부분 │
              ├─────────────┤
              │ 현재 최하층 │   현재 플레이어 레인의 눈에 보이는 밑면
              └──────┬──────┘  ← buildingVisibleBottomY(lane)
                     ↓  gap > 0 이면 아직 떨어져 있음
                  [접촉]         ← gap = 0
                     ↑
                  ╱ 검 ╲        ← 공격/가드 포즈의 실제 접촉면
                  [캐릭터]
                  ───────── 지면
                  Y + (아래)
```

### 충돌 데이터와 렌더 데이터 통일

반드시 구현하거나 기존 필드를 매핑한다.

```ts
type ContactSurface = {
  // 월드 좌표. 렌더용 파티클/카메라 진동을 제외한 게임 판정 위치.
  y: number;
  xMin: number;
  xMax: number;
  segmentId: string; // 건물ID + 층ID + 레인ID로 유일하게
};

type PlayerMeleeSurface = {
  y: number;       // 현재 공격 포즈에서 실제로 보이는 손·검 접촉 높이
  xMin: number;
  xMax: number;
};

type PlayerGuardSurface = {
  y: number;       // 현재 방어 포즈에서 받치는 손·무기 끝 높이
  xMin: number;
  xMax: number;
};
```

**구현 핵심:** `building.bottomY`를 그대로 충돌면으로 사용해도 되는 에셋은 실제로 그 바닥이 보이는 이미지뿐이다. 경복궁 기단, 에펠탑 다리, 불규칙한 타워 등은 **현재 레인의 시각적 밑면과 충돌면이 같도록** 층 메타데이터의 앵커/충돌 폴리곤을 보정한다.

- 에셋 이미지의 투명한 하단 여백은 빌드 시 crop하거나 `contactBaseOffsetY`로 정확히 보정.
- 카메라 흔들림·검광·파편·그림자 크기는 충돌 판정에 포함하지 않음.
- 공격 포즈/가드 포즈의 실제 `contactY`는 포즈별로 정의. 한 포즈의 머리 높이를 모든 동작의 충돌면으로 재사용하지 말 것.
- 공격 판정에 쓰는 손/무기의 접촉면이 몸에서 수십 wu 위까지 길게 튀어나오지 않도록. **멀리서도 맞는 커다란 검 박스 금지.** 실제 화면에서 캐릭터에 붙어 있는 짧은 근접 타격 영역으로 제한.
- 동일 카메라 변환을 플레이어·건물에 적용. 디버그 박스도 그 변환을 사용.

### 거리 부호와 범위

```js
const gap = playerAttackSurface.y - buildingBottomSurface.y;
// gap > 0  : 건물이 위에 있고, 캐릭터와 떨어져 있음
// gap = 0  : 정확히 닿음
// gap < 0  : 화면상 겹침(관통)
```

| 값 | 의미 | 일반 공격 HP 감소 | 가드 확정 |
|---|---|---|---|
| `gap > 12wu` | 먼 거리 | **절대 불가** | **절대 불가** |
| `2wu < gap ≤ 12wu` | 가까워짐 | **불가** | **불가** (준비만 가능) |
| `0wu < gap ≤ 2wu` | 픽셀 수준 접촉 허용차 | 가능 | 가능(실제 접촉 판정 확인) |
| `-3wu ≤ gap ≤ 0wu` | 소규모 수치 관통 / swept 접촉 | 가능(한 번) | 가능(한 번) |
| `gap < -3wu` | 심각한 관통 또는 버그 | 무조건 적중 금지 | 과거 접촉 복구 없으면 실패/충돌 처리 |

**절대 주의:** 위 2wu는 **렌더 정합을 위한 작은 허용 오차**일 뿐 공격 사거리가 아니다. 픽셀 변환 후 눈에 보이는 틈이 3px보다 크면 보정값을 줄이거나 에셋을 바로잡아야 한다. `gap > 2wu`에서 적중은 금지한다. 이동 중 접촉은 해당 프레임의 **실제 접촉 시각 TOI**로 보정해서 판정하므로 원거리 사거리가 늘어나지 않는다.

### 수평 일치까지 확인

플레이어가 왼쪽에서 중앙으로 이동하는 애니메이션 도중, 논리 레인 값만 중앙으로 먼저 바뀌었다고 중앙 층을 때려서는 안 된다.

- **현재 레인 동일** + **공격 포즈의 접촉 X구간과 그 레인 건물 밑면의 X구간 실제 중첩** 필요.
- 공격 당시의 플레이어 X(또는 수평 이동 swept 위치)로 판정한다.
- 레인 전환 애니메이션 중이면 **실제 렌더된 몸/무기 위치와 충돌 구간이 일치**하도록 시뮬레이션 기반 보간 또는 타이밍 조정.
- 수평 중첩이 없으면 수직으로 닿아도 허공 공격.

---

## 3. 일반 공격 — 반드시 '닿았을 때만' 명중

### 3.1 한 번의 공격 실행 순서 (강제)

```txt
Z 키 / 모바일 ATTACK 버튼
  ├─ 공격 주기(기본 95ms) 검사
  ├─ 공격 애니메이션은 즉시 재생 (허공에서도 자연스럽게 휘두름)
  ├─ 현재 최하층과 플레이어의 실제 접촉면 계산
  ├─ 같은 레인인가? / X구간이 겹치는가?
  ├─ 수직 접촉이 실제로 발생했는가? (현재/이전 틱 swept 포함)
  ├─ 실제 타격 활성 프레임인가? / 중복 히트는 아닌가?
  ├─ 하나라도 NO → WHIFF (HP/점수/콤보/게이지/명중 이펙트 절대 없음)
  └─ 전부 YES → HIT (HP -1, 충격 피드백, 층/건물 파괴 검사)
```

### 3.2 타이밍값

| 항목 | v3.0 기본값 | 이유 |
|---|---:|---|
| 일반 공격 반복 주기 | **95ms** | v2 템포 유지 |
| 시각 스윙 시작 | **입력 직후 0ms** | 즉각적 조작감 |
| 유효 타격 프레임 | **0~55ms** | 접촉 직전의 짧은 검격 허용, 장거리 자동 타격 금지 |
| 입력 버퍼 최대 | **70ms** | 근접 접촉과 같은 프레임의 입력 유실 방지 |
| 수직 근접 허용 오차 | **2wu 이하** | 눈에 띄는 틈 없이 접촉 |
| 깊은 관통 방지 | **3wu 초과 관통 금지** | 뒤늦은 허공 판정 방지 |
| 공격 성공 후 작은 반동 | **기존 -7wu** | 타격 순간 뒤로 밀림, 단 순간이동처럼 보이면 45~70ms 시각 보간 |
| 층 파괴 시 hit-stop | **45~60ms** | v2 유지, 중복 정지 금지 |

**주의:** 0~55ms는 공격이 허공에서도 유효하다는 뜻이 아니다. **그 시간 안에 실제 접촉이 일어나야만** HP가 감소한다. 예컨대 건물이 40wu 떨어져 있고 플레이어가 공격하면 0ms에 검은 휘두르지만 HP는 0 감소한다.

### 3.3 '공격 판정'을 재사용 가능한 공통 접촉 판정으로 분리

아래는 **구조를 보여 주는 의사코드**다. 실제 저장소의 좌표 시스템과 이벤트 버스에 맞게 포팅할 것.

```js
const CONTACT = Object.freeze({
  touchEpsilonWu: 2,
  maxPenetrationWu: 3,
  minHorizontalOverlapWu: 1,
  attackActiveMs: 55,
  attackCooldownMs: 95,
});

function xOverlaps(a, b) {
  return Math.min(a.xMax, b.xMax) - Math.max(a.xMin, b.xMin)
    >= CONTACT.minHorizontalOverlapWu;
}

function crossedContact(prevGap, nextGap) {
  // 이전 틱에서 떨어져 있다가 현재 틱에서 정확히 접촉면을 가로질렀는지.
  if (prevGap < -CONTACT.maxPenetrationWu) return null;
  if (prevGap <= CONTACT.touchEpsilonWu) return 0;
  if (nextGap > CONTACT.touchEpsilonWu) return null;
  if (nextGap === prevGap) return null;
  return Math.max(0, Math.min(1, prevGap / (prevGap - nextGap)));
}

function resolveVisibleMeleeContact({
  player, building, prev, curr, attack, segment,
}) {
  if (!segment || !attack || attack.hitConsumed) return null;
  if (attack.elapsedMs > CONTACT.attackActiveMs) return null;
  if (player.lane !== segment.lane) return null;
  if (!xOverlaps(curr.attackSurface, curr.buildingSurface)) return null;

  const prevGap = prev.attackSurface.y - prev.buildingSurface.y;
  const currGap = curr.attackSurface.y - curr.buildingSurface.y;
  const t = crossedContact(prevGap, currGap);
  const alreadyTouching = currGap >= -CONTACT.maxPenetrationWu &&
                          currGap <= CONTACT.touchEpsilonWu;
  if (!alreadyTouching && t === null) return null;

  // swept로 '이번 틱 중 접촉'을 확인했을 때는 충돌 시각 좌표로
  // 이벤트를 발생시킨다. 플레이어/건물을 멀리서 잡아당기지 않는다.
  return { segmentId: segment.id, timeOfImpact: t ?? 1 };
}

function tryMeleeDamage(game, attack) {
  const hit = resolveVisibleMeleeContact(game.contactSnapshotFor(attack));
  if (!hit) {
    game.events.emit('ATTACK_WHIFF', { attackId: attack.id });
    return false;
  }
  // 같은 스윙/동일 층/동일 접촉에서 1회만 적용
  if (!game.hitLedger.claim(attack.id, hit.segmentId)) return false;
  attack.hitConsumed = true;
  game.damageActiveFloor(game.player.lane, 1);
  game.events.emit('ATTACK_HIT', hit);
  return true;
}
```

**중요 구현 보완:** 접촉이 충돌 틱의 중간(TOI)에서 일어난 경우 그 시각의 **수평 겹침도 보간해서 확인**해야 한다. 위 예시의 `curr.attackSurface`를 통한 X검사는 보수적 초기 구현이다. 고속 횡이동이 있는 엔진에서는 X/Y를 모두 TOI에 샘플링해야 한다. 인위적으로 이전 프레임의 오래된 접촉을 무한 재사용하면 안 된다.

### 3.4 공격 성공과 허공 공격의 피드백을 명확히 분리

| 요소 | 허공 공격 | 실제 접촉 공격 |
|---|---|---|
| 캐릭터 칼 휘두름 | O | O |
| 바람 가르는 소리 | O | O |
| 칼 잔상 | O (조금 작음) | O |
| 건물 HP 감소 | **X** | **O** |
| 건물 균열/층 파괴 | **X** | **O** |
| 타격음, 스파크, 파편 | **X** | **O** |
| 타격 hit-stop | **X** | **O** |
| 카메라 타격 흔들림 | **X** | **O** |
| 점수·콤보·필살기 충전 | **X** | **O** |

- 공격 버튼 연타로 **멀리서 건물이 자동으로 부서지는 기존 로직 전부 제거**.
- 명중 위치는 화면 중앙이 아니라 **실제 검·건물 접촉점**.
- **필살기 X는 별도 광역 스킬**이므로 이 근접 조건의 예외. 단 일반 공격을 필살기처럼 취급하지 말 것.
- 현재 층 `HP == 0`으로 제거되면 해당 층에 들어오는 중복 히트 무시.

---

## 4. 층 파괴 이후 — 근접 타격 연계가 끊기지 않도록

기존의 `floors.shift(); building.bottomY -= floorHeight`는 제거된 층 높이만큼 **다음 층의 밑면이 위로 올라가므로** 캐릭터와 사이에 실제 틈이 생긴다. **이 틈이 있는 동안 일반 공격으로 다음 층을 때릴 수 없어야 정상**이다.

반대로 템포가 멈추지 않도록 다음 층이 빠르게 접촉하도록 연출한다.

1. 층 파괴 즉시 층/HP/점수/상태는 변경한다. 같은 공격으로 다음 층도 자동 피해를 받지 않는다.
2. 새 최하층은 **실제로 아래로 떨어져** 다시 캐릭터에 닿아야 한다. **숨겨진 거대 히트박스, 사거리 무한 확장, 즉시 스냅 금지.**
3. `postBreakSettle` 상태에서 짧게 낙하속도를 높일 수 있다(권장 초기값 **최대 400wu/s, 80~140ms**). 단 현재 난이도 낙하보다 더 빠르게 붙는 과정으로 보이도록 연속 이동시키고, 충돌/가드/피해 판정도 정상 수행한다.
4. 이전 층의 비충돌 파편만 카메라에 남는다. 새 층의 공격 판정은 물리적인 재접촉부터 시작.
5. Z를 누르고 있을 때는 다음 95ms 공격 틱들이 정상 실행되므로, **실제 재접촉한 첫 유효 공격만 명중**한다.
6. `postBreakSettle`로 인해 낮은 난이도에서도 부당한 피해가 발생한다면 속도/위험선부터 재조정. **접촉 없이 자동 명중시키는 식으로 해결 금지.**

---

## 5. 가드 — '초고속 낙하 → 딱 붙어서 쾅 → 0.12초 정지'가 표준

### 5.1 플레이어가 느껴야 하는 완성된 동작

```txt
낙하속도 급증 ────────────────↓ ↓ ↓ ↓ ↓
                       (정말 빠르게 접근)
가드를 가까운 순간에 누름  → [캐릭터 팔/검이 받치는 자세]
정확한 접촉 발생!          → [쿵!!!] (건물 하단이 손/검에 맞닿음)
                  0~120ms → [건물 Y 위치 완전 정지] + 캐릭터 무릎 압축
               120~290ms → [캐릭터가 힘을 주어 건물을 조금 밀어 올림]
               290~360ms → [반발 끝, 서서히 낙하 가속 회복]
                      이후 → [다시 무서운 속도로 아래로 내려옴]
```

여기서 가장 중요한 것은 **엄청 빠르던 물체가 접촉 순간 멈추는 강한 대비**다. 전체 화면을 0.12초 멈추는 것이 아니라, **건물의 물리 낙하만 접촉면에서 정확히 잠깐 정지**시키고 타격 스파크·압축 자세·사운드·배경의 미세 움직임은 살아 있어야 한다.

### 5.2 가드가 '가능한 거리'와 '성공한 거리' 구분

- 가드 버튼을 건물 80wu 밖에서 눌렀을 때: **가드 자세는 나올 수 있으나 건물은 계속 낙하한다.** 성공 판정 X. 게이지 성공 소모 X.
- 12wu 이내에서 누르면: **접촉 대비 준비**. 아직 떨어져 있으면 건물 정지 X.
- **실제 접촉(`gap ≈ 0`)**: 준비/가드 입력 윈도우가 유효하고 게이지가 충분하면 **그 틱의 TOI에서 성공**. 즉시 0속도 + 짧은 홀드 진입.
- 이미 3wu 이상 깊이 관통한 상황: 건물을 먼 거리로 위로 스냅시키지 말고 기존 충돌/피해 규칙을 따른다. 이 경우는 원래 충돌 처리가 늦게 진행된 버그일 수 있으므로 원인 로그 필요.
- 가드 키를 멀리서 누르고 **계속 유지하면 무적이 되는 설계는 금지**. 180ms의 1회 READY 윈도우가 만료된 뒤에는 **키를 떼고 다시 눌러야** 재무장.
- 키를 눌렀다가 **70ms 안에 실제 접촉**하면 짧은 사전 입력 버퍼로 인정한다. 접촉보다 먼저 성공 이펙트를 재생하지 않는다.
- 실제 접촉이 발생한 **같은 물리 틱에 가드가 눌렸으면 성공**. 키 이벤트가 requestAnimationFrame보다 늦게 처리되어 놓치는 버그를 금지한다.
- 일정 속도 이상의 급강하에서도 접촉 TOI를 계산하므로 `gap=30 → gap=-8`처럼 프레임을 건너뛰어도 접촉을 놓치지 않는다.

### 5.3 가드 물리/연출 권장값 (v3.0이 v2를 덮어씀)

| 파라미터 | 지상 가드 | 공중 가드 | 설명 |
|---|---:|---:|---|
| 준비 최대 윈도우 | 180ms | 180ms | 오래 홀드로 자동 가드 금지 |
| 접촉 전 짧은 버퍼 | 70ms | 70ms | 딱 붙기 직전 입력 인정 |
| 접촉 허용 오차 | ≤2wu | ≤2wu | 시각 접촉과 동기화 |
| 접촉 순간 정지 | **120ms** | **100ms** | 엄청난 낙하속도를 순간 정지 |
| 신체 압축 | 3~4wu | 2~3wu | 건물 논리 좌표/접촉면은 유지 |
| 건물 상향 반발 | **36wu** | **18wu** | 실제로 밀어낸 거리 |
| 반발 시간 | **170ms** | **140ms** | 순간 이동 대신 동작으로 표시 |
| 정상 낙하 속도 복귀 | **70ms** | **70ms** | 부드러운 재하강 |
| 동일 접촉 재발동 제한 | **280ms 이상** | **280ms 이상** | 다중 발동 방지 |
| 가드 게이지 비용 | 기존 v1의 **30** | 기존 v1의 **18** | 동일 이벤트 한 번만 소비 |
| 콤보 | **0으로 초기화** | **그대로 유지** | 기존 게임 규칙 보존 |

**균형 조정:** 우선 위 값을 고정하여 30/60/120fps 및 낙하속도 1.0/1.7/2.4배로 테스트하라. 지상 가드가 너무 약하면 `36 → 42wu`로, 정지감이 부족하면 `120 → 140ms`로 하나씩 바꾼다. 수치 변경을 빌드 로그에 기록한다.

### 5.4 가드 상태기계 — 적중 확인 이전에는 건물을 건드리지 말 것

```txt
IDLE
  ├─ 새 guard press / 게이지 충분 → READY (실제 물리 영향 없음)
  └─ 기타 → IDLE
READY (최대 180ms)
  ├─ guard released → IDLE
  ├─ 만료 → LOCKED_UNTIL_RELEASE (원거리 홀드 자동가드 금지)
  ├─ 건물·플레이어 접촉 TOI 검출 + 유효 레인 + 자원 충분 → CONTACT_HOLD
  └─ 아직 안 닿음 → READY (건물은 계속 빠르게 낙하)
CONTACT_HOLD (지상 120ms / 공중 100ms)
  ├─ 건물 bottomY = 접촉 Y로 고정, 낙하속도 0
  ├─ 캐릭터 압축/팔 버팀 (접촉점 분리 금지)
  └─ 타이머 완료 → REPEL
REPEL (지상 170ms / 공중 140ms)
  ├─ 한 소유자만 building Y를 연속적으로 위로 이동
  └─ 이동 완료 → RELEASE
RELEASE (70ms)
  └─ 재낙하 속도 회복 → COOLDOWN
COOLDOWN
  └─ 중복 접촉 방지 기간 및 키 재입력 조건 충족 → IDLE
```

중요: 가드 키가 실제로 건물과 접촉한 상태에서 **처음 눌린 경우**, 물리 틱에서 새 `guardDown`과 접촉 후보를 함께 평가해야 한다. 미리 READY 상태였는지만 검사하면 '가드를 딱 눌렀는데 실패'하는 버그가 생긴다.

### 5.5 가드 접촉 순간의 물리 순서

```js
function tryStartGuardAtContact(game, toiContact) {
  const g = game.guard;
  const p = game.player;
  const b = game.building;

  if (!toiContact) return false;
  if (!g.freshPressInCurrentTick && !g.isReadyWithinWindow) return false;
  if (g.lockedUntilRelease || g.inCooldown) return false;
  if (p.lane !== toiContact.lane || !toiContact.horizontalOverlap) return false;
  if (!toiContact.validTrueTouch) return false;
  const cost = p.isGrounded ? 30 : 18;
  if (g.energy < cost) return false;
  if (!g.claimContact(toiContact.segmentId)) return false;

  // 실제 충돌 시각의 점(TOI)으로 고정: 접촉 20wu 전 스냅 금지!
  b.bottomY = toiContact.exactBuildingBottomY;
  b.velocityY = 0;
  b.motionOwner = 'GUARD_HOLD';

  g.energy -= cost;                       // 정확히 한 번
  g.state = 'CONTACT_HOLD';
  g.elapsedMs = 0;
  g.contactY = toiContact.exactBuildingBottomY;
  g.savedFallSpeed = toiContact.fallSpeedBeforeImpact;
  g.isGroundGuard = p.isGrounded;
  g.contactId = toiContact.segmentId;

  if (g.isGroundGuard) game.combo.reset();
  else game.combo.extendTimer(450);

  game.events.emit('GUARD_CONTACT', {
    x: toiContact.x, y: toiContact.y,
    impactSpeed: toiContact.relativeSpeed,
  });
  return true;
}
```

`toiContact.exactBuildingBottomY`는 **플레이어의 실제 가드 접촉면에 맞는 건물 논리 밑면으로 환산**해야 한다(랜드마크 contact offset 포함). 접촉을 만들려고 먼 위치에서 `bottomY += 20` 같은 코드는 불허한다. 충돌 시각을 `t ∈ [0,1]`로 계산해 **그 위치에서 적분을 종료**하는 것이 정답이다.

### 5.6 홀드와 반발 — 빠른 건물도 정말 멈춘다

**홀드 `0~120ms` (지상 기준):**

- `building.bottomY = contactBottomY`를 유지하고 `velocityY = 0`.
- 정상 낙하 적분(`bottomY += speed*dt`)을 **완전히 건너뜀**. 같은 프레임에 다른 updater가 Y를 쓰면 버그.
- 팔/무기 접촉 높이와 건물 밑면 차이 **2wu 이내**를 유지. 몸 압축은 몸통/무릎 포즈로 처리하되 손/검 접촉 앵커는 고정.
- **건물은 단단히 멈춰 있고 캐릭터는 약간 떨며 받치는 모습**. 화면 전체를 긴 시간 일시정지하지 않음.
- 건물이 빠르게 떨어질수록 첫 프레임 충격 스파크·짧은 카메라 충격이 조금 강해질 수 있지만 **정지 길이는 지나치게 길게 하지 않음**.

**반발 (지상 170ms / 공중 140ms):**

```js
function smootherstep01(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function guardRepelY(contactBottomY, elapsedMs, air) {
  const duration = air ? 140 : 170;
  const travel = air ? 18 : 36;
  return contactBottomY - travel * smootherstep01(elapsedMs / duration);
}
```

- 반발 끝의 `bottomY`는 정확히 `contactBottomY - (36 또는 18)`이 되어야 한다.
- 포즈는 캐릭터가 먼저 **버팀→밀어내는 힘을 씀**으로 전환한 뒤 실제 건물이 연속적으로 위로 이동하는 순서.
- 반발 종료 즉시 낙하속도를 과거 저장한 속도로 순간 변경하지 말고 `70ms` 동안 `0 → 목표 낙하속도`로 복귀.
- 건물이 다시 떨어져 캐릭터와 재접촉해도 동일 contact ID/쿨다운이면 **새 가드 성공 이벤트가 발생하지 않는다**.

### 5.7 반발 중 공격 규칙

- **가드 버티는 동작 중에는 별도의 층 타격 판정을 하지 않는다.** 가드 자세와 공격 자세의 겹치는 모션으로 무상 HP 감소 금지.
- 공격 버튼을 누르면 마지막 하나만 **≤70ms 버퍼** 가능. 반발 후 실제로 재접촉할 때까지 자동 적중 금지.
- 반발 중 떨어진 거리에서 Z 연타했는데 층이 깨지면 공격 거리 버그다.
- 가드 직후 `COUNTER!` 표현은 **재접촉한 정상 근접 공격이 성공했을 때만** 출력. '가드 후 0.35초'만 충족한다고 먼 공격을 카운터로 계산하지 않는다.

---

## 6. 최고속 낙하에서도 접촉 정확도 유지

### 단순 현재 위치 비교가 실패하는 이유

60fps에서 낙하가 900wu/s이면 한 틱 이동량이 약 **15wu**다. 이전 프레임 `gap=+7wu`, 이번 프레임 `gap=-8wu`로 지나간다. 현재 프레임에서 `abs(gap)≤2wu`만 검사하면 **접촉 자체를 놓친다**.

### 구현 표준: swept contact / TOI

1. 틱 시작 시 이전 `buildingBottom`, `playerAttackPlane`, `playerGuardPlane`을 기록.
2. 낙하·점프·레인 이동을 같은 시뮬레이션 틱 내에서 예측/적분.
3. 이전 간격 `prevGap > 0`, 현재 간격 `nextGap ≤ 0`이면 **중간에 접촉이 있었다**고 판단.
4. `tHit = prevGap / (prevGap - nextGap)`을 `[0,1]`로 제한하고 **정확한 충돌 시점의 X/Y 포즈와 건물 밑면**을 얻는다.
5. 해당 순간에 가드/공격 활성 여부 확인. 가드가 유효하면 그 지점에서 건물 낙하를 **정지하고 남은 틱 낙하 이동을 버림**.
6. 누적 접촉 관통이 이미 `3wu`를 넘은 **오래된 상태**에서 새 입력만으로 소급 가드/공격하지 않는다.
7. collision solver의 결과는 domain event로 1회만 발행한다.

**동일 프레임 최종 판정 우선순위:** `필살기 무적/전역 파괴 → 정확한 가드 접촉 → 정확한 근접 공격 접촉 → 기존 위험 충돌/라이프 처리`. 

- 공격과 가드가 동시에 눌렸다면 **가드 우선**(공격 데미지 중복 발생 금지).
- 정확한 공격이 성공했다면 타격 반동/층 파괴 후 물리 상태로 충돌 위험을 재평가. **같은 접촉 이벤트로 성공 타격 + 목숨 -1을 동시에 주지 말 것.**
- 공격도 가드도 안 됐을 때의 라이프 규칙은 **기존 v1의 위험선 규칙을 유지**한다. 다만 그로 인해 캐릭터·건물이 깊이 관통해 보이면, 시각 렌더링·위험선/캐릭터 몸체 접촉 앵커 불일치를 따로 수정한다. 이 패치만으로 임의의 즉사 규칙 추가 금지.

---

## 7. 표준 가드 연출 — 가드의 존재감을 강하게 만들기

| 경과 시간(지상) | 캐릭터 | 건물 | 카메라·사운드 |
|---|---|---|---|
| 접근 중 | 시선/팔을 위로, 호흡·긴장 | 속도 증가하며 낙하 | 아주 약한 바람음. 성공 이펙트 X |
| **접촉 0ms** | 팔/무기가 건물과 딱 닿음 | **즉시 Y 고정** | **묵직한 단발 `쿵!` + 1프레임 충격 링** |
| 0~35ms | 무릎 3~4wu 압축, 상체 내려앉음 | **정지** | 카메라 3px 하향 충격 후 복귀, 파편 5~8개 |
| 35~120ms | 팔에 힘, 미세 떨림, 이 악물기 | **완전 정지** | 금속 삐걱임/저음 짧게, 접촉광 지속 |
| 120~290ms | 다리 펴며 팔로 들어 올림 | 36wu 부드럽게 상승 | 충격파, 먼지·파편 아래로 낙하 |
| 290~360ms | 균형 회복/다음 행동 | 속도 0→원래 낙하속도 회복 | 짧은 재낙하 바람 소리 |

**중요:** 흔들림을 주더라도 **손/검 끝과 건물 밑면은 같은 카메라 변환으로 그린다.** 캐릭터만 흔들리거나 건물만 흔들려 틈이 생기면 금지. 손 끝의 시각 contact anchor와 판정 contact anchor는 정지 중 매 프레임 일치해야 한다.

### 속도에 따른 임팩트 가변값(시각만)

```js
const normalizedSpeed = clamp((impactSpeed - 100) / 600, 0, 1);
const shakePx = 2.5 + 1.5 * normalizedSpeed;     // 약 2.5~4px
const sparkCount = Math.round(5 + 5 * normalizedSpeed);
const impactPitch = 1.0 - 0.08 * normalizedSpeed; // 더 빠르면 조금 묵직하게
```

`normalizedSpeed`가 높아져도 **가드 성공 거리/게이지/접촉 오차/점수는 바뀌지 않는다**. 속도에 맞춰 연출 강도만 달라진다.

---

## 8. 게임 로직을 고칠 때 반드시 지킬 코드 구조

```txt
Input (keydown/pointerdown timestamps)
      ↓
Fixed-step prediction (player + building previous/next positions)
      ↓
Contact Geometry Resolver
  - floor/lane visual contact segment
  - player's actual attack / guard pose surface
  - swept TOI / X overlap
      ↓
Combat Resolver (ONE authority)
  1) SPECIAL
  2) GUARD true contact
  3) ATTACK true contact
  4) hazard/life
      ↓
State Mutations (single writer)
  - guard motion owner (HOLD/REPEL/RELEASE)
  - active floor HP / floor removal
  - combo / meter / score
      ↓
Events (only confirmed outcomes)
  ATTACK_WHIFF / ATTACK_HIT / FLOOR_DESTROYED
  GUARD_READY / GUARD_CONTACT / GUARD_REPEL / GUARD_RELEASE
      ↓
Renderer + Audio + Particles
```

**기존 함수 변경 가이드**

- `attackCurrentFloor()` : `isMeleeContact` / `resolveVisibleMeleeContact`를 **HP 감소 전에** 호출.
- `handleGuard()` : `bottomY >= groundY - 95` 등의 원거리 트리거 삭제.
- `updateFallingBuilding()` : 가드 `CONTACT_HOLD`/`REPEL`/`RELEASE` 상태에서는 독립 낙하 적분을 중단하고 **가드 모션 관리자만 Y를 갱신**.
- `updatePlayer()` : 가드 자세의 실제 손/무기 접촉점이 고정되어야 하고 공중 가드에서도 상대 위치가 떨리지 않아야 함.
- `removeFloor()` : 재접촉 이전에 새 최하층이 맞지 않도록 접촉 스냅샷 폐기.
- `effects` : `ATTACK_HIT`, `GUARD_CONTACT` 등 확인된 이벤트에서만 적중/파괴 이펙트.
- `camera` : 논리 판정에 흔들림 변환 절대 반영하지 않음.

### 가드 정지와 글로벌 hit-stop 중복 금지

`GUARD_CONTACT`에서 `globalHitStop(30ms)`를 다시 호출하면 가드 120ms에 +30ms 정지가 붙거나 타이머가 두 번 멈춰 어색해질 수 있다. **가드 접촉 정지는 가드 상태에서 한 번만 소유**한다. 파편·소리·카메라 등 연출 타이머는 계속 동작 가능해야 한다.

### 프레임 독립성

- 물리 fixed tick(권장 1/60초)을 유지.
- 타이머는 초/ms 기반. `N frames` 고정으로 30fps에서 효과가 두 배 길어지게 하지 않음.
- 탭 비활성화 후 복귀하면 누적 `dt`를 제한하고 가드 타이머·접촉 스냅샷을 안전하게 재동기화.
- 30/60/120fps에서 타격/가드 횟수, 게이지 소비, 건물 위치 변위가 거의 동일해야 함.

---

## 9. 디버그 모드 — 실제로 붙었는지 숫자로 증명

`?debugContact=1` 또는 개발 전용 토글로 다음을 추가. **출시 빌드 기본 OFF**.

```txt
ATTACK [WHIFF | HIT]    lane=1
Attack gap: +28.4wu     // 이 상태의 HIT는 심각한 버그
Guard gap:  +9.5wu      // 준비 상태는 가능, HOLD는 불가
Player attackSurface Y: 463.5
Player guardSurface  Y: 455.5
Building visibleBottom Y: 435.1
TOI: none / 0.43
X overlap: true / false
Guard state: IDLE / READY / CONTACT_HOLD / REPEL / RELEASE
Building velocityY: 273.6wu/s
Motion owner: FALL / GUARD
Contact ID: B003-F004-L1
Attack id: A00121
Last confirmed event: ATTACK_WHIFF
```

필수 시각화:

- 플레이어 공격 접촉면: **얇은 선**.
- 플레이어 가드 접촉면: **다른 색 얇은 선**.
- 현재 최하층 현재 레인의 눈에 보이는 충돌면: **얇은 선**.
- 두 접촉면의 간격: **수치 + 연결선**.
- 유효 HIT 때만 접촉점에 작은 원. 가드 CONTACT 때만 같은 위치에 링.
- 실제 스프라이트와 충돌면이 지속적으로 3px 이상 어긋나면 **앵커 오류로 보고 테스트 실패**.

`console.assert` 또는 테스트 환경 assert 예시:

```js
if (event.type === 'ATTACK_HIT') {
  assert(event.contactConfirmed === true);
  assert(event.atExactContact === true);
  assert(event.laneMatched === true);
}
if (event.type === 'GUARD_CONTACT') {
  assert(event.contactConfirmed === true);
  assert(event.atExactContact === true);
  assert(event.motionOwner === 'GUARD_HOLD');
}
```

---

## 10. P0 자동 테스트 — 모두 필수 통과

| ID | 시나리오 | 기대 결과 |
|---|---|---|
| CT-01 | 건물이 **80wu** 위, Z 누름 | 허공 공격; HP·콤보·점수·필살기 변동 없음 |
| CT-02 | 건물이 **40wu** 위, 공격 연타 | 건물 피해 0, 파괴 0 |
| CT-03 | 건물이 **12wu** 위, 공격 | 피해 0 |
| CT-04 | 건물이 **4wu** 위, 공격 | 피해 0 |
| CT-05 | 건물이 **0~2wu** 거리, 올바른 레인, 공격 | HP 정확히 1 감소 |
| CT-06 | 건물과 접촉, 옆 레인 공격 | 피해 0 |
| CT-07 | 건물과 접촉, 실제 X구간 불일치(레인 이동 중) | 피해 0 |
| CT-08 | 1회 스윙 중 공격 해상도 높은 렌더 프레임 다수 | 같은 층 HP 1회만 감소 |
| CT-09 | HP 1 층의 약점 접촉 공격 | 해당 층 전체만 1회 파괴 |
| CT-10 | 파괴 직후 새 층이 높이 28wu 떨어져 있음 | 새 층이 재접촉하기 전에는 공격 피해 0 |
| CT-11 | 공격 성공 뒤 반동으로 7wu 틈이 생김 | 그 틈이 닫힐 때까지 추가 타격 불가 |
| CT-12 | 필살기 X를 멀리서 사용 | 기존 전체 파괴 규칙 정상(근접공격 제약 미적용) |
| GD-01 | 건물 **80wu** 위, 가드 누름 | 자세만, 정지·반발·성공효과 0 |
| GD-02 | 건물 **12wu** 위, 가드 누름 | READY 가능, 접촉 전 실제 건물 속도/좌표 영향 0 |
| GD-03 | 유효 윈도우 내 `gap=0` 접촉 | 성공, 즉시 건물 속도 0, contactY 고정 |
| GD-04 | 2.4배 빠른 낙하, 접촉 프레임에 가드 | 성공, 건물 관통 없음, 건물 120ms 정지(지상) |
| GD-05 | `gap=+7 → -8` 프레임 건너뜀 | swept TOI 발견, 7wu 전 지점에서 미리 정지한 것처럼 보이지 않음 |
| GD-06 | HOLD 지상 120ms | `bottomY` 정확히 고정, 캐릭터 손/건물 분리 ≤2wu |
| GD-07 | REPEL 지상 170ms | 접촉 지점에서 위로 정확히 36wu 이동(한 번만) |
| GD-08 | RELEASE 70ms | 위치 점프 없이 낙하속도 부드럽게 복귀 |
| GD-09 | 원거리에서 1초 내내 가드 홀드 | 자동 무적 가드 불가, 180ms READY 종료 후 재입력 필요 |
| GD-10 | 같은 접촉 이벤트에서 한 프레임 안에 여러 충돌콜백 | 가드 게이지 소비 1회, 성공 이벤트 1회 |
| GD-11 | 지상 가드 성공 | 콤보 0, 자원 30 소모 |
| GD-12 | 공중 가드 성공 | 콤보 유지, 자원 18 소모, 정지 100ms + 반발 18wu |
| GD-13 | 가드 중 게이지 부족 | 성공 가드 연출/건물 정지 없음, 기존 피해 규칙 준수 |
| GD-14 | 가드 중 Z 연타·반발 상태 | 접촉 안 된 원거리에서 HP 감소 0 |
| GD-15 | 같은 프레임 Z + 가드 | 가드 우선, 중복 타격/라이프 감소 없음 |
| VIS-01 | 건물별 에셋 다른 하단 투명 여백 | 보이는 바닥과 판정선이 3px 이내 |
| VIS-02 | 카메라 흔들림 중 접촉 | 캐릭터와 건물 상대 거리 변하지 않음 |
| VIS-03 | 30/60/120fps / 저성능 기기 | 접촉 스킵, 이중 적중, 시간 2배 가드 없음 |
| VIS-04 | 화면 회전/리사이즈/모바일 버튼 | 월드 거리 판정 불변, 모바일 입력 정상 |

### 플레이 QA (숫자 테스트 외 필수)

**A — 원거리 마구 공격:** 건물이 하늘에서 떨어지는 동안 `Z`를 길게 누른다. **캐릭터와 건물이 딱 붙기 전까지** 층이 절대로 파괴되지 않는다.

**B — 실제 접촉 타격:** 캐릭터 손/검이 하단 구조물과 맞닿는 타이밍에 공격한다. 그때만 스파크/타격음/균열이 발생한다. 포즈와 실제 손/검 접촉점이 일치한다.

**C — 고속 가드:** 난이도 6, 높은 낙하속도에서 마지막 순간 가드. `쾅!` 소리와 함께 건물이 **그 접촉 위치에서** 순간 멈추고 캐릭터는 압축되며 버틴다. 그 이후 짧게 밀어 올린 뒤 빠르게 추락한다. 프레임마다 건물이 멀리 순간 이동하지 않는다.

**D — 원거리 가드:** 80wu 이상 떨어져서 가드를 누른다. 플레이어가 자세를 취할 수는 있어도 건물이 정지하거나 올라가지 않는다.

**E — 공중 가드:** 높은 점프를 한 상태에서 떨어지는 건물과 접촉해 가드. 공중에서도 손과 건물이 붙어 잠깐 멈추며, 캐릭터가 건물 아래에서 미끄러지듯 빠지는 버그가 없다.

**F — 연속 층 파괴:** 최하층을 부순 직후 새 층과 간격이 생긴다. 그 간격 동안 공격이 안 맞는다. 새 층이 실제로 떨어져 닿는 즉시 다시 빠르게 때릴 수 있다. 흥미를 유지하기 위해 낙하 연결 템포를 조정하되 가짜 적중은 절대 허용하지 않는다.

---

## 11. 실패 판정 / 금지되는 임시방편

다음 중 하나라도 존재하면 구현 완료 아님.

- `if (building && player.lane === lane) floor.hp[lane]--`처럼 거리 없는 HP 코드.
- 건물이 멀리 있어도 층만 자동으로 삭제하는 공격 루프.
- 공격 검광의 렌더 길이를 HP 판정 길이로 그대로 사용하는 코드.
- `bottomY >= groundY - 95`처럼 바닥 근접만으로 성공하는 가드.
- `gap <= 16`을 **실제 접촉**으로 취급하는 코드(16wu는 사전 감지 거리일 뿐).
- 가드 눌렀을 때 `bottomY -= 85`, `bottomY -= 36` 등으로 즉시 텔레포트.
- 건물과 플레이어 위치를 따로 흔들어 실제로 틈이 생기는 카메라 효과.
- 가드 성공 시 전체 시뮬레이션/입력까지 오래 멈추는 글로벌 freeze.
- 성공/실패 여부와 무관하게 공격마다 스파크·건물 파편을 만드는 코드.
- `GUARD_HOLD`에서 기본 낙하 updater와 가드 updater가 **둘 다** 건물 Y를 변경하는 코드.
- 고속 낙하에서 접촉 누락을 해결하려고 원거리 공격·가드 히트박스를 크게 늘리는 방식.
- 밸런스가 답답하다는 이유로 건물 HP를 접촉 없이 깎는 방식.

---

## 12. 실제 작업 순서 / 수정 완료 기준

1. **원인 추적:** 코드에서 `attackCurrentFloor`, `handleAttack`, `guard`, `bottomY`, `groundY`, `attackRange`, `collision`, `onFloorDestroyed` 유사 함수 검색. HP를 바꾸는 모든 경로와 건물 Y를 쓰는 모든 경로 식별.
2. **Contact Geometry:** 캐릭터 공격/가드 접촉면 및 현재 최하층의 **레인별 실제 시각 접촉면** 계산. 좌표/렌더 앵커 정합.
3. **공격 P0 수정:** HP 감소·보상 전에 공통 접촉 검증 강제. 허공 공격/공격 성공 이벤트 분리.
4. **Continuous Collision:** 고속 낙하/점프 중 swept TOI + 동시간대 수평 겹침 검사.
5. **가드 P0 수정:** 원거리/위험선 트리거 제거, 준비→진짜 접촉→정지→반발→재낙하 상태기계 적용. 접촉 이벤트 1회 처리.
6. **층 파괴 연결:** 파괴된 층 제거 후 다음 층이 **물리적으로 재접촉**하도록 낙하 템포 보정. 미접촉 자동 데미지 금지.
7. **연출 정합:** 실제 접촉 지점 기준으로 타격/가드 소리·포즈·스파크·짧은 정지·카메라. 효과는 확인된 이벤트만 구독.
8. **테스트:** 본 문서 CT/GD/VIS 자동 테스트 + A~F 플레이 QA 통과. 기존 v1/v2 회귀 테스트 실행.
9. **리포트:** 실제 수정한 소스 경로, 핵심 변경, 접촉/가드 실측값, 30/60/120fps 결과, 남은 결함을 **검증 결과와 함께** 제출. 실패한 테스트를 숨기지 말 것.

### 완료 판정 (Definition of Done)

- [ ] **거리가 떨어졌는데 건물이 부서지는 문제 0건** (CT-01~CT-12).
- [ ] **실제로 붙을 때만 공격 HP가 감소**하며 충돌면과 보이는 이미지가 일치.
- [ ] **가드 버튼만으로 원거리에서 건물이 반응하는 현상 0건**.
- [ ] **급강하 2.4배 건물을 정확한 접촉 순간에 0.12초 받아내고 멈춤**.
- [ ] **가드 때 손/검과 건물 사이가 벌어지지 않고**, 반발도 순간이동하지 않음.
- [ ] **이중 가드·이중 타격·이중 게이지 소비·이중 라이프 감소 0건**.
- [ ] 층 파괴 후 재접촉 전에는 허공 공격, 재접촉 뒤에는 빠른 연속 공격 정상.
- [ ] 30/60/120fps, 모바일 및 느린 기기에서 동일 판정.
- [ ] 기존 점프 높이, 콤보, 점수, 필살기, 3레인/3목숨, 랜드마크 구조 유지.
- [ ] **xAI API는 개발용 비식별 에셋 생성에만 사용**. 실제 게임 실행 중 API 호출 0건.

---

## 13. Claude Code에 전달할 최종 구현 지시

> 이 문서는 새로운 아이디어 제안이 아니라 **현재 게임의 치명적인 공격 거리 판정 오류와 가드 물리/연출 결함에 대한 실제 코드 수정 지시서**다. 기존 저장소를 조사하여 관련 함수·상태·렌더 앵커를 직접 고치고, 접촉 기반 공격과 swept collision 및 가드 상태기계를 통합하라. 특히 **캐릭터와 건물이 떨어져 있는데 HP가 감소하면 무조건 실패**로 판단하라. 가드는 고속 낙하 시에도 **정확히 닿는 순간 짧게 정지한 뒤 자연스럽게 밀어내며**, 원거리에서 가드만 눌러 건물이 멈추거나 순간이동하면 실패다. 위의 테스트를 실제로 실행하고 수정 파일과 검증 결과를 보고하라. 기존 UI·랜드마크·목숨·콤보·필살기와 개발 시 에셋 생성 정책은 유지하라.

**최종 체감 목표:** 가까이 붙어야 비로소 공격이 맞고, 떨어지는 건물을 마지막 순간에 가드로 **정말 받아내는 듯한 '쿵!—정지—반발'**이 느껴지는 게임.
