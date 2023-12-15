import { Router } from "express";
import {
    getProducts, getProduct,
    createProduct, deleteProduct,
    updateProduct, goProducts, goEditProduct,
    updatePrices
} from "../controllers/product.controller.js";

const router = Router();

router.get("/view-products", goProducts);
router.get("/view-edit-product/:id", goEditProduct);

router.post("/create-product", createProduct);

router.post("/update-prices", updatePrices);

router.get("/get-products", getProducts);
router.get("/get-product/:id", getProduct);

router.delete("/delete-product/:id", deleteProduct);

router.post("/update-product", updateProduct);

export default router