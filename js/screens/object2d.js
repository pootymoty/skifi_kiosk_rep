// ============================================================
// 2D-стадия объекта «Ковёр» (ТЗ п.13).
// Базовая версия: изображение + zoom. Перемещение — перетаскиванием
// или одним пальцем, масштабирование — двумя пальцами (pinch) либо
// колесом мыши (для отладки на десктопе).
//
// Архитектурно оставлено место под расширение из п.13: интерактивные
// зоны на ковре (см. hitAreas ниже, сейчас не используется, но
// координаты можно добавлять в content.js и подключать без переписывания
// остальной логики).
// ============================================================

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

export function initObjectStage2D(container, { imagePath }) {
  container.innerHTML = `
    <div class="canvas2d-wrap">
      <img class="canvas2d-img" alt="" draggable="false">
      <div class="asset-missing-note hidden"></div>
    </div>
  `;

  const wrap = container.querySelector(".canvas2d-wrap");
  const img = container.querySelector(".canvas2d-img");
  const badge = container.querySelector(".asset-missing-note");

  img.addEventListener("error", () => {
    console.warn("[2D] Файл не найден: " + imagePath + ". Показан фон-заглушка.");
    wrap.classList.add("no-image");
    badge.textContent = "Файл не найден: " + imagePath;
    badge.classList.remove("hidden");
  });
  img.src = imagePath;

  let pan = { x: 0, y: 0 };
  let zoom = 1;
  let dragging = false, lastX = 0, lastY = 0;
  let pinchStartDist = 0, pinchStartZoom = 1;
  const pointers = new Map();

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function clampPan() {
    const bound = 90 * zoom;
    pan.x = Math.max(-bound, Math.min(bound, pan.x));
    pan.y = Math.max(-bound, Math.min(bound, pan.y));
  }
  function apply() {
    img.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  }

  wrap.addEventListener("pointerdown", (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) { dragging = true; lastX = e.clientX; lastY = e.clientY; }
    else if (pointers.size === 2) {
      dragging = false;
      const pts = [...pointers.values()];
      pinchStartDist = dist(pts[0], pts[1]);
      pinchStartZoom = zoom;
    }
    wrap.setPointerCapture(e.pointerId);
  });
  wrap.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      const d = dist(pts[0], pts[1]);
      zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchStartZoom * (d / pinchStartDist)));
      clampPan();
      apply();
      return;
    }
    if (dragging) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      pan.x += dx; pan.y += dy;
      clampPan();
      apply();
    }
  });
  function release(e) {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) dragging = false;
  }
  wrap.addEventListener("pointerup", release);
  wrap.addEventListener("pointercancel", release);

  // колесо мыши — удобно при отладке макета на обычном ПК без тачскрина
  function onWheel(e) {
    e.preventDefault();
    zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom - e.deltaY * 0.001));
    clampPan();
    apply();
  }
  wrap.addEventListener("wheel", onWheel, { passive: false });

  apply();

  return {
    destroy() {
      wrap.removeEventListener("wheel", onWheel);
    }
  };
}
