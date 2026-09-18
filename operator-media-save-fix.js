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

  // Безопасное повторное сохранение формы с медиа.
  // Если запись уже успела сохраниться, а загрузка фото/видео упала,
  // повторное нажатие «Сохранить» обновит ту же запись, а не создаст дубль.
  if (!window.__prizSafeRecordSaveInstalled) {
    window.__prizSafeRecordSaveInstalled = true;

    const baseSaveRecord =
      typeof saveRecord === 'function' ? saveRecord : window.saveRecord;

    const baseUploadOneMedia =
      typeof uploadOneMedia === 'function' ? uploadOneMedia : window.uploadOneMedia;

    const baseDeleteOneMedia =
      typeof deleteOneMedia === 'function' ? deleteOneMedia : window.deleteOneMedia;

    const currentRecordForm = () => document.getElementById('recordForm');

    if (typeof baseSaveRecord === 'function') {
      const safeSaveRecord = async function (record, isEdit) {
        const form = currentRecordForm();

        if (isEdit || !form) {
          return baseSaveRecord(record, isEdit);
        }

        const alreadySavedId =
          String(form.dataset.prizSavedRecordId || '').trim();

        if (alreadySavedId) {
          try {
            return await baseSaveRecord(
              { ...record, id: alreadySavedId },
              true
            );
          } catch (err) {
            // This retry exists only to resume a media upload that failed
            // after the record itself was already created — the record's
            // fields don't actually need to change. Roles without UPDATE
            // rights on records (e.g. operator) can't perform that no-op
            // update at all: PostgREST reports the 0-row result as
            // PGRST116 ("Cannot coerce the result to a single JSON
            // object"). Treat that specific case as nothing-to-update and
            // keep going with the record as already saved, instead of
            // surfacing a confusing error and blocking the upload retry.
            if (err?.code === 'PGRST116') {
              return { ...record, id: alreadySavedId };
            }
            throw err;
          }
        }

        const saved = await baseSaveRecord(record, false);

        if (saved?.id) {
          form.dataset.prizSavedRecordId = saved.id;
        }

        return saved;
      };

      try { saveRecord = safeSaveRecord; } catch (_) {}
      window.saveRecord = safeSaveRecord;
    }

    if (typeof baseUploadOneMedia === 'function') {
      const safeUploadOneMedia = async function (recordId, item, onProgress) {
        // Уже успешно загруженный файл при повторном сохранении второй раз не отправляем.
        if (item?.__prizUploadedMedia) {
          try { onProgress?.(100); } catch (_) {}
          return item.__prizUploadedMedia;
        }

        try {
          const uploaded = await baseUploadOneMedia(
            recordId,
            item,
            onProgress
          );

          if (item && uploaded) {
            item.__prizUploadedMedia = uploaded;
          }

          try { onProgress?.(100); } catch (_) {}
          return uploaded;
        } catch (error) {
          const form = currentRecordForm();
          const savedId =
            String(form?.dataset?.prizSavedRecordId || '').trim();

          const reason =
            String(error?.message || error || 'неизвестная ошибка');

          if (savedId && savedId === String(recordId)) {
            throw new Error(
              `Запись уже сохранена. Фото/видео не загрузилось. ` +
              `Нажмите «Сохранить» ещё раз — загрузка продолжится без создания дубля. ` +
              `Причина: ${reason}`
            );
          }

          throw error;
        }
      };

      try { uploadOneMedia = safeUploadOneMedia; } catch (_) {}
      window.uploadOneMedia = safeUploadOneMedia;
    }

    if (typeof baseDeleteOneMedia === 'function') {
      const safeDeleteOneMedia = async function (att) {
        // Если удаление уже прошло до сбоя следующего шага, повторно не удаляем.
        if (att?.__prizDeletedMedia) return;

        const result = await baseDeleteOneMedia(att);

        if (att) {
          att.__prizDeletedMedia = true;
        }

        return result;
      };

      try { deleteOneMedia = safeDeleteOneMedia; } catch (_) {}
      window.deleteOneMedia = safeDeleteOneMedia;
    }
  }
})();
