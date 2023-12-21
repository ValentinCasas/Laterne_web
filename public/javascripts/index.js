gsap.registerPlugin(MotionPathPlugin);

  var cards = Array.from(document.querySelectorAll("#card-slider-testimonial .slider-item-testimonial"));

  startAnim(cards);

  function startAnim(array) {
    if (array.length >= 4) {
      gsap.fromTo(
        array[0],
        0.5,
        { x: 0, y: 0, opacity: 0.75 },
        {
          motionPath: {
            path: [
              { x: 0, y: -120 }
            ]
          },
          opacity: 0,
          zIndex: 0,
          delay: 0.03,
          ease: "power1.inOut",
          onComplete: function() { sortArray(array); }
        }
      );

      gsap.fromTo(
        array[1],
        0.5,
        { x: 15, y: 125, opacity: 1, zIndex: 1 },
        {
          motionPath: {
            path: [
              { x: 0, y: 0 }
            ]
          },
          opacity: 0.75,
          zIndex: 0,
          boxShadow: "-5px 8px 8px 0 rgba(82,89,129,0.05)",
          ease: "power1.inOut"
        }
      );

      gsap.to(
        array[2],
        0.5,
        {
          motionPath: {
            path: [
              { x: 0, y: 250 },
              { x: 15, y: 200 },
              { x: 15, y: 125 }
            ]
          },
          boxShadow: "-5px 8px 8px 0 rgba(82,89,129,0.05)",
          zIndex: 1,
          opacity: 1,
          ease: "power1.inOut"
        }
      );

      gsap.fromTo(
        array[3],
        0.5,
        { x: 0, y: 400, opacity: 0, zIndex: 0 },
        {
          motionPath: {
            path: [
              { x: 0, y: 250 }
            ]
          },
          opacity: 0.75,
          zIndex: 0,
          ease: "power1.inOut"
        }
      );
    } else {
      var p = document.createElement("p");
      p.textContent = "Sorry, carousel should contain more than 3 slides";
      document.querySelector("#card-slider-testimonial").appendChild(p);
    }
  }

  function sortArray(array) {
    clearTimeout(delay);
    var delay = setTimeout(function () {
      var firstElem = array.shift();
      array.push(firstElem);
      return startAnim(array);
    }, 3000);
  }



var modalContainer = document.getElementById('modal');
var modalImage = document.getElementById('modalImage');

function openModal(imageUrl) {
  modalImage.src = imageUrl;
  modalContainer.style.display = 'flex';
}

function closeModal() {
  modalContainer.style.display = `none`;
}


document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("form-testimonial");

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    try {
      const formData = new FormData(form);
      const response = await fetch("/testimonial/create-testimonial", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {


        Swal.fire({
          title: 'Éxito',
          text: result.message,
          icon: 'success',
          confirmButtonText: 'Aceptar',
          timer: 3000,
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: result.error || "Error desconocido",
        });
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error en la solicitud: " + error,
      });
    }
  });
});



document.addEventListener("DOMContentLoaded", function () {
  var map = L.map("map", {
    center: [0, 0],
    zoom: 13,
    zoomControl: false, // Desactivar controles de zoom
    dragging: false // Deshabilitar arrastre por defecto
  });

  var lastMarker = null;

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '',
  }).addTo(map);

  // Manejar eventos de zoom para habilitar/deshabilitar el arrastre
  map.on('zoomstart', function (e) {
    map.dragging.disable(); // Deshabilitar arrastre al comenzar el zoom
  });

  function colocarMarcador(lat, lng) {
    if (lastMarker !== null) {
      lastMarker.remove();
    }

    var marker = L.marker([lat, lng]).addTo(map);
    lastMarker = marker;
  }

  // Fetch a "/businessInfo/get-businessInfo"
  fetch("/businessInfo/get-businessInfo")
    .then(response => response.json())
    .then(data => {
      // Obtener las coordenadas del objeto BusinessInfo
      var lat = data.BusinessInfo.latitude;
      var lng = data.BusinessInfo.longitude;

      map.setView([lat, lng], 14);
      colocarMarcador(lat, lng);

    })
    .catch(error => console.error('Error al obtener la información del negocio:', error));


});


const items = document.querySelectorAll('.slider-item');
const itemCount = items.length;
const nextItem = document.querySelector('.next');
const previousItem = document.querySelector('.previous');
const navItem = document.querySelector('a.toggle-nav');
let count = 0;

function showNextItem() {
  items[count].classList.remove('active');

  if (count < itemCount - 1) {
    count++;
  } else {
    count = 0;
  }

  items[count].classList.add('active');

}

function showPreviousItem() {
  items[count].classList.remove('active');

  if (count > 0) {
    count--;
  } else {
    count = itemCount - 1;
  }

  items[count].classList.add('active');
  // Check if working...
  console.log(count);
}

function toggleNavigation() {
  this.nextElementSibling.classList.toggle('active');
}

function keyPress(e) {
  e = e || window.event;

  if (e.keyCode == '37') {
    showPreviousItem();
  } else if (e.keyCode == '39') {
    showNextItem();
  }
}

nextItem.addEventListener('click', showNextItem);
previousItem.addEventListener('click', showPreviousItem);
document.addEventListener('keydown', keyPress);
//navItem.addEventListener('click', toggleNavigation);


