// ============================================================
// Карусель картинок (используется для элементов одежды на экране
// «Человек», но написана без привязки к конкретному контенту).
//
// Поведение:
//   - автопролистывание каждые autoMs (плавный слайд);
//   - пользователь может пролистать свайпом или точками;
//   - после любого пользовательского пролистывания автопрокрутка
//     приостанавливается и возобновляется через resumeMs простоя.
// ============================================================

export function createCarousel(container, slides, { autoMs = 10000, resumeMs = 20000, onChange } = {}) {
  container.innerHTML = `
    <div class="carousel-track"></div>
    <div class="carousel-dots"></div>
  `;
  const track = container.querySelector(".carousel-track");
  const dotsEl = container.querySelector(".carousel-dots");

  slides.forEach((s, i) => {
    const slide = document.createElement("div");
    slide.className = "carousel-slide";
    slide.innerHTML = `
      <img src="${s.image}" alt="" draggable="false">
      ${s.caption ? `<div class="carousel-caption">${s.caption}</div>` : ""}
      <div class="asset-missing-note hidden"></div>
    `;
    const img = slide.querySelector("img");
    const badge = slide.querySelector(".asset-missing-note");
    img.addEventListener("error", () => {
      console.warn("[carousel] Файл не найден: " + s.image);
      slide.classList.add("no-image");
      badge.textContent = "Файл не найден: " + s.image;
      badge.classList.remove("hidden");
    });
    track.appendChild(slide);

    const dot = document.createElement("div");
    dot.className = "dot" + (i === 0 ? " active" : "");
    dot.addEventListener("pointerdown", () => goTo(i, true));
    dotsEl.appendChild(dot);
  });

  let index = 0;
  let autoTimer = null;
  let resumeTimer = null;
  let paused = false;

  function apply() {
    track.style.transform = `translateX(${-index * 100}%)`;
    [...dotsEl.children].forEach((d, i) => d.classList.toggle("active", i === index));
  }

  function goTo(i, isUserAction) {
    const next = ((i % slides.length) + slides.length) % slides.length;
    const changed = next !== index;
    index = next;
    apply();
    if (changed && onChange) onChange(index, slides[index]);
    if (isUserAction) pauseThenResume();
  }

  function scheduleAuto() {
    clearTimeout(autoTimer);
    if (paused || slides.length < 2) return;
    autoTimer = setTimeout(() => { goTo(index + 1, false); scheduleAuto(); }, autoMs);
  }

  function pauseThenResume() {
    paused = true;
    clearTimeout(autoTimer);
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => { paused = false; scheduleAuto(); }, resumeMs);
  }

  // --- свайп ---
  let dragging = false, startX = 0, deltaX = 0;
  container.addEventListener("pointerdown", (e) => {
    dragging = true; startX = e.clientX; deltaX = 0;
    container.setPointerCapture(e.pointerId);
  });
  container.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    deltaX = e.clientX - startX;
  });
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    const threshold = 40;
    if (deltaX > threshold) goTo(index - 1, true);
    else if (deltaX < -threshold) goTo(index + 1, true);
    else pauseThenResume(); // даже слабое касание — считается взаимодействием
  }
  container.addEventListener("pointerup", endDrag);
  container.addEventListener("pointercancel", endDrag);

  apply();
  if (onChange) onChange(index, slides[index]);
  scheduleAuto();

  return {
    destroy() {
      clearTimeout(autoTimer);
      clearTimeout(resumeTimer);
    }
  };
}
