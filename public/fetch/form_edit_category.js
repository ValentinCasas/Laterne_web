document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("form_edit_category");

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        try {
            const formData = new FormData(form);
            const response = await fetch("/category/update-category", {
                method: "POST",
                body: formData,
            });

            const result = await response.json();

            if (response.ok) {
                // Actualiza los elementos del DOM
                const categoryNameElement = document.getElementById("category-name");
                const categoryDescriptionElement = document.getElementById("category-description");
                const categoryImageElement = document.getElementById("category-image");
    

                // Actualiza el contenido con los nuevos valores
                categoryNameElement.textContent = result.Category.name;
                categoryDescriptionElement.textContent = result.Category.description;
                categoryImageElement.src = `/${result.Category.imageUrl}`;


                // Muestra Sweet Alert en caso de éxito
                Swal.fire({
                    title: 'Éxito',
                    text: 'La categoria se ha actualizado exitosamente.',
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


/* elegir imagen y ponerle el value al input hidden */
document.addEventListener("DOMContentLoaded", function () {
    var selectedImageInput = document.getElementById("selectedImage");

    document.addEventListener("click", function (event) {
        var clickedImage = event.target.closest(".selectable-image");

        if (clickedImage) {
            var imageName = clickedImage.getAttribute("data-name");

            // Quita la clase 'selected' de todas las imágenes seleccionables
            document.querySelectorAll(".selectable-image").forEach(function (image) {
                image.classList.remove("selected");
            });

            // Agrega la clase 'selected' a la imagen clicada
            clickedImage.classList.add("selected");

            // Actualiza el valor del input oculto con el nombre de la imagen seleccionada
            selectedImageInput.value = imageName;
        }
    });
});

