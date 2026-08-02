// ============================================================
// Интерактивная карта — макет из Figma (экран 1280×720 в дизайне).
//
// КАК СДЕЛАНО МАСШТАБИРОВАНИЕ: всё (координаты картинок из content.js,
// и позиции заголовка/эйбрау/кнопок ниже, заданные тут же в LAYOUT) —
// в пикселях макета 1280×720, один в один из Figma. При каждом ресайзе
// считаем ОДИН коэффициент scale = реальная_ширина_карты / 1280 и
// применяем его как обычное умножение через JS (не через CSS cqw —
// пробовал, давал неверный результат для части элементов; через JS
// результат гарантированно предсказуем и уже проверен на хит-тесте
// по альфа-каналу ниже). За счёт единого коэффициента для X и Y макет
// масштабируется без искажений на любом экране — 1280×720 это просто
// точка отсчёта, использовать её "напрямую" (без scale) нигде не нужно.
//
// Три объекта (пантера/человек/ковёр) — картинки с прозрачным фоном,
// повёрнутые под углом (как в макете). Клик засчитывается только по
// непрозрачным пикселям, и это работает даже с учётом поворота —
// см. isOpaqueAt (переводит точку клика в локальные координаты
// картинки, отменяя поворот, прежде чем проверять альфа-канал).
//
// Текст (заголовок/эйбрау) рисуется ПОВЕРХ картинок (z-index выше), но
// сам не перехватывает клики (pointer-events:none) — палец «проваливается»
// сквозь буквы к картинке под ними, если она там есть.
// ============================================================
import { createOnceHint } from "../utils/hints.js";

const SELECT_DELAY_MS = 380;
const ALPHA_THRESHOLD = 15; // 0-255, ниже — пиксель считается прозрачным
const REF_W = 1280; // ширина макета в Figma — единая точка отсчёта для всех расчётов

// Позиции статичных элементов (заголовок/эйбрау/кнопки) — в пикселях
// макета 1280×720, 1 в 1 из Figma. Картинки объектов берутся отдельно
// из content.js → objects.*.heroLayout (они per-объектные, эти — нет).
const LAYOUT = {
  word1: { left: 197, top: 272, fontSize: 80 },
  word2: { left: 555, top: 368, fontSize: 80 },
  eyebrow1: { left: 638, top: 232, fontSize: 32 },
  eyebrow2: { left: 565, top: 451, fontSize: 32 },
  btnRestart: { left: 425, top: 649, width: 200, height: 51, fontSize: 24 },
  btnAuthors: { left: 655, top: 649, width: 200, height: 51, fontSize: 24 }
};

function applyLayout(el, spec, scale) {
  if (spec.left !== undefined) el.style.left = spec.left * scale + "px";
  if (spec.top !== undefined) el.style.top = spec.top * scale + "px";
  if (spec.width !== undefined) el.style.width = spec.width * scale + "px";
  if (spec.height !== undefined) el.style.height = spec.height * scale + "px";
  if (spec.fontSize !== undefined) el.style.fontSize = spec.fontSize * scale + "px";
}

