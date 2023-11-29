
/* crear usuario */
document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("form_user");

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        // Envía el formulario usando Fetch
        try {
            const formData = new FormData(form);
            const response = await fetch("/auth/register", {
                method: "POST",
                body: formData,
            });

            const result = await response.json();

            if (response.ok) {


                // Crear la tarjeta y agregarla al contenedor
                const cardHTML = `
                <li id="card-${result.User.id}" class="shadow-lg space-y-4">
                    <div class="aspect-w-3 aspect-h-2">
                        <img src="${result.User.imageUrl == 'avatar_profile_default.png' ? '/avatar_profile_default.png' : '/' + result.User.imageUrl}" alt="" class="rounded-lg object-cover shadow-lg w-full h-80 border">
                    </div>
                    <div class="space-y-2 p-3">
                        <div class="space-y-1 text-lg font-medium leading-6">
                            <h3>${result.User.name}</h3>
                            <p>${result.User.role == 1 ? 'Admin' : 'Empleado'}</p>
                            <div class="flex justify-between">
                                <a href="/user/view-edit-users/${result.User.id}" class="text-indigo-600">EDITAR</a>
                                <a href="/auth/delete-user/${result.User.id}" data-user-id="${result.User.id}" class="delete-user bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">ELIMINAR</a>
                            </div>
                        </div>
                    </div>
                </li>
            `;

                const container = document.getElementById("container-users");
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


/* eliminar usuario */
document.addEventListener("click", async function (event) {
    const target = event.target;

    if (target.tagName === "A" && target.getAttribute("data-user-id")) {
        event.preventDefault();
        const usertId = target.getAttribute("data-user-id");

        // Preguntar al admin si realmente quiere eliminar el usuario
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
                const response = await fetch(`/auth/delete-user/${usertId}`, {
                    method: 'DELETE',
                });

                if (response.ok) {
                    const card = document.getElementById(`card-${usertId}`);
                    card.remove();
                    Swal.fire({
                        icon: "success",
                        title: "Eliminado",
                        text: "Usuario eliminado exitosamente",
                    });
                } else {
                    const result = await response.json();
                    console.error(result.message || 'Error desconocido al eliminar el usuario');
                }
            } catch (error) {
                console.error('Error en la solicitud:', error);
            }
        }
    }
});