// ============================================================
// Глобальный «дежурный» таймер простоя (attract loop) — два режима:
//
//   1. Пока после видео НЕ БЫЛО ни одного взаимодействия (не открыли
//      ни один объект, не нажали «Авторы» и т.д.) — короткий таймер
//      (firstTimeoutMs). Не уложились — видео запускается заново.
//   2. Как только произошло любое первое взаимодействие — переключаемся
//      на длинный таймер (repeatTimeoutMs), который перезапускается
//      при КАЖДОМ следующем взаимодействии. Если после последнего
//      взаимодействия прошло больше repeatTimeoutMs — видео запускается
//      заново.
//
// Слушаем pointerdown на всём document (событие всплывает и с карты,
// и с 3D/2D-стадии, и с кнопок — отдельно вешать слушатели на каждый
// экран не нужно).
// ============================================================

export function createGlobalIdleWatcher({ firstTimeoutMs, repeatTimeoutMs }, onIdle) {
  let timer = null;
  let enabled = true;
  let hasInteracted = false; // было ли уже хоть одно взаимодействие с момента resume()

  function currentTimeout() {
    return hasInteracted ? repeatTimeoutMs : firstTimeoutMs;
  }

  function arm() {
    if (!enabled) return;
    clearTimeout(timer);
    timer = setTimeout(onIdle, currentTimeout());
  }

  function activityHandler() {
    hasInteracted = true; // с этого момента и до следующего resume() — режим «5 минут»
    arm();
  }

  document.addEventListener("pointerdown", activityHandler, { passive: true });

  return {
    // приостановить отсчёт (например, пока и так показывается видео)
    pause() { enabled = false; clearTimeout(timer); },
    // возобновить отсчёт «с чистого листа» — снова короткий таймер,
    // пока не случится первое взаимодействие
    resume() {
      enabled = true;
      hasInteracted = false;
      arm();
    },
    // переключить на короткий таймер (20 сек) — используется когда
    // пользователь вручную нажал кнопку перезапуска видео
    resetToFirstTimeout() {
      hasInteracted = false;
      arm();
    },
    destroy() {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", activityHandler);
    }
  };
}
