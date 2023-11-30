
/* crear producto */
document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("form_category");

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        // Envía el formulario usando Fetch
        try {
            const formData = new FormData(form);
            const response = await fetch("/category/create-category", {
                method: "POST",
                body: formData,
            });

            const result = await response.json();

            if (response.ok) {


                const cardHTML = `
                <div class="card relative bg-white rounded-lg overflow-hidden shadow-2xl my-4 flex border" id="card-${result.Category.id}">
                    <div class="flex">
                        <img src="/${result.Category.imageUrl}" alt="${result.Category.name}" class="w-1/3 h-48 object-contain">
                        <div class="w-2/3 p-4">
                            <h3 class="text-lg font-bold mb-2">${result.Category.name}</h3>
                            <p class="text-gray-600">${result.Category.description}</p>
            
                            <div class="flex justify-between items-center mt-4">
                                <a href="/category/view-edit-category/${result.Category.id}" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
                                    Editar
                                </a>
                                <a href="/category/delete-category/${result.Category.id}" data-category-id="${result.Category.id}" class="delete-category bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
                                    Eliminar
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            


                const container = document.getElementById("container-categories");
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

    if (target.tagName === "A" && target.getAttribute("data-category-id")) {
        event.preventDefault();
        const categoryId = target.getAttribute("data-category-id");


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
                const response = await fetch(`/category/delete-category/${categoryId}`, {
                    method: 'DELETE',
                });

                if (response.ok) {
                    const card = document.getElementById(`card-${categoryId}`);
                    card.remove();
                    Swal.fire({
                        icon: "success",
                        title: "Eliminado",
                        text: "Categoria eliminada exitosamente",
                    });
                } else {
                    const result = await response.json();
                    console.error(result.message || 'Error desconocido al eliminar la categoria');
                }
            } catch (error) {
                console.error('Error en la solicitud:', error);
            }
        }
    }
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


