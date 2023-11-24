import { Router } from "express";
import {
    getProducts, getProduct,
    createProduct, deleteProduct,
    updateProduct, goProducts, goEditProduct
} from "../controllers/product.controller.js";

const router = Router();

router.get("/view-products", goProducts);
router.get("/view-edit-product/:id", goEditProduct);

router.post("/create-product", createProduct);

router.get("/get-products", getProducts);
router.get("/get-product/:id", getProduct);

router.delete("/delete-product/:id", deleteProduct);

router.put("/update-product/:id", updateProduct);

export default router