
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


                let eventNameElement = document.getElementById("event-name");
                let eventDescriptionElement = document.getElementById("event-description");
                let eventDateElement = document.getElementById("event-date");
                let eventTimeElement = document.getElementById("event-time");
                let eventLocationElement = document.getElementById("event-location");
                let eventImageElement = document.getElementById("event-image");
                let card = document.getElementById(`card-${result.Event.id}`);

                let contentDiv = document.getElementById(`card-child-${result.Event.id}`);


                // Verifica si hay una imagen antes de actualizar el src
                if (result.Event.imageUrl) {
                    // Si existe, verifica si la img ya existe y actualiza el src
                    if (eventImageElement) {
                        eventImageElement.src = `/${result.Event.imageUrl}`;
                    } else {
                        // Si no existe, crea la img y establece el src
                        const imgElement = document.createElement('img');
                        imgElement.src = `/${result.Event.imageUrl}`;
                        imgElement.alt = result.Event.name;
                        imgElement.id = 'event-image';
                        imgElement.className = 'w-1/3 h-48 object-contain';

                        card.appendChild(imgElement);
                    }
                }


                // Actualiza el contenido con los nuevos valores
                if (result.Event.name) {
    
                    if (eventNameElement) {
                        eventNameElement.textContent = result.Event.name;
                    } else {
                        eventNameElement = document.createElement('h3');
                        eventNameElement.textContent = result.Event.name;
                        eventNameElement.id = 'event-name';
                        eventNameElement.className = 'text-lg font-bold mb-2';
                        contentDiv.appendChild(eventNameElement);
                    }
                }
                
                if (result.Event.description) {

                    if (eventDescriptionElement) {
                        eventDescriptionElement.textContent = result.Event.description;
                    } else {
                        eventDescriptionElement = document.createElement('p');
                        eventDescriptionElement.textContent = result.Event.description;
                        eventDescriptionElement.id = 'event-description';
                        eventDescriptionElement.className = 'text-gray-600';
                        contentDiv.appendChild(eventDescriptionElement);
                    }
                }
                
                // Verifica y actualiza eventDateElement
                if (result.Event.date) {
                    const dateObject = new Date(result.Event.date);
                    const localDateString = dateObject.toLocaleDateString('es-AR', { timeZone: 'UTC' });
                    if (eventDateElement) {
                        eventDateElement.textContent = localDateString;
                    } else {
                        eventDateElement = document.createElement('p');
                        eventDateElement.textContent = localDateString;
                        eventDateElement.id = 'event-date';
                        eventDateElement.className = 'text-gray-600';
                        contentDiv.appendChild(eventDateElement);
                    }
                }
                

                // Verifica y actualiza eventTimeElement
                if (result.Event.time) {
                    let eventTimeParts = result.Event.time.split(":");
                    let eventTime = new Date();
                    eventTime.setHours(Number(eventTimeParts[0]));
                    eventTime.setMinutes(Number(eventTimeParts[1]));
                    if (eventTimeElement) {
                        eventTimeElement.textContent = eventTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
                    } else {
                        let timeElement = document.createElement('p');
                        timeElement.textContent = eventTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
                        timeElement.id = 'event-time';
                        timeElement.className = 'text-gray-600'
                        contentDiv.appendChild(timeElement);
                    }
                }

                // Verifica y actualiza eventLocationElement
                if (result.Event.location) {
                    if (eventLocationElement) {
                        eventLocationElement.textContent = result.Event.location;
                    } else {
                        let locationElement = document.createElement('p');
                        locationElement.textContent = result.Event.location;
                        locationElement.id = 'event-location';
                        
                        locationElement.className = 'text-gray-600'
                        contentDiv.appendChild(locationElement);
                    }
                }

                
                card.appendChild(contentDiv);

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

