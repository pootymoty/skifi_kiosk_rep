// ============================================================
// Шахматная раскладка экрана «Скифский звериный стиль»
// (см. js/data/content.js → objects.panther):
//
//   ряд 1:  текст t1           | модель «Пантера и олень» | текст t2
//   ряд 2:  модель «Олень»     | текст t3                 | модель «Пантера»
//   ряд 3:  текст t4 (по центру, во всю ширину)
//
// Модели ищутся по подписи (label), поэтому их порядок в content.js
// значения не имеет. Раньше каждая модель рендерилась своим отдельным
// WebGL-рендерером — три параллельных GL-контекста заметно подвисали.
// Теперь все три модели рендерятся ОДНИМ общим рендерером через
// scissor/viewport (см. js/screens/object3d.js → mountModelGroup) —
// взаимодействие (вращение/автовращение/сброс) у каждой по-прежнему
// независимое, просто сама отрисовка общая.
// Каждый текстовый блок — независимый пейджер (стрелки ‹ › + квадратики),
// см. js/utils/textBlock.js.
// ============================================================
import { mountModelGroup } from "./object3d.js";
import { createTextBlock } from "../utils/textBlock.js";

export async function initBeastGrid(container, { models, texts }) {
  const combined = models.find(m => /и/.test(m.label) && models.length > 2) || models[2];
  const deer = models.find(m => /олень/i.test(m.label)) || models[1];
  const panther = models.find(m => /пантера/i.test(m.label) && m !== combined) || models[0];

  container.innerHTML = `
    <div class="beast-grid">
      <div class="beast-cell beast-text area-t1"></div>
      <div class="beast-cell beast-model area-m1"></div>
      <div class="beast-cell beast-text area-t2"></div>
      <div class="beast-cell beast-model area-m2"></div>
      <div class="beast-cell beast-text area-t3"></div>
      <div class="beast-cell beast-model area-m3"></div>
      <div class="beast-cell beast-text area-t4"></div>
    </div>
  `;

  const pagers = [
    createTextBlock(container.querySelector(".area-t1"), texts.t1),
    createTextBlock(container.querySelector(".area-t2"), texts.t2),
    createTextBlock(container.querySelector(".area-t3"), texts.t3),
    createTextBlock(container.querySelector(".area-t4"), texts.t4)
  ];

  const modelGroup = await mountModelGroup([
    { el: container.querySelector(".area-m1"), modelConfig: combined },
    { el: container.querySelector(".area-m2"), modelConfig: deer },
    { el: container.querySelector(".area-m3"), modelConfig: panther }
  ]);

  return {
    destroy() {
      modelGroup.destroy();
      pagers.forEach((p) => p.destroy());
    }
  };
}
