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
