// ============================================================
// 2D-стадия объекта «Ковёр» (ТЗ п.13 + доработка «дырки»).
//
// 1. Contain-фит: в состоянии покоя (zoom = 1) картинка ровно вписана
//    в область по своим фактическим краям, панорамирование при
//    увеличении жёстко ограничено этими же краями.
// 2. Интерактивная зона (см. content.js → carpet.hole): подсвеченная
//    метка на месте повреждения ковра. При касании страница визуально
//    превращается в свой же шаблон с другим содержимым — картинка
//    в той же области меняется на восстановленный фрагмент, текст и
//    заголовок страницы тоже меняются (см. onSectionsChange/
//    onTitleChange), а кнопка «Меню» временно становится «Назад к
//    ковру» (см. onHoleToggle). Это не отдельное всплывающее окно —
//    та же раскладка, просто с другими данными.
// 3. Подсказка «Приближай» — показывается один раз при открытии
//    страницы, исчезает при первом касании изображения.
// ============================================================
import { createOnceHint } from "../utils/hints.js";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

export function initObjectStage2D(container, { imagePath, hole, baseSections, onSectionsChange, onTitleChange, onHoleToggle }) {
  // Сбрасываем анимацию появления с прошлого показа — контейнер
  // (#stage2d) переиспользуется при каждом открытии объекта.
  container.classList.remove("revealed");

  container.innerHTML = `
    <div class="canvas2d-wrap">
      <div class="canvas2d-pan">
        <img class="canvas2d-img base-img" alt="" draggable="false">
        <div class="hole-marker hidden">
          <div class="tap-hand-pulse"><div class="tap-hand">👆</div></div>
        </div>
      </div>
      <div class="asset-missing-note base-missing hidden"></div>
      <div class="hint-toast stage-hint">Приближай</div>
    </div>
  `;

  const wrap = container.querySelector(".canvas2d-wrap");
  const pan = container.querySelector(".canvas2d-pan");
  const baseImg = container.querySelector(".base-img");
  const marker = container.querySelector(".hole-marker");
  const badge = container.querySelector(".base-missing");
  const hintEl = container.querySelector(".stage-hint");
  const hint = createOnceHint(hintEl, wrap);

  let inDetail = false;
  let natW = 0, natH = 0;

  // ---------------- загрузка изображений ----------------
  let resolveReady;
  const readyPromise = new Promise((resolve) => { resolveReady = resolve; });
  let firstLoad = true;
  function revealNow() {
    requestAnimationFrame(() => container.classList.add("revealed"));
    hint.show();
    if (firstLoad) { firstLoad = false; resolveReady(); }
  }
  function loadImage(src, isDetail) {
    badge.classList.add("hidden");
    wrap.classList.remove("no-image");
    baseImg.src = src;
    baseImg.dataset.detail = isDetail ? "1" : "";
  }
  // Плавная смена картинки при входе/выходе из "детали" — сначала
  // уводим текущую в прозрачность, и только потом (когда её не видно)
  // подставляем новую и возвращаем видимость.
  const SWAP_FADE_MS = 220;
  function swapImage(src, isDetail) {
    baseImg.classList.add("fading");
    setTimeout(() => loadImage(src, isDetail), SWAP_FADE_MS);
  }
  baseImg.addEventListener("load", () => {
    natW = baseImg.naturalWidth; natH = baseImg.naturalHeight;
    if (!inDetail) layoutMarker(); // в режиме "детали" метки на фрагменте нет
    baseImg.classList.remove("fading");
    revealNow();
  });
  baseImg.addEventListener("error", () => {
    const missing = baseImg.dataset.detail ? hole.patchImage : imagePath;
    console.warn("[2D] Файл не найден: " + missing + ". Показана заглушка.");
    wrap.classList.add("no-image");
    badge.textContent = "Файл не найден: " + missing;
    badge.classList.remove("hidden");
    baseImg.classList.remove("fading");
    revealNow(); // заглушка тоже должна появиться, а не остаться невидимой
  });
  loadImage(imagePath, false);

  // ---------------- метка «дырки» на карте (позиция в % от картинки) ----------------
  function layoutMarker() {
    if (!hole || !natW || !natH || inDetail) return;
    const cw = wrap.clientWidth, ch = wrap.clientHeight;
    if (!cw || !ch) return;
    const rect = containRect(cw, ch, natW, natH);
    marker.style.left = (rect.x + (hole.x / 100) * rect.w) + "px";
    marker.style.top = (rect.y + (hole.y / 100) * rect.h) + "px";
    marker.classList.remove("hidden");
  }
  function containRect(cw, ch, iw, ih) {
    const containerAspect = cw / ch, imgAspect = iw / ih;
    let w, h;
    if (imgAspect > containerAspect) { w = cw; h = cw / imgAspect; }
    else { h = ch; w = ch * imgAspect; }
    // Картинка прижата к ПРАВОМУ краю области (см. CSS → object-position:right),
    // а не центрирована — поэтому и здесь считаем x от правого края,
    // иначе метка "дырки" окажется не там, где реально нарисована картинка.
    return { w, h, x: cw - w, y: (ch - h) / 2 };
  }
  const ro = new ResizeObserver(layoutMarker);
  ro.observe(wrap);

  // ---------------- состояние трансформации (сбрасывается при входе/выходе из "детали") ----------------
  let tx = 0, ty = 0, scale = 1;

  function clamp() {
    const cw = wrap.clientWidth, ch = wrap.clientHeight;
    const boundX = Math.max(0, (scale - 1) * cw / 2);
    const boundY = Math.max(0, (scale - 1) * ch / 2);
    tx = Math.max(-boundX, Math.min(boundX, tx));
    ty = Math.max(-boundY, Math.min(boundY, ty));
  }
  function apply() {
    pan.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }
  function resetTransform() {
    tx = 0; ty = 0; scale = 1;
    apply();
  }

  // ---------------- вход/выход из «детали» (дырка → тот же шаблон, другое содержимое) ----------------
  function enterDetail() {
    if (!hole || inDetail) return;
    inDetail = true;
    hintEl.classList.remove("show");
    marker.classList.add("hidden");
    resetTransform();
    swapImage(hole.patchImage, true);
    if (onSectionsChange && hole.sections) onSectionsChange(hole.sections);
    if (onTitleChange && hole.title) onTitleChange(hole.title);
    if (onHoleToggle) onHoleToggle(true, exitDetail);
  }

  function exitDetail() {
    if (!inDetail) return;
    inDetail = false;
    resetTransform();
    swapImage(imagePath, false);
    if (onSectionsChange && baseSections) onSectionsChange(baseSections);
    if (onTitleChange) onTitleChange(null); // null = вернуть исходный заголовок страницы
    if (onHoleToggle) onHoleToggle(false);
  }

  marker.addEventListener("pointerdown", (e) => { e.stopPropagation(); enterDetail(); });

  // ---------------- обычные жесты: перетаскивание / pinch / колесо ----------------
  let dragging = false, lastX = 0, lastY = 0;
  let pinchStartDist = 0, pinchStartScale = 1;
  const pointers = new Map();
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  wrap.addEventListener("pointerdown", (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) { dragging = true; lastX = e.clientX; lastY = e.clientY; }
    else if (pointers.size === 2) {
      dragging = false;
      const pts = [...pointers.values()];
      pinchStartDist = dist(pts[0], pts[1]);
      pinchStartScale = scale;
    }
    wrap.setPointerCapture(e.pointerId);
  });
  wrap.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      const d = dist(pts[0], pts[1]);
      scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchStartScale * (d / pinchStartDist)));
      clamp(); apply();
      return;
    }
    if (dragging) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      tx += dx; ty += dy;
      clamp(); apply();
    }
  });
  function release(e) {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) dragging = false;
  }
  wrap.addEventListener("pointerup", release);
  wrap.addEventListener("pointercancel", release);

  function onWheel(e) {
    e.preventDefault();
    scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale - e.deltaY * 0.0015));
    clamp(); apply();
  }
  wrap.addEventListener("wheel", onWheel, { passive: false });

  apply();

  return {
    ready: readyPromise,
    destroy() {
      ro.disconnect();
      wrap.removeEventListener("wheel", onWheel);
      hint.dispose();
      if (inDetail && onHoleToggle) onHoleToggle(false); // подстраховка: не оставить кнопку «застрявшей»
    }
  };
}
