
import express from 'express';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import path from 'path';
import { fileURLToPath } from 'url';



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import indexRoutes from './routes/index.routes.js';
import authRoutes from './routes/auth.routes.js';
import productRoutes from './routes/product.routes.js';
import categoryRoutes from './routes/category.routes.js';
import asociationRoutes from './routes/asociation.routes.js';

const app = express();

app.set('view engine', 'jade');
app.set('views', path.join(__dirname, 'views'));

app.use(cors());
app.use(morgan('dev'));

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.static(path.join(__dirname, 'public/javascripts')));
app.use(express.static(path.join(__dirname, 'public/stylesheets')));
app.use(express.static(path.join(__dirname, 'public/svg')));

app.use(express.static(path.join(__dirname, 'public/images/banners')));
app.use(express.static(path.join(__dirname, 'public/images/image_defect')));
app.use(express.static(path.join(__dirname, 'public/images/images_product')));
app.use(express.static(path.join(__dirname, 'public/images/images_profile')));



app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(fileUpload());
app.use(cookieParser());


/* falta agregar la authorizacion a las rutas correspondientes */

app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/product', productRoutes);
app.use('/category', categoryRoutes);
app.use('/asociation', asociationRoutes);




app.use((req, res, next) => {
  res.status(404).json({ message: 'Not Found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal Server Error' });
});

export default app;
