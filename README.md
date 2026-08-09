# Laterne Web

Aplicación moderna de Laterne construida con Next.js, React, TypeScript, Tailwind CSS y Prisma. Conserva la base de datos MySQL del sistema original.

## Stack

- Next.js 16 con App Router y React Server Components
- React 19 y TypeScript estricto
- Tailwind CSS 4
- Prisma ORM 6 con MySQL
- Zod para validación
- JWT firmado en una cookie `httpOnly` para autenticación
- ESLint para calidad de código

## Requisitos

- Node.js 20.9 o superior
- MySQL 8 o MariaDB compatible

## Configuración local

1. Importá `laterne.sql` en una base MySQL llamada `laterne`.
2. Copiá `.env.example` como `.env`.
3. Ajustá `DATABASE_URL` y generá un valor seguro para `AUTH_SECRET`.
4. Ejecutá `npm install`.
5. Ejecutá `npm run dev`.

## Comandos

- `npm run dev`: inicia el entorno de desarrollo.
- `npm run build`: genera Prisma y compila para producción.
- `npm start`: inicia la compilación de producción.
- `npm run typecheck`: valida todos los tipos.
- `npm run lint`: ejecuta ESLint.
- `npm run db:pull`: sincroniza el esquema Prisma desde MySQL.
- `npm run db:studio`: abre el administrador visual de Prisma.

## Estructura

```text
app/          Páginas, layouts y endpoints de Next.js
components/   Componentes React reutilizables
lib/          Prisma, autenticación y utilidades
prisma/       Esquema tipado de la base MySQL
public/       Imágenes y recursos estáticos
```

## Migración

La versión 2 elimina Express, Pug, Sequelize, Bootstrap, jQuery y el JavaScript imperativo anterior. La interfaz pública y el panel administrativo ahora forman una única aplicación React. Los modelos Prisma usan `@@map` y `@map` para mantener los nombres de tablas y columnas de la base MySQL existente, incluida la columna histórica `availavility`.
