// ============================================================
// Экран «Скифский звериный стиль» (см. js/data/content.js →
// objects.panther.entries): три фигурки листаются ОДНОЙ парой стрелок
// (не по отдельности) — при переключении меняются разом модель,
// заголовок страницы и текст. Модель — справа, текст — слева
// (см. css/style.css → .beast-carousel), заголовок — общий .page-title
// в шапке страницы (передаём через helpers.setPageTitle).
// ============================================================
import { mountModelViewer } from "./object3d.js";

export async function initBeastCarousel(container, { title, entries }, helpers = {}) {
  container.innerHTML = `
    <div class="beast-carousel">
      <div class="beast-carousel-text"></div>
      <div class="beast-carousel-stage stage-3d"></div>
      <div class="beast-carousel-arrows">
        <button class="text-arrow" data-prev aria-label="Предыдущая фигура">‹</button>
        <button class="text-arrow" data-next aria-label="Следующая фигура">›</button>
      </div>
    </div>
  `;

  const textEl = container.querySelector(".beast-carousel-text");
  const stageEl = container.querySelector(".beast-carousel-stage");
  const prevBtn = container.querySelector("[data-prev]");
  const nextBtn = container.querySelector("[data-next]");

  let index = 0;
  let viewer = null;

  async function show(i) {
    index = ((i % entries.length) + entries.length) % entries.length;
    const entry = entries[index];

    if (helpers.setPageTitle) helpers.setPageTitle(entry.pageTitle || title);

    textEl.innerHTML = `
      <h3>${entry.section.h}</h3>
      <p>${entry.section.t}</p>
      ${entry.section.location ? `<p class="txt-location">${entry.section.location}</p>` : ""}
    `;

    if (viewer) { viewer.destroy(); viewer = null; }
    viewer = await mountModelViewer(stageEl, { modelPath: entry.modelPath, icon: entry.icon });

    prevBtn.disabled = false;
    nextBtn.disabled = false;
  }

  prevBtn.addEventListener("pointerdown", () => show(index - 1));
  nextBtn.addEventListener("pointerdown", () => show(index + 1));

  await show(0);

  return {
    destroy() {
      if (viewer) viewer.destroy();
      if (helpers.setPageTitle) helpers.setPageTitle(title); // возвращаем заголовок как было
    }
  };
}
