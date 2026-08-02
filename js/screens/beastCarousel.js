// ============================================================
// Экран «Скифский звериный стиль» (см. js/data/content.js →
// objects.panther.entries): три фигурки листаются ОДНОЙ парой стрелок
// (не по отдельности) — при переключении меняются разом модель,
// заголовок страницы и текст. Стрелки — просто переключение отображения
// одной модели на другую + замена текста, БЕЗ зацикливания: на первой
// фигурке «‹» неактивна, на последней неактивна «›».
// ============================================================
import { mountModelViewer } from "./object3d.js";
import { createOnceHint } from "../utils/hints.js";

export async function initBeastCarousel(container, { title, entries }, helpers = {}) {
  container.innerHTML = `
    <div class="beast-carousel">
      <div class="beast-carousel-text"></div>
      <div class="beast-carousel-stage-wrap">
        <div class="beast-carousel-stage stage-3d"></div>
        <div class="hint-toast beast-hint">Вращай</div>
      </div>
      <div class="beast-carousel-arrows">
        <button class="text-arrow" data-prev aria-label="Предыдущая фигура">‹</button>
        <button class="text-arrow" data-next aria-label="Следующая фигура">›</button>
      </div>
    </div>
  `;

  const textEl = container.querySelector(".beast-carousel-text");
  const stageWrapEl = container.querySelector(".beast-carousel-stage-wrap");
  const stageEl = container.querySelector(".beast-carousel-stage");
  const prevBtn = container.querySelector("[data-prev]");
  const nextBtn = container.querySelector("[data-next]");
  const hintEl = container.querySelector(".beast-hint");
  const hint = createOnceHint(hintEl, stageWrapEl);

  let index = 0;
  let viewer = null;
  let busy = false; // блокируем повторное нажатие, пока идёт переключение — раньше это и вызывало "кривое" листание

  async function show(i) {
    if (busy) return;
    if (i < 0 || i > entries.length - 1) return; // без зацикливания: за края не выходим
    busy = true;
    prevBtn.disabled = true;
    nextBtn.disabled = true;

    index = i;
    const entry = entries[index];

    if (helpers.setPageTitle) helpers.setPageTitle(entry.pageTitle || title);

    textEl.innerHTML = `
      <h3>${entry.section.h}</h3>
      <p>${entry.section.t}</p>
      ${entry.section.location ? `<p class="txt-location">${entry.section.location}</p>` : ""}
    `;

    if (viewer) { viewer.destroy(); viewer = null; }
    // ВАЖНО: mountModelViewer только ДОБАВЛЯЕТ элементы (canvas/значок
    // загрузки), сам не очищает контейнер — раньше именно это и было
    // причиной "кривого" листания: старые canvas оставались висеть друг
    // на друге при каждом переключении. Чистим явно перед новым монтированием.
    stageEl.innerHTML = "";
    stageEl.classList.remove("revealed");
    viewer = await mountModelViewer(stageEl, { modelPath: entry.modelPath, icon: entry.icon });
    await viewer.ready; // дожидаемся, чтобы страница/переключение не выглядели "недогруженными"

    busy = false;
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === entries.length - 1;
    hint.show();
  }

  prevBtn.addEventListener("pointerdown", () => show(index - 1));
  nextBtn.addEventListener("pointerdown", () => show(index + 1));

  await show(0);

  return {
    destroy() {
      hint.dispose();
      if (viewer) viewer.destroy();
      if (helpers.setPageTitle) helpers.setPageTitle(title); // возвращаем заголовок как было
    }
  };
}
