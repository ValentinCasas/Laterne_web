document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  const cards = document.querySelectorAll('.card');

  searchInput?.addEventListener('input', () => {
    const searchTerm = searchInput.value.trim().toLocaleLowerCase('es');

    for (const card of cards) {
      const title = card.querySelector('h3')?.textContent.toLocaleLowerCase('es') || '';
      card.hidden = !title.includes(searchTerm);
    }
  });

  const selectButton = document.getElementById('btn-select-products');
  const productContainer = document.getElementById('container-products');

  selectButton?.addEventListener('click', () => {
    const shouldSelect = selectButton.textContent === 'Seleccionar Todo';
    const checkboxes = productContainer?.querySelectorAll('.each-product-checkbox') || [];

    for (const checkbox of checkboxes) checkbox.checked = shouldSelect;
    selectButton.textContent = shouldSelect ? 'Deseleccionar Todo' : 'Seleccionar Todo';
  });
});
