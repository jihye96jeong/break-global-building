# WORLD BREAKER — Gameplay Recovery & Arcade Impact HOTFIX v4.0

## 기존 구현에 직접 적용하는 수정 지시서 | Claude Code / Cursor 전달용

> **목적**: 현재 실행 화면에서 확인된 6개 문제를 실제 코드 레벨에서 수정한다. 신규 게임을 처음부터 생성하지 말 것. 원작 오마주 게임의 핵심인 `접촉 → 공격 / 가드 → 층 단위 파괴 → 빠른 추락 → 극적인 필살기`를 정상 작동시키는 것이 목표다.
>
> **선행 문서**: `building_breaker_complete_implementation_spec.md`(v1), `world_breaker_game_feel_upgrade_v2.md`(v2), `world_breaker_contact_combat_guard_precision_v3.md`(v3).
>
> **규칙 우선순위**: **본 v4가 기존 v1/v2/v3의 충돌되는 요구사항보다 우선**. 특히 **가드 게이지·가드 에너지·가드 준비 타임아웃·가드 잠금·가드 부족 시 실패·장시간 키 홀드 실패**를 모두 폐기한다.
>
> **스코프**: 현 프로젝트를 분석하고 기존 파일을 수정하며 실제 브라우저에서 재현→수정→검증한다. 단순히 함수 예시를 추가하거나 이펙트만 그리는 것은 구현 완료가 아니다.

---

# 0. 현재 증상 및 완료 후 목표

| 번호 | 지금 문제가 되는 증상 | 반드시 달라져야 하는 동작 | 우선순위 |
|---|---|---|---|
| 1 | 건물에 깔리면 목숨만 1 줄고 캐릭터가 바닥에 끼인 채 남음. 그 상태에서 베면 층이 깨지고 건물이 갑자기 높게 떠오름 | **한 번의 피격으로 목숨 정확히 1 감소**, 짧은 충격 연출 후 현재 건물 제거·안전 위치 복귀·다음 건물 등장. 피격 처리 도중 공격/가드/물리 업데이트 차단 | P0 |
| 2 | 조작 지시 문구가 화면 중앙에 한 글자씩 세로 줄바꿈되고 캐릭터·HUD를 가림 | **가이드 UI 수평 정렬**, 게임 중에는 소형 가이드 또는 토글, 전체 키 설명은 시작/일시정지 메뉴에서만 | P0 |
| 3 | 캐릭터가 건물 바로 아래에서 가드해도 실패 | **실제 접촉 시 가드를 누르거나 누르고 있으면 항상 성공**. 충돌 판정보다 가드 우선. 자원 조건·짧은 준비 창·키 재입력 강요 없음 | P0 |
| 4 | 건물이 너무 천천히 내려와 위기감 없음 | 초반은 읽을 시간 제공, **진행할수록 눈에 띄게 가속**, 후반은 빠른 낙하를 가드로 세우는 쾌감 | P0 |
| 5 | GUARD 바/잔량 표시가 있고 소모됨 | **가드 자원·게이지 완전 삭제**. 플레이 중 무제한 사용 | P0 |
| 6 | 필살기가 단순히 건물 제거 수준이라 통쾌하지 않음 | **건물 가장 아래부터 최상단까지 거대한 검격이 솟구치며 층을 연쇄 파괴**. 전 화면 공간 연출, 파편·광원·사운드·카메라가 동기화 | P1 |

### 절대 유지할 기존 사항

- 목숨 3개, 좌·중·우 3레인, 점프 높이(v2), 근접 공격 95ms 간격(v3), 각 층 좌·중·우 HP 1~3, 한 구역을 깨면 해당 층 전체 파괴, 연속 콤보, 점수, 스페셜 충전.
- **일반 공격은 캐릭터와 건물의 실제 접촉면이 닿은 때에만 적중**(v3 원거리 타격 금지 유지).
- 유명 랜드마크 구조물, 로컬 HTML5 Canvas/JS 플레이, 이미지/사운드 사전 제작, **xAI API는 개발 중 정적 에셋 생성에만 사용**. 게임 플레이 중 API 호출 금지.
- 건물의 논리 Y 위치를 한 상태에서 한 updater만 변경. 건물 도약·텔레포트 금지.

---

# 1. 구현 전 코드 진단 — 먼저 실제 원인을 추적

다음 패턴을 전역 검색하고, 코드의 실질적 실행 경로를 추적하라.

```text
guardEnergy, guardMeter, guardBar, guardGauge, energyCost,
guardCooldown, inCooldown, lockedUntilRelease, readyWindow,
GUARD_READY, GUARD_HOLD, guardHeld,
isCrushed, crushing, damageTimer, invulnerable, hitStop,
collision, groundY, bottomY, playerTopY, overlap, attackCurrentFloor,
fallSpeed, velocityY, speedMultiplier, spawnY,
special, cutin, activeFloors, floorRemoved,
controls, helpText, instruction, keyGuide, HUD, overlay
```

1. **가드 조건 확인**: 미리 `READY`가 되었어야만 성공하는지, 에너지 부족/쿨다운/착지 상태/콤보 상태 때문에 접촉 가드가 실패하는지 로그로 검증.
2. **충돌 순서 확인**: `loseLife()`가 `resolveGuard()`보다 먼저 실행되지 않는지. `building.bottomY > playerTopY`가 된 뒤에야 접촉을 확인하는 프레임 관통 버그가 있는지.
3. **건물 Y 쓰기 경로 확인**: `updateBuildingFall`, `resolveGuard`, `attackRecoil`, `floorCollapse`, `damageRecovery`, `special`이 같은 프레임에 중복으로 위치를 변경하지 않는지.
4. **피격 상태 추적**: 생명만 차감하고 건물과 캐릭터가 그대로 중첩되는지, 피격 중 키 입력과 HP 판정이 허용되는지.
5. **DOM/CSS 구조 확인**: 게임 canvas를 덮는 가이드가 좁은 `width`/`max-width`/`flex-shrink`/`writing-mode`/`word-break: break-all` 때문에 한 글자씩 세로 정렬되는지. 화면 캡처에서 캐릭터와 UI가 서로 겹친다.
6. **특수 효과 소유권 확인**: 스페셜 동안에도 낙하/충돌/공격 코드가 현재 건물을 조작하는지.

**개발 순서**: 로그 추가 → 재현 자동 테스트 → 로직 수정 → 기존 게임과 통합 → 실제 브라우저로 영상/스크린샷 확인. 추정만으로 특정 라이브러리나 코드 파일이 원인이라고 단정하지 말 것.

---

# 2. 최우선: 깔림(CRUSH) 후 영구 끼임 현상 제거

## 2.1 정해진 동작 — 깔리면 한 번 피격되고 라운드가 복구된다

