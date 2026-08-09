document.addEventListener("DOMContentLoaded", function () {
    initModal();
    initTestimonialForm();
    initMap();
    initImageSlider();
});

/* =========================
   MODAL DE IMÁGENES
========================= */

function initModal() {
    const modalContainer = document.getElementById("modal");
    const modalImage = document.getElementById("modalImage");

    if (!modalContainer || !modalImage) return;

    window.openModal = function (imageUrl) {
        modalImage.src = imageUrl;
        modalContainer.classList.add("show");
        modalContainer.style.display = "flex";
        document.body.classList.add("modal-open-custom");
    };

    window.closeModal = function () {
        modalContainer.classList.remove("show");
        modalContainer.style.display = "none";
        modalImage.src = "";
        document.body.classList.remove("modal-open-custom");
    };

    document.addEventListener('click', (event) => {
        const imageButton = event.target.closest('[data-event-image]');
        if (imageButton) window.openModal(imageButton.dataset.eventImage);
        if (event.target.closest('[data-event-modal-close]')) window.closeModal();
    });

    modalContainer.addEventListener("click", function (event) {
        if (event.target === modalContainer) {
            window.closeModal();
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && modalContainer.classList.contains("show")) {
            window.closeModal();
        }
    });
}

/* =========================
   FORMULARIO TESTIMONIAL
========================= */

function initTestimonialForm() {
    const form = document.getElementById("form-testimonial");

    if (!form) return;

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const button = form.querySelector("button[type='submit']");
        const originalButtonText = button ? button.textContent : "";

        try {
            if (button) {
                button.disabled = true;
                button.textContent = "Enviando...";
            }

            const formData = new FormData(form);

            const response = await fetch("/testimonial/create-testimonial", {
                method: "POST",
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                Swal.fire({
                    title: "¡Gracias!",
                    text: result.message || "Tu opinión fue enviada correctamente.",
                    icon: "success",
                    confirmButtonText: "Aceptar",
                    timer: 3000
                });

                form.reset();
            } else {
                Swal.fire({
                    icon: "error",
                    title: "Error",
                    text: result.error || "No se pudo enviar la opinión."
                });
            }
        } catch (error) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: "Error en la solicitud: " + error.message
            });
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = originalButtonText;
            }
        }
    });
}

/* =========================
   MAPA
========================= */

function initMap() {
    const mapContainer = document.getElementById("map");

    if (!mapContainer || typeof L === "undefined") return;

    const map = L.map("map", {
        center: [0, 0],
        zoom: 13,
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false
    });

    let lastMarker = null;

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: ""
    }).addTo(map);

    function colocarMarcador(lat, lng) {
        if (lastMarker !== null) {
            lastMarker.remove();
        }

        lastMarker = L.marker([lat, lng]).addTo(map);
    }

    fetch("/businessInfo/get-businessInfo")
        .then(response => response.json())
        .then(data => {
            if (!data || !data.BusinessInfo) return;

            const lat = Number(data.BusinessInfo.latitude);
            const lng = Number(data.BusinessInfo.longitude);

            if (Number.isNaN(lat) || Number.isNaN(lng)) return;

            map.setView([lat, lng], 15);
            colocarMarcador(lat, lng);
        })
        .catch(error => {
            console.error("Error al obtener la información del negocio:", error);
        });

    mapContainer.addEventListener("mouseenter", function () {
        map.scrollWheelZoom.enable();
    });

    mapContainer.addEventListener("mouseleave", function () {
        map.scrollWheelZoom.disable();
    });
}

/* =========================
   SLIDER DE IMÁGENES
========================= */

function initImageSlider() {
    const items = document.querySelectorAll(".slider-item");
    const nextItem = document.querySelector(".next");
    const previousItem = document.querySelector(".previous");
    const navItem = document.querySelector("a.toggle-nav");

    if (!items.length || !nextItem || !previousItem) return;

    let count = 0;

    function showItem(index) {
        items[count].classList.remove("active");
        count = index;
        items[count].classList.add("active");
    }

    function showNextItem() {
        const nextIndex = count < items.length - 1 ? count + 1 : 0;
        showItem(nextIndex);
    }

    function showPreviousItem() {
        const previousIndex = count > 0 ? count - 1 : items.length - 1;
        showItem(previousIndex);
    }

    function keyPress(event) {
        if (event.key === "ArrowLeft") {
            showPreviousItem();
        }

        if (event.key === "ArrowRight") {
            showNextItem();
        }
    }

    nextItem.addEventListener("click", showNextItem);
    previousItem.addEventListener("click", showPreviousItem);
    document.addEventListener("keydown", keyPress);

    if (navItem) {
        navItem.addEventListener("click", function (event) {
            event.preventDefault();

            if (this.nextElementSibling) {
                this.nextElementSibling.classList.toggle("active");
            }
        });
    }
}
