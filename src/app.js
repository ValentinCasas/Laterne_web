import express from 'express';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import session from 'express-session';
import { SECRET_KEY_SESSION } from './config.js';

import { authMiddleware } from './middlewares/authMiddleware.js';
import indexRoutes from './routes/index.routes.js';
import authRoutes from './routes/auth.routes.js';
import productRoutes from './routes/product.routes.js';
import categoryRoutes from './routes/category.routes.js';
import associationRoutes from './routes/association.routes.js';
import eventRoutes from './routes/event.routes.js';
import testimonialRoutes from './routes/testimonial.routes.js';
import businessInfoRoutes from './routes/businessInfo.routes.js';
import openingHourRoutes from './routes/openingHour.routes.js';
import userRoutes from './routes/user.routes.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable('x-powered-by');
app.set('view engine', 'pug');
app.set('views', path.join(currentDirectory, '../views'));

app.use(cors());
app.use(morgan('dev'));
app.use(express.static(path.join(currentDirectory, '../public')));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(fileUpload());
app.use(cookieParser());
app.use(session({
  secret: SECRET_KEY_SESSION,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  },
}));

app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/product', authMiddleware, productRoutes);
app.use('/category', authMiddleware, categoryRoutes);
app.use('/user', authMiddleware, userRoutes);
// Se conserva la URL histórica para no romper clientes existentes.
app.use('/asociation', authMiddleware, associationRoutes);
app.use('/event', authMiddleware, eventRoutes);
app.use('/testimonial', testimonialRoutes);
app.use('/businessInfo', businessInfoRoutes);
app.use('/openingHour', authMiddleware, openingHourRoutes);

app.use((req, res) => {
  res.status(404).render('pages/error', {
    statusCode: 404,
    title: 'Página no encontrada',
    message: 'La URL ingresada no existe.',
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('pages/error', {
    statusCode: 500,
    title: 'Error interno',
    message: 'No pudimos completar la solicitud.',
  });
});

export default app;
