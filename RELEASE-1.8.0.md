# 1.8.0 배포 안내

준비 완료. 아래 순서대로만 하시면 됩니다. **순서가 중요합니다** — `vibe-diagnosis-mcp` 가
`vibe-diagnosis` 를 정확한 버전으로 의존하므로, 코어가 npm 에 없으면 MCP 설치가 실패합니다.

## 만들어 둔 파일

| 파일 | 크기 | 올릴 곳 |
|---|---|---|
| `vibe-diagnosis-1.8.0.tgz` | 98 KB | npmjs.com |
| `mcp-server/vibe-diagnosis-mcp-1.8.0.tgz` | 16 KB | npmjs.com |
| `vscode-extension/vibe-diagnosis-vscode-1.8.0.vsix` | 295 KB | Open VSX · VS Code Marketplace |

## 배포 순서

**1. 코어를 npm 에 올린다**

```
npm publish vibe-diagnosis-1.8.0.tgz
```

**2. 올라간 것을 확인한다**

```
npm view vibe-diagnosis@1.8.0 version
```

이 명령이 `1.8.0` 을 돌려주기 전에는 다음 단계로 가지 않는다.

**3. MCP 의 lock 을 다시 만든다**

```
cd mcp-server
npm install
```

`mcp-server/package-lock.json` 이 아직 1.7.3 을 가리킨다. 코어가 npm 에 올라간 뒤라야
`npm install` 이 1.8.0 을 찾는다. lock 이 바뀌면 커밋한다.

**4. MCP 를 올린다**

```
npm publish mcp-server/vibe-diagnosis-mcp-1.8.0.tgz
```

lock 은 tgz 에 포함되지 않으므로 지금 파일 그대로 올려도 결과는 같다.

**5. 확장을 올린다**

```
cd vscode-extension
npx vsce publish --packagePath vibe-diagnosis-vscode-1.8.0.vsix
npx ovsx publish vibe-diagnosis-vscode-1.8.0.vsix -p <OPEN_VSX_TOKEN>
```

`vsce publish` 에는 사용자의 PAT 가 필요하다. `npx vsce login Rejard` 를 한 번 해 두면
다음 릴리스부터는 에이전트가 배포 단계를 돌릴 수 있다.

## 배포 후 확인

```
npm view vibe-diagnosis@1.8.0 version
npm view vibe-diagnosis-mcp@1.8.0 dependencies
npx -y vibe-diagnosis-mcp@1.8.0
```

마지막 명령에 아래를 넣으면 서버가 1.8.0 을 보고해야 한다.

```
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"probe","version":"1.0"}}}
```

## 이번 릴리스에 담긴 것

**`run_diagnostics` 응답 축소.** 통과 항목이 응답의 70% 를 차지하면서 결정에는 아무것도
보태지 않았다. 이제 `run_diagnostics` 와 `complete_task_diagnostics` 가 `verbosity` 를 받고,
기본값은 `summary` 다.

| 값 | 응답 내용 |
|---|---|
| `summary` (기본) | 집계, 게이트, 증거·도메인 요약, 근본원인 묶음, `runFile`, 그리고 **실패한 진단 전부** |
| `list` | 여기에 통과·건너뜀 항목의 `id`·`name`·`executionState`·`durationMs` 를 더한다 |
| `full` | 1.8.0 이전과 동일한 전체 보고서 |

**이전 동작은 `verbosity: "full"` 이다.** 기본값이 바뀌므로 의미상 breaking 이고, 그래서
1.8.0 이다.

실측 (이 저장소의 실제 보고서를 241개·1,000개로 확장, 들여쓰기 포함 문자수 / 3.5 로 환산):

| 진단 수 | 실패 | `summary` | `list` | `full` |
|---|---|---|---|---|
| 241 | 0 | **761 토큰** | 11,177 | 194,966 |
| 241 | 3 | **3,114 토큰** | 13,402 | 194,904 |
| 1,000 | 0 | **763 토큰** | 44,141 | 806,504 |
| 1,000 | 3 | **3,115 토큰** | 46,365 | 806,442 |

