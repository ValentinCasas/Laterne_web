document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("form_info");

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        // Envía el formulario usando Fetch
        try {
            const formData = new FormData(form);
            const response = await fetch("/businessInfo/update-businessInfo", {
                method: "POST",
                body: formData,
            });

            const result = await response.json();  // Mueve esta línea aquí

            if (response.ok) {
                Swal.fire({
                    icon: "success",
                    title: "Genial!",
                    text: result.message || "Modificado exitosamente",
                });

            } else {
                Swal.fire({
                    icon: "error",
                    title: "Error",
                    text: result.message || "Error desconocido",
                });
            }
        } catch (error) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: "Error en la solicitud",
            });
        }
    });
});


document.addEventListener("DOMContentLoaded", function () {
    var map = L.map("map").setView([0, 0], 13);
    var lastMarker = null;

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    function actualizarInputs(lat, lng) {
        var latInput = document.getElementById("input-latitude");
        var lngInput = document.getElementById("input-longitude");

        latInput.value = lat.toFixed(8);
        lngInput.value = lng.toFixed(8);
    }

    function obtenerUbicacionInicial() {
        var latInput = document.getElementById("input-latitude");
        var lngInput = document.getElementById("input-longitude");

        var lat = parseFloat(latInput.value);
        var lng = parseFloat(lngInput.value);

        if (!isNaN(lat) && !isNaN(lng)) {
            map.setView([lat, lng], 13);

            if (lastMarker !== null) {
                lastMarker.remove();
            }

            var marker = L.marker([lat, lng]).addTo(map);
            lastMarker = marker;
        }
    }

    obtenerUbicacionInicial();

    function onMapClick(e) {
        var lat = e.latlng.lat;
        var lng = e.latlng.lng;
    
        actualizarInputs(lat, lng);
    
        if (lastMarker !== null) {
            lastMarker.remove();
        }
    
        var marker = L.marker([lat, lng]).addTo(map);
        lastMarker = marker;
    }
    

    map.on("click", onMapClick);
});
