// ============================================================
// Шахматная раскладка экрана «Скифский звериный стиль»
// (см. js/data/content.js → objects.panther):
//
//   ряд 1:  текст 0            | модель «Пантера и олень» | текст 1
//   ряд 2:  модель «Олень»     | текст 2                  | модель «Пантера»
//   ряд 3:  текст 3 (по центру, во всю ширину)
//
// Модели ищутся по подписи (label), поэтому их порядок в content.js
// значения не имеет. Каждая модель — независимая ячейка с собственным
// автовращением/сбросом простоя (см. js/screens/object3d.js → mountModelViewer).
// ============================================================
import { mountModelViewer } from "./object3d.js";

export async function initBeastGrid(container, { models, sections }) {
  const combined = models.find(m => /и/.test(m.label) && models.length > 2) || models[2];
  const deer = models.find(m => /олень/i.test(m.label)) || models[1];
  const panther = models.find(m => /пантера/i.test(m.label) && m !== combined) || models[0];

  function textCell(section, extraClass) {
    if (!section) return `<div class="beast-cell beast-text ${extraClass || ""}"></div>`;
    return `
      <div class="beast-cell beast-text ${extraClass || ""}">
        <h3>${section.h}</h3>
        <p>${section.t}</p>
        ${section.location ? `<p class="txt-location">${section.location}</p>` : ""}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="beast-grid">
      ${textCell(sections[0], "area-t1")}
      <div class="beast-cell beast-model area-m1"></div>
      ${textCell(sections[1], "area-t2")}
      <div class="beast-cell beast-model area-m2"></div>
      ${textCell(sections[2], "area-t3")}
      <div class="beast-cell beast-model area-m3"></div>
      ${textCell(sections[3], "area-t4")}
    </div>
  `;

  const m1 = container.querySelector(".area-m1");
  const m2 = container.querySelector(".area-m2");
  const m3 = container.querySelector(".area-m3");

  const controllers = await Promise.all([
    mountModelViewer(m1, combined),
    mountModelViewer(m2, deer),
    mountModelViewer(m3, panther)
  ]);

  return {
    destroy() {
      controllers.forEach((c) => c.destroy());
    }
  };
}
