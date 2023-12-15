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
    const isSelectAll = btnSelectProducts.innerHTML === "Seleccionar Todo";

    checkboxes.forEach(function (cbx) {
      cbx.checked = isSelectAll;
    });

    btnSelectProducts.innerHTML = isSelectAll ? "Deseleccionar Todo" : "Seleccionar Todo";
  });

});