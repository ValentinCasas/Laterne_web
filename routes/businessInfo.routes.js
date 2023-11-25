import { Router } from "express";
import {
    getbusinessInfo, updateBusinessInfo,
    goBusinessInfo
} from "../controllers/businessInfo.controller.js";

const router = Router();

router.get("/view-businessInfo", goBusinessInfo);

router.get("/get-businessInfo", getbusinessInfo);

router.post("/update-businessInfo", updateBusinessInfo);

export default router