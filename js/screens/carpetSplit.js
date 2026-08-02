// ============================================================
// Раскладка экрана «Ковёр»:
//   слева  — текстовый блок (абзацы через \n\n, без пагинации —
//            см. content.js → carpet.sections)
//   справа — картинка ковра
//
// При касании «дырки» открывается всплывающее окно (см.
// js/screens/object2d.js) — оно полностью самодостаточное: свой
// заголовок, свой текст, своя картинка фрагмента и своя кнопка
// «Назад к ковру» — эта раскладка его не трогает, ничего в ней не
// меняется, пока окно открыто.
// ============================================================
import { createTextBlock } from "../utils/textBlock.js";
import { initObjectStage2D } from "./object2d.js";

export async function initCarpetSplit(container, data, helpers = {}) {
  container.innerHTML = `
    <div class="carpet-split">
      <div class="carpet-split-text"></div>
      <div class="carpet-split-stage stage-2d"></div>
    </div>
  `;

  const textEl = container.querySelector(".carpet-split-text");
  const pager = createTextBlock(textEl, data.sections, { arrowsBelow: true, extraClass: "carpet-text-aligned" });

  const stageEl = container.querySelector(".carpet-split-stage");
  const stage2d = initObjectStage2D(stageEl, {
    imagePath: data.image,
    hole: data.hole,
    baseSections: data.sections
  });
  await stage2d.ready; // дожидаемся картинку ковра, чтобы страница открывалась уже полностью готовой

  return {
    destroy() {
      pager.destroy();
      if (stage2d && stage2d.destroy) stage2d.destroy();
    }
  };
}
