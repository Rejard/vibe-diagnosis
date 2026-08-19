# 1.8.0 지시문 — `run_diagnostics` 응답 축소

이 문서는 다른 대화창에서 이어서 작업하기 위한 인계다. 조사와 설계 결정은 끝났고
구현만 남았다. 아래 수치는 실측이므로 다시 재지 않아도 된다.

## 왜 하는가

AloBTC 프로젝트(진단 241개)에서 `run_diagnostics` 를 호출했더니 응답이 도구 한도를
넘겼다. 실측:

```
전체 응답        532,328자 = 152,094 토큰
  results        375KB (70.4%)
  그중 OK 항목   375KB (100%)   ← 통과 241개
  비OK 항목      0KB
  summary        54자
```

**통과 항목이 응답의 70%를 차지하고 결정에는 0 기여한다.** 에이전트가 알아야 할 것은
"실패가 있나, 있으면 왜인가" 뿐이다.

## 페이지 나누기는 답이 아니다

처음 나온 안은 50개씩 페이지였다. 검토 결과 에이전트에게는 오히려 나쁘다.

| | 현재 | 50개 페이지 | 요약+실패 |
|---|---|---|---|
| 호출 횟수 | 1 | 5 | 1 |
| 총 토큰 | 152,094 | 152,094 + 오버헤드 | ~115 |
| 실패 유무 판단 | 즉시 | 5번째 호출 후 | 즉시 |

페이지는 총량을 줄이지 않고 나누기만 한다. 그리고 에이전트가 페이지를 끝까지 넘기지
않으면 실패를 놓친다. 사람은 스크롤하다 멈춰도 되지만 에이전트는 전부 봐야 판단한다.

**핵심은 "많으면 잘라 보낸다" 가 아니라 "안 쓰는 걸 안 보낸다" 이다.**

## 설계 — `verbosity` 세 단계

| 값 | 내용 | 241개 | 1,000개 |
|---|---|---|---|
| `summary` **(기본)** | 요약 + 게이트 + 실패 상세 + `runFile` | **115 토큰** | 115 토큰 |
| `list` | + 통과 항목의 `id`·`name`·`durationMs` | 7,207 토큰 | 29,417 토큰 |
| `full` | 현재 응답 그대로 | 152,094 토큰 | 630,000 토큰 |

`summary` 는 진단 수와 무관하게 일정하다. 실패가 늘 때만 커지는데 그건 봐야 하는 것이다.

사용자 확인 사항: "통과 항목은 제목과 시간과 통과됐구나만 보지 내용은 안 봐. 그런데
실패는 왜지? 라고 궁금해서 읽게 돼." `list` 가 이 읽기 방식에 대응하고, 사람에게 보고서를
만들어 줄 때만 필요하다. 통과 목록은 대시보드에 이미 있다.

## 구현 지점

- `mcp-server/index.js:195` 부터가 `run_diagnostics` 도구 정의다. 입력 스키마에
  `verbosity: z.enum(["summary","list","full"]).optional().default("summary")` 를 더한다.
- 같은 파일 218행 근처에서 `JSON.stringify(report, null, 2)` 를 그대로 돌려주고 있다.
  이 자리에 응답 정형화를 넣는다.
- 정형화 함수는 `mcp-server/index.js` 에 두지 말고 `src/` 에 새 모듈로 분리한다.
  `index.js` 가 이미 790줄이고, 300/600 규칙에 걸린다. `complete_task_diagnostics` 도
  같은 문제를 겪으므로 공용으로 쓸 수 있어야 한다.
- 보고서 최상위 키는 다음과 같다. `summary` 모드에서 무엇을 남길지 여기서 고른다.
  `schemaVersion, runId, startedAt, finishedAt, durationMs, totalDurationMs, projectDir,
  selected, discovered, filteredOut, selectionMode, filters, environment, policy,
  skippedDiagnostics, removedDiagnostics, results, summary, overallStatus, healthPercent,
  gates, evidenceSummary, domains, rootCauseGroups, runFile`
- `runFile` 은 반드시 남긴다. 전체 결과가 이미 그 파일에 저장되므로 필요하면 읽으면 된다.
- `complete_task_diagnostics` 에도 같은 처리를 적용할지 판단한다. 완료 영수증은 크기가
  다르므로 별도 확인이 필요하다.

## 버전을 1.8.0 으로 하는 이유

기본 동작이 바뀐다. 기존 호출자가 같은 호출로 다른 모양을 받는다. 의미상 breaking 이다.

기본값을 `full` 로 두고 문서로만 권장하는 안도 있었으나 채택하지 않았다. **기본값이 나쁘면
아무도 바꾸지 않는다.** 이번 조사도 기본값 그대로 152K 를 받아서 시작됐다.

릴리스 노트에 "이전 동작은 `verbosity: 'full'`" 한 줄을 넣는다.

## 테스트 요구

- 세 모드가 각각 무엇을 포함하고 무엇을 빼는지 단언한다.
- 실패가 있을 때 `summary` 모드가 실패 상세를 **전부** 담는지 단언한다. 실패를 줄이면 안 된다.
- `summary` 응답 크기가 통과 항목 수에 비례하지 않는지 단언한다. 합성 결과 1,000개로
  확인할 수 있다.
- 기존 테스트 중 전체 응답 모양을 기대하는 것은 `verbosity: "full"` 로 바꾼다.
- 기준선은 현재 83개 통과다. 변경 전후 실패 목록을 비교하고 개수만 보지 않는다.

## 릴리스 절차

`RELEASE-1.7.3.md` 와 같다. 순서가 중요하다. 코어를 npm 에 올린 뒤에야
`mcp-server` 의 lock 을 다시 만들 수 있다. 버전은 다섯 곳에 있었고 지금은
`test/version-parity.test.cjs` 가 지킨다. 그 테스트가 통과하면 버전은 맞다.

VS Code 확장 배포에는 사용자의 PAT 가 필요하다. `npx vsce login <publisher>` 를 한 번
해 두면 이후 릴리스부터는 에이전트가 `vsce publish` 를 돌릴 수 있다.

## 남은 별건

`open_dashboard` 가 기존 서버를 교체할 때 한 번 실패를 반환하고 실제로는 성공했다.
`stop_dashboard` 직후 호출하면 종료와 기동 사이 경합이 있다. 재현되면 같이 고칠 만하다.
