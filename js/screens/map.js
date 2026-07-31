// ============================================================
// Интерактивная карта (ТЗ п.9). Метки объектов берутся из
// content.js (hotspot.x/y — проценты от области карты).
//
// Два режима отображения метки — выбираются автоматически:
//   - data.hotspotImage задан  → кликабельна вся картинка объекта
//     (PNG с прозрачностью), подсветка идёт по её реальному контуру
//     (CSS drop-shadow работает по alpha-каналу картинки, отдельная
//     SVG-обводка не нужна);
//   - не задан → как раньше, круглая кнопка с эмодзи.
// Если файл по hotspotImage не найден — тихий откат на круглую кнопку.
//
// При касании — короткая «разгонка» перед переходом (карта
// притемняется, выбранный объект подсвечивается сильнее и чуть
// увеличивается), и только потом происходит сам переход на экран
// объекта — вместо мгновенного жёсткого переключения.
// ============================================================
import { createOnceHint } from "../utils/hints.js";

const SELECT_DELAY_MS = 380;

export function initMapScreen(container, mapData, objects, onSelect, onAuthors, onRestartVideo, showHint) {
  container.innerHTML = `
    <div class="map-stage">
      <img class="map-bg" alt="" draggable="false">
      <div class="map-scrim"></div>
      <div class="hotspots-layer"></div>
      <div class="map-caption-group">
        <span class="eyebrow map-eyebrow">Интерактивная экспозиция</span>
        <h1 class="map-title">Скифы Алтая · Древности Сибири</h1>
      </div>
      <button class="btn authors-fab">Авторы</button>
      <button class="btn restart-video-fab" title="Переиграть видео-заставку">Заставка</button>
      <div class="hint-toast map-hint">Нажмите на объект, чтобы узнать больше</div>
    </div>
  `;

  const stage = container.querySelector(".map-stage");
  const bg = container.querySelector(".map-bg");
  const layer = container.querySelector(".hotspots-layer");
  const authorsBtn = container.querySelector(".authors-fab");
  const restartVideoBtn = container.querySelector(".restart-video-fab");
  const hintEl = container.querySelector(".map-hint");

  bg.addEventListener("error", () => {
    console.warn("[map] Файл не найден: " + mapData.background + ". Показан фон-заглушка.");
    stage.classList.add("no-image");
  });
  bg.src = mapData.background;

  function roundMarkup(data) {
    return `<div class="ring"></div><div class="ring2"></div>
      <div class="glyph">${data.icon || "◆"}</div>
      <div class="label">${data.title}</div>`;
  }

  let transitioning = false; // блокируем повторный тап, пока идёт «разгонка»
  const sizedHotspots = []; // {el, data} — картинки-вырезки, чей размер надо пересчитывать при ресайзе

  function selectHotspot(id, el) {
    if (transitioning) return;
    transitioning = true;
    stage.classList.add("selecting");
    el.classList.add("selected");
    setTimeout(() => onSelect(id), SELECT_DELAY_MS);
  }

  Object.entries(objects).forEach(([id, data]) => {
    const hs = document.createElement("div");
    hs.className = "hotspot";
    hs.style.left = data.hotspot.x + "%";
    hs.style.top = data.hotspot.y + "%";

    if (data.hotspotImage) {
      hs.classList.add("hotspot-image-mode");
      hs.innerHTML = `
        <img class="hotspot-cutout" src="${data.hotspotImage}" alt="" draggable="false">
        <div class="label">${data.title}</div>
      `;
      hs.querySelector(".hotspot-cutout").addEventListener("error", () => {
        console.warn("[map] Файл не найден: " + data.hotspotImage + ". Показана круглая кнопка вместо картинки-вырезки.");
        hs.classList.remove("hotspot-image-mode");
        hs.innerHTML = roundMarkup(data);
      });
      // Ширина вырезки — в процентах от карты (по умолчанию 9%), а не в
      // фиксированных пикселях, чтобы она увеличивалась/уменьшалась
      // ВМЕСТЕ с самим фоном карты на разных экранах, а не оставалась
      // одного размера всегда.
      sizedHotspots.push({ el: hs, percent: data.hotspotWidthPercent || 9 });
    } else {
      hs.innerHTML = roundMarkup(data);
    }

    hs.addEventListener("pointerdown", () => selectHotspot(id, hs));
    layer.appendChild(hs);
  });

  function layoutHotspotSizes() {
    const stageW = stage.clientWidth;
    if (!stageW) return;
    sizedHotspots.forEach(({ el, percent }) => {
      el.style.setProperty("--hs-w", (stageW * percent / 100) + "px");
    });
  }
  layoutHotspotSizes();
  const sizeObserver = new ResizeObserver(layoutHotspotSizes);
  sizeObserver.observe(stage);

  authorsBtn.addEventListener("pointerdown", () => {
    if (transitioning) return;
    onAuthors();
  });

  restartVideoBtn.addEventListener("pointerdown", () => {
    if (transitioning) return;
    onRestartVideo(true); // true = пользователь вручную нажал кнопку, переключиться на таймер 20 сек
  });

  const hint = createOnceHint(hintEl, layer);
  if (showHint) hint.show();

  return {
    destroy() {
      hint.dispose();
      sizeObserver.disconnect();
    }
  };
}
