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
