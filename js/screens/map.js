// ============================================================
// Интерактивная карта — макет из Figma (экран 1280×720 в дизайне).
//
// КАК СДЕЛАНО МАСШТАБИРОВАНИЕ: все координаты/размеры/повороты объектов
// заданы в content.js как есть, один в один из Figma (heroLayout.left/
// top/width/height/rotate — в пикселях макета 1280×720). В CSS они
// переводятся в единицы "cqw" (% от ширины родителя, см. .map-stage{
// container-type:inline-size}) через calc(N/1280*100cqw) — то есть
// одно и то же число, но выраженное в процентах от реальной ширины
// карты. За счёт этого макет масштабируется идентично что на ноутбуке,
// что на интерактивном столе — реальные пиксели тут вообще не хранятся,
// хранится только ПРОПОРЦИЯ относительно ширины экрана 1280.
//
// Три объекта (пантера/человек/ковёр) — картинки с прозрачным фоном,
// повёрнутые под углом (как в макете). Клик засчитывается только по
// непрозрачным пикселям, и это работает даже с учётом поворота —
// см. hitTestAtPoint (переводит точку клика в локальные координаты
// картинки, отменяя поворот, прежде чем проверять альфа-канал).
// ============================================================
import { createOnceHint } from "../utils/hints.js";
import { traceContours } from "../utils/contourTrace.js";

const SELECT_DELAY_MS = 380;
const ALPHA_THRESHOLD = 15; // 0-255, ниже — пиксель считается прозрачным
const REF_W = 1280; // ширина макета в Figma — точка отсчёта для всех calc()

function px(n) { return `calc(${n} / ${REF_W} * 100cqw)`; }

export function initMapScreen(container, mapData, objects, onSelect, onAuthors, onRestartVideo, showHint) {
  const heroEntries = Object.entries(objects).filter(([, d]) => d.heroLayout);
  const fallbackEntries = Object.entries(objects).filter(([, d]) => !d.heroLayout);

  container.innerHTML = `
    <div class="map-stage">
      <div class="map-scrim"></div>

      <div class="hero-eyebrow hero-eyebrow-1" data-eyebrow="1"></div>
      <h1 class="hero-word hero-word-1" data-word="1"></h1>
      <h1 class="hero-word hero-word-2" data-word="2"></h1>
      <div class="hero-eyebrow hero-eyebrow-2" data-eyebrow="2"></div>

      <div class="hotspots-layer"></div>

      <button class="pill-btn hero-btn-authors">Авторы</button>
      <button class="pill-btn hero-btn-restart" title="Переиграть видео-заставку">Заставка</button>

      <div class="hint-toast map-hint">Нажмите на объект, чтобы узнать больше</div>
    </div>
  `;

  const stage = container.querySelector(".map-stage");
  const layer = container.querySelector(".hotspots-layer");
  const authorsBtn = container.querySelector(".hero-btn-authors");
  const restartVideoBtn = container.querySelector(".hero-btn-restart");
  const hintEl = container.querySelector(".map-hint");

  // Заголовок — два слова + эйбрау-подписи рядом с каждым (см. content.js → map.title)
  container.querySelector('[data-word="1"]').textContent = mapData.title?.line1 || "";
  container.querySelector('[data-word="2"]').textContent = mapData.title?.line2 || "";
  container.querySelector('[data-eyebrow="1"]').textContent = mapData.eyebrow1 || "";
  container.querySelector('[data-eyebrow="2"]').textContent = mapData.eyebrow2 || "";

  function roundMarkup(data) {
    return `<div class="ring"></div><div class="ring2"></div>
      <div class="glyph">${data.icon || "◆"}</div>
      <div class="label">${data.title}</div>`;
  }

  let transitioning = false;
  const alphaMap = new Map(); // hotspot-элемент → { natW, natH, data, left, top, width, height, rotate } (в px макета 1280×720)

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
    hs.style.left = px(L.left);
    hs.style.top = px(L.top);
    hs.style.width = px(L.width);
    hs.style.height = px(L.height);
    hs.style.transform = `rotate(${L.rotate}deg)`;
    hs.innerHTML = `<img class="hero-object-img" src="${L.image}" alt="" draggable="false">`;

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
      buildOutline(hs, data, w, h);
    } catch (err) {
      console.warn("[map] Не удалось прочитать пиксели " + img.src + " для точного хит-теста.", err);
    }
  }

  // «Бегущая» обводка ПО КОНТУРУ картинки (не по прямоугольной рамке
  // вокруг неё) — строится один раз при загрузке картинки через
  // трассировку альфа-канала (marching squares, см. utils/contourTrace.js).
  // Сетка для трассировки — уменьшенная копия альфа-маски (иначе на
  // полном разрешении контур был бы избыточно детальным и рваным по
  // краям сглаживания PNG).
  const OUTLINE_GRID = 130; // ячеек по большей стороне — компромисс детальности/гладкости
  function buildOutline(hs, data, w, h) {
    const cols = w >= h ? OUTLINE_GRID : Math.max(2, Math.round(OUTLINE_GRID * w / h));
    const rows = h >= w ? OUTLINE_GRID : Math.max(2, Math.round(OUTLINE_GRID * h / w));
    const grid = new Uint8Array(cols * rows);
    for (let gy = 0; gy < rows; gy++) {
      const sy = Math.min(h - 1, Math.round((gy / (rows - 1)) * (h - 1)));
      for (let gx = 0; gx < cols; gx++) {
        const sx = Math.min(w - 1, Math.round((gx / (cols - 1)) * (w - 1)));
        grid[gy * cols + gx] = data[(sy * w + sx) * 4 + 3] > ALPHA_THRESHOLD ? 1 : 0;
      }
    }

    const polylines = traceContours(grid, cols, rows);
    if (!polylines.length) return;

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${cols - 1} ${rows - 1}`);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.classList.add("hero-outline");
    polylines
      .filter((pts) => pts.length > 3) // отбрасываем шум/точечные артефакты трассировки
      .forEach((pts) => {
        const path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", pts.map((p, i) => (i === 0 ? "M" : "L") + p[0] + "," + p[1]).join(" ") + " Z");
        svg.appendChild(path);
      });
    hs.appendChild(svg);
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
    }
  };
}
