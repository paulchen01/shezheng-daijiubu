import {
  buildProgressAfterAttempt,
  createPracticeSet,
  evaluateAnswer,
  getProgressSummary
} from "./app-core.mjs";
import { initPwa, markQuestionDataReady, renderAbout, handlePwaAction, reportQuestion, showStorageWarning } from "./pwa.js";

const PROGRESS_KEY = "shezhengDaijiubuProgressV1";
const FAVORITES_KEY = "shezhengDaijiubuFavoritesV1";
const SESSION_KEY = "shezhengDaijiubuSessionV1";
const app = document.querySelector("#app");
const nav = document.querySelector(".bottom-nav");
const state = {
  data: null,
  catalog: null,
  dataPromise: null,
  dataError: null,
  progress: readJson(PROGRESS_KEY, {}),
  favorites: new Set(Array.isArray(readJson(FAVORITES_KEY, [])) ? readJson(FAVORITES_KEY, []) : []),
  session: null,
  setupChapterIds: [],
  pendingPractice: null
};

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { showStorageWarning(); }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function questionById(id) {
  return state.data?.questions.find((question) => question.id === id);
}

function labelForAnswer(question) {
  const answer = question.currentAnswer;
  if (answer.scoringRule === "bonus_all") return "A至D均給分";
  if (answer.scoringRule === "multiple_answers") return `${answer.keys.join("／")}均給分`;
  return answer.keys.join("／");
}

function sessionQuestions() {
  return state.session.questionIds.map(questionById).filter(Boolean);
}

function selectedChapterIdsForQuestion(question, session = state.session) {
  const mapped = (question.content?.chapters || []).map((chapter) => Number(chapter.chapterId));
  const selected = (session?.chapterIds || []).map(Number);
  return selected.length ? mapped.filter((chapterId) => selected.includes(chapterId)) : mapped;
}

function saveSession() {
  if (state.session) saveJson(SESSION_KEY, state.session);
  else localStorage.removeItem(SESSION_KEY);
}

function setActiveNav(view) {
  nav.querySelectorAll("a").forEach((link) => link.classList.toggle("active", link.dataset.nav === view));
}

function renderHome() {
  const summary = getProgressSummary(state.progress);
  const catalog = state.catalog;
  const chapterCounts = catalog.chapterQuestionCounts;
  const hasSession = state.session && !state.session.completed;
  setActiveNav("home");
  app.innerHTML = `
    <section class="hero-card">
      <p class="eyebrow">公開測試・${catalog.summary.questions.toLocaleString("zh-TW")}題國考原題</p>
      <h1>從考題，讀懂社會政策</h1>
      <p>依課程章節練習，作答後閱讀詳解、選項差異與延伸理解。</p>
      <button class="primary" data-action="open-range">開始練習</button>
      ${hasSession ? '<button class="secondary" data-action="resume">繼續上次練習</button>' : ""}
    </section>
    <section class="stats-grid" aria-label="你的學習紀錄">
      <article><strong>${summary.attempts}</strong><span>已作答</span></article>
      <article><strong>${summary.accuracy === null ? "—" : `${summary.accuracy}%`}</strong><span>答對率</span></article>
      <article><strong>${summary.wrongCount}</strong><span>待重練錯題</span></article>
    </section>
    <section class="section-title"><div><p class="eyebrow">CHAPTER PRACTICE</p><h2>依章節練習</h2></div><p>選擇一章，即可抽5題或10題。</p></section>
    <section class="chapter-grid">
      ${catalog.filters.chapters.map((chapter) => {
        const chapterProgress = state.progress.chapterStats?.[String(chapter.id)];
        const progressLabel = chapterProgress?.attempts ? `已練${chapterProgress.attempts}題・答對率${Math.round((chapterProgress.correct / chapterProgress.attempts) * 100)}%` : "尚未練習";
        return `
        <button class="chapter-card" data-action="open-chapter" data-chapter-id="${chapter.id}">
          <span>第${chapter.id}章</span><strong>${escapeHtml(chapter.title)}</strong><small>${chapterCounts[chapter.id]}題可練・${progressLabel}</small>
        </button>`;
      }).join("")}
    </section>
    <section class="source-note"><strong>公測內容與學習紀錄</strong><p>本版收錄歷屆國考原題；教學詳解、選項差異及章節對應仍在審閱中。官方答案與教學說明分開呈現。法規題請留意命題年度，必要時回查現行法規。</p><p>課程參考：黃源協、蕭文高《社會政策與社會立法》（五版）。練習完成交卷後計入統計，紀錄只存於此裝置與瀏覽器。</p><a href="#about">安裝、備份與公測說明</a></section>`;
}

