

/* crear producto */
document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("form_event");

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        // Envía el formulario usando Fetch
        try {
            const formData = new FormData(form);
            const response = await fetch("/event/create-event", {
                method: "POST",
                body: formData,
            });

            const result = await response.json();

            if (response.ok) {
                // Validar la existencia de result.Event.date y result.Event.time
                const hasDate = result.Event.date;
                const hasTime = result.Event.time;

                const eventTimeParts = hasTime ? result.Event.time.split(":") : null;
                const eventDate = hasDate ? new Date(result.Event.date) : null;
                const eventTime = hasTime ? new Date() : null;

                // Si no hay fecha o no hay hora, imprimir un mensaje en la consola
                if (!hasDate || !hasTime) {
                    console.warn('La fecha o la hora del evento no están disponibles.');
                }

                // Crear la tarjeta y agregarla al contenedor
                const cardHTML = `
                    <div class="card relative bg-white rounded-lg overflow-hidden shadow-2xl m-4 flex border" id="card-${result.Event.id}">
                        <a href="/event/delete-event/${result.Event.id}" data-event-id="${result.Event.id}" class="delete-event absolute top-0 right-0 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
                            Eliminar
                        </a>
                        ${result.Event.imageUrl ? `<img src="/${result.Event.imageUrl}" alt="${result.Event.name}" class="w-1/3 h-48 object-contain">` : ''}
                        <div class="w-1/2 p-4">
                            <h3 class="text-lg font-bold mb-2">${result.Event.name}</h3>
                            <p class="text-gray-600">${result.Event.description}</p>
                            ${hasDate ? `<p class="text-gray-600">${eventDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>` : ''}
                            ${hasTime ? `<p class="text-gray-600">${eventTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>` : ''}
                            <p class="text-gray-600">${result.Event.location}</p>
                            <div class="flex items-center justify-between mt-4">
                                <a href="/event/view-edit-event/${result.Event.id}" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">Editar</a>
                            </div>
                        </div>
                    </div>`;

                const container = document.getElementById("container-events");
                container.insertAdjacentHTML('beforeend', cardHTML);
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
                text: "Error en la solicitud: " + error,
            });
        }
    });
});



/* eliminar producto */

document.addEventListener("click", async function (event) {
    const target = event.target;

    if (target.tagName === "A" && target.getAttribute("data-event-id")) {
        event.preventDefault();
        const eventId = target.getAttribute("data-event-id");

        // Preguntar al usuario si realmente quiere eliminar el producto
        const isConfirmed = await Swal.fire({
            icon: 'warning',
            title: '¿Estás seguro?',
            text: 'Esta acción no se puede deshacer',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, eliminarlo'
        });

        if (isConfirmed.value) {
            try {
                const response = await fetch(`/event/delete-event/${eventId}`, {
                    method: 'DELETE',
                });

                if (response.ok) {
                    const card = document.getElementById(`card-${eventId}`);
                    card.remove();
                    Swal.fire({
                        icon: "success",
                        title: "Eliminado",
                        text: "Evento eliminado exitosamente",
                    });
                } else {
                    const result = await response.json();
                    console.error(result.message || 'Error desconocido al eliminar el evento');
                }
            } catch (error) {
                console.error('Error en la solicitud:', error);
            }
        }
    }
});
