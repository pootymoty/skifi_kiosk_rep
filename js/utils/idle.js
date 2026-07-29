// ============================================================
// Глобальный «дежурный» таймер простоя (attract loop).
//
// Раньше в приложении был только ОДИН таймер простоя — локальный,
// внутри 3D-стадии (object3d.js), который сбрасывает поворот/зум
// конкретной модели через 10 секунд бездействия. Он не имеет
// отношения к видео и не мог его перезапускать — поэтому видео
// «не перезапускалось»: для этого просто не было отдельного
// механизма. Этот файл его добавляет.
//
// Логика: слушаем pointerdown на всём документе (любое касание —
// на карте, в 3D/2D-стадии, в тексте — событие всплывает до
// document, так что отдельно навешивать слушатели на каждый экран
// не нужно). Если тишина дольше timeoutMs — вызываем onIdle().
// ============================================================

export function createGlobalIdleWatcher(timeoutMs, onIdle) {
  let timer = null;
  let enabled = true;

  function reset() {
    if (!enabled) return;
    clearTimeout(timer);
    timer = setTimeout(onIdle, timeoutMs);
  }

  function activityHandler() { reset(); }

  document.addEventListener("pointerdown", activityHandler, { passive: true });
  reset();

  return {
    // приостановить отсчёт (например, пока и так показывается видео)
    pause() { enabled = false; clearTimeout(timer); },
    // возобновить отсчёт заново
    resume() { enabled = true; reset(); },
    destroy() {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", activityHandler);
    }
  };
}
