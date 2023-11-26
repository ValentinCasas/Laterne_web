const dropZone = document.querySelector('.container');
const fileInput = document.querySelector('#file');
const browseBtn = document.querySelector('.header');
const footerText = document.querySelector('.footer p:last-of-type');

const showFile = (file) => {
  footerText.textContent = file.name;
}

const isValidImageType = (file) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  return allowedTypes.includes(file.type);
};

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('hovered');
  const file = e.dataTransfer.files[0];
  if (isValidImageType(file)) {
    fileInput.files = e.dataTransfer.files;
    showFile(file);
  } else {
    fileInput.value = 'archivo invalido';
  }
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (isValidImageType(file)) {
    showFile(file);
  } else {

    fileInput.value = 'archivo invalido'; // Limpiar el valor del input para permitir seleccionar otro archivo
  }
});

browseBtn.addEventListener('click', () => {
  fileInput.click();
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('hovered');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('hovered');
});