document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("form-openingHour");

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        // Envía el formulario usando Fetch
        try {
            const formData = new FormData(form);
            const response = await fetch("/openingHour/create-hour", {
                method: "POST",
                body: formData,
            });

            const result = await response.json();

            if (response.ok) {

                Swal.fire({
                    title: 'Éxito',
                    text: 'Los horarios se han actualizado exitosamente.',
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
                text: "Error en la solicitud: " + error,
            });
        }
    });
});


document.addEventListener("DOMContentLoaded", function () {
    document.addEventListener("click", async function (event) {
        // Verifica si el elemento clicado tiene la clase 'delete-link'
        if (event.target.classList.contains("delete-link")) {
            event.preventDefault();

            // Obtiene el ID desde el atributo data-id del elemento clicado
            const id = event.target.getAttribute("data-id");

            // Construye la URL DELETE con el ID
            const deleteUrl = `/openingHour/delete-hour/${id}`;

            // Envía la solicitud DELETE usando Fetch
            try {
                const response = await fetch(deleteUrl, {
                    method: "DELETE",
                });

                const result = await response.json();

                if (response.ok) {
                    Swal.fire({
                        title: 'Éxito',
                        text: 'El horario se ha reseteado exitosamente.',
                        icon: 'success',
                        confirmButtonText: 'Aceptar'
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
        }
    });
});
