/* var swiper = new Swiper('.swiper-container', {
    loop: true,
    autoplay: {
        delay: 1500,
        disableOnInteraction: false,
    },
    slidesPerView: 'auto',
    spaceBetween: 20,
    speed: 1000,
    pagination: {
        el: '.swiper-pagination',
        clickable: true,
    },
    navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
    },
    breakpoints: {
        768: {
            slidesPerView: 3,
            spaceBetween: 1,
        },
    },

}); */


var swiper = new Swiper('.swiper-container-categories', {
    loop: true,
    autoplay: false,
    slidesPerView: 'auto',
    spaceBetween: 20,
    speed: 1000,
    pagination: {
        el: '.swiper-pagination',
        clickable: true,
    },
    navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
    },
    breakpoints: {
        768: {
            slidesPerView: 3,
            spaceBetween: 1,
        },
    },
});


var swiper = new Swiper('.swiper-container-categories-card', {
    loop: true,
    autoplay: false,
    slidesPerView: 'auto',
    spaceBetween: 20,
    speed: 500,
    centeredSlides: true, // Centrar los slides activos
    pagination: {
        el: '.swiper-pagination',
        clickable: true,
    },
    navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
    },
    breakpoints: {
        300: {
            slidesPerView: 2,
            spaceBetween: 10,
        },
        480: {
            slidesPerView: 2,
            spaceBetween: 10,
        },
        576: {
            slidesPerView: 4,
            spaceBetween: 10,
        },
        768: {
            slidesPerView: 5,
            spaceBetween: 15,
        },
        1024: {
            slidesPerView: 5,
            spaceBetween: 15,
        },
        1200: {
            slidesPerView: 5,
            spaceBetween: 20,
        },
    },
});




function openModal(imageUrl) {
    console.log('Modal abierto con la imagen:', imageUrl);

    const modal = document.getElementById("productModal");
    const modalImage = document.getElementById("modalImage");

    modalImage.src = imageUrl;
    modal.style.display = "block";
}


function closeModal() {
    const modal = document.getElementById("productModal");
    modal.style.display = "none";
}

// Cierra el modal si se hace clic fuera de él
window.onclick = function (event) {
    const modal = document.getElementById("productModal");
    if (event.target === modal) {
        closeModal();
    }
};