function renderSetup(initialChapters = []) {
  const catalog = state.catalog;
  const selected = new Set(initialChapters.map(Number));
  const singleChapter = selected.size === 1;
  const selectedChapter = singleChapter ? catalog.filters.chapters.find((chapter) => selected.has(chapter.id)) : null;
  const chapterOptions = catalog.filters.chapters.map((chapter) => `<option value="${chapter.id}">第${chapter.id}章　${escapeHtml(chapter.title)}</option>`).join("");
  setActiveNav("");
  app.innerHTML = `
    <section class="panel setup-panel">
      <button class="text-button" data-action="home">← 回首頁</button>
      <p class="eyebrow">PRACTICE SETUP</p><h1>${selectedChapter ? `第${selectedChapter.id}章快速練習` : "設定本次練習"}</h1>
      <p class="muted">同一題可能對應多章；本次練習會去除重複題目，並盡量平均抽取所選章節。</p>
      ${selectedChapter ? `<section class="quick-start" aria-label="單章快速練習"><h2>直接開始</h2><p>${escapeHtml(selectedChapter.title)}・逐題公布答案</p><div><button class="primary" data-action="quick-start" data-count="5">練5題</button><button class="secondary-dark" data-action="quick-start" data-count="10">練10題</button></div></section>` : ""}
      ${!singleChapter ? `<fieldset class="range-selector"><legend>從範圍帶入章節</legend><div><label>起始章<select id="range-start">${chapterOptions}</select></label><label>結束章<select id="range-end">${chapterOptions}</select></label></div><button class="text-button" data-action="apply-range">套用連續範圍</button></fieldset>` : ""}
      <details class="setup-details" ${singleChapter ? "" : "open"}><summary>${singleChapter ? "調整題數、答案公布方式或練習章節" : "選擇練習章節"}</summary><div>
      <fieldset><legend>練習章節</legend><div class="chapter-selector">
      ${catalog.filters.chapters.map((chapter) => `<label><input type="checkbox" name="chapter" value="${chapter.id}" ${selected.has(chapter.id) ? "checked" : ""}><span>第${chapter.id}章　${escapeHtml(chapter.title)}</span></label>`).join("")}
      </div></fieldset>
      <fieldset><legend>題數</legend><div class="choice-row">
        <label><input type="radio" name="count" value="5" checked><span>5題</span></label>
        <label><input type="radio" name="count" value="10"><span>10題</span></label>
        <label><input type="radio" name="count" value="20"><span>20題</span></label>
        <label><input type="radio" name="count" value="50"><span>50題</span></label>
      </div><label class="custom-count">自訂題數<input id="custom-count" type="number" min="1" inputmode="numeric" placeholder="不填則依上方選項"></label></fieldset>
      <fieldset><legend>答案公布時機</legend><div class="answer-timing">
        <label><input type="radio" name="reveal" value="immediate" checked><span><strong>逐題公布</strong><small>每題作答後立刻看答案與詳解</small></span></label>
        <label><input type="radio" name="reveal" value="deferred"><span><strong>整份交卷後公布</strong><small>完成全部題目後再看結果與解析</small></span></label>
      </div></fieldset>
      <p id="setup-error" class="form-error" role="alert"></p>
      <button class="primary" data-action="start-practice">開始作答</button></div></details>
    </section>`;
}

