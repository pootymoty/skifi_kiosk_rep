// ============================================================
// Пагинация текстовых блоков объекта (ТЗ п.10).
// Индикатор страниц ▰ ▱ ▱ — не кликабелен, только отображает прогресс.
// ============================================================

export class TextPager {
  /**
   * @param {Object} refs
   * @param {HTMLElement} refs.heading
   * @param {HTMLElement} refs.body
   * @param {HTMLElement} refs.dots
   * @param {HTMLButtonElement} refs.prevBtn
   * @param {HTMLButtonElement} refs.nextBtn
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
  }
}