`summary` 는 진단 수가 4배로 늘어도 761 → 763 토큰이다. 커지는 것은 실패가 늘 때뿐이고,
그것은 봐야 하는 것이다. 인계 문서의 추정치는 115 토큰이었으나 실측은 761 토큰이다. 차이는
`environment`·`evidenceSummary`·`domains`·`policy`·게이트를 남겼기 때문이고, 이것들은
릴리스 판단과 증거 신선도에 쓰이므로 600 토큰을 아끼자고 버리지 않았다.

**실패는 어떤 모드에서도 줄이지 않는다.** 표본추출도, 페이지 나누기도 없다. `stderr` 와
스택을 그대로 담는다. 전체 보고서는 언제나 로컬에 저장되고 모든 응답의 `runFile` 이 그 경로를
가리킨다.

**대시보드 포트 탐지 수정.** 인계 문서의 "남은 별건" 을 재현했다. 원인은 종료와 기동 사이의
경합이 아니라 포트 점검 자체였다.

- `isPortInUse` 가 `listen(port)` 로 와일드카드 주소(`0.0.0.0`)에 바인딩해 확인했다.
- 대시보드는 `127.0.0.1` 에만 바인딩한다. Windows 에서는 루프백이 점유된 포트에도
  와일드카드 바인딩이 성공한다.
- 그래서 종료 직후 아직 살아 있는 대시보드의 포트를 "비어 있음" 으로 읽고 같은 포트에 새
  서버를 띄웠다. 자식 프로세스는 `EADDRINUSE` 로 죽고, 준비 대기 30회가 지나면
  `open_dashboard` 가 실패를 돌려주었다.
- 재현: 수정 전 5회 중 5회 실패, 수정 후 3회 중 3회 성공.
- 확인: 같은 포트를 루프백으로 점유한 상태에서 루프백 점검은 `true`, 와일드카드 점검은
  `false` 를 돌려준다.

포트 점검 세 함수를 `src/port-probe.js` 로 옮기고 루프백을 기본 대상으로 삼았다.
`mcp-server/index.js` 는 790줄에서 765줄이 되었다.

**재발 방지.** `test/response-verbosity.test.cjs` 11개와 `test/port-probe.test.cjs` 3개가
세 모드의 포함·제외, 실패 상세의 완전 보존, 통과 항목 수와 무관한 `summary` 크기,
MCP 스키마 노출, 루프백 포트 점유 감지를 확인한다. `scripts/verify-packed-install.cjs` 는
포장된 tgz 로 설치한 뒤 `src/report-view.js`·`src/port-probe.js` 동봉과 `verbosity` 기본값,
포장된 MCP 응답이 실제로 축소되는지를 확인한다.

## 검증 기록

- 단위 테스트 97개 전부 통과 (기준선 83 + 신규 14). 변경 전 실패 0개, 변경 후 실패 0개
- 자가진단 15개 전부 OK (기준선 13 + 신규 2), Health 100%, `RELEASE_ALLOWED`
- `node scripts/verify-packed-install.cjs` 종료코드 0 — 포장된 MCP 가
  `report.response.verbosity === "summary"` 로 응답
- `node scripts/scan-secrets.cjs` 종료코드 0
- `test/dashboard.test.cjs` 에 `'1.7.3'` 이 하드코딩되어 있어 버전 상승에서 깨졌다.
  `package.json` 에서 읽도록 고쳤다. 소스의 하드코딩은 `version-parity` 가 막고 있었으나
  테스트 파일은 그 검사 대상이 아니었다.

## 남은 정리 (배포와 무관)

- `mcp-server/package-lock.json` 이 1.7.3 을 가리킨다. 위 3단계에서 함께 처리한다.
- `NEXT-1.8.0.md` 의 지시는 모두 반영했다. 다음 인계 문서를 쓸 때 지운다.
- 인계 문서가 남긴 `complete_task_diagnostics` 판단: 같은 처리를 적용했다. 완료 영수증과
  `completion` 결정 블록은 어느 모드에서도 그대로 남는다.
