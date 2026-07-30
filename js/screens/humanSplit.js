// ============================================================
// Раскладка экрана «Человек»: модель в правой половине, слева —
// текст про элемент одежды / карусель одежды / текст о находке
// (см. js/screens/humanPanel.js).
// ============================================================
import { mountModelViewer } from "./object3d.js";
import { initHumanPanel } from "./humanPanel.js";

export async function initHumanSplit(container, data) {
  container.innerHTML = `
    <div class="human-split">
      <div class="human-split-left"></div>
      <div class="human-split-stage stage-3d"></div>
    </div>
  `;

  const leftEl = container.querySelector(".human-split-left");
  const stageEl = container.querySelector(".human-split-stage");

  const panel = initHumanPanel(leftEl, data);
  const viewer = await mountModelViewer(stageEl, { modelPath: data.model, icon: data.icon });

  return {
    destroy() {
      panel.destroy();
      viewer.destroy();
    }
  };
}
