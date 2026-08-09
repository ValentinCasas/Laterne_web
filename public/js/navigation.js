document.addEventListener('DOMContentLoaded', () => {
  for (const toggle of document.querySelectorAll('[data-menu-toggle]')) {
    const navigation = document.getElementById(toggle.getAttribute('aria-controls'));
    if (!navigation) continue;

    toggle.addEventListener('click', () => {
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!isExpanded));
      navigation.classList.toggle('hidden', isExpanded);
    });
  }
});
