// ============================================================
// Шахматная раскладка экрана «Скифский звериный стиль»
// (см. js/data/content.js → objects.panther):
//
//   ряд 1:  текст t1           | модель «Пантера и олень» | текст t2
//   ряд 2:  модель «Олень»     | текст t3                 | модель «Пантера»
//   ряд 3:  текст t4 (по центру, во всю ширину)
//
// Модели ищутся по подписи (label), поэтому их порядок в content.js
// значения не имеет. Каждая модель — независимая ячейка с собственным
// автовращением/сбросом простоя (см. js/screens/object3d.js → mountModelViewer).
// Каждый текстовый блок — независимый пейджер (стрелки ‹ › + квадратики),
// см. js/utils/textBlock.js.
// ============================================================
import { mountModelViewer } from "./object3d.js";
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

  const m1 = container.querySelector(".area-m1");
  const m2 = container.querySelector(".area-m2");
  const m3 = container.querySelector(".area-m3");

  const viewers = await Promise.all([
    mountModelViewer(m1, combined, { lite: true }),
    mountModelViewer(m2, deer, { lite: true }),
    mountModelViewer(m3, panther, { lite: true })
  ]);

  return {
    destroy() {
      viewers.forEach((c) => c.destroy());
      pagers.forEach((p) => p.destroy());
    }
  };
}