```text
정상 낙하 (FALLING)
  └─ 캐릭터 몸/지면 위험 접촉, 가드·공격·스페셜로 처리되지 않음
      ├─ 같은 충돌 이벤트에서 life -= 1 (딱 한 번)
      ├─ 콤보 초기화, 피격 판정 비활성, 현재 건물 위험 비활성
      └─ DAMAGE_IMPACT (약 130ms)
          ├─ 캐릭터 순간 움찔·압축 + 바닥 충돌 먼지/충격음
          └─ 현 건물 무너짐/분산/사라짐 (충돌체 제거)
              └─ RECOVER (약 270ms)
                  ├─ 캐릭터 안전한 지면·현재 선택 레인으로 이동
                  ├─ 애니메이션 정상 자세 복원
                  └─ 다음 건물 진입 (목숨 > 0)
                       └─ 다시 FALLING
```

- 피격 후 **캐릭터가 건물 안에 갇혀 있어서는 안 된다.** 복구 전에는 건물 충돌체를 비활성화한다.
- 피격 순간 현재 건물은 플레이 대상에서 제거한다. **맞은 건물을 높이 재발사하거나, 공격으로 탈출하도록 요구하지 않는다.**
- **목숨 0**이면 피격 애니메이션 직후 `GAME_OVER`, 다음 건물 생성 금지.
- 마지막 안전한 플레이어 레인과 지면 위치를 복원한다. X 좌표는 그 레인의 중심, feetY는 groundY.
- 공중 피격이어도 이 복구 시스템으로 통일하되, 플레이어 연출은 공중에서 밀리는 애니메이션을 사용할 수 있다.
- 피격 후 무적시간 **1.25초**(기존 v1 유지). 무적은 생명 추가 감소 방지용. 다음 건물의 이동/가드/공격을 영구적으로 막는 락이 아니다.

## 2.2 한 번의 충돌에서 life -1만 실행

```ts
// 구현 구조를 안내하는 TypeScript 의사코드. 실제 프로젝트 JS로 포팅.
type Phase = 'PLAY' | 'DAMAGE_IMPACT' | 'RECOVER' | 'SPECIAL' | 'GAME_OVER';

function takeCrushDamage(game, contact) {
  if (game.phase !== 'PLAY') return false;
  if (game.player.invulnerableUntilGameTime > game.clock.gameTime) return false;
  if (game.building.collisionDisabled || game.building.resolved) return false;
  if (!contact.isActualBodyCrush) return false;

  game.phase = 'DAMAGE_IMPACT'; // 먼저 잠금: 같은 틱 재입장 불가
  game.player.lives = Math.max(0, game.player.lives - 1);
  game.combo.reset();
  game.currentAttack?.cancel();
  game.guard.cancelWithoutSuccess();
  game.building.collisionDisabled = true;
  game.building.motionOwner = 'DAMAGE_SEQUENCE';
  game.building.resolved = true; // 같은 건물로 점수·HP 처리 금지
  game.damageSeq = { elapsed: 0, buildingId: game.building.id, phase: 'IMPACT' };
  game.events.emit('PLAYER_CRUSHED', { contact, remainingLives: game.player.lives });
  return true;
}
```

### 복구 중 절대 금지

- 공격 키를 눌러 `floor.hp`를 감소시키는 것.
- 건물이 남아 있는 것으로 인식되어 다시 `PLAYER_CRUSHED`를 발행하는 것.
- 현재 건물을 한순간 100wu 올렸다가 다시 떨어뜨리는 것.
- `setTimeout()` 콜백과 고정 시간스텝 로직이 경쟁해 서로 다른 위치로 캐릭터/건물을 옮기는 것.
- `damageSeq`가 끝났는데 캐릭터가 영구적으로 `isCrushed=true`에 남아 있는 것.

### 필수 가드레일

```js
function applyNormalAttack(game, hit) {
  if (game.phase !== 'PLAY') return false;
  if (!hit || !hit.trueMeleeContact) return false;
  if (game.building?.collisionDisabled || game.building?.resolved) return false;
  // v3 실제 접촉 검증 후에만 기존 floor HP를 감소시키기
  return applyHitToCurrentFloor(game, hit);
}
```

---

# 3. 가드 v4 — 가까이서 누르면 100% 성공, 자원 무제한

## 3.1 사용자 체험 표준

가드의 핵심은 **건물이 아무리 무섭게 떨어져도 실제로 붙는 순간 멈춰 주는 쾌감**이다.

```text
빠르게 추락하는 건물 ↓↓↓↓↓↓↓
                ▼
캐릭터가 아래에서 가드 버튼 누름/누르고 있음
                ▼
손·무기·캐릭터 가드 포즈와 건물의 실제 밑면 접촉
                ▼
0ms      [쾅!] 낙하 0으로 즉시 정지 / 절대로 생명 감소 X
0~120ms  손/무기와 건물 완전 밀착 · 무릎 압축 · 덜컹임
120~290ms 건물을 위로 약 36wu 천천히 밀어냄
290~360ms 다시 낙하가 점진적으로 가속
              ▼
접촉이 새로 발생했을 때 또 가드 가능 (횟수/잔량 무제한)
```

### 예외 없는 성공 요건 (MUST)

- `phase === 'PLAY'`이고, 현재 건물의 실제 하단이 캐릭터의 **활성 가드 접촉면과 맞닿을 때**, `guardHeld === true` 또는 **이번 물리 틱에 guardPressed === true**라면 반드시 성공.
- **가드 버튼을 일찍 누르고 계속 유지해도** 실제 접촉 순간 성공. v3의 `READY 180ms 만료 → LOCKED_UNTIL_RELEASE`를 **삭제**한다.
- **건물이 이미 딱 붙은 상태에서 방금 가드 키를 눌러도** 같은 프레임에 성공. `wasReady`를 요구하지 않는다.
- **가드 횟수 제한·게이지·코스트·에너지 회복·버튼 재입력 강요 없음**.
- 실패가 허용되는 상황은 `건물과 아직 실제로 닿지 않음`, `다른 레인/X 비중첩`, `이미 피격 확정되어 DAMAGE_IMPACT/RECOVER 중`, `SPECIAL/게임오버 중`뿐이다.
- **이미 가드 성공해서 HOLD/REPEL 중일 때**는 같은 접촉을 재발동하지 않는다(성공이 유지 중이므로 거절 아님).
- 빠른 낙하로 한 프레임에 접촉면을 관통하더라도 **swept collision / time-of-impact(TOI)** 검출로 접촉 시각에 정지.
- 게임 화면에서 눈에 보이는 접촉 오차 목표 **2px 이하**; v3의 `touchEpsilonWu ≤ 2` 유지, 에셋별 실제 바닥 앵커 보정.
- 현재 접촉면에 건물이 이미 끼여 깊이 관통한 상태는 새 가드 입력이 뒤늦게 과거 피격을 취소하지 않도록, 관통 원인을 먼저 해결한다.

