import Category from "../models/category.model.js";
import Product from "../models/product.model.js";
import ProductCategory from "../models/productCategory.model.js";


export const getProductCategoryByProduct = async (req, res) => {
    const { productId } = req.params;
    try {
        const productCategory = await ProductCategory.findAll({
            where: { productId: productId },
            include: [Product, Category] 
        });

        if (productCategory.length > 0) {
            res.status(200).json({ ProductCategory: productCategory });
        } else {
            res.status(404).json({ error: `Ninguna categoría tiene el producto enlistado` });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Error al traer los datos' });
    }
};

export const getProductCategoryByCategory = async (req, res) => {
    const { categoryId } = req.params;
    try {
        const productCategory = await ProductCategory.findAll({
            where: { categoryId: categoryId },
            include: [Product, Category] 
        });

        if (productCategory.length > 0) {
            res.status(200).json({ ProductCategory: productCategory });
        } else {
            res.status(404).json({ error: `La categoría aún no tiene ningún producto enlistado` });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Error al traer los datos' });
    }
};


export const enlistProductCategory = async (req, res) => {
    const { productId, categoryId } = req.body;
    try {
        const product = await Product.findByPk(productId);
        const category = await Category.findByPk(categoryId);
        const existRelation = await ProductCategory.findAll({
            where: { productId: productId, categoryId: categoryId }
        });

        if (existRelation.length > 0) {
            res.status(400).json({ error: `Ya se encuentra ${product.name} en ${category.name}` });
        } else {
            await ProductCategory.create({ productId, categoryId });
            res.status(201).json({ success: true, message: `Se agregó ${product.name} a ${category.name}` });
        }

    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al enlistar producto en categoría' });
    }
};

export const delistProductCategory = async (req, res) => {
    const { productId, categoryId } = req.body;
    try {
        const existRelation = await ProductCategory.findAll({
            where: { productId: productId, categoryId: categoryId }
        });

        if (existRelation.length > 0) {
            await ProductCategory.destroy({
                where: { productId: productId, categoryId: categoryId }
            });

            res.status(200).json({ success: true, message: `Se eliminó la relación entre el producto y la categoría` });
        } else {
            res.status(404).json({ success: false, error: `No existe la relación entre el producto y la categoría` });
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Error al desenlistar producto de categoría' });
    }
};
