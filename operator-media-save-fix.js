(() => {
  const originalRemove = Element.prototype.remove;
  const UPLOAD_HELPER = 'Файлы будут загружены напрямую в Backblaze после сохранения записи.';

  const style = document.createElement('style');
  style.id = 'operatorMediaSaveFixStyles';
  style.textContent = `
    .story-tools,
    #parseStoryBtn,
    #storyAutoStatus {
      display: none !important;
    }
  `;
  document.getElementById(style.id)?.remove();
  document.head.appendChild(style);

  Element.prototype.remove = function (...args) {
    try {
      // Эти элементы нужны app.js для корректной инициализации формы.
      // Мы скрываем их визуально, но не даём скриптам очистки удалить их из DOM.
      if (
        this.id === 'parseStoryBtn' ||
        this.id === 'storyAutoStatus' ||
        this.classList?.contains('story-tools')
      ) {
        this.style.display = 'none';
        this.setAttribute('aria-hidden', 'true');
        return;
      }

      // Блок выбора фото/видео должен оставаться в DOM.
      // Убираем только служебную подпись про Backblaze.
      const isRecordUploadBox =
        this instanceof Element &&
        this.classList?.contains('upload-box') &&
        this.querySelector?.('input[type="file"][name="attachments"]');

      if (isRecordUploadBox) {
        this.querySelectorAll('.file-hint').forEach(hint => {
          if (
            String(hint.textContent || '').replace(/\s+/g, ' ').trim() === UPLOAD_HELPER
          ) {
            originalRemove.call(hint);
          }
        });
        return;
      }
    } catch (_) {}

    return originalRemove.apply(this, args);
  };
})();
