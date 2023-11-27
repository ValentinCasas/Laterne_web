document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("form_edit_product");

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        try {
            const formData = new FormData(form);
            const response = await fetch("/product/update-product", {
                method: "POST",
                body: formData,
            });

            const result = await response.json();

            if (response.ok) {
                // Actualiza los elementos del DOM
                const productNameElement = document.getElementById("product-name");
                const productDescriptionElement = document.getElementById("product-description");
                const productPriceElement = document.getElementById("product-price");
                const productAvailavilityElement = document.getElementById("product-availavility");
                const productImageElement = document.getElementById("product-image");
                const productCategoriesElement = document.getElementById("product-categories");

                // Actualiza el contenido con los nuevos valores
                productNameElement.textContent = result.Product.name;
                productDescriptionElement.textContent = result.Product.description;
                productPriceElement.textContent = `$ ${result.Product.price}`;
                productAvailavilityElement.textContent = result.Product.availavility;
                productImageElement.src = `/${result.Product.imageUrl}`;

                // Actualiza las categorías
                const categoriesHTML = Array.isArray(result.ProductCategory)
                    ? result.ProductCategory.map(pc => `<div class="mr-4 mb-2 p-2 bg-gray-200 rounded-md"><span class="text-blue-500 font-semibold">${pc.Category.name}</span></div>`).join('')
                    : '';

                productCategoriesElement.innerHTML = categoriesHTML;


                // Muestra Sweet Alert en caso de éxito
                Swal.fire({
                    title: 'Éxito',
                    text: 'El producto se ha actualizado exitosamente.',
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
