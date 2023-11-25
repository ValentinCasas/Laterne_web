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
