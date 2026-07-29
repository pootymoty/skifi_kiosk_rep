// ============================================================
// 2D-стадия объекта «Ковёр» (ТЗ п.13 + доработка «дырки»).
//
// Изменения по вашему запросу:
// 1. Раньше картинка лежала на холсте, искусственно увеличенном
//    до 220% — из-за этого область, где «лежит» ковёр, была больше
//    самой картинки, и можно было утащить её далеко за пределы
//    видимой области. Теперь используется настоящий contain-фит:
//    в состоянии покоя (zoom = 1) картинка ровно вписана в область
//    по своим фактическим краям, панорамирование при увеличении
//    жёстко ограничено этими же краями — утащить изображение
//    «в никуда» больше нельзя.
// 2. Добавлена интерактивная зона (см. content.js → carpet.hole):
//    подсвеченная метка на месте повреждения ковра. При касании —
//    плавное приближение именно к этой точке, кросс-фейд на картинку
//    с восстановленным участком и отдельный текстовый блок про
//    реставрацию. Кнопка «Ковёр целиком» возвращает к общему виду.
// ============================================================

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const DETAIL_TRANSITION_MS = 850;

export function initObjectStage2D(container, { imagePath, hole, baseSections, onSectionsChange }) {
  // Сбрасываем анимацию появления с прошлого показа — контейнер
  // (#stage2d) переиспользуется при каждом открытии объекта.
  container.classList.remove("revealed");

  container.innerHTML = `
    <div class="canvas2d-wrap">
      <div class="canvas2d-pan">
        <img class="canvas2d-img base-img" alt="" draggable="false">
        <img class="canvas2d-img restored-img" alt="" draggable="false">
        <div class="hole-marker hidden">
          <div class="ring"></div><div class="ring2"></div>
        </div>
      </div>
      <button class="btn ghost stage-back-btn hidden">‹ Ковёр целиком</button>
      <div class="asset-missing-note hidden"></div>
    </div>
  `;

  const wrap = container.querySelector(".canvas2d-wrap");
  const pan = container.querySelector(".canvas2d-pan");
  const baseImg = container.querySelector(".base-img");
  const restoredImg = container.querySelector(".restored-img");
  const marker = container.querySelector(".hole-marker");
  const backBtn = container.querySelector(".stage-back-btn");
  const badge = container.querySelector(".asset-missing-note");

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

  if (hole && hole.restoredImage) {
    restoredImg.addEventListener("error", () => {
      console.warn("[2D] Файл не найден: " + hole.restoredImage + ". Приближение сработает без смены картинки.");
      restoredImageBroken = true;
    });
    restoredImg.src = hole.restoredImage;
  }
  let restoredImageBroken = false;

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

  // ---------------- состояние трансформации (общее для обзора и детали) ----------------
  let tx = 0, ty = 0, scale = 1;
  let inDetail = false;
  let animating = false;

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
  function animateTo(targetTx, targetTy, targetScale, onDone) {
    animating = true;
    pan.style.transition = `transform ${DETAIL_TRANSITION_MS}ms cubic-bezier(.4,0,.2,1)`;
    tx = targetTx; ty = targetTy; scale = targetScale;
    apply();
    setTimeout(() => {
      pan.style.transition = "";
      animating = false;
      if (onDone) onDone();
    }, DETAIL_TRANSITION_MS);
  }

  // ---------------- вход/выход из «детали» (дырка → восстановленный участок) ----------------
  function enterDetail() {
    if (!hole || inDetail || animating) return;
    inDetail = true;
    marker.classList.add("hidden");
    backBtn.classList.remove("hidden");

    const cw = wrap.clientWidth, ch = wrap.clientHeight;
    const centerX = cw / 2, centerY = ch / 2;
    const markerX = parseFloat(marker.style.left), markerY = parseFloat(marker.style.top);
    const targetScale = hole.zoom || 2.2;
    // Приближение к точке при transform-origin: center (см. CSS) —
    // чтобы точка markerX/markerY после масштабирования оказалась
    // точно в центре области: (tx,ty) = scale * (center - point).
    const tX = targetScale * (centerX - markerX);
    const tY = targetScale * (centerY - markerY);

    animateTo(tX, tY, targetScale, () => clampAndReapply());

    if (!restoredImageBroken && hole.restoredImage) {
      restoredImg.classList.add("show");
    }
    if (onSectionsChange && hole.sections) onSectionsChange(hole.sections);
  }
  function clampAndReapply() { clamp(); apply(); }

  function exitDetail() {
    if (!inDetail || animating) return;
    inDetail = false;
    backBtn.classList.add("hidden");
    restoredImg.classList.remove("show");
    animateTo(0, 0, 1, () => { marker.classList.remove("hidden"); });
    if (onSectionsChange && baseSections) onSectionsChange(baseSections);
  }

  marker.addEventListener("pointerdown", (e) => { e.stopPropagation(); enterDetail(); });
  backBtn.addEventListener("pointerdown", (e) => { e.stopPropagation(); exitDetail(); });

  // ---------------- обычные жесты: перетаскивание / pinch / колесо ----------------
  let dragging = false, lastX = 0, lastY = 0;
  let pinchStartDist = 0, pinchStartScale = 1;
  const pointers = new Map();
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  wrap.addEventListener("pointerdown", (e) => {
    if (animating) return;
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
    if (animating || !pointers.has(e.pointerId)) return;
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
    if (animating) return;
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
    }
  };
}
