


document.addEventListener('DOMContentLoaded', (event) => {

  var dragSrcEl = null;

  function handleDragStart(e) {
    this.style.opacity = '0.1';
    this.style.border = '3px dashed #c4cad3';

    dragSrcEl = this;

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
  }

  function handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }

    e.dataTransfer.dropEffect = 'move';

    return false;
  }

  function handleDragEnter(e) {
    this.classList.add('task-hover');
  }

  function handleDragLeave(e) {
    this.classList.remove('task-hover');
  }

  function handleDrop(e) {
    if (e.stopPropagation) {
      e.stopPropagation(); // stops the browser from redirecting.
    }

    if (dragSrcEl != this) {
      dragSrcEl.innerHTML = this.innerHTML;
      this.innerHTML = e.dataTransfer.getData('text/html');
    }

    return false;
  }

  function handleDragEnd(e) {
    this.style.opacity = '1';
    this.style.border = 0;

    items.forEach(function (item) {
      item.classList.remove('task-hover');
    });
  }


  let items = document.querySelectorAll('.task');
  items.forEach(function (item) {
    item.addEventListener('dragstart', handleDragStart, false);
    item.addEventListener('dragenter', handleDragEnter, false);
    item.addEventListener('dragover', handleDragOver, false);
    item.addEventListener('dragleave', handleDragLeave, false);
    item.addEventListener('drop', handleDrop, false);
    item.addEventListener('dragend', handleDragEnd, false);
  });
});


// ================== BUSCADOR ==================
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('search-feedback');
  if (!input) return;

  const $$cards = () => Array.from(document.querySelectorAll('.task'));

  // Normaliza para búsquedas sin tildes y case-insensitive
  const norm = (s) =>
    (s || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const textOf = (card) => {
    const desc = card.querySelector('[id^="description-"]')?.textContent || '';
    const date = card.querySelector('time')?.textContent || '';
    return norm(`${desc} ${date}`);
  };

  // Cache simple para no recalcular todo cada tecla
  const cache = new Map();
  const rebuildCache = () => {
    cache.clear();
    $$cards().forEach((c) => cache.set(c, textOf(c)));
  };
  rebuildCache();

  const applyFilter = () => {
    const q = norm(input.value.trim());
    // Por si cambiaron tarjetas (eliminaste/aceptaste/moviste)
    if (cache.size !== $$cards().length) rebuildCache();

    $$cards().forEach((card) => {
      const hay = (cache.get(card) ?? textOf(card)).includes(q);
      card.style.display = q === '' ? '' : (hay ? '' : 'none');
    });
  };

  input.addEventListener('input', applyFilter);

  // Si el DOM cambia (agregar/quitar/mover tarjetas), refrescamos el cache
  const root = document.querySelector('.app') || document.body;
  const mo = new MutationObserver(rebuildCache);
  mo.observe(root, { subtree: true, childList: true, characterData: false });
});



