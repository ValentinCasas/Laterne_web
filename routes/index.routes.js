import { Router } from "express";
import { goIndex, goHome, goCardVirtual } from "../controllers/index.controller.js";
import {
    authMiddleware,
    adminMiddleware,
    employeeMiddleware
  } from "../middlewares/authMiddleware.js";

const router = Router();


router.get("/", goIndex);
router.get("/home", authMiddleware,goHome);
router.get("/card_virtual", goCardVirtual);

export default router