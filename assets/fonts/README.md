# Шрифты

Сейчас используются системные шрифты (без интернета веб-шрифты
подключить нельзя). Если у проекта есть брендовые шрифты — положите
файлы .woff2 сюда и добавьте в css/style.css:

    @font-face {
      font-family: "ИмяШрифта";
      src: url("../assets/fonts/файл.woff2") format("woff2");
      font-display: swap;
    }

и подставьте это имя в font-family нужных селекторов (.site-title h1,
.obj-title, .text-content и т.д.).
