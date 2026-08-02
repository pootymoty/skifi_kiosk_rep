// ============================================================
// Раньше здесь всё (модели + картинки со ВСЕХ страниц) грузилось
// заранее, до старта видео. Это решало проблему "объект открылся —
// а модель ещё грузится", но создавало другую: тяжёлые 3D-модели
// скачивались и парсились ещё до того, как пользователь вообще
// решил зайти на ту страницу — лишняя нагрузка на память и GPU
// с самого начала, даже если до конкретного объекта дело не дойдёт.
//
// Теперь — по вашему запросу — наоборот: ЛЕНИВАЯ загрузка.
//   - При старте (до видео) предзагружаются только 3 картинки-объекта
//     карты (hero/*.png) — их видно сразу после видео, ждать не хочется.
//   - Всё остальное (модели, картинки объектов) грузится в момент,
//     когда пользователь реально открыл нужный экран — см.
//     js/screens/object3d.js (mountRealViewer сам вызывает cacheModel()
//     после первой успешной загрузки).
//   - После первого открытия результат остаётся в кэше (modelCache) —
//     повторное открытие той же страницы в этом же сеансе — мгновенно,
//     без повторного скачивания/парсинга.
// ============================================================
import { CONTENT } from "../data/content.js";

const modelCache = new Map(); // путь к .glb → уже распарсенный THREE.Object3D (сцена)
let heroPreloadPromise = null;

const IMAGE_TIMEOUT_MS = 6000; // не ждать бесконечно один медленный/битый файл

/**
 * Предзагружает только то, что понадобится СРАЗУ после видео (картинки
 * трёх объектов на карте) — не модели, не картинки других страниц.
 */
export function preloadHeroImages() {
  if (heroPreloadPromise) return heroPreloadPromise;
  const paths = Object.values(CONTENT.objects)
    .flatMap(o => (o.heroLayout ? [o.heroLayout.image] : []))
    .filter(Boolean);
  heroPreloadPromise = Promise.all(paths.map(preloadImage));
  return heroPreloadPromise;
}

function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    const done = () => resolve();
    const timer = setTimeout(done, IMAGE_TIMEOUT_MS); // подстраховка от зависшей загрузки
    img.onload = () => { clearTimeout(timer); done(); };
    img.onerror = () => { clearTimeout(timer); done(); }; // ошибка одного файла не блокирует остальное
    img.src = src;
  });
}

/**
 * Вернёт уже готовую сцену модели, если она загружалась раньше
 * (в этом же сеансе — например, пользователь уже открывал эту страницу),
 * иначе null — тогда object3d.js загрузит её сам, впервые.
 * ВАЖНО: возвращает КЛОН — вызывающая сторона может свободно добавлять его
 * в свою сцену и не бояться конфликтов между несколькими открытыми экранами.
 */
export function getCachedModel(path) {
  const scene = modelCache.get(path);
  return scene ? scene.clone(true) : null;
}

/**
 * Кладёт только что загруженную модель в кэш — вызывается из
 * object3d.js сразу после первой успешной загрузки, чтобы повторное
 * открытие той же страницы было мгновенным.
 */
export function cacheModel(path, scene) {
  if (!modelCache.has(path)) modelCache.set(path, scene);
}
