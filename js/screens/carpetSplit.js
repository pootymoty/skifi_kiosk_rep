// ============================================================
// Раскладка экрана «Ковёр»: картинка в правой половине (с небольшим
// заходом за середину экрана — см. css/style.css → .carpet-split),
// текст слева, отцентрирован по высоте. Текст — обычный пейджер
// (см. js/utils/textBlock.js), при касании «дырки» переключается
// на текст фрагмента, при возврате — обратно на текст ковра.
// ============================================================
import { createTextBlock } from "../utils/textBlock.js";
import { initObjectStage2D } from "./object2d.js";

export function initCarpetSplit(container, data) {
  container.innerHTML = `
    <div class="carpet-split">
      <div class="carpet-split-text"></div>
      <div class="carpet-split-stage stage-2d"></div>
    </div>
  `;

  const textEl = container.querySelector(".carpet-split-text");
  const pager = createTextBlock(textEl, data.sections);

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
