document.addEventListener('DOMContentLoaded', () => {
  if (!window.Swiper) return;

  if (document.querySelector('.swiper-container')) {
    new Swiper('.swiper-container', {
      loop: true,
      autoplay: { delay: 1500, disableOnInteraction: false },
      slidesPerView: 'auto',
      spaceBetween: 20,
      speed: 1000,
      breakpoints: {
        768: { slidesPerView: 3, spaceBetween: 1 },
      },
    });
  }

  if (document.querySelector('.swiper-container-categories')) {
    new Swiper('.swiper-container-categories', {
      loop: false,
      slidesPerView: 2,
      spaceBetween: 10,
      speed: 500,
      breakpoints: {
        576: { slidesPerView: 4, spaceBetween: 10 },
        768: { slidesPerView: 5, spaceBetween: 15 },
      },
    });
  }
});
