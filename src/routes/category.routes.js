import { Router } from "express";
import {
    createCategory, getCategories,
    getCategory, deleteCategory,
    updateCategory, goCategories,
    goEditCategory
} from "../controllers/category.controller.js";

const router = Router();

router.get("/view-create-category", goCategories);
router.get("/view-edit-category/:id", goEditCategory);

router.post("/create-category", createCategory);

router.get("/get-categories", getCategories);

router.get("/get-category/:id", getCategory);

router.delete("/delete-category/:id", deleteCategory);

router.post("/update-category", updateCategory);

export default router