// ============================================================
// Переиспользуемый текстовый блок с пагинацией — только стрелки ‹ ›
// (без точек-индикатора), показываются, ТОЛЬКО если у блока больше
// одной страницы — см. js/utils/pagination.js (TextPager._render()
// сам скрывает их, если sections.length <= 1). Можно поставить где
// угодно, и у каждого экземпляра — своя независимая пагинация, свайп
// по тексту тоже работает.
// ============================================================
import { TextPager } from "./pagination.js";

/**
 * @param {HTMLElement} container - куда вставить разметку
 * @param {Array<{h:string,t:string,location?:string}>} sections
 * @param {Object} [opts]
 * @param {string} [opts.extraClass] - дополнительный класс на обёртку (для стилизации под конкретное место)
 * @param {boolean} [opts.arrowsBelow] - стрелки под текстом (в ряд), а не по бокам от него
 * @returns {TextPager} - обычный TextPager (setSections/go/destroy)
 */
export function createTextBlock(container, sections, opts = {}) {
  container.innerHTML = opts.arrowsBelow
    ? `
      <div class="mini-text-block arrows-below ${opts.extraClass || ""}">
        <div class="text-content">
          <h3 data-heading>—</h3>
          <p data-body>—</p>
          <p class="txt-location" data-location></p>
        </div>
        <div class="text-arrows-row">
          <button class="text-arrow" data-prev aria-label="Предыдущий блок">‹</button>
          <button class="text-arrow" data-next aria-label="Следующий блок">›</button>
        </div>
      </div>
    `
    : `
      <div class="mini-text-block ${opts.extraClass || ""}">
        <div class="text-slider">
          <button class="text-arrow" data-prev aria-label="Предыдущий блок">‹</button>
          <div class="text-content">
            <h3 data-heading>—</h3>
            <p data-body>—</p>
            <p class="txt-location" data-location></p>
          </div>
          <button class="text-arrow" data-next aria-label="Следующий блок">›</button>
        </div>
      </div>
    `;

  const pager = new TextPager({
    heading: container.querySelector("[data-heading]"),
    body: container.querySelector("[data-body]"),
    location: container.querySelector("[data-location]"),
    prevBtn: container.querySelector("[data-prev]"),
    nextBtn: container.querySelector("[data-next]")
  });
  pager.setSections(sections);
  return pager;
}
