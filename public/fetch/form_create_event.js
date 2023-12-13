
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


                const dateObject = new Date(result.Event.date);
                const localDateString = dateObject.toLocaleDateString('es-AR', { timeZone: 'UTC' });


                let eventTime = result.Event.time;

                if (typeof eventTime === 'string') {
                    // Divide la cadena de tiempo en horas y minutos
                    let [hour, minute] = eventTime.split(':');

                    // Crea una nueva fecha
                    let date = new Date();
                    date.setHours(parseInt(hour), parseInt(minute));

                    eventTime = date;
                }

                let formatter = new Intl.DateTimeFormat('es-AR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                    timeZone: 'America/Argentina/Buenos_Aires'
                });

                const time = formatter.format(eventTime);



                // Crear la tarjeta y agregarla al contenedor
                const cardHTML = `
  <div class="card relative overflow-hidden my-4 flex border bg-white shadow-xl rounded-3xl" id="card-${result.Event.id}">
 
    ${result.Event.imageUrl ? `<img src="/${result.Event.imageUrl}" alt="${result.Event.name}" class="w-1/3  h-40 mb-10 object-contain mr-2 rounded-l-t-lg">` : ''}
    <div class="flex flex-col justify-between w-full">
      <div>
        <h3 class="text-lg font-bold my-2">${result.Event.name}</h3>
        <p class="text-gray-600">${result.Event.description}</p>
        ${result.Event.date ? `<p class="text-gray-600">${localDateString}</p>` : ''}
        ${result.Event.time ? `<p class="text-gray-600">${time}</p>` : ''}
        <p class="text-gray-600">${result.Event.location}</p>
      </div>
      <div class="flex items-center justify-end mt-4">
        <a href="/event/view-edit-event/${result.Event.id}" class="w-1/2 absolute bottom-0 left-0 bg-gray-100 text-center hover:bg-gray-500  text-gray-500 hover:text-gray-100 transition-all font-bold py-2 px-2  focus:outline-none focus:shadow-outline">
          Editar
        </a>
        <a href="/event/delete-event/${result.Event.id}" data-event-id="${result.Event.id}" class="delete-event w-1/2 absolute text-center bottom-0 right-0 bg-gray-400 text-gray-700 hover:bg-gray-700 hover:text-gray-400 font-bold py-2 px-2 transition-all  focus:outline-none focus:shadow-outline">
          Eliminar
        </a>
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
