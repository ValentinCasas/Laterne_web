var swiper = new Swiper('.swiper-container', {
    loop: true,
    autoplay: {
        delay: 1000,
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

});


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
    slidesPerView: 'auto', // Mostrar el número de imágenes según el tamaño de la pantalla
    spaceBetween: 20,
    speed: 500, // Ajustar la velocidad del desplazamiento (en milisegundos)
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
            slidesPerView: 2,
            spaceBetween: 10, // Ajustar el espacio entre las imágenes en pantallas más pequeñas
        },
        1024: {
            slidesPerView: 3,
            spaceBetween: 15, // Puedes ajustar este espacio según tus preferencias
        },
        1200: {
            slidesPerView: 5,
            spaceBetween: 20, // Puedes ajustar este espacio según tus preferencias
        },
    },
});
