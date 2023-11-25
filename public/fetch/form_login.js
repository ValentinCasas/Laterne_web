document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("form_login"); 
  
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
  
      // Envía el formulario usando Fetch
      try {
        const formData = new FormData(form);
        const response = await fetch("/auth/login", {
          method: "POST",
          body: formData,
        });
  
        if (response.ok) {
          // Si la respuesta es exitosa, redirige a "/home"
          window.location.href = "/home";
        } else if (response.status === 302) {
          // Si es una redirección, intenta extraer la URL de redirección
          const redirectUrl = response.headers.get("Location");
          if (redirectUrl) {
            window.location.href = redirectUrl;
          } else {
            console.error("La redirección no tiene una URL válida");
          }
        } else {
          // Si la respuesta no es exitosa y no es una redirección, muestra un SweetAlert con el mensaje del servidor
          const result = await response.json();
          Swal.fire({
            icon: "error",
            title: "Error",
            text: result.message || "Error desconocido",
          });
        }
      } catch (error) {
        // Si hay un error en la solicitud, muestra un SweetAlert con el mensaje de error
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Error en la solicitud",
        });
      }
    });
});
