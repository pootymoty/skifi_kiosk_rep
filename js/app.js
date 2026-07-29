// ============================================================
// Точка входа. Управляет экранами по схеме из ТЗ:
// VIDEO → MAP → (PANTHER | HUMAN | CARPET) → AUTHORS → QR
// ============================================================
import { CONTENT } from "./data/content.js";
import { TextPager } from "./utils/pagination.js";
import { createOnceHint } from "./utils/hints.js";
import { createGlobalIdleWatcher } from "./utils/idle.js";
import { preloadAll } from "./utils/preload.js";
import { initVideoScreen } from "./screens/video.js";
import { initMapScreen } from "./screens/map.js";
import { initObjectStage3D } from "./screens/object3d.js";
import { initObjectStage2D } from "./screens/object2d.js";
import { initAuthorsScreen } from "./screens/authors.js";

// Таймеры простоя (attract loop). Два режима — см. js/utils/idle.js:
// пока не было НИ ОДНОГО взаимодействия после видео — короткий таймер,
// как только было хотя бы одно — длинный, перезапускающийся при
// каждом следующем взаимодействии.
const FIRST_IDLE_MS = 20 * 1000;       // 20 секунд без первого взаимодействия
const REPEAT_IDLE_MS = 5 * 60 * 1000;  // 5 минут после любого взаимодействия

const screens = {
  video: document.getElementById("screen-video"),
  map: document.getElementById("screen-map"),
  object: document.getElementById("screen-object"),
  authors: document.getElementById("screen-authors")
};

// Экраны «карта» и «авторы» имеют свою постоянную шапку (кнопка «Назад» и т.п.),
// поэтому их динамическое содержимое монтируется во вложенный контейнер,
// а не в саму секцию целиком.
const mapMount = screens.map.querySelector(".map-mount");
const authorsMount = screens.authors.querySelector(".authors-body");

let activeController = null; // destroy()-хук текущего динамического экрана

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove("active"));
  screens[name].classList.add("active");
}

function teardownActive() {
  if (activeController && typeof activeController.destroy === "function") {
    activeController.destroy();
  }
  activeController = null;
}

// Возврат к видео-заставке после простоя — тот самый недостающий
// таймер. Срабатывает независимо от того, на каком сейчас экране
// (карта / объект / авторы) находится пользователь.
function returnToAttract(isManualRestart = false) {
  if (stageController && typeof stageController.destroy === "function") {
    stageController.destroy();
  }
  stageController = null;
  teardownActive();
  // Если пользователь вручную нажал кнопку перезапуска видео —
  // сбросить таймер на 20 секунд. Иначе продолжить обычный цикл
  // с двухуровневыми таймерами.
  if (isManualRestart) {
    idleWatcher.resetToFirstTimeout(); // см. js/utils/idle.js
  }
  startIntro();
}

function restartVideo() {
  returnToAttract(true); // true = пользователь вручную нажал кнопку
}

const idleWatcher = createGlobalIdleWatcher(
  { firstTimeoutMs: FIRST_IDLE_MS, repeatTimeoutMs: REPEAT_IDLE_MS },
  returnToAttract
);

// ---------------- VIDEO ----------------
function startIntro() {
  idleWatcher.pause(); // на самой заставке отдельный таймер простоя не нужен
  activeController = initVideoScreen(screens.video, CONTENT.intro.video, () => {
    teardownActive();
    idleWatcher.resume();
    goMap();
  });
  showScreen("video");
}

// ---------------- MAP ----------------
function goMap() {
  activeController = initMapScreen(
    mapMount,
    CONTENT.map,
    CONTENT.objects,
    (id) => openObject(id),
    () => goAuthors(),
    () => restartVideo()
  );
  showScreen("map");
}

// ---------------- OBJECT (общий шаблон, ТЗ п.9-10) ----------------
const objTitleEl = document.getElementById("objTitle");
const stage3dEl = document.getElementById("stage3d");
const stage2dEl = document.getElementById("stage2d");
const backBtn = document.getElementById("btnBackFromObject");

const pager = new TextPager({
  heading: document.getElementById("txtHeading"),
  body: document.getElementById("txtBody"),
  dots: document.getElementById("txtDots"),
  prevBtn: document.getElementById("txtPrev"),
  nextBtn: document.getElementById("txtNext")
});

let stageController = null;

async function openObject(id) {
  const data = CONTENT.objects[id];
  if (!data) { console.error("[app] Неизвестный объект: " + id); return; }

  objTitleEl.textContent = data.title;
  pager.setSections(data.sections);

  if (stageController && typeof stageController.destroy === "function") {
    stageController.destroy();
  }
  stageController = null;

  const is3d = data.type === "3d";
  stage3dEl.style.display = is3d ? "flex" : "none";
  stage2dEl.style.display = is3d ? "none" : "block";

  if (is3d) {
    stageController = await initObjectStage3D(stage3dEl, { modelPath: data.model, icon: data.icon });
  } else {
    stageController = initObjectStage2D(stage2dEl, {
      imagePath: data.image,
      hole: data.hole,
      baseSections: data.sections,
      onSectionsChange: (sections) => pager.setSections(sections)
    });
  }

  showScreen("object");
}

backBtn.addEventListener("pointerdown", () => {
  if (stageController && typeof stageController.destroy === "function") {
    stageController.destroy();
  }
  stageController = null;
  goMap();
});

// ---------------- AUTHORS ----------------
function goAuthors() {
  activeController = initAuthorsScreen(authorsMount, CONTENT.authors);
  showScreen("authors");
}
document.getElementById("btnBackFromAuthors").addEventListener("pointerdown", () => {
  teardownActive();
  goMap();
});

// ---------------- START ----------------
startIntro();
// Предзагрузка всех моделей/картинок — запускается один раз, параллельно
// с показом видео, чтобы к моменту, когда пользователь дойдёт до карты
// и начнёт открывать объекты, всё уже было готово (см. js/utils/preload.js).
preloadAll();
