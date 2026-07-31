// ============================================================
// Экран «Авторы» (ТЗ п.15).
// 4 карточки в один ряд, по центру страницы: QR-код, под ним имя,
// под именем роль в проекте. Список — content.js → authors.team.
// ============================================================

export function initAuthorsScreen(container, authorsData) {
  const team = authorsData.team || [];

  container.innerHTML = `
    <p class="authors-text"></p>
    <div class="authors-team">
      ${team.map((person, i) => `
        <div class="author-card" data-i="${i}">
          <div class="qr-box">
            <img class="qr-img" alt="QR-код — ${person.name}">
          </div>
          <div class="author-name">${person.name}</div>
          <div class="author-role">${person.role}</div>
        </div>
      `).join("")}
    </div>
  `;

  container.querySelector(".authors-text").textContent = authorsData.text || "";

  container.querySelectorAll(".author-card").forEach((card, i) => {
    const person = team[i];
    const qrImg = card.querySelector(".qr-img");
    const qrBox = card.querySelector(".qr-box");
    qrImg.addEventListener("error", () => {
      console.warn("[authors] Файл не найден: " + person.qr + ". Показана заглушка.");
      qrBox.classList.add("no-image");
    });
    qrImg.src = person.qr;
  });

  return { destroy() {} };
}
