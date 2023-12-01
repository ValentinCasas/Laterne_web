document.addEventListener('DOMContentLoaded', function() {
    var searchInput = document.getElementById('search-input');

    searchInput.addEventListener('input', function() {
      var searchTerm = this.value.toLowerCase();
      var cards = document.querySelectorAll('.card');

      cards.forEach(function(card) {
        var productName = card.querySelector('h3').textContent.toLowerCase();

        if (productName.includes(searchTerm)) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });