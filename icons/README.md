# 커스텀 메뉴 아이콘

이 폴더에 아래 이름으로 이미지를 넣으면 행동 메뉴에 자동 적용됩니다.
파일이 없으면 기본 이모지로 표시됩니다. (png 우선, 없으면 svg 탐색)

## 권장 규격
- 포맷: **PNG(투명 배경)** 또는 SVG
- 크기: 64×64 ~ 128×128 정사각형 (메뉴에는 22px로 표시)
- 톤: 게임 UI가 다크 테마이므로 밝은 색/흰 윤곽 계열 추천

## 메인 행동 (5종)
| 파일명 | 용도 |
|---|---|
| `attack.png` | ⚔ 공격 |
| `ultimate.png` | ⚡ 필살기 |
| `strategy.png` | 📜 책략 |
| `item.png` | 🎒 아이템 |
| `wait.png` | 🚩 대기 |
| `back.png` | ← 돌아가기 (서브메뉴) |

## 책략별 (선택)
`spell_<id>.png` — 예: `spell_fire.png`(화계), `spell_water.png`(수계),
`spell_heal.png`(회복), `spell_dark.png`(요술)

## 아이템별 (선택)
`item_<id>.png` — 예: `item_potion.png`(회복약), `item_herb.png`(약초),
`item_tea.png`(명차)
