
document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("form_edit_event");

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        try {
            const formData = new FormData(form);
            const response = await fetch("/event/update-event", {
                method: "POST",
                body: formData,
            });

            const result = await response.json();

            if (response.ok) {


                const hasDate = result.Event.date;
                const hasTime = result.Event.time;

                const eventTimeParts = hasTime ? result.Event.time.split(":") : null;
                const eventDate = hasDate ? new Date(result.Event.date) : null;
                const eventTime = hasTime ? new Date() : null;

                // Actualiza los elementos del DOM
                const eventNameElement = document.getElementById("event-name");
                const eventDescriptionElement = document.getElementById("event-description");
                const eventDateElement = document.getElementById("event-date");
                const eventTimeElement = document.getElementById("event-time");
                const eventLocationElement = document.getElementById("event-location");
                const eventImageElement = document.getElementById("event-image");

                // Actualiza el contenido con los nuevos valores
                eventNameElement.textContent = result.Event.name;
                eventDescriptionElement.textContent = result.Event.description;
                eventImageElement.src = `/${result.Event.imageUrl}`;
                eventDateElement = `${eventDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
                eventTimeElement = `${eventTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
                eventLocationElement = result.Event.location;

                // Muestra Sweet Alert en caso de éxito
                Swal.fire({
                    title: 'Éxito',
                    text: 'El evento se ha actualizado exitosamente.',
                    icon: 'success',
                    confirmButtonText: 'Aceptar'
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
                text: "Error en la solicitud: " + error.message,
            });
        }
    });
});

