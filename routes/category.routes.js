import { Router } from "express";
import {
    createCategory, getCategories,
    getCategory, deleteCategory,
    updateCategory, goCategories,
    goEditCategories
} from "../controllers/category.controller.js";

const router = Router();

router.get("/view-create-category", goCategories);
router.get("/view-edit-category/:id", goEditCategories);

router.post("/create-category", createCategory);

router.get("/get-categories", getCategories);

router.get("/get-category/:id", getCategory);

router.delete("/delete-category/:id", deleteCategory);

router.put("/update-category/:id", updateCategory);

export default router