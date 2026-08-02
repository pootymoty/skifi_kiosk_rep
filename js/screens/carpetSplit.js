// ============================================================
// Раскладка экрана «Ковёр» (обновлено по новому макету Figma):
//   слева  — текстовый блок (абзацы через \n\n, без пагинации —
//            см. content.js → carpet.sections)
//   справа — картинка ковра
//
// При касании «дырки» страница визуально превращается в свой же
// шаблон с другим содержимым — картинка меняется на восстановленный
// фрагмент, текст меняется (onSectionsChange), заголовок страницы
// меняется на hole.title (onTitleChange), а глобальная кнопка «Меню»
// временно превращается в «Назад к ковру» (helpers.setBackOverride).
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

  // Плавная смена заголовка страницы — ТОЛЬКО для этого перехода
  // (касание "дырки" / кнопка "Ковёр целиком"), общий механизм в
  // app.js не трогаем, на остальных страницах заголовок по-прежнему
  // меняется мгновенно.
  const pageTitleEl = document.getElementById("pageTitle");
  const TITLE_FADE_MS = 220;
  function fadeTitleTo(text) {
    if (!helpers.setPageTitle) return;
    pageTitleEl.classList.add("fading");
    setTimeout(() => {
      helpers.setPageTitle(text);
      pageTitleEl.classList.remove("fading");
    }, TITLE_FADE_MS);
  }

  const stageEl = container.querySelector(".carpet-split-stage");
  const stage2d = initObjectStage2D(stageEl, {
    imagePath: data.image,
    hole: data.hole,
    baseSections: data.sections,
    onSectionsChange: (sections) => pager.setSections(sections),
    onTitleChange: (title) => fadeTitleTo(title || data.title),
    onHoleToggle: (isOpen, exitFn) => {
      if (helpers.setBackOverride) {
        helpers.setBackOverride(isOpen ? exitFn : null, "Назад к ковру");
      }
    }
  });
  await stage2d.ready; // дожидаемся картинку ковра, чтобы страница открывалась уже полностью готовой

  return {
    destroy() {
      pager.destroy();
      if (stage2d && stage2d.destroy) stage2d.destroy();
      if (helpers.setBackOverride) helpers.setBackOverride(null); // подстраховка
      if (helpers.setPageTitle) helpers.setPageTitle(data.title); // подстраховка — вернуть исходный заголовок
    }
  };
}
