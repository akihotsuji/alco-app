(() => {
  const root = document.getElementById("root");
  if (!root) {
    return;
  }

  let ready = false;
  window.__alcoMarkBootReady = () => {
    ready = true;
  };

  const status = () => root.querySelector("[data-boot-status]");
  const retry = () => root.querySelector("[data-boot-retry]");

  function stillHtmlBoot() {
    return !ready && Boolean(root.querySelector("[data-boot-html]"));
  }

  function showRetry(message) {
    if (!stillHtmlBoot()) {
      return;
    }
    const statusEl = status();
    const retryEl = retry();
    if (statusEl) {
      statusEl.textContent = message;
    }
    if (retryEl) {
      retryEl.setAttribute("data-visible", "1");
    }
  }

  window.setTimeout(() => {
    showRetry("読み込みに時間がかかっています");
  }, 8000);

  window.addEventListener(
    "error",
    (event) => {
      const target = event.target;
      if (
        target &&
        (target.tagName === "SCRIPT" || target.tagName === "LINK")
      ) {
        showRetry("読み込めませんでした");
      }
    },
    true,
  );

  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    showRetry("読み込めませんでした");
  });
})();
