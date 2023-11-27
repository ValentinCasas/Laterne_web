import { Router } from "express";
import {
    getbusinessInfo, updateBusinessInfo,
    goBusinessInfo
} from "../controllers/businessInfo.controller.js";

import {
    authMiddleware,
    adminMiddleware,
    isLoggedin
} from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/view-businessInfo", authMiddleware, adminMiddleware, goBusinessInfo);

router.get("/get-businessInfo", getbusinessInfo);

router.post("/update-businessInfo", authMiddleware, adminMiddleware, updateBusinessInfo);

export default router