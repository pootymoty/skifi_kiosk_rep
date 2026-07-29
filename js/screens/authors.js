// ============================================================
// Экран «Авторы» (ТЗ п.15).
// ============================================================

export function initAuthorsScreen(container, authorsData) {
  container.innerHTML = `
    <p class="authors-text"></p>
    <div class="qr-box">
      <img class="qr-img" alt="QR-код">
    </div>
    <div class="qr-note">QR предположительно ведёт на Telegram-канал авторов</div>
  `;

  container.querySelector(".authors-text").textContent = authorsData.text;

  const qrImg = container.querySelector(".qr-img");
  const qrBox = container.querySelector(".qr-box");
  qrImg.addEventListener("error", () => {
    console.warn("[authors] Файл не найден: " + authorsData.qr + ". Показана заглушка.");
    qrBox.classList.add("no-image");
  });
  qrImg.src = authorsData.qr;

  return { destroy() {} };
}
