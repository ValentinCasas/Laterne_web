document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-update-profile');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      const response = await fetch(form.dataset.endpoint || '/auth/update-user', {
        method: form.dataset.method || 'POST',
        body: new FormData(form),
      });
      const result = await response.json();

      await Swal.fire({
        icon: response.ok ? 'success' : 'error',
        title: response.ok ? 'Cambios guardados' : 'No se pudo actualizar',
        text: result.message || result.error || 'Ocurrió un error desconocido.',
      });
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error de conexión',
        text: 'No se pudo enviar la solicitud.',
      });
    }
  });
});
