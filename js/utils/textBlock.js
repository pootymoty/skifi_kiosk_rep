// ============================================================
// Переиспользуемый текстовый блок с пагинацией (стрелки ‹ › +
// квадратики-индикаторы страниц) — тот же принцип, что и в исходном
// едином текстовом блоке объекта, но теперь можно поставить где
// угодно (у каждой модели в шахматке, у каждого элемента одежды,
// у ковра и т.д.), и у каждого экземпляра — своя независимая
// пагинация.
// ============================================================
import { TextPager } from "./pagination.js";

/**
 * @param {HTMLElement} container - куда вставить разметку
 * @param {Array<{h:string,t:string,location?:string}>} sections
 * @param {Object} [opts]
 * @param {string} [opts.extraClass] - дополнительный класс на обёртку (для стилизации под конкретное место)
 * @returns {TextPager} - обычный TextPager (setSections/go/destroy)
 */
export function createTextBlock(container, sections, opts = {}) {
  container.innerHTML = `
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
      <div class="dots" data-dots></div>
    </div>
  `;

  const pager = new TextPager({
    heading: container.querySelector("[data-heading]"),
    body: container.querySelector("[data-body]"),
    location: container.querySelector("[data-location]"),
    dots: container.querySelector("[data-dots]"),
    prevBtn: container.querySelector("[data-prev]"),
    nextBtn: container.querySelector("[data-next]")
  });
  pager.setSections(sections);
  return pager;
}
