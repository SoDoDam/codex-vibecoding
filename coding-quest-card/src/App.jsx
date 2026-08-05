import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const quests = [
  {
    id: "state-trace",
    label: "상태 추적",
    title: "버튼 클릭 후 바뀌는 값을 한 줄씩 따라가기",
    detail: "작은 컴포넌트 하나를 골라 클릭 전, 클릭 중, 클릭 후 상태가 어떻게 변하는지 메모해보세요.",
    minutes: 15,
    accent: "#28666e",
  },
  {
    id: "empty-state",
    label: "빈 상태",
    title: "데이터가 없을 때도 어색하지 않은 화면 만들기",
    detail: "목록이 비어 있을 때 보여줄 문구와 버튼을 자연스러운 한국어로 다듬어보세요.",
    minutes: 20,
    accent: "#7b3f61",
  },
  {
    id: "css-spacing",
    label: "CSS 정리",
    title: "간격 규칙 3개만 정해서 화면 정돈하기",
    detail: "반복되는 margin과 padding을 찾아 8px 단위로 정리하고 모바일에서 겹침이 없는지 확인하세요.",
    minutes: 25,
    accent: "#6f5b2f",
  },
  {
    id: "component-name",
    label: "컴포넌트",
    title: "이름만 봐도 역할이 보이는 컴포넌트로 나누기",
    detail: "너무 많은 일을 하는 JSX 영역을 찾아 카드, 버튼, 상태 표시처럼 읽히는 단위로 나눠보세요.",
    minutes: 30,
    accent: "#345995",
  },
];

function pickNextQuest(currentId) {
  const candidates = quests.filter((quest) => quest.id !== currentId);
  const pool = candidates.length > 0 ? candidates : quests;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function App() {
  const [currentQuest, setCurrentQuest] = useState(quests[0]);
  const [completedIds, setCompletedIds] = useState(() => new Set());

  const isComplete = completedIds.has(currentQuest.id);
  const completedCount = completedIds.size;

  const progressText = useMemo(
    () => `${completedCount}/${quests.length} 완료`,
    [completedCount],
  );

  function handleDrawQuest() {
    setCurrentQuest((quest) => pickNextQuest(quest.id));
  }

  function handleToggleComplete() {
    setCompletedIds((previous) => {
      const next = new Set(previous);

      if (next.has(currentQuest.id)) {
        next.delete(currentQuest.id);
      } else {
        next.add(currentQuest.id);
      }

      return next;
    });
  }

  return (
    <main className="app-shell">
      <section className="quest-board" aria-labelledby="app-title">
        <header className="quest-header">
          <div>
            <p className="eyebrow">Daily Coding Quest</p>
            <h1 id="app-title">오늘의 코딩 퀘스트</h1>
          </div>
          <p className="progress-pill" aria-label={`완료한 퀘스트 ${progressText}`}>
            {progressText}
          </p>
        </header>

        <div className="card-stage">
          <AnimatePresence>
            <motion.article
              key={currentQuest.id}
              className="quest-card"
              style={{ "--accent-color": currentQuest.accent }}
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -18, scale: 0.98 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
            >
              <div className="card-topline">
                <span className="quest-label">{currentQuest.label}</span>
                <span className="quest-time">{currentQuest.minutes}분</span>
              </div>
              <h2>{currentQuest.title}</h2>
              <p>{currentQuest.detail}</p>
              <span className={isComplete ? "status done" : "status"}>
                {isComplete ? "완료됨" : "진행 전"}
              </span>
            </motion.article>
          </AnimatePresence>
        </div>

        <div className="actions" aria-label="퀘스트 작업">
          <motion.button
            className="button primary"
            type="button"
            onClick={handleDrawQuest}
            whileTap={{ scale: 0.96 }}
          >
            랜덤 뽑기
          </motion.button>
          <motion.button
            className="button secondary"
            type="button"
            onClick={handleToggleComplete}
            whileTap={{ scale: 0.96 }}
          >
            {isComplete ? "완료 취소" : "완료하기"}
          </motion.button>
        </div>
      </section>
    </main>
  );
}
