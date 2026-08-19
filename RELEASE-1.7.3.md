# 1.7.3 배포 안내

준비 완료. 아래 순서대로만 하시면 됩니다. **순서가 중요합니다** — `vibe-diagnosis-mcp` 가
`vibe-diagnosis` 를 정확한 버전으로 의존하므로, 코어가 npm 에 없으면 MCP 설치가 실패합니다.

## 만들어 둔 파일

| 파일 | 크기 | 올릴 곳 |
|---|---|---|
| `vibe-diagnosis-1.7.3.tgz` | 96 KB | npmjs.com |
| `mcp-server/vibe-diagnosis-mcp-1.7.3.tgz` | 16 KB | npmjs.com |
| `vscode-extension/vibe-diagnosis-vscode-1.7.3.vsix` | 294 KB | Open VSX · VS Code Marketplace |

## 배포 순서

**1. 코어를 npm 에 올린다**

```
npm publish vibe-diagnosis-1.7.3.tgz
```

**2. 올라간 것을 확인한다**

```
npm view vibe-diagnosis@1.7.3 version
```

이 명령이 `1.7.3` 을 돌려주기 전에는 다음 단계로 가지 않는다.

**3. MCP 의 lock 을 다시 만든다**

```
cd mcp-server
npm install
```

`mcp-server/package-lock.json` 이 아직 1.7.2 를 가리키고 있다. 코어가 npm 에 올라간 뒤라야
`npm install` 이 1.7.3 을 찾는다. lock 이 바뀌면 커밋한다.

**4. MCP 를 올린다**

```
npm publish mcp-server/vibe-diagnosis-mcp-1.7.3.tgz
```

lock 을 고쳤으므로 `npm pack` 을 다시 돌려 tgz 를 새로 만든 뒤 올려도 된다. lock 은 tgz 에
포함되지 않으므로 지금 파일 그대로 올려도 결과는 같다.

**5. 확장을 올린다**

```
cd vscode-extension
npx vsce publish --packagePath vibe-diagnosis-vscode-1.7.3.vsix
npx ovsx publish vibe-diagnosis-vscode-1.7.3.vsix -p <OPEN_VSX_TOKEN>
```

`vscode-extension/package-lock.json` 도 1.7.2 로 남아 있다. 확장 동작에는 영향이 없지만
정리하려면 `npm install` 후 커밋한다.

## 배포 후 확인

```
npm view vibe-diagnosis@1.7.3 version
npm view vibe-diagnosis-mcp@1.7.3 dependencies
npx -y vibe-diagnosis-mcp@1.7.3
```

마지막 명령에 아래를 넣으면 서버가 1.7.3 을 보고해야 한다.

```
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"probe","version":"1.0"}}}
```

## 이번 릴리스에 담긴 것

**버전 단일화.** 버전 문자열이 다섯 곳에 흩어져 있었고 `dashboardCompatibility` 는 정확한
일치를 요구한다. 하나라도 빠뜨리면 대시보드와 MCP 가 서로를 거부하고, 사용자는
"대시보드가 안 열린다" 만 보게 된다. 이제 각 패키지가 자기 매니페스트에서 읽고, 대시보드
화면은 서버가 주입하는 값을 쓴다.

가장 위험했던 두 곳은 `mcp-server` 의 코어 의존성 고정과 VS Code 확장이었다. 전자를 놓치면
배포된 1.7.3 MCP 가 코어 1.7.2 를 끌어와 **모든 사용자** 에게 불일치가 난다. 후자는 테스트가
`Dashboard update required: extension 1.7.2/API 2, server 1.7.3/API 2` 로 잡아 주었다.

**상태별 필터.** total·OK·WARN·ERR 카드가 버튼이 되고 키보드 1~4 로도 전환된다. 입력창에
타이핑 중일 때는 단축키가 동작하지 않는다. 해당 상태가 없으면 빈 목록 대신 어떤 필터인지
알려 준다.

**재발 방지.** `test/version-parity.test.cjs` 가 세 매니페스트 일치, MCP 의 코어 의존성 일치,
소스의 버전 하드코딩 금지, MCP 가 stdio 로 보고하는 버전 일치, 낡은 대시보드 거부를 확인한다.
어긋난 상태를 실제로 만들어 각 검사가 실패하는 것을 확인했다.

## 검증 기록

- 단위 테스트 83개 전부 통과 (기준선 76 + 신규 7)
- `npm test` 종료코드 0
- `npm run test:packed` 종료코드 0
- `npm run test:secrets` 종료코드 0
- 필터 동작을 브라우저에서 직접 확인: ERR 필터에서 13개 → 0개, 키 1~4 전환, 입력창 타이핑 중 무시

## 남은 정리 (배포와 무관)

- `mcp-server/package-lock.json`, `vscode-extension/package-lock.json` 이 1.7.2 를 가리킨다.
  위 3단계에서 함께 처리한다.
