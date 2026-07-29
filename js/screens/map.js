// ============================================================
// Интерактивная карта (ТЗ п.9). Метки объектов берутся из
// content.js (hotspot.x/y — проценты от области карты).
// ============================================================
import { createOnceHint } from "../utils/hints.js";

export function initMapScreen(container, mapData, objects, onSelect, onAuthors) {
  container.innerHTML = `
    <div class="map-stage">
      <img class="map-bg" alt="" draggable="false">
      <div class="hotspots-layer"></div>
      <div class="map-caption">коснитесь объекта на карте кургана</div>
      <button class="btn authors-fab">Авторы</button>
      <div class="hint-toast map-hint">Нажмите на объект, чтобы узнать больше</div>
    </div>
  `;

  const stage = container.querySelector(".map-stage");
  const bg = container.querySelector(".map-bg");
  const layer = container.querySelector(".hotspots-layer");
  const authorsBtn = container.querySelector(".authors-fab");
  const hintEl = container.querySelector(".map-hint");

  bg.addEventListener("error", () => {
    console.warn("[map] Файл не найден: " + mapData.background + ". Показан фон-заглушка.");
    stage.classList.add("no-image");
  });
  bg.src = mapData.background;

  Object.entries(objects).forEach(([id, data]) => {
    const hs = document.createElement("div");
    hs.className = "hotspot";
    hs.style.left = data.hotspot.x + "%";
    hs.style.top = data.hotspot.y + "%";
    hs.innerHTML = `
      <div class="ring"></div><div class="ring2"></div>
      <div class="glyph">${data.icon || "◆"}</div>
      <div class="label">${data.title}</div>
    `;
    hs.addEventListener("pointerdown", () => onSelect(id));
    layer.appendChild(hs);
  });

  authorsBtn.addEventListener("pointerdown", onAuthors);

  const hint = createOnceHint(hintEl, layer);
  hint.show();

  return {
    destroy() {
      hint.dispose();
    }
  };
}
