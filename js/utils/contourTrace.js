// ============================================================
// Трассировка контура по бинарной маске (marching squares).
// На входе — сетка 0/1 (0 = прозрачно, 1 = непрозрачно), на выходе —
// один или несколько непрерывных контуров (массивов точек [x,y]) —
// то есть настоящий контур по силуэту картинки, а не прямоугольник.
//
// Используется в js/screens/map.js для «бегущей» обводки картинок-
// объектов на карте — по контуру, а не по квадратной рамке вокруг них.
// ============================================================

export function traceContours(grid, cols, rows) {
  const segments = [];
  const at = (x, y) => grid[y * cols + x];

  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < cols - 1; x++) {
      const tl = at(x, y), tr = at(x + 1, y), br = at(x + 1, y + 1), bl = at(x, y + 1);
      const c = tl * 8 + tr * 4 + br * 2 + bl * 1;
      if (c === 0 || c === 15) continue; // клетка целиком внутри или снаружи — линии нет

      const top = [x + 0.5, y], right = [x + 1, y + 0.5], bottom = [x + 0.5, y + 1], left = [x, y + 0.5];
      switch (c) {
        case 1: segments.push([left, bottom]); break;
        case 2: segments.push([bottom, right]); break;
        case 3: segments.push([left, right]); break;
        case 4: segments.push([top, right]); break;
        case 5: segments.push([top, right]); segments.push([left, bottom]); break;
        case 6: segments.push([top, bottom]); break;
        case 7: segments.push([top, left]); break;
        case 8: segments.push([top, left]); break;
        case 9: segments.push([top, bottom]); break;
        case 10: segments.push([top, left]); segments.push([bottom, right]); break;
        case 11: segments.push([top, right]); break;
        case 12: segments.push([left, right]); break;
        case 13: segments.push([bottom, right]); break;
        case 14: segments.push([left, bottom]); break;
      }
    }
  }

  return chainSegments(segments);
}

function keyOf(p) { return p[0] + "," + p[1]; }

// Отдельные отрезки marching squares нужно "сшить" в непрерывные
// контуры (иначе бегущая обводка не сможет анимироваться единым
// потоком — она едет вдоль ОДНОГО пути через stroke-dashoffset).
function chainSegments(segments) {
  const byPoint = new Map();
  segments.forEach(([a, b], i) => {
    const ka = keyOf(a), kb = keyOf(b);
    if (!byPoint.has(ka)) byPoint.set(ka, []);
    if (!byPoint.has(kb)) byPoint.set(kb, []);
    byPoint.get(ka).push(i);
    byPoint.get(kb).push(i);
  });

  const used = new Array(segments.length).fill(false);
  const polylines = [];

  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const [a, b] = segments[i];
    const pts = [a, b];
    let cur = b;
    let guard = 0;
    while (guard++ < cols_guard(segments.length)) {
      const candidates = (byPoint.get(keyOf(cur)) || []).filter((si) => !used[si]);
      if (!candidates.length) break;
      const si = candidates[0];
      used[si] = true;
      const [pa, pb] = segments[si];
      const next = keyOf(pa) === keyOf(cur) ? pb : pa;
      pts.push(next);
      cur = next;
      if (keyOf(cur) === keyOf(a)) break; // контур замкнулся
    }
    polylines.push(simplifyCollinear(pts));
  }
  return polylines;
}

function cols_guard(n) { return n + 10; } // защита от зацикливания на вырожденных случаях

// Убираем точки, лежащие точно на прямой между соседями — путь короче,
// анимация обводки плавнее (меньше лишних узлов на прямых участках).
function simplifyCollinear(pts) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = out[out.length - 1];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const cross = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
    if (Math.abs(cross) > 1e-6) out.push(pts[i]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