export function initMapScreen(container, mapData, objects, onSelect, onAuthors, onRestartVideo, showHint) {
  const heroEntries = Object.entries(objects).filter(([, d]) => d.heroLayout);
  const fallbackEntries = Object.entries(objects).filter(([, d]) => !d.heroLayout);

  container.innerHTML = `
    <div class="map-stage">
      <div class="map-scrim"></div>

      <div class="hotspots-layer"></div>

      <div class="hero-eyebrow" data-el="eyebrow1"></div>
      <h1 class="hero-word" data-el="word1"></h1>
      <h1 class="hero-word" data-el="word2"></h1>
      <div class="hero-eyebrow" data-el="eyebrow2"></div>

      <button class="pill-btn hero-btn-authors" data-el="btnAuthors">Авторы</button>
      <button class="pill-btn hero-btn-restart" data-el="btnRestart" title="Переиграть видео-заставку">Заставка</button>

      <div class="hint-toast map-hint">Нажмите на объект, чтобы узнать больше</div>
    </div>
  `;

  const stage = container.querySelector(".map-stage");
  const layer = container.querySelector(".hotspots-layer");
  const authorsBtn = container.querySelector(".hero-btn-authors");
  const restartVideoBtn = container.querySelector(".hero-btn-restart");
  const hintEl = container.querySelector(".map-hint");

  // Заголовок — два слова + эйбрау-подписи рядом с каждым (см. content.js → map.title)
  container.querySelector('[data-el="word1"]').textContent = mapData.title?.line1 || "";
  container.querySelector('[data-el="word2"]').textContent = mapData.title?.line2 || "";
  container.querySelector('[data-el="eyebrow1"]').textContent = mapData.eyebrow1 || "";
  container.querySelector('[data-el="eyebrow2"]').textContent = mapData.eyebrow2 || "";

  function roundMarkup(data) {
    return `<div class="ring"></div><div class="ring2"></div>
      <div class="glyph">${data.icon || "◆"}</div>
      <div class="label">${data.title}</div>`;
  }

  let transitioning = false;
  const alphaMap = new Map(); // hotspot-элемент → { natW, natH, data, left, top, width, height, rotate } (в px макета 1280×720)
  const heroEls = []; // { el, L } — для пересчёта позиции/размера при ресайзе

  function selectHotspot(id, el) {
    if (transitioning) return;
    transitioning = true;
    stage.classList.add("selecting");
    el.classList.add("selected");
    setTimeout(() => onSelect(id), SELECT_DELAY_MS);
  }

  // --- объекты с точной раскладкой из Figma (heroLayout) ---
  heroEntries.forEach(([id, data]) => {
    const L = data.heroLayout;
    const hs = document.createElement("div");
    hs.className = "hotspot hero-object";
    hs.dataset.id = id;
    hs.style.transform = `rotate(${L.rotate}deg)`;
    hs.innerHTML = `<img class="hero-object-img" src="${L.image}" alt="" draggable="false">`;
    heroEls.push({ el: hs, L });

    const img = hs.querySelector(".hero-object-img");
    img.addEventListener("error", () => {
      console.warn("[map] Файл не найден: " + L.image + " (объект «" + data.title + "»). Метка временно невидима, но кликабельна по всей área (запасной вариант).");
      hs.classList.add("hero-object-missing");
    });
    img.addEventListener("load", () => {
      buildAlphaMask(hs, img, L);
    });

    layer.appendChild(hs);
  });

  // --- объекты без heroLayout (запасной путь — старая круглая кнопка по центру) ---
  fallbackEntries.forEach(([id, data]) => {
    const hs = document.createElement("div");
    hs.className = "hotspot";
    hs.dataset.id = id;
    hs.style.left = data.hotspot.x + "%";
    hs.style.top = data.hotspot.y + "%";
    hs.innerHTML = roundMarkup(data);
    layer.appendChild(hs);
  });

  // Пересчитываем позиции/размеры ВСЕХ элементов макета (картинки,
  // заголовок, эйбрау, кнопки) при любом изменении размера карты —
  // единый коэффициент scale для всего, без искажений.
  function relayout() {
    const scale = stage.clientWidth / REF_W;
    if (!scale) return;

    heroEls.forEach(({ el, L }) => {
      el.style.left = L.left * scale + "px";
      el.style.top = L.top * scale + "px";
      el.style.width = L.width * scale + "px";
      el.style.height = L.height * scale + "px";
    });

    Object.entries(LAYOUT).forEach(([key, spec]) => {
      const el = container.querySelector(`[data-el="${key}"]`);
      if (el) applyLayout(el, spec, scale);
    });
  }
  const ro = new ResizeObserver(relayout);
  ro.observe(stage);
  relayout();

  function buildAlphaMask(hs, img, L) {
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    try {
      const data = ctx.getImageData(0, 0, w, h).data;
      alphaMap.set(hs, { natW: w, natH: h, data, left: L.left, top: L.top, width: L.width, height: L.height, rotate: L.rotate });
    } catch (err) {
      console.warn("[map] Не удалось прочитать пиксели " + img.src + " для точного хит-теста.", err);
    }
  }

  // Проверка «попал ли клик в непрозрачную часть картинки» — с учётом
  // поворота: переводим точку клика в СОБСТВЕННУЮ (неповёрнутую) систему
  // координат картинки, отменяя поворот вокруг её центра, и только потом
  // сравниваем с прямоугольником и альфа-каналом.
  function isOpaqueAt(hs, clientX, clientY) {
    const mask = alphaMap.get(hs);
    if (!mask) return true; // круглая кнопка (или маска ещё не готова) — считаем попаданием, как раньше
    const stageRect = stage.getBoundingClientRect();
    const scale = stageRect.width / REF_W;

    const cx = stageRect.left + (mask.left + mask.width / 2) * scale;
    const cy = stageRect.top + (mask.top + mask.height / 2) * scale;
    const rad = -mask.rotate * Math.PI / 180;
    const dx = clientX - cx, dy = clientY - cy;
    const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
    const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

    const halfW = (mask.width * scale) / 2, halfH = (mask.height * scale) / 2;
    const fx = (localX + halfW) / (halfW * 2);
    const fy = (localY + halfH) / (halfH * 2);
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return false;

    const px_ = Math.min(mask.natW - 1, Math.floor(fx * mask.natW));
    const py_ = Math.min(mask.natH - 1, Math.floor(fy * mask.natH));
    const alpha = mask.data[(py_ * mask.natW + px_) * 4 + 3];
    return alpha > ALPHA_THRESHOLD;
  }

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

  authorsBtn.addEventListener("pointerdown", () => {
    if (transitioning) return;
    onAuthors();
  });

  restartVideoBtn.addEventListener("pointerdown", () => {
    if (transitioning) return;
    onRestartVideo(true);
  });

  const hint = createOnceHint(hintEl, layer);
  if (showHint) hint.show();

  return {
    destroy() {
      hint.dispose();
      ro.disconnect();
    }
  };
}
