// ============================================================
// Левая колонка экрана «Человек» (модель — в правой половине,
// см. css/style.css → .obj-body.layout-human и js/app.js).
//
// Сверху вниз: карусель элементов одежды → текстовый блок ТЕКУЩЕГО
// элемента (переключается вместе с каруселью, но пролистывается
// только внутри страниц ОДНОГО элемента) → отдельный независимый
// текст о самой находке (тоже пролистываемый, но не связан с каруселью).
// ============================================================
import { createCarousel } from "../utils/carousel.js";
import { createTextBlock } from "../utils/textBlock.js";

export function initHumanPanel(container, data) {
  container.innerHTML = `
    <div class="human-carousel"></div>
    <div class="human-item-text"></div>
    <div class="human-about-text"></div>
  `;

  const carouselEl = container.querySelector(".human-carousel");
  const itemTextEl = container.querySelector(".human-item-text");
  const aboutTextEl = container.querySelector(".human-about-text");

  // Текст текущего элемента одежды — пересоздаём пейджер при каждой
  // смене слайда, т.к. у каждого элемента свой набор страниц.
  let itemPager = null;
  function showItemText(_index, slide) {
    if (itemPager) itemPager.destroy();
    itemPager = createTextBlock(itemTextEl, slide.sections || [{ h: slide.caption || "", t: "" }]);
  }

  const carousel = createCarousel(carouselEl, data.clothingCarousel, {
    autoMs: data.carouselAutoMs || 10000,
    resumeMs: data.carouselResumeMs || 20000,
    onChange: showItemText
  });

  // Текст о самой находке — независимый, не связан с каруселью.
  const aboutPager = createTextBlock(aboutTextEl, data.aboutSections);

  return {
    destroy() {
      carousel.destroy();
      if (itemPager) itemPager.destroy();
      aboutPager.destroy();
    }
  };
}