## 3.2 기존 가드 게이지/제약 완전 제거

**삭제해야 할 항목**

- `guardEnergy`, `guardMeter`, `guardGauge`, `guardMaxEnergy`, `guardDrainPerSecond`, `guardRegen`, `guardCost`, `guardBreakOnEmpty` 및 동일 목적 필드.
- DOM `<div class="guard-meter">` 등 가드 바, `GUARD 100%` 텍스트, 화면 좌측의 GUARD 게이지.
- 에너지를 소모하거나 부족해서 막지 못하는 조건.
- `READY`가 180/250ms 후 소멸하는 타임아웃, `LOCKED_UNTIL_RELEASE`.
- 가드 버튼을 계속 누르면 실패하게 만드는 키업 재무장 조건.

**남기는 것**

- 접촉 상태 제어용 `GUARD_HOLD`, `GUARD_REPEL`, `GUARD_RELEASE`.
- 중복 같은 접촉을 60fps에서 수십 번 처리하지 않기 위한 **현재 접촉 이벤트 ID 래치**. 래치는 자원 제한이나 재사용 쿨다운과 다르다.
- 지상/공중 가드 차이(지상 120ms·36wu, 공중 100ms·18wu)와 기존 콤보 정책. *단, 무제한 가드 때문에 지상 가드의 콤보 초기화는 유지.*

## 3.3 이벤트 우선순위: 가드가 목숨 감소보다 무조건 먼저

**한 물리 틱 내 판정 순서**

1. 입력 큐를 수집하여 `guardPressedThisTick`, `guardHeld`를 확정.
2. 캐릭터와 건물의 이전·예측 위치를 계산. **접촉이 일어나는 TOI를 탐색**.
3. `SPECIAL` 우선 확인.
4. **실제 가드 접촉 + 가드 입력 → 가드 성공 확정**. 그 시각에서 낙하 중지.
5. 정확한 근접 공격이 유효하면 공격 판정(동시에 가드면 가드 우선).
6. 위에서 해소되지 않은 실제 압착 접촉이 있으면 목숨 -1.
7. 해당 틱 최종 상태/카메라/렌더 업데이트.

`life--` 또는 `CRUSHED` 발생 이후 가드를 검사하면 구현 실패다.

### 참고 구현 의사코드

```js
function resolveContact(game, toi, input) {
  // 하나의 접촉 이벤트를 여러 분기로 동시에 소비하지 않는다.
  if (game.phase !== 'PLAY' || !toi) return;
  if (input.specialPressed && game.specialGauge >= 100) {
    return startSpecial(game); // 충돌체 즉시 비활성
  }

  const trueTouch = toi.physicalTouch && toi.horizontalOverlap && toi.laneMatches;
  const guardWanted = input.guardHeld || input.guardPressedThisTick;

  if (trueTouch && guardWanted && game.guard.phase === 'IDLE') {
    return startGuardAtTOI(game, toi); // 항상 성공, 자원 검사 없음
  }
  if (trueTouch && game.guard.phase !== 'IDLE') {
    return; // 이미 가드 접촉/반발/해제 중: 같은 충돌 재피해 금지
  }
  if (trueTouch && input.attackActive && toi.meleeContact) {
    return resolveExactMeleeHit(game, toi);
  }
  if (toi.isActualBodyCrush) {
    return takeCrushDamage(game, toi);
  }
}
```

**중요**: 위 예시는 판정 **우선순위 설명**을 위한 의사코드다. 실제 구현에서는 `trueTouch`가 가드 손끝 표면과 몸통 압착 표면 중 무엇을 의미하는지 분리해야 한다. 가드 실패의 근본 원인이 `guardSurface`와 `crushSurface` 앵커 불일치인 경우, `resolveContact`가 사용하는 TOI 후보에 두 표면을 모두 넣고 **접촉 시각이 더 빠른 이벤트부터** 평가하라. 같은 시각이면 `GUARD > ATTACK > CRUSH`.

## 3.4 손과 건물이 맞닿는 가드의 접촉 물리

| 상태 | 지상 가드 | 공중 가드 | 세부 연출 |
|---|---:|---:|---|
| 접촉 직전 | 언제든 홀드 가능 | 언제든 홀드 가능 | 캐릭터 팔/검 들어 준비, 건물 계속 낙하 |
| 접촉 HOLD | **120ms** | **100ms** | 건물 속도 `0`, `Y` 정확히 고정, 짧고 묵직한 쿵 |
| REPEL | **170ms / 위로 36wu** | **140ms / 위로 18wu** | 애니메이션 easing으로 반발, 순간 위치이동 금지 |
| RELEASE | **70ms** | **70ms** | `0 → 현재 웨이브 목표 낙하속도`로 복귀 |
| 자원 소모 | **0** | **0** | 무제한 |
| 콤보 | 기존대로 리셋 | 기존대로 유지 | 방어만 반복하면 득점하지 않음 |

- **HOLD 동안 건물 하단과 가드 손/검 끝의 접촉 Y는 계속 같은 값**. 캐릭터 몸 압축은 시각 포즈만 변형하며 접촉점이 벌어지지 않는다.
- `REPEL`은 실제 물리 경로를 렌더링하고, **카메라 흔들림은 캐릭터와 건물에 동일하게 적용**. 화면상 떨어져 보여선 안 된다.
- 게임 전체를 120ms 멈추지 말 것. **건물의 낙하 운동만 120ms 정지**시키고 파편·배경·사운드·캐릭터 버팀 애니메이션은 계속 작동.
- 반발이 끝나고 다시 접근해 **새 접촉 에피소드**가 발생하면 가드를 또 성공시킬 수 있다. 키를 여전히 누르고 있어도 작동한다.
- **가드가 무제한이라고 무제한 필살기 충전·점수 상승을 허용하지 않는다.** 가드는 HP 감소나 점수/필살기 게이지 충전 없음. 방어만 하면 오래 버틸 수 있지만 건물을 파괴할 수 없다.

### 신뢰할 수 있는 접촉 이벤트 ID

```text
contactEpisodeKey = `${building.id}:${floor.id}:${lane}:${contactSequence}`
```

- 한 번 HOLD→REPEL→RELEASE할 동안 `contactSequence`는 고정, 동일 접촉 이벤트 중복 성공/이펙트/타격 금지.
- 건물이 다시 실제로 떨어져 닿았을 때만 `contactSequence += 1`.
- 같은 층을 유지하더라도 위치가 실제로 떨어졌다가 재접촉했으면 다른 에피소드다.
- 건물 생성/층 전환 시 래치를 초기화; **오래된 쿨다운으로 새 건물의 가드를 막지 않는다**.

## 3.5 가드가 제대로 작동하는지 사용자 눈으로 확인

