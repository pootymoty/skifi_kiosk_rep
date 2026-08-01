// ============================================================
// Интерактивная карта (ТЗ п.9). Больше НЕТ фоновой картинки —
// просто чёрный фон, на котором расположены кликабельные объекты
// по координатам из content.js (hotspot.x/y — проценты от area карты,
// hotspotWidthPercent — ширина в процентах от ширины карты). Проценты
// сами по себе одинаково корректно масштабируются на экранах любого
// размера (от ноутбука до интерактивного стола) при одинаковом
// соотношении сторон — это не требует отдельной логики.
//
// Два режима отображения метки:
//   - data.hotspotImage задан  → кликабельна вся картинка объекта
//     (PNG с прозрачностью), подсветка идёт по её реальному контуру.
//     Клик засчитывается ТОЛЬКО по непрозрачным пикселям картинки —
//     это важно, когда объекты стоят близко друг к другу: клик по
//     прозрачному участку одной картинки "проваливается" к тому, что
//     реально нарисовано под ним (см. hitTestAtPoint).
//   - не задан → как раньше, круглая кнопка с эмодзи.
// Если файл по hotspotImage не найден — тихий откат на круглую кнопку.
//
// При касании — короткая «разгонка» перед переходом (сцена
// притемняется, выбранный объект подсвечивается сильнее и чуть
// увеличивается), и только потом происходит сам переход на экран
// объекта — вместо мгновенного жёсткого переключения.
// ============================================================
import { createOnceHint } from "../utils/hints.js";

const SELECT_DELAY_MS = 380;
const ALPHA_THRESHOLD = 15; // 0-255, ниже — считаем пиксель прозрачным (клик "проваливается" дальше)

export function initMapScreen(container, mapData, objects, onSelect, onAuthors, onRestartVideo, showHint) {
  container.innerHTML = `
    <div class="map-stage">
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
  const layer = container.querySelector(".hotspots-layer");
  const authorsBtn = container.querySelector(".authors-fab");
  const restartVideoBtn = container.querySelector(".restart-video-fab");
  const hintEl = container.querySelector(".map-hint");

  function roundMarkup(data) {
    return `<div class="ring"></div><div class="ring2"></div>
      <div class="glyph">${data.icon || "◆"}</div>
      <div class="label">${data.title}</div>`;
  }

  let transitioning = false; // блокируем повторный тап, пока идёт «разгонка»
  const sizedHotspots = []; // {el, percent} — картинки-вырезки, чей размер надо пересчитывать при ресайзе
  const alphaMap = new Map(); // hotspot-элемент → { natW, natH, data } для точного хит-теста по прозрачности

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
    hs.dataset.id = id;
    hs.style.left = data.hotspot.x + "%";
    hs.style.top = data.hotspot.y + "%";

    if (data.hotspotImage) {
      hs.classList.add("hotspot-image-mode");
      hs.innerHTML = `
        <img class="hotspot-cutout" src="${data.hotspotImage}" alt="" draggable="false">
        <div class="label">${data.title}</div>
      `;
      const img = hs.querySelector(".hotspot-cutout");
      img.addEventListener("error", () => {
        console.warn("[map] Файл не найден: " + data.hotspotImage + ". Показана круглая кнопка вместо картинки-вырезки.");
        hs.classList.remove("hotspot-image-mode");
        hs.innerHTML = roundMarkup(data);
      });
      img.addEventListener("load", () => buildAlphaMask(hs, img));
      // Ширина вырезки — в процентах от карты, а не в фиксированных
      // пикселях, чтобы она увеличивалась/уменьшалась ВМЕСТЕ с самой
      // картой на разных экранах, а не оставалась одного размера всегда.
      sizedHotspots.push({ el: hs, percent: data.hotspotWidthPercent || 9 });
    } else {
      hs.innerHTML = roundMarkup(data);
    }

    layer.appendChild(hs);
  });

  // Строим оффскрин-канвас с альфа-каналом картинки один раз при
  // загрузке — дальше просто читаем из готового пиксельного массива,
  // это дёшево даже при частых кликах.
  function buildAlphaMask(hs, img) {
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    try {
      const data = ctx.getImageData(0, 0, w, h).data;
      alphaMap.set(hs, { natW: w, natH: h, data });
    } catch (err) {
      console.warn("[map] Не удалось прочитать пиксели " + img.src + " для точного хит-теста.", err);
    }
  }

  function isOpaqueAt(hs, clientX, clientY) {
    const mask = alphaMap.get(hs);
    if (!mask) return true; // круглая кнопка (или маска ещё не построена) — считаем попаданием как раньше
    const rect = hs.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const fx = (clientX - rect.left) / rect.width;
    const fy = (clientY - rect.top) / rect.height;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return false;
    const px = Math.min(mask.natW - 1, Math.floor(fx * mask.natW));
    const py = Math.min(mask.natH - 1, Math.floor(fy * mask.natH));
    const alpha = mask.data[(py * mask.natW + px) * 4 + 3];
    return alpha > ALPHA_THRESHOLD;
  }

  // Один делегированный слушатель на весь слой меток вместо отдельного
  // на каждую метку — так можно правильно обработать перекрытие: если
  // верхняя картинка в этой точке прозрачна, проверяем следующую под
  // ней (document.elementsFromPoint возвращает их в порядке сверху вниз).
  layer.addEventListener("pointerdown", (e) => {
    if (transitioning) return;
    const candidates = document.elementsFromPoint(e.clientX, e.clientY)
      .filter((el) => el.classList && el.classList.contains("hotspot"));
    for (const el of candidates) {
      if (isOpaqueAt(el, e.clientX, e.clientY)) {
        selectHotspot(el.dataset.id, el);
        return;
      }
    }
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
