
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
