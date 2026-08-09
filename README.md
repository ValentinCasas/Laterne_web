# Laterne Web

Sitio público y panel de administración de Laterne, construido con Express, Pug, Tailwind CSS y CSS específico por página.

## Requisitos

- Node.js 20 o superior
- MySQL 8 o superior

## Configuración local

1. Copiá `.env.example` como `.env` y completá las credenciales.
2. Importá `laterne.sql` en MySQL.
3. Instalá dependencias con `npm install`.
4. Iniciá el entorno de desarrollo con `npm run dev`.

La aplicación usa el puerto `3000` de forma predeterminada.

## Comandos

- `npm run dev`: compila Tailwind e inicia el servidor con recarga automática.
- `npm run build`: genera el CSS de producción y valida todas las vistas.
- `npm run check:views`: compila las plantillas y renderiza casos de prueba.
- `npm start`: inicia el servidor sin recompilar assets.

## Estructura

```text
src/
  controllers/    Controladores HTTP
  libs/           Utilidades internas
  middlewares/    Autenticación y autorización
  models/         Modelos y asociaciones Sequelize
  routes/         Definición de endpoints
  styles/         Entrada de Tailwind
public/
  css/            CSS compilado, componentes y estilos por página
  images/         Imágenes públicas y archivos subidos
  js/             JavaScript del sitio y del panel
views/
  layouts/        Documentos base
  mixins/         Componentes Pug reutilizables
  pages/          Vistas renderizadas por Express
  partials/       Fragmentos compartidos
scripts/          Validaciones y tareas del proyecto
```

Las vistas usan Pug como único motor. Tailwind se compila localmente; no se carga Bootstrap, Tailwind CDN ni librerías de componentes superpuestas.
