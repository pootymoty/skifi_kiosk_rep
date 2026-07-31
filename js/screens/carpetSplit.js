// ============================================================
// Раскладка экрана «Ковёр»: картинка в правой половине (с небольшим
// заходом за середину экрана — см. css/style.css → .carpet-split).
// Слева — ДВА независимых текстовых поля:
//   - верхнее  — постоянный вводный текст про ковёр (data.introSections);
//   - центральное — основной пейджер (data.sections), именно он
//     переключается на текст фрагмента при касании «дырки» и обратно
//     при возврате (через onSectionsChange).
// Оба поля — обычные пейджеры (см. js/utils/textBlock.js): стрелки
// ‹ › и свайп работают одинаково в обоих.
// ============================================================
import { createTextBlock } from "../utils/textBlock.js";
import { initObjectStage2D } from "./object2d.js";

export function initCarpetSplit(container, data) {
  container.innerHTML = `
    <div class="carpet-split">
      <div class="carpet-split-text">
        <div class="carpet-split-text-top"></div>
        <div class="carpet-split-text-center"></div>
      </div>
      <div class="carpet-split-stage stage-2d"></div>
    </div>
  `;

  const topEl = container.querySelector(".carpet-split-text-top");
  const centerEl = container.querySelector(".carpet-split-text-center");

  const topPager = createTextBlock(topEl, data.introSections || []);
  const centerPager = createTextBlock(centerEl, data.sections);

  const stageEl = container.querySelector(".carpet-split-stage");
  const stage2d = initObjectStage2D(stageEl, {
    imagePath: data.image,
    hole: data.hole,
    baseSections: data.sections,
    onSectionsChange: (sections) => centerPager.setSections(sections)
  });

  return {
    destroy() {
      topPager.destroy();
      centerPager.destroy();
      if (stage2d && stage2d.destroy) stage2d.destroy();
    }
  };
}
