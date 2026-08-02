// ============================================================
// Переиспользуемый текстовый блок — БЕЗ пагинации (стрелки/точки
// убраны по вашей просьбе, листание оставлено только у карусели
// элементов одежды). Все секции просто идут одна за другой, блок
// прокручивается, если не помещается целиком.
// ============================================================

/**
 * @param {HTMLElement} container - куда вставить разметку
 * @param {Array<{h:string,t:string,location?:string}>} sections
 * @param {Object} [opts]
 * @param {string} [opts.extraClass] - дополнительный класс на обёртку (для стилизации под конкретное место)
 * @returns {{setSections:Function, destroy:Function}}
 */
export function createTextBlock(container, sections, opts = {}) {
  function render(list) {
    container.innerHTML = `<div class="mini-text-block ${opts.extraClass || ""}"><div class="text-content"></div></div>`;
    const contentEl = container.querySelector(".text-content");
    (list || []).forEach((s) => {
      const block = document.createElement("div");
      block.className = "text-section";

      const h3 = document.createElement("h3");
      h3.textContent = s.h;
      block.appendChild(h3);

      const p = document.createElement("p");
      p.textContent = s.t;
      block.appendChild(p);

      if (s.location) {
        const loc = document.createElement("p");
        loc.className = "txt-location";
        loc.textContent = s.location;
        block.appendChild(loc);
      }
      contentEl.appendChild(block);
    });
  }

  render(sections);

  return {
    setSections(newSections) { render(newSections); },
    destroy() {}
  };
}