function renderQuestion() {
  const questions = sessionQuestions();
  const question = questions[state.session.index];
  if (!question) return renderResult();
  const selected = state.session.answers[question.id];
  const hasAnswered = Boolean(selected);
  const immediate = state.session.reveal === "immediate";
  const answerLocked = immediate && hasAnswered;
  const isCorrect = hasAnswered && evaluateAnswer(question, selected);
  setActiveNav("");
  app.innerHTML = `
    <section class="quiz-head"><button class="text-button" data-action="save-and-home">儲存並離開</button><span>第${state.session.index + 1}／${questions.length}題</span></section>
    <div class="progress-track"><span style="width:${((state.session.index + (hasAnswered ? 1 : 0)) / questions.length) * 100}%"></span></div>
    <section class="panel question-panel">
      <p class="question-meta">${escapeHtml(question.exam.displayLabel)}｜第${question.number}題</p>
      <h1 class="question-stem">${escapeHtml(question.stem)}</h1>
      <div class="options">${question.options.map((option) => `
        <button class="option-button ${hasAnswered ? (option.key === selected ? (immediate ? (isCorrect ? "chosen-correct" : "chosen-wrong") : "chosen-neutral") : (immediate && question.currentAnswer.keys.includes(option.key) ? "correct-answer" : "")) : ""}" data-action="answer" data-key="${option.key}" ${answerLocked ? "disabled" : ""} aria-pressed="${option.key === selected}">
          <span>${option.key}</span><strong>${escapeHtml(option.text)}</strong>
        </button>`).join("")}</div>
      ${hasAnswered && immediate ? renderExplanation(question, isCorrect) : ""}
      <div class="quiz-actions">${state.session.index > 0 ? '<button class="secondary-dark" data-action="previous-question">上一題</button>' : ""}${hasAnswered ? `<button class="primary" data-action="next-question">${state.session.index + 1 === questions.length ? "完成並看結果" : immediate ? "下一題" : "確認並前往下一題"}</button>` : ""}</div>
      <button class="favorite-button ${state.favorites.has(question.id) ? "saved" : ""}" data-action="toggle-favorite" data-question-id="${escapeHtml(question.id)}">${state.favorites.has(question.id) ? "★ 已收藏" : "☆ 收藏此題"}</button>
    </section>`;
}

