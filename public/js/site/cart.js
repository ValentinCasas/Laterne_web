let carrito = [];

function formatearPrecio(valor) {
    const numero = Number(valor || 0);

    return numero.toLocaleString('es-AR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

function obtenerCarritoGuardado() {
    try {
        const guardado = localStorage.getItem('laterne_carrito');
        carrito = guardado ? JSON.parse(guardado) : [];
    } catch (error) {
        carrito = [];
    }
}

function guardarCarrito() {
    try {
        localStorage.setItem('laterne_carrito', JSON.stringify(carrito));
    } catch (error) {
        console.warn('No se pudo guardar el carrito', error);
    }
}

function agregarAlCarritoDesdeBoton(boton) {
    const producto = {
        id: boton.getAttribute('data-id'),
        name: boton.getAttribute('data-name'),
        price: Number(boton.getAttribute('data-price') || 0),
        imageUrl: boton.getAttribute('data-image'),
        description: boton.getAttribute('data-description') || '',
        quantity: 1
    };

    agregarAlCarrito(producto);
}

function agregarAlCarrito(producto) {
    const existente = carrito.find(item => String(item.id) === String(producto.id));

    if (existente) {
        existente.quantity += 1;
    } else {
        carrito.push(producto);
    }

    guardarCarrito();
    actualizarCarrito();
    animarBotonCarrito();
}

function quitarDelCarrito(id) {
    carrito = carrito.filter(item => String(item.id) !== String(id));

    guardarCarrito();
    actualizarCarrito();
}

function cambiarCantidad(id, cambio) {
    const producto = carrito.find(item => String(item.id) === String(id));

    if (!producto) {
        return;
    }

    producto.quantity += cambio;

    if (producto.quantity <= 0) {
        quitarDelCarrito(id);
        return;
    }

    guardarCarrito();
    actualizarCarrito();
}

function vaciarCarrito() {
    carrito = [];

    guardarCarrito();
    actualizarCarrito();
}

function calcularCantidadTotal() {
    return carrito.reduce((total, producto) => {
        return total + Number(producto.quantity || 1);
    }, 0);
}

function calcularPrecioTotal() {
    return carrito.reduce((total, producto) => {
        return total + Number(producto.price || 0) * Number(producto.quantity || 1);
    }, 0);
}

function actualizarCarrito() {
    const contadorCarrito = document.getElementById('cantidad-productos');
    const contenedorItems = document.getElementById('items-carrito');
    const precioTotal = document.getElementById('precio-total');

    if (contadorCarrito) {
        contadorCarrito.textContent = calcularCantidadTotal();
    }

    if (precioTotal) {
        precioTotal.textContent = `$ ${formatearPrecio(calcularPrecioTotal())}`;
    }

    if (!contenedorItems) {
        return;
    }

    contenedorItems.replaceChildren();

    if (carrito.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'cart-empty';
        emptyState.textContent = 'Todavía no agregaste productos.';
        contenedorItems.append(emptyState);
        return;
    }

    for (const producto of carrito) {
        const subtotal = Number(producto.price || 0) * Number(producto.quantity || 1);
        const item = document.createElement('div');
        item.className = 'cart-item';

        const imageBox = document.createElement('div');
        imageBox.className = 'cart-item-image';
        const image = document.createElement('img');
        image.src = producto.imageUrl;
        image.alt = `Imagen de ${producto.name}`;
        imageBox.append(image);

        const body = document.createElement('div');
        body.className = 'cart-item-body';
        const top = document.createElement('div');
        top.className = 'cart-item-top';
        const heading = document.createElement('div');
        const name = document.createElement('h3');
        name.textContent = producto.name;
        const price = document.createElement('p');
        price.className = 'cart-item-price';
        price.textContent = `$ ${formatearPrecio(producto.price)}`;
        heading.append(name, price);

        const removeButton = document.createElement('button');
        removeButton.className = 'remove-item';
        removeButton.type = 'button';
        removeButton.dataset.cartRemove = producto.id;
        removeButton.setAttribute('aria-label', `Quitar ${producto.name}`);
        removeButton.textContent = '×';
        top.append(heading, removeButton);

        const bottom = document.createElement('div');
        bottom.className = 'cart-item-bottom';
        const quantity = document.createElement('div');
        quantity.className = 'quantity-control';
        const subtractButton = document.createElement('button');
        subtractButton.type = 'button';
        subtractButton.dataset.cartQuantity = '-1';
        subtractButton.dataset.productId = producto.id;
        subtractButton.textContent = '−';
        const quantityValue = document.createElement('span');
        quantityValue.textContent = producto.quantity;
        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.dataset.cartQuantity = '1';
        addButton.dataset.productId = producto.id;
        addButton.textContent = '+';
        quantity.append(subtractButton, quantityValue, addButton);

        const subtotalElement = document.createElement('div');
        subtotalElement.className = 'cart-subtotal';
        subtotalElement.textContent = `$ ${formatearPrecio(subtotal)}`;
        bottom.append(quantity, subtotalElement);
        body.append(top, bottom);
        item.append(imageBox, body);
        contenedorItems.append(item);
    }
}

function abrirModalCarrito() {
    const modalCarrito = document.getElementById('modal-carrito');

    if (!modalCarrito) {
        return;
    }

    modalCarrito.classList.add('is-open');
    document.body.classList.add('modal-open');

    actualizarCarrito();
}

function cerrarModalCarrito() {
    const modalCarrito = document.getElementById('modal-carrito');

    if (!modalCarrito) {
        return;
    }

    modalCarrito.classList.remove('is-open');
    document.body.classList.remove('modal-open');
}

function openProductModal(imageUrl, title) {
    const modal = document.getElementById('productModal');
    const modalImage = document.getElementById('modalImage');
    const modalTitle = document.getElementById('modalTitle');

    if (!modal || !modalImage || !modalTitle) {
        return;
    }

    modalImage.src = imageUrl;
    modalTitle.textContent = title || '';

    modal.classList.add('is-open');
    document.body.classList.add('modal-open');
}

function closeProductModal() {
    const modal = document.getElementById('productModal');

    if (!modal) {
        return;
    }

    modal.classList.remove('is-open');
    document.body.classList.remove('modal-open');
}

function copiarPedido() {
    if (carrito.length === 0) {
        alert('Todavía no agregaste productos.');
        return;
    }

    const detalle = carrito.map(producto => {
        const subtotal = Number(producto.price || 0) * Number(producto.quantity || 1);
        return `${producto.quantity} x ${producto.name} - $ ${formatearPrecio(subtotal)}`;
    }).join('\n');

    const texto = `Pedido Laterne:\n\n${detalle}\n\nTotal: $ ${formatearPrecio(calcularPrecioTotal())}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto)
            .then(() => {
                alert('Pedido copiado.');
            })
            .catch(() => {
                alert(texto);
            });
    } else {
        alert(texto);
    }
}

function animarBotonCarrito() {
    const botonCarrito = document.getElementById('contador-carrito');

    if (!botonCarrito) {
        return;
    }

    botonCarrito.classList.remove('cart-badge-pulse');
    void botonCarrito.offsetWidth;
    botonCarrito.classList.add('cart-badge-pulse');
}

function inicializarSwiperCategorias() {
    if (!window.Swiper) {
        return;
    }

    new Swiper('.categorySwiper', {
        slidesPerView: 'auto',
        spaceBetween: 10,
        freeMode: true,
        grabCursor: true,
        loop: false
    });
}

document.addEventListener('DOMContentLoaded', function () {
    obtenerCarritoGuardado();
    actualizarCarrito();
    inicializarSwiperCategorias();

    document.addEventListener('click', (event) => {
        const addButton = event.target.closest('[data-add-product]');
        const previewButton = event.target.closest('[data-product-preview]');
        const quantityButton = event.target.closest('[data-cart-quantity]');
        const removeButton = event.target.closest('[data-cart-remove]');

        if (addButton) agregarAlCarritoDesdeBoton(addButton);
        if (previewButton) openProductModal(previewButton.dataset.image, previewButton.dataset.title);
        if (quantityButton) cambiarCantidad(quantityButton.dataset.productId, Number(quantityButton.dataset.cartQuantity));
        if (removeButton) quitarDelCarrito(removeButton.dataset.cartRemove);
        if (event.target.closest('[data-cart-open]')) abrirModalCarrito();
        if (event.target.closest('[data-cart-close]')) cerrarModalCarrito();
        if (event.target.closest('[data-cart-clear]')) vaciarCarrito();
        if (event.target.closest('[data-cart-copy]')) copiarPedido();
        if (event.target.closest('[data-product-modal-close]')) closeProductModal();

        if (event.target.id === 'modal-carrito') cerrarModalCarrito();
        if (event.target.id === 'productModal') closeProductModal();
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            cerrarModalCarrito();
            closeProductModal();
        }
    });
});
