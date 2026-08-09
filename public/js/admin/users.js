const profileImageUrl = (user) => user.imageUrl === 'avatar_profile_default.png'
  ? '/images/image_defect/avatar_profile_default.png'
  : `/images/images_profile/${encodeURIComponent(user.imageUrl)}`;

const createUserCard = (user) => {
  const item = document.createElement('li');
  item.id = `card-${user.id}`;
  item.className = 'panel overflow-hidden p-0';

  const image = document.createElement('img');
  image.className = 'h-72 w-full object-cover';
  image.src = profileImageUrl(user);
  image.alt = `Foto de ${user.name}`;

  const content = document.createElement('div');
  content.className = 'p-5';

  const name = document.createElement('h3');
  name.className = 'text-lg font-bold';
  name.textContent = user.name;

  const role = document.createElement('p');
  role.className = 'mt-1 text-sm text-gray-500';
  role.textContent = Number(user.role) === 1 ? 'Administrador' : 'Empleado';

  const actions = document.createElement('div');
  actions.className = 'mt-5 flex items-center justify-between gap-3';

  const editLink = document.createElement('a');
  editLink.className = 'button-secondary';
  editLink.href = `/user/view-edit-users/${user.id}`;
  editLink.textContent = 'Editar';

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'delete-user button-danger';
  deleteButton.dataset.userId = user.id;
  deleteButton.textContent = 'Eliminar';

  actions.append(editLink, deleteButton);
  content.append(name, role, actions);
  item.append(image, content);
  return item;
};

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form_user');
  const container = document.getElementById('container-users');
  if (!form || !container) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      const response = await fetch('/auth/register', { method: 'POST', body: new FormData(form) });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || result.message || 'No se pudo crear el usuario.');

      container.append(createUserCard(result.User));
      form.reset();
      await Swal.fire({ icon: 'success', title: 'Usuario creado' });
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
  });
});

document.addEventListener('click', async (event) => {
  const deleteButton = event.target.closest('[data-user-id]');
  if (!deleteButton) return;

  const userId = deleteButton.dataset.userId;
  const confirmation = await Swal.fire({
    icon: 'warning',
    title: '¿Eliminar este usuario?',
    text: 'Esta acción no se puede deshacer.',
    showCancelButton: true,
    confirmButtonText: 'Eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#dc2626',
  });

  if (!confirmation.isConfirmed) return;

  try {
    const response = await fetch(`/auth/delete-user/${userId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('No se pudo eliminar el usuario.');

    document.getElementById(`card-${userId}`)?.remove();
    await Swal.fire({ icon: 'success', title: 'Usuario eliminado' });
  } catch (error) {
    await Swal.fire({ icon: 'error', title: 'Error', text: error.message });
  }
});