- 누르는 즉시 캐릭터가 검/팔을 받치는 자세를 취한다. `guardHeld` 입력이 빠졌는지 모르게 무반응이면 버그.
- 건물이 닿는 정확한 프레임에 `THUD`(묵직한 저음), 접촉 불꽃, 몸 압축, 카메라 2~4px 충격, 약 120ms 정지.
- 이후 위로 조금 밀어 올린 뒤 다시 내려와 긴장감을 이어간다.
- **이미 캐릭터와 1~2px 사이로 바짝 붙은 상태에서 가드 키를 눌렀다면 1프레임 이내 접촉 성공**. 가드 후 생명 감소는 버그.
- 20px 이상 멀리서 가드를 누르면 캐릭터만 준비. **건물은 당겨지거나 멈추지 않는다**. 계속 누르고 있으면 나중에 실제 접촉할 때 성공.

---

# 4. 낙하속도 재설계 — 초반 학습 → 후반 공포 → 가드 쾌감

## 4.1 왜 지금 게임이 지루한가

v1의 기본 속도 `115wu/s`에 최저 배율 1.0을 적용하면, 현재 카메라에서 건물이 캐릭터에 도달하기까지의 시간이 길게 느껴질 수 있다. 특히 아래층이 파괴된 뒤 재접촉까지 오래 걸리면 리듬이 끊긴다. **화면에서 캐릭터가 실제로 받는 압박 = 접촉까지의 남은 시간(TTC)** 을 지표로 조정한다.

## 4.2 v4 권장 기본 낙하속도

월드 높이 약 600wu 기준 초기 **`baseFallSpeed=190wu/s`**. 이후 파괴 건물 수에 따라 계단식 증가, 구간 안에서는 소폭 완만한 램핑을 선택할 수 있다. 아래 수치는 **시작 밸런스값**이며 실제 캐릭터 충돌면·출현 높이·캔버스 크기에 맞춰 TTC로 검증한다.

| 완파 건물 수 | 티어 | 기준 낙하속도 | 처음 체감 | 주목표 |
|---|---|---:|---|---|
| 0~2 | 1 | **190wu/s** | 빠르지만 반응 가능 | 이동/공격/가드 학습 |
| 3~5 | 2 | **240wu/s** | 속도가 확연히 증가 | 손이 바빠지기 시작 |
| 6~9 | 3 | **300wu/s** | 실수하면 닿을 정도 | 자주 가드하게 유도 |
| 10~14 | 4 | **390wu/s** | 빠른 대응 요구 | 가드-반격 리듬 |
| 15~19 | 5 | **490wu/s** | 위협적인 속도 | 타이밍 싸움 |
| 20+ | 6 | **600wu/s 시작, 650wu/s 상한** | 급강하 느낌 | 숙련자의 반복 생존 도전 |

**중요**: 이전 문서의 `115 × 티어 낙하 배율`과 **중복 곱하면 안 된다**. v4부터 낙하속도는 **위 표의 절대 속도를 단일 소스**로 삼는다. 스테이지 전환에서만 값을 바꾸며, 현재 건물이 HOLD 중이면 속도 회복 목표만 다음 낙하에 반영한다.

### 계단식 전환이 어색하다면

동일 티어 내 미세 보간만 사용한다. 예를 들어 `tierSpeed + 0~8%` 선에서 게임 내 진행 정도를 반영하되 **650wu/s 상한**을 넘기지 말 것. 모든 수치는 `balance.js` 또는 현재 프로젝트의 설정 파일 한 곳에서만 바꿀 수 있어야 한다.

## 4.3 실제 화면 기준 TTC 목표 (매우 중요)

```text
TTC = max(0, buildingVisibleBottomToPlayerGuardSurfaceDistance) / currentFallSpeed
```

| 상황 | 건물 최초 등장 → 최초 접촉까지 목표 |
|---|---:|
| 입문(0~2채) | **약 1.6~2.3초** |
| 초중반(3~9채) | **약 1.1~1.7초** |
| 중후반(10~19채) | **약 0.75~1.2초** |
| 극한(20채 이상) | **약 0.50~0.80초** |

- 위 TTC가 실제 화면에서 충족되도록 `spawnY`, `camera.worldScale`, `floorHeight`를 고려하라. 속도 숫자만 키우고 건물을 먼 곳에서 생성하면 여전히 답답하다.
- 전 화면을 지나가는 시간과 새 층 재접촉 시간 모두 체감에 영향을 준다. **새로 노출된 최하층은 자연스럽게 빠르게 떨어져 접근**해야 하며 접촉 없이 타격되면 안 된다.
- 가드 120ms 정지는 고속 티어에서도 동일하게 유지. **600wu/s → 딱 멈춤**의 대비가 재미의 핵심.
- 고속에서도 저프레임에서 물체가 몸을 관통하지 않도록 고정타임스텝 + swept TOI 유지.

## 4.4 속도 상승 연출

- 티어 상승 시 `SPEED UP!` 짧은 0.5초 플로팅 표시(화면 중앙이 아닌 상단 비혼잡 영역).
- 빠른 건물 뒤편에 약한 속도선, 주변 바람 효과, 접근 시 짧은 저음 상승(사전 에셋).
- 충돌 예상이 `TTC ≤ 0.35초`면 캐릭터에 작은 긴장 모션 또는 배경 비네트. **UI 시야를 가리지 않는 수준**.
- **게임에 시간을 끌기 위한 정적 정지는 만들지 말 것**. 첫 3채 외에는 다음 건물 전환 0.25~0.40초 권장.
- 느린 연출을 영상 프레임 저하로 구현하지 말고 게임 로직의 시간값으로 제어.

---

# 5. 일반 공격/층 파괴에서 건물 높게 튀는 현상 수정

- 일반 공격은 v3처럼 **진짜 접촉에서만** HP 감소. 95ms 반복 간격은 유지.
- **HP만 깎이는 타격**: 미세 충격, 균열, 2~4wu 이하의 작은 반응 가능. `building.bottomY -= 7`가 누적되어 건물이 위로 날아간다면 **이식된 반동 코드 제거 또는 비누적 시각적 반응**으로 변경.
- **한 층 완파**: 해당 층의 논리/시각 높이만 제거. 남은 건물은 새 밑면이 실제로 위에 위치하므로 다시 떨어짐. `floorHeight`만큼 위로 밑면이 이동하는 것은 구조상 정상이나, **추가 `-floorHeight`/`-85`/`-36` 중복 가산 금지**.
- **피격 중 공격**: 완전 차단(섹션 2).
- **가드 반발**: v4의 정상 가드에서만 HOLD 후 36wu/18wu 이동. 가드 중 타격 반동 및 층 붕괴 반동을 더하지 말 것.
- **건물 위치 소유권**: `FALLING | GUARD_HOLD | GUARD_REPEL | GUARD_RELEASE | DAMAGE_SEQUENCE | SPECIAL_SEQUENCE` 중 정확히 1개.

