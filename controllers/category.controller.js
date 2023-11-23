import Category from "../models/category.model.js";
import ProductCategory from "../models/productCategory.model.js";
import { fileURLToPath } from 'url';

export const createCategory = async (req, res) => {
    try {
        const { name, description, imageUrl } = req.body;

        const categoryExists = await Category.findOne({ where: { name } });

        if (categoryExists) {
            return res.status(400).json({ error: 'La categoria ya existe' });
        }

        const newCategory = await Category.create({
            name,
            description,
            imageUrl,
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
    const { id } = req.params;
    const { name, description, imageUrl } = req.body;

    try {
        const category = await Category.findByPk(id);

        if (!category) {
            return res.status(404).json({ message: 'Categoria no encontrada' });
        }

        category.name = name || category.name;
        category.description = description || category.description;
        category.imageUrl = imageUrl || category.imageUrl;


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
