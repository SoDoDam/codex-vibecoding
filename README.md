# Codex Vibecoding Projects

Codex와 함께 제작한 웹 및 데스크톱 프로젝트를 모아두는 저장소입니다.

## 프로젝트

### NEON APEX — 3D Racing Game

네온 야간 도시 서킷에서 세 명의 AI 경쟁자와 3랩을 겨루는 브라우저 기반 3D 레이싱 게임입니다.

- 실시간 순위, 랩, 속도 및 기어 표시
- 키보드 가속, 브레이크, 조향
- 충전식 니트로 부스트
- AI 경쟁자 3명과의 레이스
- 카메라 추적 및 니트로 시야각 효과
- 경기 결과와 즉시 재시작 기능

실행 방법과 조작법은 [게임 README](racing-game/README.md)에서 확인할 수 있습니다.

#### 레이싱 게임 빠른 실행

```bash
cd racing-game
python3 -m http.server 8000
```

브라우저에서 [http://localhost:8000](http://localhost:8000)을 열고 **RACE NOW**를 누르세요.

> Three.js와 웹 글꼴을 CDN에서 불러오므로 최초 실행 시 인터넷 연결이 필요합니다.

### Codex Session Manager

로컬에 저장된 Codex CLI 세션을 검색하고 대화 내용을 미리 본 뒤, 선택한 세션을 새 터미널에서 재개하는 macOS 및 Windows 데스크톱 앱입니다.

- `~/.codex/sessions` 자동 검색
- 대화 내용과 작업 경로 미리보기
- 검색, 정렬 및 대용량 스크롤 목록
- 방향키, Page Up/Down, Home/End 키보드 탐색
- `codex resume <SESSION_ID>`를 이용한 세션 재개
- macOS DMG/ZIP 및 Windows 설치/포터블 패키징

설치, 실행 및 빌드 방법은 [Session Manager README](session-manager/README.md)에서 확인할 수 있습니다.

#### Session Manager 빠른 실행

```bash
cd session-manager
npm install
npm start
```
