import { STORAGE_KEYS, validateBackup } from "./backup.mjs";
export const RELEASE = "0.2.0-beta.1";
const banner = document.querySelector("#pwa-status");
let registration, installPrompt;
let offlineReady = false, storageFailed = false, refreshing = false;
const escape = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
function paintStatus() {
  banner.innerHTML = `${storageFailed ? '<p>瀏覽器無法儲存紀錄。請到「說明」匯出備份，避免關閉後遺失。</p>' : ""}${registration?.waiting ? '<span>新版已準備好，更新會保留已儲存的作答。</span><button class="text-button" id="apply-update">更新版本</button>' : `<span>${!navigator.onLine ? (offlineReady ? "離線中・可繼續練習" : "離線中・請連線完成首次下載") : offlineReady ? "已可離線練習" : "正在準備離線題庫……"}</span>`}`;
  banner.querySelector("#apply-update")?.addEventListener("click", () => registration.waiting.postMessage({ type: "SKIP_WAITING" }));
}
export function showStorageWarning() { storageFailed = true; paintStatus(); }
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault(); installPrompt = event;
  const button = document.querySelector('[data-action="install-app"]');
  if (button) button.textContent = "安裝到這台裝置";
});
window.addEventListener("appinstalled", () => { installPrompt = null; });
export async function initPwa() {
  paintStatus(); window.addEventListener("online", paintStatus); window.addEventListener("offline", paintStatus);
  if (!("serviceWorker" in navigator)) { banner.textContent = "此瀏覽器可線上練習；離線功能不受支援。"; return; }
  let hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) { hadController = true; offlineReady = true; paintStatus(); return; }
    if (refreshing) return; refreshing = true; location.reload();
  });
  try {
    registration = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => { if (worker.state === "installed") paintStatus(); });
    });
    await navigator.serviceWorker.ready; offlineReady = true; paintStatus();
    registration.update().catch(() => {});
  } catch { banner.textContent = "目前可線上練習；離線下載未完成，請連線後重新整理再試。"; }
}
export function renderAbout(app, data) {
  app.innerHTML = `<section class="panel about-panel"><p class="eyebrow">PUBLIC BETA · ${RELEASE}</p><h1>把練習帶著走</h1><p>社政待救補是社會政策與社會立法的獨立練習工具。目前有${data.questions.length.toLocaleString("zh-TW")}題國考原題、15章練習範圍。</p>
  <h2>安裝與離線使用</h2><button class="primary" data-action="install-app">${installPrompt ? "安裝到這台裝置" : "查看安裝方式"}</button><div id="install-help"><p>Android或電腦：用Chrome／Edge開啟，選擇選單中的「安裝應用程式」或「新增至主畫面」。</p><p>iPhone／iPad：用Safari開啟，點「分享」→「加入主畫面」。選單名稱依瀏覽器版本略有不同。</p><p>第一次請保持連線，直到上方顯示「已可離線練習」。之後可離線作答、看詳解與使用錯題本；外部來源連結仍需要網路。瀏覽器若清除網站資料，需再次連線下載。</p></div>
  <h2>你的紀錄</h2><p>交卷後才計入答對率和錯題本；未完成的練習可儲存後繼續。紀錄只存在目前的瀏覽器，不會自動跨裝置同步。換手機、清除網站資料或使用無痕模式前，請先備份。</p><p>備份包含已完成練習的統計、錯題及收藏，不包含尚未交卷的練習。匯入會取代這台裝置的紀錄，請先匯出舊紀錄。</p><div class="utility-actions"><button class="secondary-dark" data-action="export-backup">匯出紀錄</button><button class="secondary-dark" data-action="import-backup">匯入紀錄</button></div><input id="backup-file" type="file" accept=".json,application/json" hidden><p id="backup-message" role="status"></p><button class="text-button" data-action="clear-local">重設這台裝置的紀錄</button>
  <h2>內容與來源</h2><p>國考題幹、選項、官方答案及更正公告保留原資料。詳解、其他選項差異、延伸理解與章節對應是另行整理的教學說明，目前仍在審閱中；請搭配原始來源判讀。</p><p>課程參考：黃源協、蕭文高《社會政策與社會立法》（五版）。本網站不提供課程PDF下載。歷屆法規題的命題時間與今日規定可能不同，練習的計分依該題官方答案。</p>
  <h2>協助公測</h2><p>在題目詳解下點「回報這題的問題」，填寫狀況後複製或下載回報，交給邀請你公測的人。這個版本不會自動傳送回報。</p><button class="secondary-dark" data-action="report-general">回報操作問題</button>
  <h2>隱私與獨立運作</h2><p>不需登入；本版未加入廣告或使用行為分析。作答紀錄保存在裝置，網站不會主動上傳。主機服務商仍可能保留一般網站請求紀錄；點擊外部來源後適用該網站的規則。</p><p>這是獨立的公測網站，安裝項目、更新與作答紀錄都獨立管理。</p><p class="muted">版本${RELEASE}｜題庫整理日期${escape(String(data.generatedAt || "").slice(0, 10))}</p><button class="text-button" data-action="check-update">檢查更新</button><p id="update-message" role="status"></p></section>`;
}
function download(name, content, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function reportQuestion(question) {
  document.querySelector("#report-dialog")?.remove();
  const dialog = document.createElement("dialog"); dialog.id = "report-dialog";
  const header = `社政待救補公測回報\n版本：${RELEASE}\n題目：${question?.id || "操作問題"}\n${question ? `${question.exam.displayLabel} 第${question.number}題\n` : ""}`;
  dialog.innerHTML = `<form method="dialog"><button class="text-button dialog-close" aria-label="關閉回報視窗">關閉</button></form><h2>回報問題</h2><p>${escape(question ? `${question.exam.displayLabel}｜第${question.number}題` : "操作問題")}</p><label for="report-text">你遇到的狀況或建議</label><textarea id="report-text" rows="5" maxlength="4000" placeholder="例如：選項說明與原始來源不一致，或哪個步驟無法操作。請勿填入個人資料。"></textarea><p class="muted">請把回報交給邀請你公測的人；複製或下載後並不代表已送出。</p><div class="utility-actions"><button class="primary" id="copy-report">複製回報</button><button class="secondary-dark" id="download-report">下載回報</button></div><p id="report-message" role="status"></p>`;
  document.body.append(dialog);
  const reportText = () => `${header}\n問題描述：\n${dialog.querySelector("textarea").value.trim() || "（請補充問題描述）"}`;
  dialog.querySelector("#copy-report").onclick = async () => {
    try { await navigator.clipboard.writeText(reportText()); dialog.querySelector("#report-message").textContent = "已複製，請貼給公測邀請人。"; }
    catch { dialog.querySelector("#report-message").textContent = "瀏覽器不允許複製，請改用下載回報。"; }
  };
  dialog.querySelector("#download-report").onclick = () => { download("社政待救補-問題回報.txt", reportText(), "text/plain;charset=utf-8"); dialog.querySelector("#report-message").textContent = "已產生下載檔，請交給公測邀請人。"; };
  dialog.addEventListener("close", () => dialog.remove()); dialog.showModal();
}
export function handlePwaAction(action, state) {
  if (action === "install-app") {
    if (installPrompt) { installPrompt.prompt(); installPrompt = null; }
    else document.querySelector("#install-help")?.scrollIntoView({ block: "center", behavior: "smooth" });
  } else if (action === "export-backup") {
    download(`社政待救補-學習紀錄-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: "shezheng-daijiubu", schemaVersion: 1, exportedAt: new Date().toISOString(), progress: state.progress, favorites: [...state.favorites] }, null, 2));
    document.querySelector("#backup-message").textContent = "已產生備份下載，請確認檔案已儲存。";
  } else if (action === "import-backup") {
    const input = document.querySelector("#backup-file"); input.value = "";
    input.onchange = async () => {
      const file = input.files[0]; if (!file) return;
      const message = document.querySelector("#backup-message");
      try {
        if (file.size > 2 * 1024 * 1024) throw new Error("備份檔過大，請選擇本網站匯出的紀錄。");
        const restored = validateBackup(JSON.parse(await file.text()), state.data.questions);
        if (!confirm("匯入將取代目前的統計、錯題與收藏，並清除尚未完成的練習。確定已備份原紀錄並繼續嗎？")) return;
        const old = STORAGE_KEYS.map(key => localStorage.getItem(key));
        try {
          localStorage.setItem(STORAGE_KEYS[0], JSON.stringify(restored.progress)); localStorage.setItem(STORAGE_KEYS[1], JSON.stringify(restored.favorites)); localStorage.removeItem(STORAGE_KEYS[2]);
        } catch (error) {
          STORAGE_KEYS.forEach((key, index) => { try { old[index] === null ? localStorage.removeItem(key) : localStorage.setItem(key, old[index]); } catch {} }); throw error;
        }
        state.progress = restored.progress; state.favorites = new Set(restored.favorites); state.session = null; message.textContent = "已匯入學習紀錄。";
      } catch (error) { message.textContent = `無法匯入：${error.message}`; }
    }; input.click();
  } else if (action === "report-general") reportQuestion(null);
  else if (action === "check-update") {
    const message = document.querySelector("#update-message");
    if (!registration || !navigator.onLine) message.textContent = "請連線後再檢查更新。";
    else { message.textContent = "正在檢查……"; registration.update().then(() => { paintStatus(); message.textContent = registration.waiting ? "新版已準備好，請點上方更新版本。" : registration.installing ? "正在下載新版，完成後會顯示更新按鈕。" : "已完成檢查，目前沒有可安裝的新版。"; }).catch(() => { message.textContent = "暫時無法檢查，請稍後再試。"; }); }
  } else return false;
  return true;
}