권장 불변식:

```js
if (phase === 'DAMAGE_IMPACT' || phase === 'RECOVER') {
  assert(noAttackDamage && building.collisionDisabled);
}
if (building.motionOwner === 'GUARD_HOLD') {
  assert(building.velocityY === 0);
}
if (building.motionOwner === 'GUARD_REPEL') {
  assert(!normalFallUpdaterOwnsY);
}
```

---

# 6. UI HOTFIX — 겹쳐진 지시문과 가드 게이지 삭제

## 6.1 첨부 스크린샷에서 명확히 보이는 문제

- `← → 이동 / ↑ 점프 / ↓ 가드 / Z 공격 / X 필살기 / Esc 일시정지 / M 음소거` 텍스트가 **캐릭터/검 위에서 폭 좁은 한 열로 줄바꿈**됨.
- `GUARD 100%` 및 `SPECIAL 0%` 막대가 캐릭터·조작 안내와 중첩.
- 화면 좌우 모서리의 HUD 레이블 일부가 잘려 보임.

## 6.2 최종 화면 배치

```text
┌───────────────────────────────────────────────────────────┐
│ ♥ ♥ ♥      SCORE 12,450     COMBO 24      [Ⅱ] [♪]       │  상단 HUD
│                                                           │
│                      낙하 중인 건물                       │
│                                                           │
│                                                           │
│                                                           │
│                         캐릭터                            │
│________________________지면_______________________________│
│  [←] [→] [↑] [Z] [↓]       SPECIAL ███████ 70% [X]      │  모바일/하단 HUD
└───────────────────────────────────────────────────────────┘
```

- **PC**: 실제 키 조작은 유지. `←/→ 이동 · ↑ 점프 · Z 공격 · ↓ 가드 · X 필살기`를 첫 실행에만 작고 **한 줄 또는 넓은 여러 칼럼**으로 표시하고 4초 후 숨기거나 `?` 도움말 버튼에서 표시.
- **모바일**: 기본적으로 화면 하단을 차지하는 터치 버튼은 별도 컨트롤 영역으로 구성. 실시간 안내 텍스트가 캐릭터 위에 겹치지 않도록 함.
- **가드 게이지 삭제**: 파란 GUARD 막대 및 100% 텍스트 제거. GUARD는 버튼/키 설명만 있으면 된다.
- **스페셜 게이지 유지**: 하단 우측 또는 상단 고정 위치에서 명확히 표시; 기존 필살기 0~100% 자원 유지.
- **상단 HUD**: 라이프3, 점수, 콤보, 음소거/일시정지. 작은 화면에서는 점수/콤보의 글자 크기와 간격 반응형 조절.
- 게임 중 화면 중앙은 **캐릭터·건물·파괴 연출을 위한 비침범 구역**. 평시 키 설명, 상시 토스트, 디버그 로그 출력 금지.

### CSS 레이아웃 방어 규칙

```css
/* 기존 셀렉터에 통합하되 구조 규칙 유지 */
.game-shell { position: relative; width: 100%; overflow: hidden; }
.game-canvas { display: block; width: 100%; height: 100%; }
.hud-top { position: absolute; top: max(8px, env(safe-area-inset-top));
           left: 12px; right: 12px; display: flex; gap: 12px;
           align-items: center; justify-content: space-between; z-index: 5; }
.control-hints { display: flex; flex-wrap: wrap; justify-content: center;
                 align-items: center; gap: 8px 14px; max-width: 100%;
                 min-width: 0; }
.control-hints > span { display: inline-flex; flex: 0 0 auto;
                        white-space: nowrap; word-break: keep-all;
                        writing-mode: horizontal-tb; }
/* 도움말은 주 게임 화면을 영구 점유하지 않도록 토글/일시 노출 */
@media (max-width: 600px) {
  .control-hints { display: none; }
  .hud-top { gap: 7px; font-size: clamp(11px, 2.5vw, 14px); }
}
```

- 텍스트를 절대 위치로 캐릭터 머리 근처에 고정하지 말 것.
- 게임 레이아웃을 크기 562×419, 390×844, 360×640, 1280×720에서 검사.
- 브라우저 확대 125%, 텍스트 200%에서도 게임 진행 UI가 한 글자씩 나열되지 않아야 한다.

---

# 7. 스페셜 — 건물 최상단까지 한번에 쓸어버리는 연출

## 7.1 의도

**필살기 = 위험한 건물을 아래에서 위까지 한 번에 베어, 카메라와 함께 검격이 꼭대기까지 치솟고 남은 모든 층이 연쇄 붕괴하는 하이라이트.** 무조건 눈에 보이는 최상단까지 진행한다. '눌렀더니 건물이 갑자기 사라짐'은 실패.

## 7.2 필살기 5단계 타임라인 (총 권장 1.05~1.50초)

| 단계 | 시간 | 구체적 연출 | 게임 논리 |
|---|---:|---|---|
| **A. 발동/위기 차단** | 0~100ms | 입력 즉시 캐릭터가 검을 지면에 스치며 힘 모음, 주변 원형 충격파, 배경 약한 어두워짐 | 게이지 100→0, 무적, 건물 충돌체 즉시 비활성 |
| **B. 거대한 첫 검격** | 100~250ms | 캐릭터가 아래에서 위로 대각→수직 검광 시작. 바닥/최하층 1~2개가 거대한 타격음과 함께 파괴 | 시각적 층 파괴 큐 시작 |
| **C. 최상단 연쇄 베기** | 250~950ms(층 수 따라 가변) | **검광이 건물의 아래에서 맨 위까지 실제 이동**, 층마다 시간차로 `쾅쾅쾅`, 대형·소형 파편, 불꽃, 잔광. 카메라가 검광을 따라 소폭 올라가거나 줌아웃 | 아직 표시 중인 건물을 렌더 전용 스냅샷으로 유지, 충돌은 꺼진 상태 |
| **D. 꼭대기 완파/피니시** | 약 950~1150ms | 최고층에 도착한 순간 별도 대형 폭발/방사형 충격파, 약 60~80ms 임팩트 스톱, 직후 잔해가 좌우로 갈라짐 | 남은 시각 층 0 확인, 점수 지급은 정확히 한 번 |
| **E. 빠른 복귀** | 약 1150~1500ms | 카메라 원위치, 캐릭터 착지/포즈, 잔광 소멸, 다음 건물 진입 | PLAY 상태 복원, 새 건물 생성 |

> 시간은 최대한 짧고 강해야 한다. **화려하더라도 2~3초짜리 지루한 컷신 금지**. 20층 구조물이어도 한 번에 스캔하듯 베는 연출을 보장한다.

## 7.3 아래→위로 연속적으로 찢어지는 시각 구현

