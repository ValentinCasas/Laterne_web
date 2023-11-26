
var modalContainer = document.getElementById('modal');
var modalImage = document.getElementById('modalImage');

function openModal(imageUrl) {
    modalImage.src = imageUrl;
    modalContainer.style.display = 'flex';
}

function closeModal() {
    modalContainer.style.display = `none`;
}
