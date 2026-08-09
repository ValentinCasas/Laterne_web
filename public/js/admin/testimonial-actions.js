document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form_testimonial');
  const modal = document.getElementById('myModal');
  const idField = document.getElementById('modal-id');
  const descriptionField = document.getElementById('modal-description');
  const stateField = document.getElementById('modal-state');
  const closeButton = document.getElementById('closeModalButton');

  if (!form || !modal || !idField || !descriptionField || !stateField || !closeButton) return;

  const closeModal = () => modal.classList.add('hidden');

  document.addEventListener('click', (event) => {
    const editButton = event.target.closest('[data-edit-testimonial]');
    const deleteButton = event.target.closest('[data-delete-testimonial]');

    if (editButton) {
      idField.value = editButton.dataset.id;
      descriptionField.value = editButton.dataset.description || '';
      stateField.checked = editButton.dataset.state === '1' || editButton.dataset.state === 'true';
      modal.classList.remove('hidden');
    }

    if (deleteButton) deleteTestimonial(deleteButton.dataset.deleteTestimonial);
  });

  closeButton.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      const response = await fetch('/testimonial/update-testimonial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: idField.value,
          description: descriptionField.value,
          state: stateField.checked,
        }),
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'No se pudo actualizar la opinión.');

      const id = idField.value;
      const description = document.getElementById(`description-${id}`);
      const status = document.getElementById(`task_owner-${id}`);

      if (description) description.textContent = result.Testimonial.description;
      if (status) {
        const isAccepted = Boolean(result.Testimonial.state);
        status.classList.toggle('is-accepted', isAccepted);
        status.classList.toggle('is-pending', !isAccepted);
        status.setAttribute('aria-label', isAccepted ? 'Aceptada' : 'En espera');
      }

      closeModal();
      await Swal.fire({ icon: 'success', title: 'Opinión actualizada' });
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
  });
});

const deleteTestimonial = async (testimonialId) => {
  const confirmation = await Swal.fire({
    title: '¿Eliminar esta opinión?',
    text: 'Esta acción no se puede deshacer.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#dc2626',
  });

  if (!confirmation.isConfirmed) return;

  try {
    const response = await fetch(`/testimonial/delete-testimonial/${testimonialId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('No se pudo eliminar la opinión.');

    document.getElementById(`testimonial-${testimonialId}`)?.remove();
    await Swal.fire({ icon: 'success', title: 'Opinión eliminada' });
  } catch (error) {
    await Swal.fire({ icon: 'error', title: 'Error', text: error.message });
  }
};
