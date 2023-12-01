import Event from "../models/event.model.js";
import Category from "../models/category.model.js";
import ProductCategory from "../models/productCategory.model.js";
import Testimonial from "../models/testimonial.model.js";
import Product from './../models/product.model.js';
import BusinessInfo from './../models/businessInfo.model.js';
import { fileURLToPath } from 'url';
import { v1 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const goIndex = async (req, res) => {
    const events = await Event.findAll();
    const businessInfo = await BusinessInfo.findAll();
    const testimonials = await Testimonial.findAll({where:{state:1}});

    // Carpeta de imágenes
    const imagesFolder = path.join(__dirname, '../public/images/avatars_defect');

    const imageFiles = fs.readdirSync(imagesFolder);

    const imagesUrls = imageFiles.map(imageFile => {
        return `${imageFile}`;
    });

    res.render("index", {
        Events: events,
        BusinessInfo: businessInfo[0],
        ImagesUrls: imagesUrls,
        Testimonials: testimonials
    });
};

export const goCardVirtual = async (req, res) => {
    try {
        const products = await Product.findAll();
        const categories = await Category.findAll();
        const productCategories = await ProductCategory.findAll();

        // Agrupar los productos por categoría en el controlador
        const groupedProducts = categories.map(category => {
            return {
                category: category,
                products: products.filter(product => {
                    const productCategory = productCategories.find(pc => pc.productId === product.id && pc.categoryId === category.id);
                    return productCategory !== undefined;
                })
            };
        });

        // Filtrar las categorías que tienen al menos un producto
        const filteredGroupedProducts = groupedProducts.filter(group => group.products.length > 0);

        res.render("card_virtual", { GroupedProducts: filteredGroupedProducts });
    } catch (error) {
        console.error("Error al obtener datos:", error);
        res.status(500).send("Error interno del servidor");
    }
};


export const goHome = async (req, res) => {
    res.render("home");
}
