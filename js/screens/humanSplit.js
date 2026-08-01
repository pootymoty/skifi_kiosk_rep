// ============================================================
// Раскладка экрана «Человек»: справа — видео/гифка (формат 9:16,
// зациклена — сам ролик уже содержит поворот и возврат в исходное
// положение, код просто зацикленно проигрывает его), слева —
// текст про элемент одежды / карусель одежды / текст о находке
// (см. js/screens/humanPanel.js).
//
// Если data.video не задан — используется прежнее поведение (3D-модель
// через data.model), на случай если вернётесь к модели позже.
// ============================================================
import { mountModelViewer } from "./object3d.js";
import { initHumanPanel } from "./humanPanel.js";

export async function initHumanSplit(container, data) {
  container.innerHTML = `
    <div class="human-split">
      <div class="human-split-left"></div>
      <div class="human-split-stage${data.video ? " human-video-stage" : " stage-3d"}"></div>
    </div>
  `;

  const leftEl = container.querySelector(".human-split-left");
  const stageEl = container.querySelector(".human-split-stage");

  const panel = initHumanPanel(leftEl, data);

  let viewer;
  if (data.video) {
    viewer = mountHumanVideo(stageEl, data.video);
  } else {
    viewer = await mountModelViewer(stageEl, { modelPath: data.model, icon: data.icon });
  }

  return {
    destroy() {
      panel.destroy();
      viewer.destroy();
    }
  };
}

function mountHumanVideo(mountEl, src) {
  const isGif = /\.gif($|\?)/i.test(src);
  const badge = document.createElement("div");
  badge.className = "asset-missing-note hidden";

  let mediaEl;
  if (isGif) {
    mediaEl = document.createElement("img");
    mediaEl.className = "human-video";
    mediaEl.alt = "";
    mediaEl.addEventListener("error", showMissing);
    mediaEl.addEventListener("load", reveal);
    mediaEl.src = src;
  } else {
    mediaEl = document.createElement("video");
    mediaEl.className = "human-video";
    mediaEl.autoplay = true;
    mediaEl.loop = true;
    mediaEl.muted = true;
    mediaEl.playsInline = true;
    mediaEl.addEventListener("error", showMissing);
    mediaEl.addEventListener("loadeddata", reveal);
    mediaEl.src = src;
    mediaEl.play().catch(() => {}); // автоплей может потребовать явного play() в некоторых браузерах
  }

  mountEl.appendChild(mediaEl);
  mountEl.appendChild(badge);

  function reveal() {
    requestAnimationFrame(() => mountEl.classList.add("revealed"));
  }
  function showMissing() {
    console.warn("[human] Файл не найден: " + src);
    badge.textContent = "Файл не найден: " + src;
    badge.classList.remove("hidden");
    reveal();
  }

  return {
    destroy() {
      if (!isGif) { mediaEl.pause(); mediaEl.src = ""; }
    }
  };
}
