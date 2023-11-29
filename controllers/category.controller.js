import Category from "../models/category.model.js";
import ProductCategory from "../models/productCategory.model.js";
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export const goCategories = async (req, res) => {
    try {
        const categories = await Category.findAll();

        // Ruta a la carpeta que contiene las imágenes
        const imagesFolderPath = path.join(process.cwd(), 'public', 'images', 'images_categories');

        // Lee el contenido del directorio
        fs.readdir(imagesFolderPath, (err, files) => {
            if (err) {
                console.error('Error al leer el directorio de imágenes:', err);
                res.status(500).json({ success: false, error: 'Error al obtener imágenes' });
            } else {
                // Filtra solo los archivos de imagen (puedes ajustar según tus extensiones)
                const imageFiles = files.filter(file => /\.(png|jpg|jpeg|gif)$/i.test(file));

                // Construye la ruta completa de cada imagen
                const images = imageFiles.map(file => ({
                    name: file,
                    path: path.join('/images/images_categories', file)
                }));

                res.render("category_create", { Categories: categories, Images: images });
            }
        });
    } catch (err) {
        console.error('Error al obtener categorías:', err);
        res.status(500).json({ success: false, error: 'Error al traer categorías' });
    }
};


export const goEditCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await Category.findByPk(id);

        const imagesFolderPath = path.join(process.cwd(), 'public', 'images', 'images_categories');

        // Lee el contenido del directorio
        fs.readdir(imagesFolderPath, (err, files) => {
            if (err) {
                res.status(500).json({ success: false, error: 'Error al obtener imágenes' });
            } else {
                // Filtra solo los archivos de imagen (puedes ajustar según tus extensiones)
                const imageFiles = files.filter(file => /\.(png|jpg|jpeg|gif)$/i.test(file));

                // Construye la ruta completa de cada imagen
                const images = imageFiles.map(file => ({
                    name: file,
                    path: path.join('/images/images_categories', file)
                }));

                res.render("category_edit", { Category: category, Images: images });
            }
        });

    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al traer categoria' });
    }
}

export const createCategory = async (req, res) => {
    try {
        const { name, description, selectedImage } = req.body;

        const categoryExists = await Category.findOne({ where: { name } });

        if (categoryExists) {
            return res.status(400).json({ error: 'La categoria ya existe' });
        }

        const newCategory = await Category.create({
            name,
            description,
            imageUrl: selectedImage,
        });

        res.status(201).json({ Category: newCategory });

    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al crear categoria' });
    }
};

export const getCategories = async (req, res) => {
    try {
        const categories = await Category.findAll();

        res.status(200).json({ Categories: categories });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al traer categorias' });
    }
}

export const getCategory = async (req, res) => {
    const { id } = req.params;
    try {

        const category = await Category.findByPk(id);

        res.status(200).json({ Category: category });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al traer categoria' });
    }
}

export const deleteCategory = async (req, res) => {
    const { id } = req.params;
    try {
        const category = await Category.findByPk(id);

        if (!category) {
            return res.status(404).json({ message: 'Categoria no encontrada' });
        }

        const deleteRelation = await ProductCategory.destroy({ where: { categoryId: id } })
        await category.destroy();

        res.status(204).json({
            Category: category,
            success: true,
            message: "Categoria eliminada exitosamente"
        });
    } catch (error) {

        res.status(500).json({ error: 'Error al eliminar categoria' });
    }
};

export const updateCategory = async (req, res) => {
    const { name, description, selectedImage, id } = req.body;

    try {
        const category = await Category.findByPk(id);

        if (!category) {
            return res.status(404).json({ message: 'Categoria no encontrada' });
        }

        category.name = name || category.name;
        category.description = description || category.description;
        category.imageUrl = selectedImage || category.imageUrl;


        await category.save();

        res.status(200).json({
            Category: category,
            success: true,
            message: "Categoria actualizada exitosamente"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar categoria' });
    }
};
