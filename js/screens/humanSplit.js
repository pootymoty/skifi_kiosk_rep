// ============================================================
// Раскладка экрана «Человек» (обновлено по новому макету Figma):
//   слева  — сцена (3D-модель ИЛИ видео, переключается кнопкой снизу)
//   справа — карусель элементов одежды + независимый текст
//            (см. js/screens/humanPanel.js)
//
// Кнопка снизу слева — переключатель. Показывает НАЗВАНИЕ ТОГО, что
// откроется по нажатию (а не того, что показано сейчас): пока видна
// модель — кнопка называется "ии визуализация" (нажмёшь — включится
// видео); пока видно видео — кнопка называется "3D модель" (нажмёшь —
// вернётся модель).
// ============================================================
import { mountModelViewer } from "./object3d.js";
import { initHumanPanel } from "./humanPanel.js";

export async function initHumanSplit(container, data) {
  container.innerHTML = `
    <div class="human-split">
      <div class="human-split-stage-col">
        <div class="human-split-stage"></div>
        <button class="btn ghost wide human-toggle-btn"></button>
      </div>
      <div class="human-split-right"></div>
    </div>
  `;

  const stageEl = container.querySelector(".human-split-stage");
  const rightEl = container.querySelector(".human-split-right");
  const toggleBtn = container.querySelector(".human-toggle-btn");

  const panel = initHumanPanel(rightEl, data);

  // По умолчанию показываем 3D-модель (если она есть), видео — по кнопке.
  let showingVideo = false;
  let stageController = null;

  async function mountStage() {
    if (stageController) { stageController.destroy(); stageController = null; }
    stageEl.innerHTML = "";
    stageEl.classList.remove("revealed", "human-video-stage", "stage-3d");

    if (showingVideo && data.video) {
      stageEl.classList.add("human-video-stage");
      stageController = mountHumanVideo(stageEl, data.video);
    } else {
      stageEl.classList.add("stage-3d");
      stageController = await mountModelViewer(stageEl, { modelPath: data.model, icon: data.icon });
    }
    toggleBtn.textContent = showingVideo ? "3D модель" : "ии визуализация";
  }

  const hasBoth = !!(data.video && data.model);
  toggleBtn.style.display = hasBoth ? "" : "none"; // переключать нечего, если чего-то одного нет
  toggleBtn.addEventListener("pointerdown", () => {
    showingVideo = !showingVideo;
    mountStage();
  });

  await mountStage();

  return {
    destroy() {
      panel.destroy();
      if (stageController) stageController.destroy();
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
