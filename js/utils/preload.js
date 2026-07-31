// ============================================================
// Предзагрузка всех ассетов при старте приложения.
//
// Раньше каждая модель грузилась и парсилась ровно в момент нажатия
// на объект — отсюда и заметная задержка перед появлением, из-за
// которой казалось, что анимации появления нет вообще (она либо не
// успевала сыграть, либо играла «в пустоту» до того, как модель была
// готова). Теперь всё качается и парсится один раз, заранее, пока
// пользователь смотрит видео/только зашёл на карту — дальше объекты
// открываются мгновенно из кэша.
//
// Картинки (карта, ковёр, восстановленный участок, QR) точно так же
// прогреваются через new Image(), чтобы браузер их закэшировал.
// ============================================================
import { CONTENT } from "../data/content.js";

const modelCache = new Map(); // путь к .glb → уже распарсенный THREE.Object3D (сцена)
let preloadStarted = false;

export function preloadAll() {
  if (preloadStarted) return; // не запускать повторно (например, при возврате к видео)
  preloadStarted = true;

  const imagePaths = [
    CONTENT.map.background,
    ...((CONTENT.authors.team || []).map(p => p.qr)),
    ...Object.values(CONTENT.objects).map(o => o.image),
    ...Object.values(CONTENT.objects).map(o => o.hole && o.hole.patchImage),
    ...Object.values(CONTENT.objects).flatMap(o =>
      o.clothingCarousel ? o.clothingCarousel.map(c => c.image) : []
    )
  ].filter(Boolean);
  imagePaths.forEach(preloadImage);

  const modelPaths = Object.values(CONTENT.objects).flatMap(o => {
    if (o.models) return o.models.map(m => m.modelPath).filter(Boolean); // сетка из нескольких моделей
    return o.model ? [o.model] : [];                                     // одиночная модель
  });
  if (modelPaths.length) preloadModels(modelPaths);
}

function preloadImage(src) {
  const img = new Image();
  img.src = src; // сам факт установки src запускает загрузку в кэш браузера
}

async function preloadModels(paths) {
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
  paths.forEach((path) => {
    if (modelCache.has(path)) return;
    loader.load(
      path,
      (gltf) => { modelCache.set(path, gltf.scene); },
      undefined,
      (err) => { console.warn("[preload] Не удалось предзагрузить " + path, err); }
    );
  });
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
