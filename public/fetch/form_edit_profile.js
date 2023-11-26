document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("form-update-profile");

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        // Envía el formulario usando Fetch
        try {
            const formData = new FormData(form);
            const response = await fetch("/auth/update-user", {
                method: "POST",
                body: formData,
            });

            const result = await response.json(); 

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
