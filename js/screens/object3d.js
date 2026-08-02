// ============================================================
// 3D-стадия объекта (ТЗ п.11 «Пантера», п.12 «Человек»).
//
// Два режима — выбираются автоматически по форме входных данных:
//   - opts.modelPath (одна модель)  → как раньше, модель на весь экран
//     (сейчас используется для «Человек»).
//   - opts.models: [{modelPath, icon, label}, ...] (несколько моделей)
//     → сетка ячеек, в каждой — своя независимая модель. Используется
//     для экрана «Скифский звериный стиль» (пантера/олень/третья
//     модель — см. content.js → objects.panther.models).
//
// Ожидается, что в js/vendor/ будут положены модули Three.js
// (см. README.md — раздел «Подключение Three.js»). До этого момента
// код работает в режиме заглушки: рисует условную геометрию вместо
// .glb — заглушка сама уступит место настоящему рендеру, без правок
// кода, как только vendor-файлы появятся.
//
// Логика взаимодействия одинаковая и для одиночной модели, и для
// КАЖДОЙ ячейки сетки НЕЗАВИСИМО друг от друга:
//   - вращение пальцем (drag);
//   - масштабирование двумя пальцами (pinch);
//   - автовращение включено после открытия экрана;
//   - выключается при первом касании ИМЕННО этой модели;
//   - при 10 секундах бездействия ИМЕННО этой модели — сброс
//     положения и возобновление автовращения;
//   - удержание пальца без движения не считается новым действием.
// ============================================================

import { getCachedModel, cacheModel } from "../utils/preload.js";

const IDLE_RESET_MS = 10000;
const FRAME_TARGET_SIZE = 2.7; // было 2.2 — модели теперь заметно крупнее при открытии, и везде одинаково

export async function initObjectStage3D(container, opts) {
  container.innerHTML = "";
  container.classList.remove("revealed", "multi-mode");

  if (opts.models && opts.models.length) {
    container.classList.add("multi-mode");
    const cells = opts.models.map((m) => {
      const cell = document.createElement("div");
      cell.className = "stage-3d-cell";
      container.appendChild(cell);
      return { el: cell, modelConfig: m };
    });
    return mountModelGroup(cells); // общий рендерер на все ячейки разом, см. пояснение там же
  }

  // Одиночная модель на весь экран (обратная совместимость, напр. «Человек»)
  return mountModelViewer(container, opts);
}

/**
 * Монтирует ОДНУ модель в произвольный элемент — используется и для
 * одиночной модели на весь экран, и для отдельной ячейки в сетке/шахматке
 * (см. js/screens/beastGrid.js). Сам решает, THREE.js доступен или нет.
 * @param {boolean} [renderOpts.lite] — облегчённый рендер (см. mountRealViewer):
 *   используется, когда на экране одновременно несколько 3D-сцен —
 *   это ощутимо снижает нагрузку на GPU и решает лаги шахматки моделей.
 */
export async function mountModelViewer(mountEl, opts, renderOpts = {}) {
  mountEl.classList.remove("revealed");

  let THREE, GLTFLoader;
  try {
    THREE = await import("../vendor/three.module.js");
    ({ GLTFLoader } = await import("../vendor/addons/loaders/GLTFLoader.js"));
  } catch (err) {
    console.warn(
      "[3D] js/vendor/three.module.js (и/или GLTFLoader.js) не найден. " +
      "Показана временная геометрия вместо реальной модели. " +
      "См. README.md → «Подключение Three.js».", err
    );
    return mountPlaceholderViewer(mountEl, opts, mountEl);
  }

  return mountRealViewer(mountEl, opts, THREE, GLTFLoader, mountEl, renderOpts.lite);
}

