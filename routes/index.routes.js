import { Router } from "express";
import { goIndex } from "../controllers/index.controller.js";

const router = Router();


router.get("/index", goIndex);

export default router