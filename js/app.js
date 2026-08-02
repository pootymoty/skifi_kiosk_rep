// ============================================================
// Точка входа. Управляет экранами по схеме из ТЗ:
// VIDEO → MAP → (PANTHER | HUMAN | CARPET) → AUTHORS → QR
// ============================================================
import { CONTENT } from "./data/content.js";
import { TextPager } from "./utils/pagination.js";
import { createOnceHint } from "./utils/hints.js";
import { createGlobalIdleWatcher } from "./utils/idle.js";
import { preloadHeroImages } from "./utils/preload.js";
import { initVideoScreen } from "./screens/video.js";
import { initMapScreen } from "./screens/map.js";
import { initObjectStage3D } from "./screens/object3d.js";
import { initObjectStage2D } from "./screens/object2d.js";
import { initCarpetSplit } from "./screens/carpetSplit.js";
import { initHumanSplit } from "./screens/humanSplit.js";
import { initBeastCarousel } from "./screens/beastCarousel.js";
import { initAuthorsScreen } from "./screens/authors.js";

// Таймеры простоя (attract loop). Два режима — см. js/utils/idle.js:
// пока не было НИ ОДНОГО взаимодействия после видео — короткий таймер,
// как только было хотя бы одно — длинный, перезапускающийся при
// каждом следующем взаимодействии.
const FIRST_IDLE_MS = 20 * 1000;       // 20 секунд без первого взаимодействия
const REPEAT_IDLE_MS = 5 * 60 * 1000;  // 5 минут после любого взаимодействия

const screens = {
  boot: document.getElementById("screen-boot"),
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

// Подсказка на карте (ТЗ п.14) должна появляться ТОЛЬКО сразу после
// показа видео (и при обычном окончании, и при нажатии «пропустить») —
// а не при каждом возврате на карту (например, кнопкой «Назад» со
// страницы объекта). Этот флаг взводится в startIntro() и гасится
// сразу после того, как карта его один раз использует.
let hintPendingAfterVideo = false;

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
    hintPendingAfterVideo = true; // подсказка на карте покажется один раз именно сейчас
    goMap();
  });
  showScreen("video");
}

// ---------------- MAP ----------------
function goMap() {
  const showHint = hintPendingAfterVideo;
  hintPendingAfterVideo = false; // взводится заново только в startIntro()
  activeController = initMapScreen(
    mapMount,
    CONTENT.map,
    CONTENT.objects,
    (id) => openObject(id),
    () => goAuthors(),
    () => restartVideo(),
    showHint
  );
  showScreen("map");
}

// ---------------- OBJECT (общий шаблон, ТЗ п.9-10, + особые раскладки) ----------------
const pageTitleEl = document.getElementById("pageTitle");
const objStandardEl = document.getElementById("objStandard");
const objCustomEl = document.getElementById("objCustom");
const stage3dEl = document.getElementById("stage3d");
const stage2dEl = document.getElementById("stage2d");
const backBtn = document.getElementById("btnBackFromObject");
const backBtnDefaultLabel = backBtn.textContent;
const objLoadingOverlay = document.getElementById("objLoadingOverlay");
function showLoadingOverlay() { objLoadingOverlay.classList.remove("hidden"); }
function hideLoadingOverlay() { objLoadingOverlay.classList.add("hidden"); }

// Позволяет текущему экрану временно "перехватить" глобальную кнопку
// «Назад» — например, у ковра при открытой «дырке» она должна на
// время стать кнопкой «Ковёр целиком» вместо перехода на карту
// (см. js/screens/carpetSplit.js). null — обычное поведение (на карту).
let backOverride = null;
function setBackOverride(handler, label) {
  backOverride = handler || null;
  backBtn.textContent = backOverride ? label : backBtnDefaultLabel;
}

const pager = new TextPager({
  heading: document.getElementById("txtHeading"),
  body: document.getElementById("txtBody"),
  location: document.getElementById("txtLocation"),
  prevBtn: document.getElementById("txtPrev"),
  nextBtn: document.getElementById("txtNext")
});

let stageController = null;

async function openObject(id) {
  const data = CONTENT.objects[id];
  if (!data) { console.error("[app] Неизвестный объект: " + id); return; }

  showLoadingOverlay();
  showScreen("object"); // переключаемся сразу — дальше пользователь видит анимацию загрузки, а не "зависшую" карту
  pageTitleEl.textContent = data.title;
  setBackOverride(null); // сбрасываем на всякий случай при каждом открытии объекта

  if (stageController && typeof stageController.destroy === "function") {
    stageController.destroy();
  }
  stageController = null;

  if (data.layout === "beast-carousel") {
    objStandardEl.style.display = "none";
    objCustomEl.classList.remove("hidden");
    stageController = await initBeastCarousel(objCustomEl, { title: data.title, entries: data.entries }, {
      setPageTitle: (t) => { pageTitleEl.textContent = t; }
    });

  } else if (data.layout === "human-split") {
    objStandardEl.style.display = "none";
    objCustomEl.classList.remove("hidden");
    stageController = await initHumanSplit(objCustomEl, data);

  } else if (data.layout === "carpet-split") {
    objStandardEl.style.display = "none";
    objCustomEl.classList.remove("hidden");
    stageController = await initCarpetSplit(objCustomEl, data);

  } else {
    // Стандартный шаблон (на случай новых объектов без своей раскладки)
    objCustomEl.classList.add("hidden");
    objCustomEl.innerHTML = "";
    objStandardEl.style.display = "flex";

    pager.setSections(data.sections);
    const is3d = data.type === "3d";
    stage3dEl.style.display = is3d ? "flex" : "none";
    stage2dEl.style.display = is3d ? "none" : "block";

    if (is3d) {
      stageController = await initObjectStage3D(stage3dEl, data.models
        ? { models: data.models }
        : { modelPath: data.model, icon: data.icon }
      );
      await stageController.ready;
    } else {
      stageController = initObjectStage2D(stage2dEl, {
        imagePath: data.image,
        hole: data.hole,
        baseSections: data.sections,
        onSectionsChange: (sections) => pager.setSections(sections)
      });
      await stageController.ready;
    }
  }

  hideLoadingOverlay();
}

backBtn.addEventListener("pointerdown", () => {
  if (backOverride) { backOverride(); return; }
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
// Видео стартует, как только загрузятся 3 картинки объектов карты
// (они нужны сразу же после видео — не хочется, чтобы карта
// доскрёбывала их у пользователя на глазах). Модели и остальные
// картинки теперь грузятся ЛЕНИВО — только когда пользователь
// реально открыл нужную страницу (см. js/utils/preload.js).
// Предохранитель на случай зависшей/битой картинки — ждать вечно
// нельзя, лучше стартовать без неё.
const BOOT_TIMEOUT_MS = 5000;

function boot() {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    preloadHeroImages().then(finish);
    setTimeout(finish, BOOT_TIMEOUT_MS);
  });
}

boot().then(startIntro);