// ----------------------------------------------------------------
// РЕАЛЬНЫЙ РЕНДЕР (Three.js + GLTFLoader) — монтируется в любой
// переданный элемент (это либо весь #stage3d для одной модели,
// либо одна ячейка сетки для нескольких моделей).
// ----------------------------------------------------------------
function mountRealViewer(mountEl, { modelPath, icon, label }, THREE, GLTFLoader, revealTarget, lite) {
  const badge = document.createElement("div");
  badge.className = "asset-missing-note hidden";
  mountEl.appendChild(badge);

  // lite-режим (несколько 3D-сцен на одном экране, напр. шахматка
  // зверей) — заметно снижает нагрузку на GPU: без сглаживания,
  // ниже предел pixel ratio, меньше источников света, кадры реже.
  const renderer = new THREE.WebGLRenderer({ antialias: !lite, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1.25 : 2));
  renderer.domElement.style.touchAction = "none";
  mountEl.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const baseDistance = 4.4;
  camera.position.set(0, 0, baseDistance);

  scene.add(new THREE.AmbientLight(0xfff2d8, 0.8));
  const key = new THREE.DirectionalLight(0xffe3b0, 1.15);
  key.position.set(3, 4, 5);
  scene.add(key);
  if (!lite) {
    // Заполняющий/контровой свет — приятный штрих, но третий источник
    // света на сцену ощутимо дороже, когда таких сцен несколько разом.
    const rim = new THREE.DirectionalLight(0x8fa0ff, 0.35);
    rim.position.set(-4, -2, -3);
    scene.add(rim);
  }

  const pivot = new THREE.Group();
  scene.add(pivot);

  function frameObject(object3d) {
    // Обязательно обновляем мировые матрицы ПЕРЕД замером габаритов —
    // без этого при первой же вставке в сцену Box3 иногда мерил объект
    // ДО того, как его трансформация до конца "устаканилась", и на
    // разных заходах (свежая загрузка / клон из кэша) масштаб мог
    // получаться слегка разным. Теперь замер всегда детерминированный —
    // масштаб строго одинаковый при каждом открытии страницы.
    object3d.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object3d);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = FRAME_TARGET_SIZE / maxDim;
    object3d.scale.setScalar(scale);
    object3d.position.sub(center.multiplyScalar(scale));
  }

  const loader = new GLTFLoader();

  // Анимация появления должна сыграть ровно в момент, когда модель
  // реально готова — а не в момент открытия экрана/ячейки.
  function revealNow() {
    requestAnimationFrame(() => revealTarget.classList.add("revealed"));
    spinner.remove();
  }

  const spinner = document.createElement("div");
  spinner.className = "stage-spinner";

  const cached = getCachedModel(modelPath);
  if (cached) {
    // Модель уже открывалась в этом сеансе — клон уже пришёл с готовым
    // масштабом/центровкой (см. ветку ниже — кэшируем ПОСЛЕ frameObject,
    // а не до). Пересчитывать габариты заново НЕ нужно — именно
    // повторный пересчёт и был причиной того, что модель "уменьшалась"
    // при повторном заходе на страницу.
    pivot.add(cached);
    revealNow();
  } else {
    // Первое открытие этой страницы — грузим по требованию, показывая
    // индикатор загрузки, пока модель не готова.
    mountEl.appendChild(spinner);
    loader.load(
      modelPath,
      (gltf) => {
        frameObject(gltf.scene);
        cacheModel(modelPath, gltf.scene); // кэшируем УЖЕ отмасштабированную модель — навсегда с этим же масштабом
        pivot.add(gltf.scene);
        revealNow();
      },
      undefined,
      (err) => {
        console.warn("[3D] Не удалось загрузить " + modelPath + ". Показана временная геометрия.", err);
        badge.textContent = "Файл не найден: " + modelPath;
        badge.classList.remove("hidden");
        const geo = new THREE.IcosahedronGeometry(1, 1);
        const mat = new THREE.MeshStandardMaterial({ color: 0xe8e2da, metalness: 0.35, roughness: 0.4 });
        pivot.add(new THREE.Mesh(geo, mat));
        revealNow();
      }
    );
  }

  function resize() {
    const w = mountEl.clientWidth, h = mountEl.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(mountEl);
  resize();

  // --- взаимодействие: вращение / pinch-zoom / автовращение / сброс ---
  // Слушатели навешаны на renderer.domElement конкретной ячейки — то
  // есть каждая модель в сетке реагирует ТОЛЬКО на касания внутри своей
  // ячейки, независимо от соседних моделей.
  let autoRotate = true;
  let idleTimer = null;
  let dragging = false, lastX = 0, lastY = 0;
  let pinchStartDist = 0, zoomFactor = 1;
  let resetAnimId = null;
  const pointers = new Map();

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  // Плавный (но быстрый) возврат в исходное положение перед тем, как
  // снова включится автовращение — раньше положение сбрасывалось
  // мгновенно, скачком, теперь модель докручивается туда сама.
  function animateToRest() {
    cancelAnimationFrame(resetAnimId);

    // Приводим накопленный угол поворота к диапазону -π..π — иначе,
    // если модель успела повернуть пользователем через несколько полных
    // оборотов, возврат к 0 «домотал» бы их все вместо короткого пути.
    // Само присвоение ничего не меняет визуально (угол эквивалентен).
    const twoPi = Math.PI * 2;
    let normY = pivot.rotation.y % twoPi;
    if (normY > Math.PI) normY -= twoPi;
    if (normY < -Math.PI) normY += twoPi;
    pivot.rotation.y = normY;

    const startX = pivot.rotation.x, startY = pivot.rotation.y, startZ = camera.position.z;
    const duration = 500;
    const t0 = performance.now();

    function step(now) {
      const t = Math.min(1, (now - t0) / duration);
      const e = 1 - Math.pow(1 - t, 3); // easeOutCubic — быстрый старт, мягкое приземление
      pivot.rotation.x = startX * (1 - e);
      pivot.rotation.y = startY * (1 - e);
      camera.position.z = startZ + (baseDistance - startZ) * e;
      if (t < 1) {
        resetAnimId = requestAnimationFrame(step);
      } else {
        pivot.rotation.set(0, 0, 0);
        camera.position.z = baseDistance;
        zoomFactor = 1;
        autoRotate = true;
      }
    }
    resetAnimId = requestAnimationFrame(step);
  }

  function scheduleIdleReset() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(animateToRest, IDLE_RESET_MS);
  }

  const el = renderer.domElement;
  el.addEventListener("pointerdown", (e) => {
    autoRotate = false;
    cancelAnimationFrame(resetAnimId); // если модель ещё доезжала «домой» — прерываем, слушаемся пользователя
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) { dragging = true; lastX = e.clientX; lastY = e.clientY; }
    else if (pointers.size === 2) {
      dragging = false;
      const pts = [...pointers.values()];
      pinchStartDist = dist(pts[0], pts[1]);
    }
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      const d = dist(pts[0], pts[1]);
      zoomFactor = Math.min(1.8, Math.max(1, d / pinchStartDist));
      camera.position.z = baseDistance / zoomFactor;
      scheduleIdleReset();
      return;
    }
    if (dragging) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      pivot.rotation.y += dx * 0.008;
      pivot.rotation.x = Math.max(-0.9, Math.min(0.9, pivot.rotation.x + dy * 0.008));
      scheduleIdleReset();
    }
  });
  function release(e) {
    pointers.delete(e.pointerId); // удержание без движения — не новое действие
    if (pointers.size === 0) dragging = false;
    scheduleIdleReset();
  }
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);
  scheduleIdleReset();

  let rafId;
  const frameInterval = lite ? 1000 / 30 : 0; // lite-режим: ~30fps вместо полных 60 — вместе с несколькими сценами разом это заметно бережёт GPU
  let lastFrameTime = 0;
  function animate(now) {
    rafId = requestAnimationFrame(animate);
    if (frameInterval && now - lastFrameTime < frameInterval) return;
    lastFrameTime = now;
    if (autoRotate) pivot.rotation.y += 0.006;
    renderer.render(scene, camera);
  }
  rafId = requestAnimationFrame(animate);

  return {
    destroy() {
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(resetAnimId);
      clearTimeout(idleTimer);
      ro.disconnect();
      renderer.dispose();
    }
  };
}

