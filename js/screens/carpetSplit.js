// ============================================================
// Раскладка экрана «Ковёр»: картинка в правой половине (с небольшим
// заходом за середину экрана — см. css/style.css → .carpet-split),
// текст слева, отцентрирован по высоте. Использует свой собственный
// TextPager (со стрелками < >), не связан с общим шаблоном.
// ============================================================
import { TextPager } from "../utils/pagination.js";
import { initObjectStage2D } from "./object2d.js";

export function initCarpetSplit(container, data) {
  container.innerHTML = `
    <div class="carpet-split">
      <div class="carpet-split-text">
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
      <div class="carpet-split-stage stage-2d"></div>
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
  pager.setSections(data.sections);

  const stageEl = container.querySelector(".carpet-split-stage");
  const stage2d = initObjectStage2D(stageEl, {
    imagePath: data.image,
    hole: data.hole,
    baseSections: data.sections,
    onSectionsChange: (sections) => pager.setSections(sections)
  });

  return {
    destroy() {
      pager.destroy();
      if (stage2d && stage2d.destroy) stage2d.destroy();
    }
  };
}