- **현재 남은 최하층부터 최상층까지** 모든 층의 최초 render bounds를 촬영한 `specialVisualSnapshot`을 만든다.
- 검광 시작점 `slashY = bottomVisibleY`이고 종료점 `slashY = topVisibleY`. 0→1 진행률에 따라 **실제 세계 좌표에서** 위로 이동.
- 모든 층은 `slashY`가 자신의 중앙/하단 파괴 기준을 통과했을 때 **각각 한 번만** `visualExplode`.
- 검광은 폭 1~3개의 레인을 가로지르는 거대한 수직/사선 띠. 우측/좌측에 양방향 잔광과 구조물 균열이 앞서 전파됨.
- 파편은 아래로 중력, 큰 조각 좌우 분출, 먼지/속도선은 광원 뒤에 잔존.
- **파괴되지 않은 윗층이 남았는데 다음 건물이 등장하면 버그**. 시각 스냅샷의 `remainingVisibleFloors === 0` 확인 후 종료.
- 매우 높은 건물이 화면 위를 벗어나도 필살기가 최상단까지 도달했다는 것이 보이도록 200~400ms 내 짧은 카메라 줌아웃/패닝 또는 실루엣 축소 화면 적용.
- 전체 화면을 흰색으로 길게 덮지 않는다. 개별 층/검격 이동이 읽히는 게 중요.

### 스페셜 코어 의사코드

```js
function startSpecial(game) {
  if (game.phase !== 'PLAY' || game.specialGauge < 100 || !game.building) return false;
  const b = game.building;
  game.phase = 'SPECIAL';
  game.specialGauge = 0;
  b.collisionDisabled = true;
  b.resolved = true;          // 일반 공격/가드/피격 중복 방지
  b.motionOwner = 'SPECIAL_SEQUENCE';
  game.player.invulnerableSpecial = true;

  const visuals = snapshotRemainingFloorsBottomToTop(b);
  // 여기서 기존 floor HP/충돌/점수를 확정하되, 시각 객체는 종료까지 보존.
  awardSpecialScoreExactlyOnce(game, b, visuals);
  game.special = {
    elapsedMs: 0,
    visuals,
    startY: getBottomVisibleY(visuals),
    endY: getTopVisibleY(visuals),
    explodedIds: new Set(),
  };
  game.events.emit('SPECIAL_STARTED', { buildingId: b.id });
  return true;
}

function updateSpecialVisual(game, dt) {
  const s = game.special;
  s.elapsedMs += dt * 1000;
  const t = specialSweepProgress(s.elapsedMs, s.visuals.length); // 0..1
  const slashY = lerp(s.startY, s.endY, easeOutCubic(t));
  for (const floor of s.visuals) {
    if (!s.explodedIds.has(floor.id) && slashPassedFloor(slashY, floor)) {
      s.explodedIds.add(floor.id);
      spawnSpecialExplosion(floor); // 파편/사운드/검광; 논리 파괴는 중복 X
    }
  }
  if (sweepAndFinishComplete(s) && s.explodedIds.size === s.visuals.length) {
    finishSpecialAndSpawnNext(game);
  }
}
```

**상태 불변식**: 스페셜 시작 직후 충돌/피격 판정은 중지되지만, **시각적 건물은 종료까지 그대로 유지**. 필살기 중 `updateFallingBuilding()`와 `normalAttack`은 스킵. 스페셜로 층 점수와 건물 점수는 정확히 한 번, 스페셜로 스페셜 게이지 재충전 금지.

## 7.4 시각·사운드 디자인 필수

- **캐릭터**: 검을 땅에 붙이는 극적인 준비 → 몸통 회전 → 번개처럼 위로 베기 → 마무리 착지.
- **검광**: 얇은 선 하나가 아니라 핵심 밝은 검 궤적 + 양옆 넓은 충격면 + 오래 남지 않는 잔광.
- **연쇄 파괴**: 층마다 순서대로 서로 다른 길이의 파편 + 떨어지는 잔해. 맨 위 도달 시 가장 큰 폭발.
- **카메라**: 시작 1회 작은 줌인 → 검광 추적 → 최상부 짧은 임팩트 → 원위치. 흔들림 누적이 화면을 이탈시키지 않게 clamp.
- **음향**: 최초 충격 저음, 매우 짧은 연쇄 금속/유리/석재 파괴, 꼭대기 큰 피니시. 오디오는 로컬 번들, 런타임 생성 API 호출 X.
- **성능**: 저사양 모바일에서는 파티클 수를 줄여도 검광 이동·층별 순서·꼭대기 파괴는 유지. prefers-reduced-motion에서 과도한 화면 흔들림 감소.

---

# 8. 전체 상태기계 통합과 중복 업데이트 제거

```text
                    [PLAY]
     ┌────────────────┼──────────────────┐
     │                │                  │
유효 접촉 + 가드    실제 깔림         스페셜 100% + X
     │                │                  │
[GUARD_HOLD]    [DAMAGE_IMPACT]      [SPECIAL]
     │                │                  │
[GUARD_REPEL]     [RECOVER]          전체 층 시각 파괴
     │                │                  │
[GUARD_RELEASE]     PLAY/GAME_OVER       PLAY
     │
    [PLAY]
```

- `PLAY` 안에서 가드 상태만 오가는 구조도 가능하지만, **누가 건물 Y를 쓰는지** 반드시 단일화한다.
- `GUARD_HOLD` 중 **일반 낙하 updater 실행 금지**, `REPEL` 동안 `floorCollapse`가 강제 이동하지 못하도록 함.
- `DAMAGE_IMPACT`와 `SPECIAL`은 서로 배타적, 같은 프레임 라이프 감소와 스페셜 성공 동시 발생 금지.
- `paused`에서는 각 상태의 로컬 시간 자체가 정지. 해제 후 타이머가 한꺼번에 흘러 연출을 스킵하면 버그.
- X/↓/Z가 같은 프레임 입력되면 **SPECIAL > GUARD > ATTACK > DAMAGE** 우선.
- 입력 이벤트는 `performance.now`의 실제 시간으로 수집하되, 판정은 고정 시뮬레이션 시간 좌표로 정렬.

### 권장 메인 업데이트 순서

```js
function fixedUpdate(game, dt) {
  const input = game.input.consumeForCurrentTick();
  if (game.paused) return;
  game.clock.advance(dt);

  if (game.phase === 'DAMAGE_IMPACT' || game.phase === 'RECOVER') {
    updateDamageRecovery(game, dt);
    return;
  }
  if (game.phase === 'SPECIAL') {
    updateSpecialVisual(game, dt);
    return;
  }
  if (game.phase === 'GAME_OVER') return;

  updatePlayerPredictedMotion(game, dt, input);
  if (game.guard.phase === 'HOLD' || game.guard.phase === 'REPEL' || game.guard.phase === 'RELEASE') {
    updateGuardOwnedBuildingMotion(game, dt);
  } else {
    predictNormalBuildingMotion(game, dt);
    const contacts = computeSweptContacts(game); // 플레이어가 크게 점프해도 유효
    resolveContactsInTimeOrder(game, contacts, input);
    if (game.phase === 'PLAY' && game.building.motionOwner === 'FALLING') {
      commitNormalBuildingMotion(game, dt);
    }
  }
  updateNonBlockingVfxAndHud(game, dt);
}
```