/**
 * Несколько моделей ОДНИМ общим WebGL-рендерером вместо N независимых
 * (использовалось раньше — каждая ячейка сетки создавала свой
 * renderer/canvas/GL-контекст, и именно это было настоящей причиной
 * подвисания шахматки зверей: три параллельных WebGL-контекста реально
 * дорого стоят браузеру, отдельно от того, сколько там полигонов).
 *
 * Технически — общий приём Three.js "несколько вьюпортов на одном
 * рендерере": один <canvas> на весь контейнер сетки, для каждой ячейки —
 * своя {scene, camera, pivot}, но renderer.render() вызывается по очереди
 * для каждой сцены в ОДНОМ requestAnimationFrame через setScissor/
 * setViewport, ограничивающий отрисовку рамками конкретной ячейки.
 *
 * @param {Array<{el:HTMLElement, modelConfig:Object}>} cells
 */
export async function mountModelGroup(cells) {
  let THREE, GLTFLoader;
  try {
    THREE = await import("../vendor/three.module.js");
    ({ GLTFLoader } = await import("../vendor/addons/loaders/GLTFLoader.js"));
  } catch (err) {
    console.warn(
      "[3D] js/vendor/three.module.js (и/или GLTFLoader.js) не найден. " +
      "Показана временная геометрия вместо реальных моделей. " +
      "См. README.md → «Подключение Three.js».", err
    );
    const controllers = cells.map(({ el, modelConfig }) => mountPlaceholderViewer(el, modelConfig, el));
    return { destroy() { controllers.forEach((c) => c.destroy()); } };
  }

  const container = cells[0].el.parentElement;
  const prevPosition = container.style.position;
  if (!prevPosition) container.style.position = "relative";

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:1; display:block;";
  container.insertBefore(canvas, container.firstChild);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.setScissorTest(true);
  renderer.setClearColor(0x000000, 0);

  const loader = new GLTFLoader();
  const items = cells.map(({ el, modelConfig }) => createGroupItem(el, modelConfig, THREE, loader));

  function resizeCanvas() {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
  }
  const ro = new ResizeObserver(resizeCanvas);
  ro.observe(container);
  resizeCanvas();

  let rafId;
  const frameInterval = 1000 / 30; // ~30fps на всю группу — вместе с общим рендерером этого достаточно для плавности
  let lastFrameTime = 0;
  function animate(now) {
    rafId = requestAnimationFrame(animate);
    if (now - lastFrameTime < frameInterval) return;
    lastFrameTime = now;

    const containerRect = container.getBoundingClientRect();
    if (!containerRect.width || !containerRect.height) return;
    const canvasH = renderer.domElement.height / renderer.getPixelRatio();

    items.forEach((item) => {
      if (!item.ready) return;
      const elRect = item.el.getBoundingClientRect();
      const w = elRect.width, h = elRect.height;
      if (!w || !h) return;
      const x = elRect.left - containerRect.left;
      const yTop = elRect.top - containerRect.top;
      const yBottom = canvasH - yTop - h; // у WebGL начало координат снизу слева

      renderer.setViewport(x, yBottom, w, h);
      renderer.setScissor(x, yBottom, w, h);
      if (item.camera.aspect !== w / h) {
        item.camera.aspect = w / h;
        item.camera.updateProjectionMatrix();
      }
      item.tick();
      renderer.render(item.scene, item.camera);
    });
  }
  rafId = requestAnimationFrame(animate);

  return {
    destroy() {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      items.forEach((i) => i.destroy());
      renderer.dispose();
      canvas.remove();
      if (!prevPosition) container.style.position = "";
    }
  };
}

