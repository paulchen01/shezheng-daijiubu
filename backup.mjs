export const STORAGE_KEYS = ["shezhengDaijiubuProgressV1", "shezhengDaijiubuFavoritesV1", "shezhengDaijiubuSessionV1"];
export function validateBackup(value, questions) {
  if (value?.app !== "shezheng-daijiubu" || value.schemaVersion !== 1) throw new Error("這不是社政待救補支援的備份檔。");
  const ids = new Set(questions.map(q => q.id));
  const chapters = new Set(questions.flatMap(q => q.content.chapters.map(c => String(c.chapterId))));
  const p = value.progress;
  if (!p || typeof p !== "object" || Array.isArray(p) || !Array.isArray(value.favorites)) throw new Error("備份格式不完整。");
  const list = items => {
    if (!Array.isArray(items) || items.some(id => typeof id !== "string" || !ids.has(id))) throw new Error("備份含有無法辨識的題目。");
    return [...new Set(items)];
  };
  const stat = s => {
    if (!s || !Number.isSafeInteger(s.attempts) || !Number.isSafeInteger(s.correct) || s.attempts < 0 || s.correct < 0 || s.correct > s.attempts) throw new Error("備份的統計數值不正確。");
    return { attempts: s.attempts, correct: s.correct, wrong: s.attempts - s.correct, updatedAt: typeof s.updatedAt === "string" ? s.updatedAt : null };
  };
  const chapterStats = {};
  for (const [id, s] of Object.entries(p.chapterStats || {})) {
    if (!chapters.has(id)) throw new Error("備份含有無法辨識的章節。");
    chapterStats[id] = stat(s);
  }
  return { progress: { schemaVersion: 2, wrongQuestionIds: list(p.wrongQuestionIds || []), chapterStats,
    ...(p.overallStats ? { overallStats: stat(p.overallStats) } : {}), lastAttemptAt: typeof p.lastAttemptAt === "string" ? p.lastAttemptAt : null }, favorites: list(value.favorites) };
}
