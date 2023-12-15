document.addEventListener('DOMContentLoaded', function () {
  var searchInput = document.getElementById('search-input');

  searchInput.addEventListener('input', function () {
    var searchTerm = this.value.toLowerCase();
    var cards = document.querySelectorAll('.card');

    cards.forEach(function (card) {
      var productName = card.querySelector('h3').textContent.toLowerCase();

      if (productName.includes(searchTerm)) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  });


  const btnSelectProducts = document.getElementById("btn-select-products");
  
  btnSelectProducts.addEventListener("click", function () {
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
 
      checkboxes.forEach(function (cbx) {
          cbx.checked = !cbx.checked;
      });
  
      const allChecked = Array.from(checkboxes).every((checkbox) => checkbox.checked);
      btnSelectProducts.innerHTML = allChecked ? "Deseleccionar Todo" : "Seleccionar Todo";
  });
  
});