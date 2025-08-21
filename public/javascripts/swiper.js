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


document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.swiper-container-categories');
  if (!container) return;

  const wrapper = container.querySelector('.swiper-wrapper');
  const hidden = document.getElementById('selectedImage');

  const clear = () => {
    wrapper.querySelectorAll('.swiper-slide.is-selected')
      .forEach(s => s.classList.remove('is-selected'));
  };

  // Click en cualquier parte del cuadrado
  wrapper.addEventListener('click', (e) => {
    const slide = e.target.closest('.swiper-slide');
    if (!slide) return;

    clear();
    slide.classList.add('is-selected');

    // toma el nombre desde el contenedor o, si no, desde la img (como lo tenías)
    const name = slide.dataset.name || slide.querySelector('img')?.dataset.name || '';
    if (hidden) hidden.value = name;
  });

  // Accesibilidad: Enter o Espacio también seleccionan
  wrapper.addEventListener('keydown', (e) => {
    const slide = e.target.closest('.swiper-slide');
    if (!slide) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      slide.click();
    }
  });
});
