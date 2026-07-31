// ============================================================
// Пагинация текстовых блоков объекта (ТЗ п.10).
// Индикатор страниц ▰ ▱ ▱ — не кликабелен, только отображает прогресс.
// Листать можно и стрелками, и свайпом по самому тексту.
// ============================================================

const SWIPE_THRESHOLD = 40; // px, минимальное горизонтальное перемещение, чтобы засчитать как свайп

export class TextPager {
  /**
   * @param {Object} refs
   * @param {HTMLElement} refs.heading
   * @param {HTMLElement} refs.body
   * @param {HTMLElement} refs.dots
   * @param {HTMLButtonElement} refs.prevBtn
   * @param {HTMLButtonElement} refs.nextBtn
   * @param {HTMLElement} [refs.swipeArea] — область для свайпа (по умолчанию — родитель body, т.е. .text-content)
   */
  constructor(refs) {
    this.heading = refs.heading;
    this.body = refs.body;
    this.location = refs.location || null; // необязательно — маленькая подпись "место хранения"
    this.dots = refs.dots;
    this.prevBtn = refs.prevBtn;
    this.nextBtn = refs.nextBtn;
    this.sections = [];
    this.page = 0;

    this._onPrev = () => this.go(this.page - 1);
    this._onNext = () => this.go(this.page + 1);
    this.prevBtn.addEventListener("pointerdown", this._onPrev);
    this.nextBtn.addEventListener("pointerdown", this._onNext);

    // --- свайп по самому тексту (не только клик по стрелкам) ---
    this.swipeArea = refs.swipeArea || this.body.parentElement;
    let dragging = false, startX = 0, startY = 0, deltaX = 0;
    this._onPointerDown = (e) => { dragging = true; startX = e.clientX; startY = e.clientY; deltaX = 0; };
    this._onPointerMove = (e) => { if (dragging) deltaX = e.clientX - startX; };
    this._onPointerUp = (e) => {
      if (!dragging) return;
      dragging = false;
      const deltaY = e.clientY - startY;
      // засчитываем как свайп-пролистывание, только если движение
      // преимущественно горизонтальное (иначе это обычная вертикальная
      // прокрутка длинного текста — её трогать не нужно)
      if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY)) {
        this.go(this.page + (deltaX < 0 ? 1 : -1));
      }
    };
    this._onPointerCancel = () => { dragging = false; };
    this.swipeArea.addEventListener("pointerdown", this._onPointerDown);
    this.swipeArea.addEventListener("pointermove", this._onPointerMove);
    this.swipeArea.addEventListener("pointerup", this._onPointerUp);
    this.swipeArea.addEventListener("pointercancel", this._onPointerCancel);
  }

  setSections(sections) {
    this.sections = sections || [];
    this.page = 0;
    this._render();
  }

  go(page) {
    if (page < 0 || page > this.sections.length - 1) return;
    this.page = page;
    this._render();
  }

  _render() {
    const s = this.sections[this.page];
    if (!s) return;
    this.heading.textContent = s.h;
    this.body.textContent = s.t;
    if (this.location) {
      if (s.location) {
        this.location.textContent = s.location;
        this.location.classList.remove("hidden");
      } else {
        this.location.textContent = "";
        this.location.classList.add("hidden");
      }
    }
    this.prevBtn.disabled = this.page === 0;
    this.nextBtn.disabled = this.page === this.sections.length - 1;

    this.dots.innerHTML = "";
    this.sections.forEach((_, i) => {
      const d = document.createElement("div");
      d.className = "dot" + (i === this.page ? " active" : "");
      this.dots.appendChild(d);
    });
  }

  destroy() {
    this.prevBtn.removeEventListener("pointerdown", this._onPrev);
    this.nextBtn.removeEventListener("pointerdown", this._onNext);
    this.swipeArea.removeEventListener("pointerdown", this._onPointerDown);
    this.swipeArea.removeEventListener("pointermove", this._onPointerMove);
    this.swipeArea.removeEventListener("pointerup", this._onPointerUp);
    this.swipeArea.removeEventListener("pointercancel", this._onPointerCancel);
  }
}
