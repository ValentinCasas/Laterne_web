
/* crear producto */
document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("form_product");

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        // Envía el formulario usando Fetch
        try {
            const formData = new FormData(form);
            const response = await fetch("/product/create-product", {
                method: "POST",
                body: formData,
            });

            const result = await response.json();

            if (response.ok) {


                // Crear la tarjeta y agregarla al contenedor
                const cardHTML = `
                <div class="card relative bg-white rounded-lg overflow-hidden shadow-2xl m-4 flex border" id="card-${result.Product.id}">

                <a href="/product/delete-product/${result.Product.id}" data-product-id="${result.Product.id}" class="delete-product absolute top-0 right-0 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
                Eliminar
              </a>
              

                <img src="/${result.Product.imageUrl}" alt="${result.Product.name}" class="w-1/3 h-48 object-contain">
                <div class="w-1/2 p-4">
                    <h3 class="text-lg font-bold mb-2">${result.Product.name}</h3>
                    <p class="text-gray-600">${result.Product.description}</p>
                    <p class="text-gray-600">${result.Product.availavility}</p>
                    <p class="text-gray-600">$ ${result.Product.price}</p>

                    <p class="text-gray-600">${result.NameCategory.name}</p>

                    <div class="flex items-center justify-between mt-4">
                    <a href="/product/view-edit-product/${result.Product.id}" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">Editar</a>
                    
                    </div>

                </div>
            </div>
            
                `;

                const container = document.getElementById("container-products");
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

    if (target.tagName === "A" && target.getAttribute("data-product-id")) {
        event.preventDefault();
        const productId = target.getAttribute("data-product-id");

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
                const response = await fetch(`/product/delete-product/${productId}`, {
                    method: 'DELETE',
                });

                if (response.ok) {
                    const card = document.getElementById(`card-${productId}`);
                    card.remove();
                    Swal.fire({
                        icon: "success",
                        title: "Eliminado",
                        text: "Producto eliminado exitosamente",
                    });
                } else {
                    const result = await response.json();
                    console.error(result.message || 'Error desconocido al eliminar el producto');
                }
            } catch (error) {
                console.error('Error en la solicitud:', error);
            }
        }
    }
});
