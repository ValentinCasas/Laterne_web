import { Router } from "express";
import {
    enlistProductCategory,
    delistProductCategory,
    getProductCategoryByProduct,
    getProductCategoryByCategory
} from "../controllers/asociation.controller.js";

const router = Router();

/* nos devuelve todas las categorias en donde se encuentra dicho producto */
router.get("/product-category-by-product/:productId", getProductCategoryByProduct);

/* nos devuelve todos los producto de dicha categoria */
router.get("/product-category-by-category/:categoryId", getProductCategoryByCategory);

/* enlistar producto de categoria */
router.post("/enlist-product-category", enlistProductCategory);

/* desenlistar producto de categoria */
router.post("/delist-product-category", delistProductCategory);


export default router