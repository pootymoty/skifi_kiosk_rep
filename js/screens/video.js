// ============================================================
// Экран видео-заставки. По завершении ролика (или по тапу «Пропустить»,
// или если файл ещё не добавлен) — переход на карту (ТЗ, «Итоговая
// архитектура»: VIDEO → INTERACTIVE MAP).
// ============================================================

export function initVideoScreen(container, videoSrc, onFinished) {
  container.innerHTML = `
    <video class="intro-video" playsinline muted autoplay preload="auto"></video>
    <div class="intro-fade"></div>
    <button class="btn ghost intro-skip">Пропустить ›</button>
  `;

  const video = container.querySelector(".intro-video");
  const skipBtn = container.querySelector(".intro-skip");

  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    container.classList.add("fading-out");
    setTimeout(onFinished, 420); // затемнение перед переходом (ТЗ п.9 «эффекты перехода»)
  }

  video.addEventListener("ended", finish);
  skipBtn.addEventListener("pointerdown", finish);

  video.addEventListener("error", () => {
    console.warn("[video] Файл не найден: " + videoSrc + ". Добавьте ролик, чтобы показывалась заставка. Пропускаем экран.");
    finish();
  });

  video.src = videoSrc;
  video.play().catch(() => {
    // автовоспроизведение может быть заблокировано браузером —
    // в этом случае просто ждём тап по «Пропустить», либо кадра ended не будет:
    // подстрахуемся коротким таймаутом, чтобы киоск не завис на чёрном экране.
    setTimeout(() => { if (!finished && video.paused) skipBtn.focus(); }, 4000);
  });

  return {
    destroy() {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
  };
}
