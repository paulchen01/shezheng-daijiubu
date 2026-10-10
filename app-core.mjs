const OPTION_KEYS = new Set(["A", "B", "C", "D"]);

function shuffled(items, random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function hasChapter(question, chapterId) {
  return (question.content?.chapters || []).some((chapter) => chapter.chapterId === chapterId);
}

export function createPracticeSet(questions, chapterIds, count, random = Math.random) {
  const selectedChapters = [...new Set(chapterIds.map(Number))].filter(Number.isInteger);
  const eligible = questions.filter((question) => selectedChapters.some((chapterId) => hasChapter(question, chapterId)));
  const requested = Number(count);
  if (!Number.isInteger(requested) || requested < 1) {
    throw new Error("題數必須是正整數。");
  }
  if (requested > eligible.length) {
    throw new Error(`可用題數只有${eligible.length}題，無法抽取${requested}題。`);
  }

  const selected = [];
  const selectedIds = new Set();
  const chapterOrder = shuffled(selectedChapters, random);
  const candidatesByChapter = new Map(
    chapterOrder.map((chapterId) => [chapterId, shuffled(eligible.filter((question) => hasChapter(question, chapterId)), random)])
  );
  let keepPicking = true;

  while (selected.length < requested && keepPicking) {
    keepPicking = false;
    for (const chapterId of chapterOrder) {
      const candidate = candidatesByChapter.get(chapterId).find((question) => !selectedIds.has(question.id));
      if (!candidate) continue;
      selected.push(candidate);
      selectedIds.add(candidate.id);
      keepPicking = true;
      if (selected.length === requested) break;
    }
  }

  if (selected.length < requested) {
    for (const question of shuffled(eligible, random)) {
      if (selectedIds.has(question.id)) continue;
      selected.push(question);
      selectedIds.add(question.id);
      if (selected.length === requested) break;
    }
  }
  return selected;
}

export function evaluateAnswer(question, selectedKey) {
  const key = String(selectedKey || "").toUpperCase();
  if (!OPTION_KEYS.has(key)) return false;
  return (question.currentAnswer?.keys || []).includes(key);
}

export function buildProgressAfterAttempt(progress, attempt) {
  const questionId = String(attempt.questionId || "");
  if (!questionId) throw new Error("缺少題目ID，無法保存練習紀錄。");
  const chapterIds = [...new Set((attempt.chapterIds || []).map(Number).filter(Number.isInteger))];
  const isCorrect = Boolean(attempt.isCorrect);
  const now = attempt.answeredAt || new Date().toISOString();
  const wrongQuestionIds = new Set(progress.wrongQuestionIds || []);
  if (isCorrect) wrongQuestionIds.delete(questionId);
  else wrongQuestionIds.add(questionId);

  const chapterStats = { ...(progress.chapterStats || {}) };
  const legacyStats = Object.values(progress.chapterStats || {});
  const overallStats = progress.overallStats || {
    attempts: legacyStats.reduce((sum, stat) => sum + (stat.attempts || 0), 0),
    correct: legacyStats.reduce((sum, stat) => sum + (stat.correct || 0), 0),
    updatedAt: progress.lastAttemptAt || null
  };
  chapterIds.forEach((chapterId) => {
    const current = chapterStats[String(chapterId)] || { attempts: 0, correct: 0, wrong: 0, updatedAt: null };
    chapterStats[String(chapterId)] = {
      attempts: current.attempts + 1,
      correct: current.correct + (isCorrect ? 1 : 0),
      wrong: current.wrong + (isCorrect ? 0 : 1),
      updatedAt: now
    };
  });

  return {
    schemaVersion: 2,
    wrongQuestionIds: [...wrongQuestionIds],
    overallStats: {
      attempts: overallStats.attempts + 1,
      correct: overallStats.correct + (isCorrect ? 1 : 0),
      updatedAt: now
    },
    chapterStats,
    lastAttemptAt: now
  };
}

export function getChapterQuestionCounts(questions, chapterIds) {
  return Object.fromEntries(
    [...new Set(chapterIds.map(Number))]
      .filter(Number.isInteger)
      .map((chapterId) => [chapterId, questions.filter((question) => hasChapter(question, chapterId)).length])
  );
}

export function getProgressSummary(progress) {
  if (progress.overallStats) {
    const attempts = progress.overallStats.attempts || 0;
    const correct = progress.overallStats.correct || 0;
    return {
      attempts,
      correct,
      accuracy: attempts ? Math.round((correct / attempts) * 100) : null,
      wrongCount: (progress.wrongQuestionIds || []).length
    };
  }
  const stats = Object.values(progress.chapterStats || {});
  const attempts = stats.reduce((sum, stat) => sum + stat.attempts, 0);
  const correct = stats.reduce((sum, stat) => sum + stat.correct, 0);
  return {
    attempts,
    correct,
    accuracy: attempts ? Math.round((correct / attempts) * 100) : null,
    wrongCount: (progress.wrongQuestionIds || []).length
  };
}
