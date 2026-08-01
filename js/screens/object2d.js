// ============================================================
// 2D-стадия объекта «Ковёр» (ТЗ п.13 + доработка «дырки»).
//
// 1. Contain-фит: в состоянии покоя (zoom = 1) картинка ровно вписана
//    в область по своим фактическим краям, панорамирование при
//    увеличении жёстко ограничено этими же краями.
// 2. Интерактивная зона (см. content.js → carpet.hole): подсвеченная
//    метка на месте повреждения ковра. При касании открывается ОТДЕЛЬНАЯ
//    картинка — именно вырезанный восстановленный фрагмент (не весь
//    ковёр), по центру области, с подписью под ней. Кнопка «Ковёр
//    целиком» возвращает к обычному виду.
// ============================================================

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

export function initObjectStage2D(container, { imagePath, hole, baseSections, onSectionsChange, onHoleToggle }) {
  // Сбрасываем анимацию появления с прошлого показа — контейнер
  // (#stage2d) переиспользуется при каждом открытии объекта.
  container.classList.remove("revealed");

  container.innerHTML = `
    <div class="canvas2d-wrap">
      <div class="canvas2d-pan">
        <img class="canvas2d-img base-img" alt="" draggable="false">
        <div class="hole-marker hidden">
          <div class="ring"></div><div class="ring2"></div>
        </div>
      </div>
      <div class="hole-detail-overlay hidden">
        <img class="hole-detail-img" alt="" draggable="false">
        <div class="hole-detail-caption"></div>
        <div class="asset-missing-note hidden"></div>
      </div>
      <div class="asset-missing-note base-missing hidden"></div>
    </div>
  `;

  const wrap = container.querySelector(".canvas2d-wrap");
  const pan = container.querySelector(".canvas2d-pan");
  const baseImg = container.querySelector(".base-img");
  const marker = container.querySelector(".hole-marker");
  const badge = container.querySelector(".base-missing");
  const detailOverlay = container.querySelector(".hole-detail-overlay");
  const detailImg = container.querySelector(".hole-detail-img");
  const detailCaption = container.querySelector(".hole-detail-caption");
  const detailBadge = detailOverlay.querySelector(".asset-missing-note");

  // ---------------- загрузка изображений ----------------
  function revealNow() {
    requestAnimationFrame(() => container.classList.add("revealed"));
  }
  let natW = 0, natH = 0;
  baseImg.addEventListener("load", () => {
    natW = baseImg.naturalWidth; natH = baseImg.naturalHeight;
    layoutMarker();
    revealNow();
  });
  baseImg.addEventListener("error", () => {
    console.warn("[2D] Файл не найден: " + imagePath + ". Показана заглушка.");
    wrap.classList.add("no-image");
    badge.textContent = "Файл не найден: " + imagePath;
    badge.classList.remove("hidden");
    revealNow(); // заглушка тоже должна появиться, а не остаться невидимой
  });
  baseImg.src = imagePath;

  if (hole && hole.patchImage) {
    detailImg.addEventListener("error", () => {
      console.warn("[2D] Файл не найден: " + hole.patchImage);
      detailBadge.textContent = "Файл не найден: " + hole.patchImage;
      detailBadge.classList.remove("hidden");
    });
    detailImg.src = hole.patchImage;
    if (hole.sections && hole.sections[0]) {
      detailCaption.textContent = hole.sections[0].h;
    }
  }

  // ---------------- метка «дырки» на карте (позиция в % от картинки) ----------------
  function layoutMarker() {
    if (!hole || !natW || !natH) return;
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
    return { w, h, x: (cw - w) / 2, y: (ch - h) / 2 };
  }
  const ro = new ResizeObserver(layoutMarker);
  ro.observe(wrap);

  // ---------------- состояние трансформации (только для обзора ковра) ----------------
  let tx = 0, ty = 0, scale = 1;
  let inDetail = false;

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

  // ---------------- вход/выход из «детали» (дырка → отдельная картинка фрагмента) ----------------
  function enterDetail() {
    if (!hole || inDetail) return;
    inDetail = true;
    detailOverlay.classList.remove("hidden");
    requestAnimationFrame(() => detailOverlay.classList.add("show"));
    if (onSectionsChange && hole.sections) onSectionsChange(hole.sections);
    if (onHoleToggle) onHoleToggle(true, exitDetail);
  }

  function exitDetail() {
    if (!inDetail) return;
    inDetail = false;
    detailOverlay.classList.remove("show");
    setTimeout(() => detailOverlay.classList.add("hidden"), 350);
    if (onSectionsChange && baseSections) onSectionsChange(baseSections);
    if (onHoleToggle) onHoleToggle(false);
  }

  marker.addEventListener("pointerdown", (e) => { e.stopPropagation(); enterDetail(); });

  // ---------------- обычные жесты: перетаскивание / pinch / колесо ----------------
  let dragging = false, lastX = 0, lastY = 0;
  let pinchStartDist = 0, pinchStartScale = 1;
  const pointers = new Map();
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  wrap.addEventListener("pointerdown", (e) => {
    if (inDetail) return;
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
    if (inDetail || !pointers.has(e.pointerId)) return;
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
    if (inDetail) return;
    e.preventDefault();
    scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale - e.deltaY * 0.0015));
    clamp(); apply();
  }
  wrap.addEventListener("wheel", onWheel, { passive: false });

  apply();

  return {
    destroy() {
      ro.disconnect();
      wrap.removeEventListener("wheel", onWheel);
      if (inDetail && onHoleToggle) onHoleToggle(false); // подстраховка: не оставить кнопку «застрявшей»
    }
  };
}
