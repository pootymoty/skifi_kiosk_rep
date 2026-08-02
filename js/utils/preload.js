// ============================================================
// Предзагрузка всех ассетов при старте приложения — теперь ДО того,
// как запускается видео-заставка (а не параллельно с ним, как было
// раньше): preloadAll() возвращает Promise, и app.js ждёт его
// завершения перед вызовом startIntro(). К моменту, когда видео
// начинает играть, все объекты уже полностью готовы и ждут.
//
// Картинки (вырезки на карте, ковёр, восстановленный фрагмент, QR,
// карусель одежды) точно так же прогреваются через new Image(),
// чтобы браузер их закэшировал.
// ============================================================
import { CONTENT } from "../data/content.js";

const modelCache = new Map(); // путь к .glb → уже распарсенный THREE.Object3D (сцена)
let preloadPromise = null;

const IMAGE_TIMEOUT_MS = 6000; // не ждать бесконечно один медленный/битый файл

export function preloadAll() {
  if (preloadPromise) return preloadPromise; // не запускать повторно

  const imagePaths = [
    ...((CONTENT.authors.team || []).map(p => p.qr)),
    ...Object.values(CONTENT.objects).map(o => o.image),
    ...Object.values(CONTENT.objects).map(o => o.hole && o.hole.patchImage),
    ...Object.values(CONTENT.objects).flatMap(o =>
      o.clothingCarousel ? o.clothingCarousel.map(c => c.image) : []
    ),
    ...Object.values(CONTENT.objects).flatMap(o =>
      o.hotspotImage ? [o.hotspotImage] : []
    ),
    ...Object.values(CONTENT.objects).flatMap(o =>
      o.heroLayout ? [o.heroLayout.image] : []
    )
  ].filter(Boolean);

  const modelPaths = Object.values(CONTENT.objects).flatMap(o => {
    if (o.models) return o.models.map(m => m.modelPath).filter(Boolean); // сетка из нескольких моделей
    return o.model ? [o.model] : [];                                     // одиночная модель
  });

  preloadPromise = Promise.all([
    Promise.all(imagePaths.map(preloadImage)),
    preloadModels(modelPaths)
  ]);
  return preloadPromise;
}

function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    const done = () => resolve();
    const timer = setTimeout(done, IMAGE_TIMEOUT_MS); // подстраховка от зависшей загрузки
    img.onload = () => { clearTimeout(timer); done(); };
    img.onerror = () => { clearTimeout(timer); done(); }; // ошибка одного файла не блокирует весь запуск
    img.src = src;
  });
}

const MODEL_TIMEOUT_MS = 8000; // не ждать бесконечно одну зависшую/повреждённую модель

async function preloadModels(paths) {
  if (!paths.length) return;
  let THREE, GLTFLoader;
  try {
    THREE = await import("../vendor/three.module.js");
    ({ GLTFLoader } = await import("../vendor/addons/loaders/GLTFLoader.js"));
  } catch (err) {
    // Three.js ещё не подключён — парсить нечем, object3d.js в этом
    // случае и так покажет CSS-заглушку, отдельно предупреждать не нужно.
    return;
  }
  const loader = new GLTFLoader();
  await Promise.all(paths.map((path) => new Promise((resolve) => {
    if (modelCache.has(path)) { resolve(); return; }
    let settled = false;
    const done = () => { if (!settled) { settled = true; resolve(); } };
    const timer = setTimeout(() => {
      console.warn("[preload] " + path + " не загрузился за " + MODEL_TIMEOUT_MS + "мс (файл битый/оборвался при закачке?). Продолжаем без него — подгрузится позже, как раньше.");
      done();
    }, MODEL_TIMEOUT_MS);
    loader.load(
      path,
      (gltf) => { clearTimeout(timer); modelCache.set(path, gltf.scene); done(); },
      undefined,
      (err) => { clearTimeout(timer); console.warn("[preload] Не удалось предзагрузить " + path, err); done(); }
    );
  })));
}

/**
 * Вернёт уже готовую сцену модели, если она была предзагружена, иначе null
 * (тогда object3d.js подгрузит её сам, как раньше — просто без предзагрузки
 * это не так мгновенно).
 * ВАЖНО: возвращает КЛОН — вызывающая сторона может свободно добавлять его
 * в свою сцену и не бояться конфликтов между несколькими открытыми экранами.
 * Клонирование не подходит для моделей со скелетной анимацией (rigged/animated
 * .glb) — для статичных музейных экспонатов этого не требуется.
 */
export function getCachedModel(path) {
  const scene = modelCache.get(path);
  return scene ? scene.clone(true) : null;
}
