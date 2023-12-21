let carrito = [];
let carritoMap = {};  // Nuevo objeto para rastrear la cantidad de cada producto

function agregarAlCarrito(product) {
    if (carritoMap[product.id]) {
        // Si el producto ya está en el carrito, incrementar la cantidad
        carritoMap[product.id].cantidad += 1;
    } else {
        // Si el producto no está en el carrito, agregarlo con cantidad 1
        carritoMap[product.id] = { ...product, cantidad: 1 };
        carrito.push(carritoMap[product.id]);
    }

    // Actualizar el contador del carrito
    actualizarContadorCarrito();

    // Actualizar la visualización del carrito
    actualizarCarrito();
}

function actualizarCarrito() {
    const contadorCarrito = document.getElementById('cantidad-productos');
    const modalCarrito = document.getElementById('modal-carrito');
    const listaProductos = document.querySelector('.item-carrito');
    const precioTotal = document.querySelector('.precio-total');

    // Limpiar la lista de productos en el carrito
    listaProductos.innerHTML = '';

    // Iterar sobre los productos en el carrito
    carrito.forEach(producto => {
        // Crear el contenedor de la tarjeta del producto
        const tarjetaProducto = document.createElement('div');
        tarjetaProducto.classList.add('producto-carrito');

        // Crear la imagen del producto
        const imagenProducto = document.createElement('img');
        imagenProducto.src = producto.imageUrl;
        imagenProducto.alt = producto.name;

        // Crear el contenedor de información (nombre, precio, cantidad y botón de eliminación)
        const infoProducto = document.createElement('div');
        infoProducto.classList.add('info-producto');

        // Crear el nombre del producto
        const nombreProducto = document.createElement('h4');
        nombreProducto.textContent = producto.name;

        // Crear el precio y cantidad del producto
        const precioCantidadProducto = document.createElement('p');
        precioCantidadProducto.textContent = `Precio: $${producto.price} | Cantidad: ${producto.cantidad}`;

        // Crear el botón de eliminación
        const botonEliminar = document.createElement('button');
        botonEliminar.textContent = 'Eliminar';
        botonEliminar.id = `eliminar-${producto.id}`; // Puedes personalizar el ID según tus necesidades
        botonEliminar.classList.add('boton-eliminar'); // Clase para aplicar estilos comunes
        botonEliminar.addEventListener('click', () => eliminarProducto(producto.id));


        // Agregar la imagen, nombre, precio y botón al contenedor de información
        infoProducto.appendChild(nombreProducto);
        infoProducto.appendChild(precioCantidadProducto);
        infoProducto.appendChild(botonEliminar);

        // Agregar la imagen y la información al contenedor de la tarjeta del producto
        tarjetaProducto.appendChild(imagenProducto);
        tarjetaProducto.appendChild(infoProducto);

        // Agregar la tarjeta del producto a la lista
        listaProductos.appendChild(tarjetaProducto);
    });

    // Actualizar el contador del carrito
    const cantidadTotal = carrito.reduce((total, producto) => total + producto.cantidad, 0);

    contadorCarrito.textContent = cantidadTotal;

    if (cantidadTotal > 0) {
        contadorCarrito.style.display = 'block';
    }else{
        contadorCarrito.style.display = 'none';
    }

    // Calcular y mostrar el precio total
    const total = carrito.reduce((total, producto) => {
        const precioNumerico = Number(producto.price);
        const cantidad = producto.cantidad;

        if (!isNaN(precioNumerico) && !isNaN(cantidad)) {
            return total + precioNumerico * cantidad;
        } else {
            return total;
        }
    }, 0);

    if (!isNaN(total)) {
        precioTotal.textContent = `TOTAL - $${total.toFixed(2)}`;
    } else {
        precioTotal.textContent = 'Precio Total: Error';
    }
}

function eliminarProducto(productoId) {
    // Buscar el producto en el carrito
    const productoEnCarrito = carritoMap[productoId];

    if (productoEnCarrito) {
        // Si la cantidad es mayor a 1, disminuir la cantidad
        if (productoEnCarrito.cantidad > 1) {
            productoEnCarrito.cantidad -= 1;
        } else {
            // Si la cantidad es 1 o menos, eliminar el producto del carrito
            delete carritoMap[productoId];
            carrito = carrito.filter(producto => producto.id !== productoId);
        }

        // Actualizar la visualización del carrito después de la eliminación
        actualizarCarrito();
    }
}


function abrirModalCarrito() {
    // Verificar si hay productos en el carrito antes de abrir el modal

    const modalCarrito = document.getElementById('modal-carrito');
    modalCarrito.classList.remove('hidden');

}


function cerrarModalCarrito() {
    const modalCarrito = document.getElementById('modal-carrito');
    modalCarrito.classList.add('hidden');
}

function actualizarContadorCarrito() {
    const contadorCarrito = document.getElementById('cantidad-productos');
    const cantidadTotal = carrito.reduce((total, producto) => total + producto.cantidad, 0);
    contadorCarrito.textContent = cantidadTotal;
}