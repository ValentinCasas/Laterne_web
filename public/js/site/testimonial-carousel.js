document.addEventListener('DOMContentLoaded', () => {
  if (!window.Swiper || !document.querySelector('.testimonial-swiper')) return;

  new Swiper('.testimonial-swiper', {
    loop: true,
    autoplay: {
      delay: 4200,
      disableOnInteraction: false,
      pauseOnMouseEnter: true,
    },
    speed: 650,
    slidesPerView: 1,
    spaceBetween: 16,
    pagination: {
      el: '.testimonial-swiper .swiper-pagination',
      clickable: true,
    },
    breakpoints: {
      768: { slidesPerView: 2, spaceBetween: 20 },
      1024: { slidesPerView: 3, spaceBetween: 24 },
    },
  });
});
