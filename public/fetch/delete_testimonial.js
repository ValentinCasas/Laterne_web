function deleteTestimonial(event, idTestimonial) {
    event.preventDefault();

    const url = `/testimonial/delete-testimonial/${idTestimonial}`;

    Swal.fire({
        title: "¿Estás seguro?",
        text: "Esta acción eliminará el feedback",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Eliminar",
        cancelButtonText: "Cancelar",
        reverseButtons: true,
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const response = await fetch(url, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    Swal.fire({
                        icon: 'success',
                        title: '¡Éxito!',
                        text: 'El feedback ha sido eliminado',
                        timer: 3000,
                        timerProgressBar: true
                    }).then(() => {
                        // Eliminar la card del testimonial del DOM
                        const cardId = `#testimonial-${idTestimonial}`;
                        const cardElement = document.querySelector(cardId);
                        if (cardElement) {
                            cardElement.remove();
                        }
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'No se pudo eliminar el feedback'
                    });
                }
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Ocurrió un error al eliminar el feedback' + error.message
                });
            }
        }
    });
}



document.getElementById('form_testimonial').addEventListener('submit', async function (event) {
    event.preventDefault();

    var description = modalDescriptionField.value;
    var state = modalStateCheckbox.checked;
    var id = modalIdField.value;

    try {
        const response = await fetch('/testimonial/update-testimonial', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id, description, state }),
        });

        const result = await response.json();

        if (response.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Éxito',
                text: 'Feedback actualizado',
                timer: 3000,
                timerProgressBar: true
            });

            // Obtener el estado actualizado del testimonio
            const updatedState = result.Testimonial.state;

            // Cambiar el color del span según el estado
            var successSpan = document.getElementById(`task_owner-${id}`);
            var errorSpan = document.getElementById(`task_owner-${id}`);

            var description = document.getElementById(`description-${id}`);

            description.innerHTML  = result.Testimonial.description;

            if (updatedState) {
                successSpan.classList.add('bg-success');
                errorSpan.classList.remove('bg-danger');
            } else {
                successSpan.classList.remove('bg-success');
                errorSpan.classList.add('bg-danger');
            }

        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo actualizar el feedback'
            });
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al actualizar el feedback: ' + error.message
        });
    }
});





var modal = document.getElementById('myModal');
var modalIdField = document.getElementById('modal-id');
var modalDescriptionField = document.getElementById('modal-description');
var modalStateCheckbox = document.getElementById('modal-state');


function openModal(id, description, state) {

    modalIdField.value = id;
    modalDescriptionField.value = description;
    modalStateCheckbox.checked = state;


    modal.classList.remove('hidden');
}


var closeModalButton = document.getElementById('closeModalButton');
closeModalButton.addEventListener('click', function () {

    modal.classList.add('hidden');
});
