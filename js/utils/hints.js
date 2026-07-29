// ============================================================
// Подсказки пользователю (ТЗ п.14).
// Появляются плавно при первом открытии экрана/объекта и исчезают
// после первого взаимодействия. Больше не показываются повторно
// в рамках текущего сеанса (память не используется — киоск,
// сессия перезапускается при простое/перезагрузке).
// ============================================================

/**
 * @param {HTMLElement} hintEl   элемент подсказки (.hint-toast)
 * @param {HTMLElement} triggerEl элемент, взаимодействие с которым скрывает подсказку
 * @returns {{show():void, dispose():void}}
 */
export function createOnceHint(hintEl, triggerEl) {
  let shown = false;
  let dismissed = false;

  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    hintEl.classList.remove("show");
  }

  triggerEl.addEventListener("pointerdown", dismiss, { once: true });

  return {
    show() {
      if (shown) return;
      shown = true;
      dismissed = false;
      hintEl.classList.remove("show");
      // requestAnimationFrame, чтобы transition сработал даже при повторном показе
      requestAnimationFrame(() => hintEl.classList.add("show"));
    },
    dispose() {
      triggerEl.removeEventListener("pointerdown", dismiss);
      hintEl.classList.remove("show");
    }
  };
}
