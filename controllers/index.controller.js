import Event from "../models/event.model.js";
import Category from "../models/category.model.js";
import ProductCategory from "../models/productCategory.model.js";
import Testimonial from "../models/testimonial.model.js";
import Product from './../models/product.model.js';
import BusinessInfo from './../models/businessInfo.model.js';
import OpeningHour from './../models/openingHour.model.js';
import User from './../models/user.model.js';
import { fileURLToPath } from 'url';
import { v1 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';
import { Op } from "sequelize";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const goIndex = async (req, res) => {
    const events = await Event.findAll();
    const businessInfo = await BusinessInfo.findAll();
    const testimonials = await Testimonial.findAll({ where: { state: 1 } });
    const openingHours = await OpeningHour.findAll();

    const groupedOpeningHours = {};
    openingHours.forEach((openingHour) => {
        const key = `${openingHour.morningStartTime}-${openingHour.morningEndTime}-${openingHour.eveningStartTime}-${openingHour.eveningEndTime}`;

        // Crea un array para el conjunto de horarios si aún no existe
        if (!groupedOpeningHours[key]) {
            groupedOpeningHours[key] = {
                morningStartTime: openingHour.morningStartTime,
                morningEndTime: openingHour.morningEndTime,
                eveningStartTime: openingHour.eveningStartTime,
                eveningEndTime: openingHour.eveningEndTime,
                days: [],
            };
        }

        // Comprueba si los días ya están asociados con estos horarios
        const days = openingHour.dayOfWeek.split(',').map(day => " " + day); // Dividir y eliminar espacios
        const formattedDays = days.map(day => {
            if (day.charAt(0) === ',') {
                return ', ' + day.slice(1); // Agregar espacio después de la coma
            }
            return day;
        });

        formattedDays.forEach(day => {
            const formattedDay = day.charAt(0).toUpperCase() + day.slice(1); // Capitalizar la primera letra
            if (!groupedOpeningHours[key].days.includes(formattedDay)) {
                groupedOpeningHours[key].days.push(formattedDay);
            }
        });
    });


    // Filtra para obtener solo las entradas con más de un día
    const resultArray = Object.values(groupedOpeningHours).filter(entry => entry.days.length > 1);

    console.log(groupedOpeningHours)

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
        GroupedOpeningHours: groupedOpeningHours,
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
    try {
        const productCount = await Product.count();
        const categoryCount = await Category.count();
        const userCount = await User.count();
        const testimonialCount = await Testimonial.count();
        const eventCount = await Event.count();

        res.render("home", {
            productCount,
            categoryCount,
            userCount,
            testimonialCount,
            eventCount,
        });
    } catch (error) {
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

