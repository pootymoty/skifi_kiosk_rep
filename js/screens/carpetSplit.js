// ============================================================
// Раскладка экрана «Ковёр» (обновлено по новому макету Figma):
//   слева  — картинка ковра
//   справа — ОДИН текстовый пейджер (раньше было два стакнутых поля —
//            теперь объединили в одно, как в макете)
//
// При касании «дырки» этот же текстовый пейджер переключается на текст
// восстановленного фрагмента и обратно (через onSectionsChange), а
// глобальная кнопка «Назад» временно превращается в «Ковёр целиком»
// (см. helpers.setBackOverride, приходит из app.js).
// ============================================================
import { createTextBlock } from "../utils/textBlock.js";
import { initObjectStage2D } from "./object2d.js";

export async function initCarpetSplit(container, data, helpers = {}) {
  container.innerHTML = `
    <div class="carpet-split">
      <div class="carpet-split-stage stage-2d"></div>
      <div class="carpet-split-text"></div>
    </div>
  `;

  const textEl = container.querySelector(".carpet-split-text");
  const pager = createTextBlock(textEl, data.sections, { arrowsBelow: true, extraClass: "carpet-text-aligned" });

  const stageEl = container.querySelector(".carpet-split-stage");
  const stage2d = initObjectStage2D(stageEl, {
    imagePath: data.image,
    hole: data.hole,
    baseSections: data.sections,
    onSectionsChange: (sections) => pager.setSections(sections),
    onHoleToggle: (isOpen, exitFn) => {
      if (helpers.setBackOverride) {
        helpers.setBackOverride(isOpen ? exitFn : null, "Ковёр целиком");
      }
    }
  });
  await stage2d.ready; // дожидаемся картинку ковра, чтобы страница открывалась уже полностью готовой

  return {
    destroy() {
      pager.destroy();
      if (stage2d && stage2d.destroy) stage2d.destroy();
      if (helpers.setBackOverride) helpers.setBackOverride(null); // подстраховка
    }
  };
}
