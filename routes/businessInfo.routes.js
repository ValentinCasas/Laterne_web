import { Router } from "express";
import {
    getbusinessInfo, updateBusinessInfo
} from "../controllers/businessInfo.controller.js";

const router = Router();


router.get("/get-businessInfo", getbusinessInfo);

router.put("/update-businessInfo", updateBusinessInfo);

export default router