
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
  <div class="grid grid-cols-1 card relative bg-white shadow-xl rounded-3xl overflow-hidden mb-10 flex border" id="card-${result.Product.id}">

    

    <img src="/${result.Product.imageUrl}" alt="${result.Product.name}" class="w-full h-48 object-contain rounded-t-lg">

    <div class="p-4 flex flex-col justify-between w-full">
      <div>
        <h3 class="text-lg font-bold mb-2">${result.Product.name}</h3>
        <details class="border rounded-md overflow-hidden shadow-md bg-white my-2">
          <summary class="bg-gray-200 p-4 cursor-pointer">Descripción del Producto</summary>
          <div class="p-4">
            <p class="text-gray-600">${result.Product.description}</p>
          </div>
        </details>
        <p class="text-gray-600">${result.Product.availavility}</p>
        <p class="text-gray-600 pb-10">$ ${result.Product.price}</p>
      </div>

      
        <a href="/product/view-edit-product/${result.Product.id}" class="w-1/2 absolute bottom-0 left-0 bg-gray-100 text-center hover:bg-gray-500  text-gray-500 hover:text-gray-100 transition-all font-bold py-3 px-2  focus:outline-none focus:shadow-outline">Editar</a>
        <a href="/product/delete-product/${result.Product.id}" data-product-id="${result.Product.id}" class="delete-product w-1/2 absolute text-center bottom-0 right-0  bg-gray-400 text-gray-700 hover:bg-gray-700 hover:text-gray-400 font-bold py-3 px-2 transition-all  focus:outline-none focus:shadow-outline">
        Eliminar
      </a>

    </div>
  </div>
`;


                const container = document.getElementById("container-products");
                container.insertAdjacentHTML('beforeend', cardHTML);

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


/* actualizar precio */
document.addEventListener("DOMContentLoaded", async function (event) {
    const form = document.getElementById("form-percentaje");

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const checkedProducts = document.querySelectorAll('input[type="checkbox"]:checked');
        const checkedProductsArray = Array.from(checkedProducts);

        if (checkedProductsArray.length === 0) {
            Swal.fire({
                icon: "info",
                title: "Info",
                text: "Selecciona al menos un producto para actualizar el precio.",
            });
            return;
        }

        try {
            const formData = new FormData(form);

            checkedProductsArray.forEach((checkbox) => {
                const productId = checkbox.id.split("-")[1];
                formData.append('checkedProducts', productId);
            });
            

            const response = await fetch("/product/update-prices", {
                method: "POST",
                body: formData,
            });

            const result = await response.json();

            if (response.ok) {
                // Actualizar visualmente las tarjetas
                updateCardPrices(result.updatedProducts);
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
    });


    // Función para actualizar visualmente las tarjetas con los precios actualizados
    function updateCardPrices(updatedProducts) {
        updatedProducts.forEach((updatedProduct) => {
            const cardElement = document.getElementById(`card-${updatedProduct.id}`);

            if (cardElement) {
                // Actualizar el precio en el elemento de la tarjeta
                const priceElement = cardElement.querySelector('#price-element');
                if (priceElement) {
                    priceElement.textContent = `$ ${updatedProduct.price}`;
                }
            }
        });
    }

});