// Одна "под-сцена" внутри общего рендерера (см. mountModelGroup) — та же
// логика взаимодействия/автовращения/сброса, что и в mountRealViewer,
// но без собственного renderer/canvas и без собственного rAF-цикла —
// рендерится и обновляется по вызову из общего цикла (item.tick()).
function createGroupItem(el, { modelPath, icon, label }, THREE, loader) {
  const badge = document.createElement("div");
  badge.className = "asset-missing-note hidden";
  el.appendChild(badge);
  const spinner = document.createElement("div");
  spinner.className = "stage-spinner";

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const baseDistance = 4.4;
  camera.position.set(0, 0, baseDistance);
  scene.add(new THREE.AmbientLight(0xfff2d8, 0.8));
  const key = new THREE.DirectionalLight(0xffe3b0, 1.15);
  key.position.set(3, 4, 5);
  scene.add(key);
  const pivot = new THREE.Group();
  scene.add(pivot);

  function frameObject(object3d) {
    // Обязательно обновляем мировые матрицы ПЕРЕД замером габаритов —
    // без этого при первой же вставке в сцену Box3 иногда мерил объект
    // ДО того, как его трансформация до конца "устаканилась", и на
    // разных заходах (свежая загрузка / клон из кэша) масштаб мог
    // получаться слегка разным. Теперь замер всегда детерминированный —
    // масштаб строго одинаковый при каждом открытии страницы.
    object3d.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object3d);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = FRAME_TARGET_SIZE / maxDim;
    object3d.scale.setScalar(scale);
    object3d.position.sub(center.multiplyScalar(scale));
  }

  function revealNow() {
    requestAnimationFrame(() => el.classList.add("revealed"));
    spinner.remove();
    // Раньше появление модели "подхватывалось" через CSS-прозрачность
    // контейнера — теперь холст общий на всю группу и больше не внутри
    // .beast-model, поэтому CSS-fade его не касается. Анимируем
    // появление прямо в 3D-сцене — плавный рост от нуля до полного
    // масштаба, это ещё и выглядит чуть более "живо", чем просто fade.
    ready = true;
    const t0 = performance.now();
    const duration = 380;
    function grow(now) {
      const t = Math.min(1, (now - t0) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      pivot.scale.setScalar(0.05 + 0.95 * e);
      if (t < 1) requestAnimationFrame(grow);
    }
    requestAnimationFrame(grow);
  }
  let ready = false;
  pivot.scale.setScalar(0.05); // стартовый масштаб для анимации появления выше

  const cached = getCachedModel(modelPath);
  if (cached) {
    // Уже отмасштабирован заранее (см. ветку ниже) — пересчитывать не нужно.
    pivot.add(cached);
    revealNow();
  } else {
    el.appendChild(spinner);
    loader.load(
      modelPath,
      (gltf) => {
        frameObject(gltf.scene);
        cacheModel(modelPath, gltf.scene); // кэшируем УЖЕ отмасштабированную модель
        pivot.add(gltf.scene);
        revealNow();
      },
      undefined,
      (err) => {
        console.warn("[3D] Не удалось загрузить " + modelPath + ". Показана временная геометрия.", err);
        badge.textContent = "Файл не найден: " + modelPath;
        badge.classList.remove("hidden");
        const geo = new THREE.IcosahedronGeometry(1, 1);
        const mat = new THREE.MeshStandardMaterial({ color: 0xe8e2da, metalness: 0.35, roughness: 0.4 });
        pivot.add(new THREE.Mesh(geo, mat));
        revealNow();
      }
    );
  }

  let autoRotate = true;
  let idleTimer = null;
  let dragging = false, lastX = 0, lastY = 0;
  let pinchStartDist = 0, zoomFactor = 1;
  let resetAnimId = null;
  const pointers = new Map();
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function animateToRest() {
    cancelAnimationFrame(resetAnimId);
    const twoPi = Math.PI * 2;
    let normY = pivot.rotation.y % twoPi;
    if (normY > Math.PI) normY -= twoPi;
    if (normY < -Math.PI) normY += twoPi;
    pivot.rotation.y = normY;

    const startX = pivot.rotation.x, startY = pivot.rotation.y, startZ = camera.position.z;
    const duration = 500;
    const t0 = performance.now();
    function step(now) {
      const t = Math.min(1, (now - t0) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      pivot.rotation.x = startX * (1 - e);
      pivot.rotation.y = startY * (1 - e);
      camera.position.z = startZ + (baseDistance - startZ) * e;
      if (t < 1) {
        resetAnimId = requestAnimationFrame(step);
      } else {
        pivot.rotation.set(0, 0, 0);
        camera.position.z = baseDistance;
        zoomFactor = 1;
        autoRotate = true;
      }
    }
    resetAnimId = requestAnimationFrame(step);
  }
  function scheduleIdleReset() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(animateToRest, IDLE_RESET_MS);
  }

  el.addEventListener("pointerdown", (e) => {
    autoRotate = false;
    cancelAnimationFrame(resetAnimId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) { dragging = true; lastX = e.clientX; lastY = e.clientY; }
    else if (pointers.size === 2) {
      dragging = false;
      const pts = [...pointers.values()];
      pinchStartDist = dist(pts[0], pts[1]);
    }
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      const d = dist(pts[0], pts[1]);
      zoomFactor = Math.min(1.8, Math.max(1, d / pinchStartDist));
      camera.position.z = baseDistance / zoomFactor;
      scheduleIdleReset();
      return;
    }
    if (dragging) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      pivot.rotation.y += dx * 0.008;
      pivot.rotation.x = Math.max(-0.9, Math.min(0.9, pivot.rotation.x + dy * 0.008));
      scheduleIdleReset();
    }
  });
  function release(e) {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) dragging = false;
    scheduleIdleReset();
  }
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);
  scheduleIdleReset();

  return {
    el, scene, camera,
    get ready() { return ready; },
    tick() { if (autoRotate) pivot.rotation.y += 0.006; },
    destroy() {
      cancelAnimationFrame(resetAnimId);
      clearTimeout(idleTimer);
    }
  };
}
// Та же логика жестов, но без WebGL — CSS 3D-плашка. Тоже монтируется
// в любой переданный элемент (весь #stage3d либо одна ячейка сетки).
// ----------------------------------------------------------------
function mountPlaceholderViewer(mountEl, { icon, label, modelPath }, revealTarget) {
  mountEl.innerHTML = `
    <div class="stage-hint-icon">⟲ авто-вращение</div>
    <div class="asset-missing-note">Three.js не подключён · заглушка вместо ${modelPath}</div>
    <div class="model-card">
      <div class="model-face front"><div class="icon">${icon || "◆"}</div><div class="tag">3D-плейсхолдер</div></div>
      <div class="model-face back"><div class="icon">${icon || "◆"}</div><div class="tag">заменить на .glb</div></div>
    </div>
  `;
  const card = mountEl.querySelector(".model-card");

  let rot = { x: -8, y: 0 };
  let scale = 1;
  let autoRotate = true;
  let idleTimer = null;
  let rafId = null;
  let dragging = false, lastX = 0, lastY = 0;
  let pinchStartDist = 0, pinchStartScale = 1;
  const pointers = new Map();

  // Плавный (но быстрый) возврат в исходное положение вместо мгновенного
  // скачка — та же идея, что и в реальном 3D-режиме (см. mountRealViewer).
  let resetting = false, resetStart = 0, resetFromX = -8, resetFromY = 0, resetFromScale = 1;

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function apply() {
    card.style.transform = `rotateX(${rot.x}deg) rotateY(${rot.y}deg) scale(${scale})`;
  }
  function startReset() {
    // короткий путь возврата, а не докручивание через все накопленные обороты
    let normY = rot.y % 360;
    if (normY > 180) normY -= 360;
    if (normY < -180) normY += 360;
    rot.y = normY;

    resetting = true;
    resetStart = performance.now();
    resetFromX = rot.x; resetFromY = rot.y; resetFromScale = scale;
  }
  function scheduleIdleReset() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(startReset, IDLE_RESET_MS);
  }
  function loop(now) {
    if (resetting) {
      const t = Math.min(1, (now - resetStart) / 500);
      const e = 1 - Math.pow(1 - t, 3); // easeOutCubic
      rot.x = resetFromX + (-8 - resetFromX) * e;
      rot.y = resetFromY * (1 - e);
      scale = resetFromScale + (1 - resetFromScale) * e;
      apply();
      if (t >= 1) { resetting = false; autoRotate = true; }
    } else if (autoRotate) {
      rot.y = (rot.y + 0.35) % 360;
      apply();
    }
    rafId = requestAnimationFrame(loop);
  }

  mountEl.addEventListener("pointerdown", (e) => {
    autoRotate = false;
    resetting = false; // если модель ещё доезжала «домой» — прерываем, слушаемся пользователя
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) { dragging = true; lastX = e.clientX; lastY = e.clientY; }
    else if (pointers.size === 2) {
      dragging = false;
      const pts = [...pointers.values()];
      pinchStartDist = dist(pts[0], pts[1]);
      pinchStartScale = scale;
    }
    mountEl.setPointerCapture(e.pointerId);
  });
  mountEl.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      const d = dist(pts[0], pts[1]);
      scale = Math.min(1.8, Math.max(1, pinchStartScale * (d / pinchStartDist)));
      apply();
      scheduleIdleReset();
      return;
    }
    if (dragging) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      rot.y += dx * 0.4;
      rot.x = Math.max(-60, Math.min(60, rot.x - dy * 0.4));
      apply();
      scheduleIdleReset();
    }
  });
  function release(e) {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) dragging = false;
    scheduleIdleReset();
  }
  mountEl.addEventListener("pointerup", release);
  mountEl.addEventListener("pointercancel", release);

  apply();
  rafId = requestAnimationFrame(loop);
  scheduleIdleReset();
  requestAnimationFrame(() => revealTarget.classList.add("revealed"));

  return {
    destroy() {
      cancelAnimationFrame(rafId);
      clearTimeout(idleTimer);
    }
  };
}
