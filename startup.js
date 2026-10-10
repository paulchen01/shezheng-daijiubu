// This lightweight script runs independently of question-data loading.
(() => {
  const screen = document.querySelector("#startup-screen");
  const shell = document.querySelector(".app-shell");
  if (!screen || !shell) return;
  const startedAt = performance.now();
  const picture = screen.querySelector("img");
  let imageShownAt = picture.complete && picture.naturalWidth ? startedAt : null;
  let finished = false;
  let minimumTimer;
  performance.mark("startup-visible");

  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(minimumTimer);
    clearTimeout(maximumTimer);
    document.removeEventListener("app-ready", checkReady);
    document.removeEventListener("pwa-ready", checkReady);
    shell.removeAttribute("inert");
    shell.removeAttribute("aria-hidden");
    screen.remove();
    document.body.classList.remove("starting");
    performance.mark("startup-hidden");
    performance.measure("startup-duration", "startup-visible", "startup-hidden");
  }

  function checkReady() {
    if (finished) return;
    const state = document.documentElement.dataset;
    if (state.appReady !== "true" || state.pwaReady !== "true" || imageShownAt === null) return;
    // Normally show for 2s, including at least 1s with the image decoded.
    const remaining = Math.max(startedAt + 2000, imageShownAt + 1000) - performance.now();
    clearTimeout(minimumTimer);
    if (remaining > 0) minimumTimer = setTimeout(checkReady, remaining);
    else finish();
  }

  picture.addEventListener("load", () => { imageShownAt = performance.now(); checkReady(); }, { once: true });
  document.addEventListener("app-ready", checkReady);
  document.addEventListener("pwa-ready", checkReady);
  // Slow/offline first loads must never remain behind the splash indefinitely.
  const maximumTimer = setTimeout(finish, 3000);
  checkReady();
})();
