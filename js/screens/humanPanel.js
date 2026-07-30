// ============================================================
// Левая колонка экрана «Человек» (модель — в правой половине,
// см. css/style.css → .obj-body.layout-human и js/app.js).
//
// Сверху вниз: текст про элемент одежды → карусель элементов одежды →
// текст о самой находке.
// ============================================================
import { createCarousel } from "../utils/carousel.js";

export function initHumanPanel(container, data) {
  container.innerHTML = `
    <div class="human-text human-text-top">
      <h3>${data.clothingText.h}</h3>
      <p>${data.clothingText.t}</p>
    </div>
    <div class="human-carousel"></div>
    <div class="human-text human-text-bottom">
      <h3>${data.aboutText.h}</h3>
      <p>${data.aboutText.t}</p>
    </div>
  `;

  const carouselEl = container.querySelector(".human-carousel");
  const carousel = createCarousel(carouselEl, data.clothingCarousel, {
    autoMs: data.carouselAutoMs || 10000,
    resumeMs: data.carouselResumeMs || 20000
  });

  return {
    destroy() {
      carousel.destroy();
    }
  };
}
