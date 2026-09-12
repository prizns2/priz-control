(() => {
  const originalRemove = Element.prototype.remove;
  const UPLOAD_HELPER = 'Файлы будут загружены напрямую в Backblaze после сохранения записи.';

  Element.prototype.remove = function (...args) {
    try {
      const isRecordUploadBox =
        this instanceof Element &&
        this.classList?.contains('upload-box') &&
        this.querySelector?.('input[type="file"][name="attachments"]');

      if (isRecordUploadBox) {
        this.querySelectorAll('.file-hint').forEach(hint => {
          if (String(hint.textContent || '').replace(/\s+/g, ' ').trim() === UPLOAD_HELPER) {
            originalRemove.call(hint);
          }
        });
        return;
      }
    } catch (_) {}

    return originalRemove.apply(this, args);
  };
})();