- 위는 구조 예시다. 실제 프로젝트의 fixed timestep에서 **예측 이동을 이미 commit한 뒤 resolve하고 또 commit하여 이중 이동하는 버그**를 만들지 않도록, 예측과 commit의 경계를 명확히 할 것.
- **카메라 흔들림/렌더 오프셋**은 시뮬레이션의 논리 충돌 좌표를 변경하지 않는다.

---

# 9. 디버그 오버레이(개발 모드 한정) 및 확인 항목

실제 원인을 찾기 위한 개발자 토글 `F3` 또는 쿼리 `?debug=1`를 구현한다. 기본 게임 화면에서는 숨긴다.

| 항목 | 표시 값 |
|---|---|
| `buildingId`, `floorId`, `lane` | 현재 접촉 대상 |
| `phase`, `motionOwner`, `guardPhase` | 물리 Y 소유권/상태 |
| `buildingBottomY`, `playerGuardY`, `gap` | 가드 시각 거리 |
| `fallSpeed`, `targetFallSpeed`, `tier`, `TTC` | 현재 난이도 |
| `guardHeld`, `guardPressedThisTick`, `guardSuccessCount` | 입력 유실 여부 |
| `life`, `damageSequenceCount`, `invuln` | 중복 피격 여부 |
| `special.visualFloorsRemaining` | 최상단까지 끝났는지 |

디버그 시 **캐릭터 가드 접촉선과 건물 최하단 충돌선을 같은 world-to-screen 변환**으로 겹쳐 그린다. 두 선이 붙어 있는데 guard 성공이 안 뜨면 이벤트/상태 순서를 로그로 추적한다.

---

# 10. 테스트 — 기능별 자동화 + 실제 플레이 QA

## 10.1 반드시 통과할 자동화 테스트

### 피격/깔림 (P0)

- [ ] 가드를 하지 않고 건물에 깔리면 목숨 3→2 **정확히 1 감소**.
- [ ] 피격 직후 60프레임 동안 키를 아무리 눌러도 동일 건물에서 목숨이 중복 감소하지 않음.
- [ ] 피격 상태에서 Z 연타해도 현재/충돌 종료 건물의 HP·점수·게이지 변화 0.
- [ ] 피격 상태에서 건물 Y가 갑자기 수십 wu 위로 이동하지 않음.
- [ ] 피해 처리 완료 후 캐릭터가 건물 내부에 갇히지 않고 지면 안전 좌표로 돌아옴.
- [ ] 목숨 1→0이면 GAME OVER, 다음 건물 생성 X.

### 가드 (P0)

- [ ] 접촉 **0~2wu**에서 ↓를 처음 눌러도 해당 틱에 가드 성공, 생명 감소 0.
- [ ] 50wu 떨어진 상황에서 ↓ 홀드 → 실제 접촉까지 건물 낙하 계속 → 접촉 순간 가드 성공.
- [ ] ↓를 1초 이상 누르고 있어도 실제 재접촉하면 가드 성공(READY 타임아웃/게이지 없음).
- [ ] 최고 속도 650wu/s + 30fps에서도 TOI 감지로 정상 가드.
- [ ] 가드 시작 시 건물 velocityY=0, 120ms 동안 접촉 위치 고정.
- [ ] HOLD 종료 후 36wu를 170ms에 걸쳐 **연속 이동**, 순간 `-36wu` 이동 금지.
- [ ] 건물이 충분히 떨어져 있으면 건물 멈춤/가드 성공 이펙트 없음.
- [ ] 새 접촉 에피소드에서 가드 재사용 횟수 제한 없음.
- [ ] 동일 접촉에서 가드 성공 이펙트는 단 1회.
- [ ] GUARD UI 바, 100% 잔량, 소모 로직, 관련 HUD 텍스트 0개.
- [ ] 같은 틱에서 가드 + 몸 충돌이면 가드가 우선하고 `life` 불변.

### 속도/판정 (P0)

- [ ] 0~2채 낙하속도 190wu/s, 3~5채 240wu/s, 10~14채 390wu/s, 20채 이상 최대 650wu/s.
- [ ] 이전 v1 배율이 한 번 더 곱해지지 않음.
- [ ] 각 티어의 실제 최초 접촉 TTC가 목표 범위인지 로깅.
- [ ] 렌더 30/60/120fps에 따른 충돌 누락/피격 차이 없음.
- [ ] 건물과 캐릭터 사이 20wu 떨어져 있으면 Z 공격으로 HP 감소 0.
- [ ] 층 파괴 후 새 층이 재접촉하기 전에 공격 적중 0.
- [ ] 일반 공격/층 파괴에서 v4가 허용하지 않은 큰 순간 위치 이동 없음.

### UI (P0)

- [ ] 562×419 화면에서 안내 문구가 캐릭터와 건물을 가리지 않음.
- [ ] 562×419 및 360×640에서도 안내 문구 글자별 세로 줄바꿈 없음.
- [ ] 390×844/1280×720에서도 HUD 좌우 잘림 없음.
- [ ] GUARD 에너지 바 삭제, SPECIAL 바는 읽기 쉽게 남음.
- [ ] `?` 또는 시작/일시정지 메뉴에서 전체 키 안내가 정상 표시됨.

### 스페셜 (P1)

- [ ] 게이지 100에서 X 1회 → 0으로 소모, 즉시 건물 충돌/피격 비활성.
- [ ] 현재 남아 있는 **모든 층**이 아래에서 위 순서대로 시각 파괴.
- [ ] 화면 최상단 이상 길게 뻗은 건물도 끝층까지 검광 추적.
- [ ] 마지막 층 폭발 후 건물 0개 상태, 다음 건물은 정상 낙하로 등장.
- [ ] 스페셜 실행 중 life 감소 0, 일반 공격 추가 점수 0.
- [ ] 파괴된 층·건물 보너스의 중복 지급 0.
- [ ] 최상층 도달 후 카메라가 정상 위치로 복귀.
- [ ] 낮은 성능 모바일 모드에서도 층별 파괴 순서/검광은 유지.

## 10.2 체감 QA (사람이 직접 확인)

