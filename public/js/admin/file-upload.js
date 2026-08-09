document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.querySelector('[data-file-dropzone]');
  const fileInput = dropZone?.querySelector('input[type="file"]');
  const trigger = dropZone?.querySelector('[data-file-trigger]');
  const fileName = dropZone?.querySelector('[data-file-name]');

  if (!dropZone || !fileInput || !trigger || !fileName) return;

  const updateFileName = () => {
    fileName.textContent = fileInput.files?.[0]?.name || 'JPG, PNG o WebP';
  };

  trigger.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', updateFileName);

  for (const eventName of ['dragenter', 'dragover']) {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add('is-dragging');
    });
  }

  for (const eventName of ['dragleave', 'drop']) {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove('is-dragging');
    });
  }

  dropZone.addEventListener('drop', (event) => {
    if (!event.dataTransfer?.files.length) return;
    fileInput.files = event.dataTransfer.files;
    updateFileName();
  });
});
