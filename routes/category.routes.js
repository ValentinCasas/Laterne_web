import { Router } from "express";
import {
    createCategory, getCategories,
    getCategory, deleteCategory,
    updateCategory
} from "../controllers/category.controller.js";

const router = Router();


router.post("/create-category", createCategory);

router.get("/get-categories", getCategories);

router.get("/get-category/:id", getCategory);

router.delete("/delete-category/:id", deleteCategory);

router.put("/update-category/:id", updateCategory);

export default router