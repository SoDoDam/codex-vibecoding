# Codex Vibecoding Projects

Codex와 함께 제작한 웹 프로젝트를 모아두는 저장소입니다.

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

## 빠른 실행

```bash
cd racing-game
python3 -m http.server 8000
```

브라우저에서 [http://localhost:8000](http://localhost:8000)을 열고 **RACE NOW**를 누르세요.

> Three.js와 웹 글꼴을 CDN에서 불러오므로 최초 실행 시 인터넷 연결이 필요합니다.
