// ============================================================
// 3D-стадия объекта (ТЗ п.11 «Пантера», п.12 «Человек»).
//
// Ожидается, что в js/vendor/ будут положены модули Three.js
// (см. README.md — раздел «Подключение Three.js»). До этого момента
// код работает в режиме заглушки: рисует условную геометрию вместо
// .glb, чтобы весь остальной интерфейс можно было тестировать уже
// сейчас. Как только vendor-файлы появятся — заглушка сама уступит
// место настоящему рендеру, без правок кода.
//
// Логика взаимодействия (общая что для реальной модели, что для
// геометрии-заглушки):
//   - вращение пальцем (drag);
//   - масштабирование двумя пальцами (pinch);
//   - автовращение включено после открытия экрана;
//   - выключается при первом касании;
//   - при 10 секундах бездействия — сброс положения и возобновление
//     автовращения;
//   - удержание пальца без движения не считается новым действием.
// ============================================================

const IDLE_RESET_MS = 10000;

export async function initObjectStage3D(container, { modelPath, icon }) {
  container.innerHTML = "";

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
    return initPlaceholderStage(container, icon, modelPath);
  }

  return initRealStage(container, THREE, GLTFLoader, modelPath, icon);
}

// ----------------------------------------------------------------
// РЕАЛЬНЫЙ РЕНДЕР (Three.js + GLTFLoader)
// ----------------------------------------------------------------
function initRealStage(container, THREE, GLTFLoader, modelPath, icon) {
  const badge = document.createElement("div");
  badge.className = "asset-missing-note hidden";
  container.appendChild(badge);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.touchAction = "none";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const baseDistance = 4.4;
  camera.position.set(0, 0, baseDistance);

  scene.add(new THREE.AmbientLight(0xfff2d8, 0.75));
  const key = new THREE.DirectionalLight(0xffe3b0, 1.15);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fa0ff, 0.35);
  rim.position.set(-4, -2, -3);
  scene.add(rim);

  const pivot = new THREE.Group();
  scene.add(pivot);

  function frameObject(object3d) {
    const box = new THREE.Box3().setFromObject(object3d);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 2.2 / maxDim;
    object3d.scale.setScalar(scale);
    object3d.position.sub(center.multiplyScalar(scale));
  }

  const loader = new GLTFLoader();
  loader.load(
    modelPath,
    (gltf) => { pivot.add(gltf.scene); frameObject(gltf.scene); },
    undefined,
    (err) => {
      console.warn("[3D] Не удалось загрузить " + modelPath + ". Показана временная геометрия.", err);
      badge.textContent = "Файл не найден: " + modelPath;
      badge.classList.remove("hidden");
      const geo = new THREE.IcosahedronGeometry(1, 1);
      const mat = new THREE.MeshStandardMaterial({ color: 0xc9a15a, metalness: 0.35, roughness: 0.4 });
      pivot.add(new THREE.Mesh(geo, mat));
    }
  );

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  // --- взаимодействие: вращение / pinch-zoom / автовращение / сброс ---
  let autoRotate = true;
  let idleTimer = null;
  let dragging = false, lastX = 0, lastY = 0;
  let pinchStartDist = 0, zoomFactor = 1;
  const pointers = new Map();

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function scheduleIdleReset() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      pivot.rotation.set(0, 0, 0);
      zoomFactor = 1;
      camera.position.set(0, 0, baseDistance);
      autoRotate = true;
    }, IDLE_RESET_MS);
  }

  const el = renderer.domElement;
  el.addEventListener("pointerdown", (e) => {
    autoRotate = false;
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
      zoomFactor = Math.min(1.8, Math.max(0.55, d / pinchStartDist));
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
  function animate() {
    if (autoRotate) pivot.rotation.y += 0.006;
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(animate);
  }
  animate();

  return {
    destroy() {
      cancelAnimationFrame(rafId);
      clearTimeout(idleTimer);
      ro.disconnect();
      renderer.dispose();
    }
  };
}

// ----------------------------------------------------------------
// ЗАГЛУШКА (пока js/vendor/three.module.js не добавлен)
// Та же логика жестов, но без WebGL — CSS 3D-плашка.
// ----------------------------------------------------------------
function initPlaceholderStage(container, icon, modelPath) {
  container.innerHTML = `
    <div class="stage-hint-icon">⟲ авто-вращение</div>
    <div class="asset-missing-note">Three.js не подключён · заглушка вместо ${modelPath}</div>
    <div class="model-card">
      <div class="model-face front"><div class="icon">${icon || "◆"}</div><div class="tag">3D-плейсхолдер</div></div>
      <div class="model-face back"><div class="icon">${icon || "◆"}</div><div class="tag">заменить на .glb</div></div>
    </div>
  `;
  const card = container.querySelector(".model-card");

  let rot = { x: -8, y: 0 };
  let scale = 1;
  let autoRotate = true;
  let idleTimer = null;
  let rafId = null;
  let dragging = false, lastX = 0, lastY = 0;
  let pinchStartDist = 0, pinchStartScale = 1;
  const pointers = new Map();

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function apply() {
    card.style.transform = `rotateX(${rot.x}deg) rotateY(${rot.y}deg) scale(${scale})`;
  }
  function scheduleIdleReset() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      rot = { x: -8, y: rot.y };
      scale = 1;
      apply();
      autoRotate = true;
    }, IDLE_RESET_MS);
  }
  function loop() {
    if (autoRotate) { rot.y = (rot.y + 0.35) % 360; apply(); }
    rafId = requestAnimationFrame(loop);
  }

  container.addEventListener("pointerdown", (e) => {
    autoRotate = false;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) { dragging = true; lastX = e.clientX; lastY = e.clientY; }
    else if (pointers.size === 2) {
      dragging = false;
      const pts = [...pointers.values()];
      pinchStartDist = dist(pts[0], pts[1]);
      pinchStartScale = scale;
    }
    container.setPointerCapture(e.pointerId);
  });
  container.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      const d = dist(pts[0], pts[1]);
      scale = Math.min(1.8, Math.max(0.6, pinchStartScale * (d / pinchStartDist)));
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
  container.addEventListener("pointerup", release);
  container.addEventListener("pointercancel", release);

  apply();
  loop();
  scheduleIdleReset();

  return {
    destroy() {
      cancelAnimationFrame(rafId);
      clearTimeout(idleTimer);
    }
  };
}
