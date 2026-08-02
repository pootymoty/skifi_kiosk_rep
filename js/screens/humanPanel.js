// ============================================================
// Правая колонка экрана «Человек» (видео/модель — в левой половине,
// см. js/screens/humanSplit.js).
//
// Карусель элементов одежды и текст ниже — теперь ПОЛНОСТЬЮ независимы
// друг от друга: карусель листается свайпом/сама по себе, текст —
// своими стрелками, никак не влияя друг на друга.
// ============================================================
import { createCarousel } from "../utils/carousel.js";
import { createTextBlock } from "../utils/textBlock.js";

export function initHumanPanel(container, data) {
  container.innerHTML = `
    <div class="human-carousel"></div>
    <div class="human-about-text"></div>
  `;

  const carouselEl = container.querySelector(".human-carousel");
  const aboutTextEl = container.querySelector(".human-about-text");

  const carousel = createCarousel(carouselEl, data.clothingCarousel, {
    autoMs: data.carouselAutoMs || 10000,
    resumeMs: data.carouselResumeMs || 20000
  });

  const aboutPager = createTextBlock(aboutTextEl, data.aboutSections);

  return {
    destroy() {
      carousel.destroy();
      aboutPager.destroy();
    }
  };
}