1. **입문**: 3초 이상 건물이 멀리 정지해 보이지 않는가? 처음 등장부터 압박이 느껴지는가?
2. **가드**: 건물이 빠르게 떨어질수록 정지의 대비가 확실하게 느껴지는가? 정확히 접촉 순간 멈추는가?
3. **가드 무한**: 키를 누른 채 재접촉하면 또 막히는가? 잔량이 없어서 막히지 않는 상황은 완전히 사라졌는가?
4. **일반 공격**: 공격 맞는 순간이 이해되는가? 허공에서 베어도 건물이 파괴되지 않는가?
5. **피격**: 목숨만 하나 줄고 캐릭터가 끼인 채 멈추지 않는가? 0.5초 안팎으로 다음 플레이에 복귀하는가?
6. **스페셜**: *건물 전체가 위끝까지 시원하게 찢어졌다*는 느낌인가? 단순 페이드/삭제가 아닌가?
7. **UI**: 첫 화면에서 캐릭터, 건물, 라이프, 스페셜을 동시에 쉽게 읽을 수 있는가?

---

# 11. 구현 순서 (반드시 이 순서로)

### Phase A — 게임 상태/판정 안정화 (필수)

1. 기존 코드의 가드 실패 조건 및 피격 루프를 찾아 재현 로그 확보.
2. `PLAY / DAMAGE_IMPACT / RECOVER / SPECIAL / GAME_OVER` 분리.
3. 피격 이벤트 1회 확정, 현재 건물 충돌체 제거, 캐릭터 위치 자동 복구.
4. 접촉/가드/공격/압착 판정 시간순으로 정렬, `SPECIAL > GUARD > ATTACK > DAMAGE` 적용.
5. 공격·가드·피격 때 Y좌표 이중 갱신 제거.

### Phase B — 가드 무제한화 및 낙하 가속 (필수)

6. 가드 에너지 데이터/UI/소모/회복/부족 조건 전부 제거.
7. 가드를 누르고 있는 동안 실제 접촉 시 무조건 성공하도록 처리.
8. HOLD 120ms → REPEL 170ms/36wu → RELEASE 70ms 정밀 구현.
9. 티어별 절대 낙하속도/TTC 적용, swept collision 검증.

### Phase C — UI 복구 (필수)

10. 세로로 깨진 키 안내 요소의 레이아웃/DOM 원인 제거.
11. 상단 HUD·스페셜 게이지·모바일 버튼/도움말 배치.
12. 4가지 화면 크기로 화면 캡처·실측 검수.

### Phase D — 스페셜 연출 (필수)

13. 스페셜 시작 즉시 충돌 비활성 + 렌더 스냅샷 저장.
14. 건물 최하층→최상층으로 이동하는 검광과 순차 층 파괴.
15. 최고층 피니시·카메라·사전 준비된 사운드 연동.
16. 스페셜 종료 후 새 건물 진입과 점수/게이지 중복 처리 검사.

### Phase E — 최종 검증 (필수)

17. P0/P1 자동 테스트 실행, 실패한 케이스 수정.
18. 브라우저에서 **저속 1티어 / 고속 6티어 / 가드 홀드 / 이미 바짝 붙은 가드 / 깔림 복구 / 스페셜**을 각각 직접 플레이.
19. 스크린샷(562×419 필수)과 가능하면 짧은 플레이 영상으로 레이아웃/손맛 확인.
20. 변경 코드, 실제 테스트 결과, 남은 이슈가 있으면 파일별로 보고.

---

# 12. 완료 정의(Definition of Done) — 전부 만족해야 완료

- [ ] **깔리면 목숨은 1만 줄고, 캐릭터가 갇힌 상태를 0.5초 이상 유지하지 않는다.** 복구 후 다음 건물 정상 시작.
- [ ] **건물과 가드 접촉면이 바짝 붙은 상태에서 ↓를 누르면 가드가 반드시 작동**한다(무한 사용).
- [ ] 650wu/s 급강하에서도 **쾅 → 약 120ms 정지 → 힘으로 밀어올림 → 재추락**이 실제로 보인다.
- [ ] 가드 게이지와 GUARD 100%가 UI 및 게임 로직에서 완전히 삭제되었다.
- [ ] 건물 낙하속도가 초반과 후반에 명확한 차이가 나며 후반이 지루하지 않다.
- [ ] 화면 하단 가이드가 정렬되고, 캐릭터 위에 세로로 깨지는 키 설명이 없다.
- [ ] 필살기를 쓰면 **화면에 남아 있는 건물 전체가 최하층부터 최상층까지 실제 이동하는 검광과 함께 연쇄 파괴**된다.
- [ ] 공격이 원거리에서 적중하지 않고, 가드 성공 상태에서 같은 접촉으로 목숨이 감소하지 않는다.
- [ ] 기존 3레인·3목숨·층별 HP·콤보·점수·필살기 충전·랜드마크 데이터는 깨지지 않았다.
- [ ] 게임 플레이 중 xAI 또는 이미지/음성 생성 API 네트워크 호출이 없다.

---

# 13. Claude Code에 전달할 직접 실행 지시

```text
현재 프로젝트 코드를 대상으로 WORLD BREAKER v4.0 HOTFIX를 실제 구현하라.

첨부된 world_breaker_gameplay_hotfix_v4.md를 최상위 우선 명세로 삼아라.
기존 v1/v2/v3와 충돌하는 부분은 v4의 값과 동작이 무조건 우선이다.

핵심 P0:
1) 깔림 시 생명 -1 이후 현재 건물의 충돌을 끝내고 캐릭터 자동 복구;
   피격 중 공격으로 건물이 튀거나 층이 파괴되지 않도록 수정.
2) HUD에서 가드 게이지/잔량 및 소모 로직 완전 삭제.
3) ↓가 눌려 있거나 접촉 상태에서 새로 눌리면, 실제 맞닿는 순간
   타이머·자원·쿨다운 제한 없이 가드가 반드시 성공하게 수정.
4) 가드 성공 즉시 건물 속도 0 → 120ms 밀착 정지 →
   약 36wu 애니메이션 반발 → 매끄럽게 재낙하.
5) 건물 낙하속도를 190→240→300→390→490→600~650wu/s로
   파괴 건물 수에 따라 증가, 실제 접촉 TTC 검증.
6) 캐릭터 위에 세로로 깨지는 키 안내 제거 및 레이아웃 재배치.

핵심 P1:
7) 스페셜 X는 건물 밑바닥부터 맨 위까지 검광이 솟구치며
   전 층이 순서대로 폭발·붕괴하는 1~1.5초짜리 극적인 연출.

반드시 현재 구조와 상태 업데이트 순서를 먼저 추적하고 원인을 수정하라.
단순한 CSS 임시조치, 이펙트 추가, 문서 작성만으로 끝내지 말 것.
가능한 자동화 테스트와 실제 브라우저 테스트를 돌리고 결과를 보고하라.
런타임 xAI API 호출은 금지한다.
```