function renderExplanation(question, isCorrect) {
  const chapters = (question.content.chapters || []).map((chapter) => `第${chapter.chapterId}章　${escapeHtml(chapter.title)}`).join("、");
  const analyses = Object.entries(question.content.optionAnalyses || {}).map(([key, text]) => `<li><strong>${key}</strong><span>${escapeHtml(text)}</span></li>`).join("");
  const supplements = (question.content.supplements || []).map((item) => `<h4>${escapeHtml(item.heading)}</h4><p>${escapeHtml(item.content)}</p>`).join("");
  const caveats = question.content.caveats?.length ? `<aside class="caveat"><strong>閱讀提醒</strong><ul>${question.content.caveats.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></aside>` : "";
  const uniqueSources = [...new Map((question.sources || []).map((source) => [source.sourceUrl || source.sourceId, source])).values()];
  const sourceLinks = uniqueSources.map((source) => `<li>${/^https?:\/\//.test(source.sourceUrl || "") ? `<a href="${escapeHtml(source.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.citationLabel || source.workTitle)}</a>` : escapeHtml(source.citationLabel || source.workTitle)}${source.sourceType === "course_pdf" ? `｜${escapeHtml(source.workTitle)}` : source.sourceLocator ? `（${escapeHtml(source.sourceLocator)}）` : ""}</li>`).join("");
  const status = isCorrect === null ? "答案與教學詳解" : isCorrect ? "答對了" : "這題先記下來";
  const statusClass = isCorrect === null ? "neutral" : isCorrect ? "success" : "error";
  const draftNote = question.contentStatus === "explanation_draft" ? '<p class="content-status">教學說明與章節對應：公測審閱中。</p>' : "";
  return `<section class="feedback ${statusClass}"><h2>${status}</h2><p>官方計分答案：<strong>${escapeHtml(labelForAnswer(question))}</strong></p></section>
    ${question.officialNotice ? `<aside class="caveat"><strong>官方答案公告</strong><p>${escapeHtml(question.officialNotice.text)}</p><p>原公布答案：${escapeHtml(question.originalAnswer?.displayText)}</p></aside>` : ""}
    <details class="learning-details" open><summary>看詳解</summary><div>
      <h3>${escapeHtml(question.content.explanation?.keyConcept || "本題考點")}</h3><p>${escapeHtml(question.content.explanation?.detailedExplanation || "詳解整理中")}</p>
      <p class="chapter-label">對應章節：${chapters || "尚未標示"}</p>
      <details><summary>其他選項的差異</summary><ul class="analysis-list">${analyses}</ul></details>
      <details><summary>延伸理解</summary>${supplements}</details>
      ${sourceLinks ? `<details><summary>來源與官方資料</summary><ul class="source-list">${sourceLinks}</ul></details>` : ""}${draftNote}${caveats}
      <button class="text-button" data-action="report-question" data-question-id="${escapeHtml(question.id)}">回報這題的問題</button>
    </div></details>`;
}

function renderResult() {
  const questions = sessionQuestions();
  const answered = Object.entries(state.session.answers);
  const correct = answered.filter(([id, key]) => evaluateAnswer(questionById(id), key)).length;
  const unanswered = questions.length - answered.length;
  setActiveNav("");
  app.innerHTML = `
    <section class="hero-card result-card"><p class="eyebrow">PRACTICE COMPLETE</p><h1>${unanswered ? "練習暫存結果" : "本次練習完成"}</h1>
      <strong class="score">${correct}<small>／${questions.length}</small></strong><p>答對率${answered.length ? Math.round((correct / answered.length) * 100) : 0}%${unanswered ? `；尚有${unanswered}題未作答` : ""}</p>
      <button class="primary" data-action="retry-same">同範圍再練</button><button class="secondary" data-action="home">回首頁</button></section>
    <section class="panel"><h2>逐題結果</h2>${questions.map((question, index) => {
      const key = state.session.answers[question.id];
      const answeredCorrectly = key && evaluateAnswer(question, key);
      return `<details class="result-question"><summary><span>${index + 1}．${answeredCorrectly ? "答對" : key ? "答錯" : "未作答"}</span><strong>${escapeHtml(question.content.explanation?.keyConcept || `第${question.number}題`)}</strong></summary>
        <p>${escapeHtml(question.stem)}</p><ol class="read-options">${question.options.map((option) => `<li class="${option.key === key ? "your-answer" : ""}"><strong>${option.key}</strong><span>${escapeHtml(option.text)}${option.key === key ? "（你的答案）" : ""}</span></li>`).join("")}</ol><p>你的答案：${escapeHtml(key || "未作答")}；官方計分答案：${escapeHtml(labelForAnswer(question))}</p>${renderExplanation(question, Boolean(answeredCorrectly))}</details>`;
    }).join("")}</section>`;
}

function renderSavedList(kind) {
  const isWrong = kind === "wrong";
  const ids = isWrong ? state.progress.wrongQuestionIds || [] : [...state.favorites];
  const questions = ids.map(questionById).filter(Boolean);
  setActiveNav(kind);
  app.innerHTML = `<section class="panel"><p class="eyebrow">${isWrong ? "REVIEW MISTAKES" : "SAVED QUESTIONS"}</p><h1>${isWrong ? "錯題本" : "收藏題目"}</h1><p class="muted">${isWrong ? "答對後會自動從錯題本移除。" : "可先收藏容易混淆或想複習的題目。"}</p>
    ${questions.length ? `<button class="primary" data-action="start-saved" data-kind="${kind}">開始練習${questions.length}題</button><div class="saved-list">${questions.map((question) => `<article><span>${escapeHtml(question.exam.displayLabel)}｜第${question.number}題</span><strong>${escapeHtml(question.content.explanation?.keyConcept || question.stem)}</strong><button class="text-button" data-action="open-question" data-question-id="${escapeHtml(question.id)}">閱讀詳解</button></article>`).join("")}</div>` : `<div class="empty-state"><p>${isWrong ? "目前沒有錯題。完成一次練習後，答錯題目會放在這裡。" : "目前沒有收藏題目。作答時可用「收藏此題」加入。"}</p><button class="primary" data-action="home">回首頁開始練習</button></div>`}</section>`;
}

function renderReadQuestion(question) {
  const blockedByDeferredSession = state.session && !state.session.completed && state.session.reveal === "deferred" && state.session.questionIds.includes(question.id);
  setActiveNav("");
  if (blockedByDeferredSession) {
    app.innerHTML = `<section class="panel"><button class="text-button" data-action="resume">← 回到本次作答</button><h1>交卷後才能閱讀這題詳解</h1><p>你選擇了「整份交卷後公布」。為維持練習公平，請完成本份作答後再查看官方答案與解析。</p></section>`;
    return;
  }
  app.innerHTML = `<section class="panel question-panel"><button class="text-button" data-action="home">← 回首頁</button><p class="question-meta">${escapeHtml(question.exam.displayLabel)}｜第${question.number}題</p><h1 class="question-stem">${escapeHtml(question.stem)}</h1><ol class="read-options">${question.options.map((option) => `<li><strong>${option.key}</strong>${escapeHtml(option.text)}</li>`).join("")}</ol>${renderExplanation(question, null)}<button class="favorite-button ${state.favorites.has(question.id) ? "saved" : ""}" data-action="toggle-favorite" data-question-id="${escapeHtml(question.id)}">${state.favorites.has(question.id) ? "★ 已收藏" : "☆ 收藏此題"}</button></section>`;
}

function renderReplaceSessionPrompt() {
  const questions = sessionQuestions();
  setActiveNav("");
  app.innerHTML = `<section class="panel replace-session"><p class="eyebrow">UNFINISHED PRACTICE</p><h1>你有一份尚未完成的練習</h1><p>目前已作答${Object.keys(state.session.answers).length}／${questions.length}題。繼續作答可保留目前進度；開始新練習會結束並取代這一份。</p><button class="primary" data-action="keep-current">繼續上次練習</button><button class="secondary-dark" data-action="discard-and-start">結束目前練習，開始新的</button></section>`;
}

function startPractice(questionIds, config = {}, force = false) {
  if (!force && state.session && !state.session.completed) {
    state.pendingPractice = { questionIds, config };
    renderReplaceSessionPrompt();
    return;
  }
  state.session = {
    questionIds,
    chapterIds: config.chapterIds || [],
    reveal: config.reveal || "immediate",
    answers: {},
    index: 0,
    completed: false,
    scored: false
    , poolIds: config.poolIds || null
  };
  state.setupChapterIds = [];
  saveSession();
  location.hash = "quiz";
  renderQuestion();
}

function finalizeSession() {
  if (!state.session || state.session.scored) return;
  sessionQuestions().forEach((question) => {
    const key = state.session.answers[question.id];
    if (!key) return;
    const chapterIds = selectedChapterIdsForQuestion(question);
    state.progress = buildProgressAfterAttempt(state.progress, { questionId: question.id, chapterIds, isCorrect: evaluateAnswer(question, key) });
  });
  state.session.scored = true;
  state.session.completed = true;
  saveJson(PROGRESS_KEY, state.progress);
  saveSession();
}

function showSetupError(message, available = null) {
  const error = app.querySelector("#setup-error");
  if (!error) return;
  app.querySelector(".setup-details").open = true;
  error.textContent = message;
  app.querySelector(".available-count")?.remove();
  if (available) error.insertAdjacentHTML("afterend", `<button class="secondary-dark available-count" data-action="start-available" data-count="${available}">改做${available}題</button>`);
}

async function ensureQuestionData(trigger = null) {
  if (state.data) return true;
  const originalLabel = trigger?.textContent;
  if (trigger) { trigger.disabled = true; trigger.textContent = "正在準備題目……"; }
  app.querySelector("#setup-error")?.replaceChildren("題庫正在背景下載，完成後會立即開始。");
  try {
    const data = await state.dataPromise;
    if (!data) throw state.dataError || new Error("請確認網路後重新整理。");
    return true;
  } catch (error) {
    const message = `題庫資料暫時無法載入：${error.message}`;
    const setupError = app.querySelector("#setup-error");
    if (setupError) setupError.textContent = message;
    else app.insertAdjacentHTML("afterbegin", `<p class="form-error" role="alert">${escapeHtml(message)}</p>`);
    return false;
  } finally {
    if (trigger) { trigger.disabled = false; trigger.textContent = originalLabel; }
  }
}

async function startFromSetup(forcedCount = null, trigger = null) {
  const chapterIds = [...app.querySelectorAll('input[name="chapter"]:checked')].map((input) => Number(input.value));
  const error = app.querySelector("#setup-error");
  if (!chapterIds.length) {
    error.textContent = "請至少選擇一個章節。";
    return;
  }
  const customInput = app.querySelector("#custom-count");
  const customText = customInput.value.trim();
  const custom = customText ? Number(customText) : null;
  const checked = app.querySelector('input[name="count"]:checked');
  const count = forcedCount ?? custom ?? Number(checked.value);
  const reveal = app.querySelector('input[name="reveal"]:checked').value;
  if (!Number.isInteger(count) || count < 1) {
    showSetupError("題數必須是正整數。");
    return;
  }
  if (!await ensureQuestionData(trigger)) return;
  try {
    const picked = createPracticeSet(state.data.questions, chapterIds, count);
    startPractice(picked.map((question) => question.id), { chapterIds, reveal });
  } catch (exception) {
    showSetupError(exception.message);
    const available = Number(exception.message.match(/可用題數只有(\d+)題/u)?.[1]);
    if (available) showSetupError(exception.message, available);
  }
}

async function handleAction(target) {
  const action = target.dataset.action;
  if (!action) return;
  if (handlePwaAction(action, state)) return;
  if (action === "report-question") { reportQuestion(questionById(target.dataset.questionId)); return; }
  if (action === "home") { location.hash = "home"; renderHome(); }
  if (action === "open-range") {
    state.setupChapterIds = [];
    location.hash = "setup";
    renderSetup(state.setupChapterIds);
  }
  if (action === "open-chapter") {
    state.setupChapterIds = [Number(target.dataset.chapterId)];
    location.hash = "setup";
    renderSetup(state.setupChapterIds);
  }
  if (action === "apply-range") {
    const first = Number(app.querySelector("#range-start").value);
    const last = Number(app.querySelector("#range-end").value);
    const start = Math.min(first, last);
    const end = Math.max(first, last);
    app.querySelectorAll('input[name="chapter"]').forEach((input) => { input.checked = Number(input.value) >= start && Number(input.value) <= end; });
  }
  if (action === "quick-start") {
    const chapterIds = state.setupChapterIds;
    const count = Number(target.dataset.count);
    if (!await ensureQuestionData(target)) return;
    try {
      const picked = createPracticeSet(state.data.questions, chapterIds, count);
      startPractice(picked.map((question) => question.id), { chapterIds, reveal: "immediate" });
    } catch (exception) {
      renderSetup(chapterIds);
      showSetupError(exception.message, Number(exception.message.match(/可用題數只有(\d+)題/u)?.[1]));
    }
  }
  if (action === "start-practice") await startFromSetup(null, target);
  if (action === "start-available") await startFromSetup(Number(target.dataset.count), target);
  if (action === "resume") { location.hash = "quiz"; renderQuestion(); }
  if (action === "keep-current") { state.pendingPractice = null; location.hash = "quiz"; renderQuestion(); }
  if (action === "discard-and-start" && state.pendingPractice) {
    const { questionIds, config } = state.pendingPractice;
    state.pendingPractice = null;
    startPractice(questionIds, config, true);
  }
  if (action === "clear-local") {
    if (!window.confirm("確定要清除這台裝置的作答紀錄、錯題與收藏嗎？題庫資料不會受影響。")) return;
    localStorage.removeItem(PROGRESS_KEY);
    localStorage.removeItem(FAVORITES_KEY);
    localStorage.removeItem(SESSION_KEY);
    state.progress = {};
    state.favorites = new Set();
    state.session = null;
    location.hash = "home";
    renderHome();
  }
  if (action === "save-and-home") { location.hash = "home"; renderHome(); }
  if (action === "answer" && state.session) {
    const question = sessionQuestions()[state.session.index];
    state.session.answers[question.id] = target.dataset.key;
    saveSession();
    renderQuestion();
  }
  if (action === "next-question" && state.session) {
    if (state.session.index + 1 < sessionQuestions().length) {
      state.session.index += 1;
      saveSession();
      renderQuestion();
    } else {
      finalizeSession();
      location.hash = "result";
      renderResult();
    }
  }
  if (action === "previous-question" && state.session && state.session.index > 0) {
    state.session.index -= 1;
    saveSession();
    renderQuestion();
  }
  if (action === "toggle-favorite") {
    const id = target.dataset.questionId;
    if (state.favorites.has(id)) state.favorites.delete(id);
    else state.favorites.add(id);
    saveJson(FAVORITES_KEY, [...state.favorites]);
    const question = questionById(id);
    if (location.hash === "#quiz") renderQuestion();
    else renderReadQuestion(question);
  }
  if (action === "start-saved") {
    const ids = target.dataset.kind === "wrong" ? state.progress.wrongQuestionIds || [] : [...state.favorites];
    const chapterIds = [...new Set(ids.flatMap((id) => (questionById(id)?.content?.chapters || []).map((chapter) => chapter.chapterId)))];
    startPractice(ids.filter(questionById), { chapterIds, reveal: "immediate", poolIds: ids.filter(questionById) });
  }
  if (action === "open-question") renderReadQuestion(questionById(target.dataset.questionId));
  if (action === "retry-same" && state.session) {
    const config = { chapterIds: state.session.chapterIds, reveal: state.session.reveal, poolIds: state.session.poolIds };
    if (config.poolIds) { startPractice(config.poolIds.filter(questionById), config); return; }
    if (config.chapterIds.length) {
      const picked = createPracticeSet(state.data.questions, config.chapterIds, state.session.questionIds.length);
      startPractice(picked.map((question) => question.id), config);
    } else renderHome();
  }
}

function route() {
  const view = location.hash.replace("#", "") || "home";
  if (!state.data && ["quiz", "result", "wrong", "favorite"].includes(view)) {
    setActiveNav("");
    app.innerHTML = `<section class="loading-panel"><p>正在準備題庫，完成後會開啟你選擇的頁面……</p></section>`;
    state.dataPromise?.then((data) => {
      if (data) route();
      else {
        app.innerHTML = `<section class="panel"><h1>題庫資料暫時無法載入</h1><p>${escapeHtml(state.dataError?.message || "請確認網路後重新整理。")}</p><button class="primary" id="reload-page">重新載入</button></section>`;
        app.querySelector("#reload-page").onclick = () => location.reload();
      }
    });
    return;
  }
  if (view === "home") renderHome();
  else if (view === "setup") renderSetup(state.setupChapterIds);
  else if (view === "quiz" && state.session && !state.session.completed) renderQuestion();
  else if (view === "result" && state.session && state.session.completed) renderResult();
  else if (view === "result" && state.session) { location.hash = "quiz"; renderQuestion(); }
  else if (view === "wrong") renderSavedList("wrong");
  else if (view === "favorite") renderSavedList("favorite");
  else if (view === "about") { setActiveNav("about"); renderAbout(app, state.catalog); }
  else renderHome();
}

function restoreCachedSession() {
  if (!state.progress || typeof state.progress !== "object" || Array.isArray(state.progress)) state.progress = {};
  const cachedSession = readJson(SESSION_KEY, null);
  if (Array.isArray(cachedSession?.questionIds) && cachedSession.questionIds.length && cachedSession.questionIds.every(questionById)
    && Number.isInteger(cachedSession.index) && cachedSession.index >= 0 && cachedSession.index < cachedSession.questionIds.length
    && cachedSession.answers && typeof cachedSession.answers === "object" && !Array.isArray(cachedSession.answers)
    && Object.entries(cachedSession.answers).every(([id, key]) => cachedSession.questionIds.includes(id) && /^[ABCD]$/.test(key))) state.session = cachedSession;
}

async function loadQuestionData() {
  const response = await fetch("data/review-data.json");
  if (!response.ok) throw new Error(`資料讀取失敗（${response.status}）`);
  state.data = await response.json();
  restoreCachedSession();
  markQuestionDataReady();
  if (["quiz", "result", "wrong", "favorite"].includes(location.hash.replace("#", ""))) route();
  else if (location.hash === "#home" || !location.hash) renderHome();
  return state.data;
}

async function boot() {
  // The catalogue is small enough for the first screen; the 10 MB question bank follows in background.
  const pwaReady = initPwa();
  try {
    const response = await fetch("data/home-data.json");
    if (!response.ok) throw new Error(`資料讀取失敗（${response.status}）`);
    state.catalog = await response.json();
    route();
    window.addEventListener("hashchange", route);
    app.addEventListener("click", (event) => {
      const target = event.target.closest("[data-action]");
      if (target) void handleAction(target);
    });
    document.querySelector(".brand").addEventListener("click", () => { location.hash = "home"; });
    document.documentElement.dataset.appReady = "true";
    document.dispatchEvent(new Event("app-ready"));
    // Start after the first home paint so it cannot delay the launch image or first interaction.
    state.dataPromise = new Promise(resolve => setTimeout(resolve, 0)).then(() => pwaReady).then(loadQuestionData).catch((error) => {
      state.dataError = error;
      return null;
    });
  } catch (error) {
    app.innerHTML = `<section class="panel"><h1>題庫資料暫時無法載入</h1><p>${escapeHtml(error.message)}</p><p>第一次使用需要網路。請連線後重新整理；離線使用前，請先等待「已可離線練習」提示。</p><button class="primary" id="reload-page">重新載入</button></section>`;
    app.querySelector("#reload-page").onclick = () => location.reload();
    document.documentElement.dataset.appReady = "true";
    document.dispatchEvent(new Event("app-ready"));
  }
}

boot();
