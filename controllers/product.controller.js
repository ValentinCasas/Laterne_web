import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import ProductCategory from "../models/productCategory.model.js";
import { fileURLToPath } from 'url';
import { v1 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export const goProducts = async (req, res) => {
    try {
        const products = await Product.findAll();
        const categories = await Category.findAll();


        res.render("product_create", { Products: products, Categories: categories });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al traer productos' });
    }
}

export const goEditProduct = async (req, res) => {
    const { id } = req.params;
    try {
        const product = await Product.findByPk(id);
        const categories = await Category.findAll();
        const productCategory = await ProductCategory.findAll({
            where: { productId: id },
            include: [Product, Category]
        });


        res.render("product_edit", { Product: product, Categories: categories, ProductCategory: productCategory });

    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al traer producto' + error });
    }
}

export const createProduct = async (req, res) => {
    try {
        const { name, description, availavility, price, categoryId } = req.body;

        const productExists = await Product.findOne({ where: { name } });

        if (productExists) {
            return res.status(400).json({ error: 'El producto ya existe' });
        }

        let imagePath = 'product_default.png';

        if (req.files && req.files.imageFile) {
            const productImage = req.files.imageFile;
            imagePath = uuid() + path.extname(productImage.name);
            const uploadPath = path.join(__dirname, '../public/images/images_product', imagePath);

            await productImage.mv(uploadPath);
        }


        const newProduct = await Product.create({
            name,
            description,
            availavility,
            price,
            imageUrl: imagePath,
        });

        const nameCategory = await Category.findByPk(categoryId)

        if (categoryId) {
            await ProductCategory.create({
                productId: newProduct.id,
                categoryId,
            });
        }

        res.status(201).json({ Product: newProduct, NameCategory: nameCategory, message: "Producto creado exitosamente" });

    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al crear el producto' });
    }
};

export const getProducts = async (req, res) => {
    try {
        const products = await Product.findAll();

        res.status(200).json({ Products: products });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al traer productos' });
    }
}

export const getProduct = async (req, res) => {
    const { id } = req.params;
    try {

        const product = await Product.findByPk(id);

        res.status(200).json({ Product: product });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al traer producto' });
    }
}

export const deleteProduct = async (req, res) => {
    const { id } = req.params;
    try {
        const product = await Product.findByPk(id);

        if (!product) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const deleteRelation = await ProductCategory.destroy({ where: { productId: id } })
        await product.destroy();

        if (product.imageUrl !== 'product_default.png') {
            const imagePath = path.join(__dirname, '../public/images/images_product', product.imageUrl);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        res.status(204).json({
            Product: product,
            success: true,
            message: "Producto eliminado exitosamente"
        });
    } catch (error) {

        res.status(500).json({ error: 'Error al eliminar producto' });
    }
};

export const updateProduct = async (req, res) => {
    const { name, description, id, availavility, price, categoryIds } = req.body;
    var productCategory;

    console.log(categoryIds);

    // Parsear categoryIds a un array si no lo es
    const parsedCategoryIds = Array.isArray(categoryIds) ? categoryIds : [categoryIds];

    console.log(parsedCategoryIds);

    try {
        const product = await Product.findByPk(id);

        if (!product) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        // Obtener las categorías asociadas actuales
        const currentCategories = await ProductCategory.findAll({
            where: { productId: product.id },
            attributes: ['categoryId']
        });

        const currentCategoryIds = currentCategories.map(category => category.categoryId);

        // Eliminar todas las asociaciones existentes si no hay categorías nuevas para agregar
        if (!parsedCategoryIds || parsedCategoryIds.length === 0 || (parsedCategoryIds.length === 1 && parsedCategoryIds[0] === undefined)) {
            await ProductCategory.destroy({
                where: {
                    productId: product.id
                }
            });
        } else {
            // Determinar las nuevas categorías a agregar
            const categoriesToAdd = parsedCategoryIds.filter(categoryId => !currentCategoryIds.includes(categoryId));

            // Determinar las categorías a eliminar
            const categoriesToRemove = currentCategoryIds.filter(categoryId => !parsedCategoryIds.includes(categoryId));

            // Eliminar las categorías deseleccionadas
            if (categoriesToRemove.length > 0) {
                await ProductCategory.destroy({
                    where: {
                        productId: product.id,
                        categoryId: categoriesToRemove
                    }
                });
            }

            // Crear los nuevos ProductCategory
            const newAssociations = categoriesToAdd.map(categoryId => ({
                productId: product.id,
                categoryId: categoryId
            }));

            productCategory = await ProductCategory.bulkCreate(newAssociations);
        }

        // Obtener todas las categorías asociadas al producto después de la actualización
        const updatedCategories = await ProductCategory.findAll({
            where: { productId: product.id },
            include: [Category]
        });

        // Actualizar el nombre, descripción, disponibilidad y precio
        product.name = name || product.name;
        product.description = description || product.description;
        product.availavility = availavility || product.availavility;
        product.price = price || product.price;

        // Actualizar la imagen si se proporciona una nueva
        if (req.files && req.files.imageFile) {
            const newImage = req.files.imageFile;
            const newImagePath = uuid() + path.extname(newImage.name);
            const uploadPath = path.join(__dirname, '../public/images/images_product', newImagePath);

            // Eliminar la imagen anterior si existe
            if (product.imageUrl !== 'product_default.png') {
                const oldImagePath = path.join(__dirname, '../public/images/images_product', product.imageUrl);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }

            // Guardar la nueva imagen
            await newImage.mv(uploadPath);
            product.imageUrl = newImagePath;
        }

        // Guardar los cambios en la base de datos
        await product.save();

        res.status(200).json({
            Product: product,
            ProductCategory: updatedCategories,
            success: true,
            message: "Producto actualizado exitosamente"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar producto' + error });
    }
};