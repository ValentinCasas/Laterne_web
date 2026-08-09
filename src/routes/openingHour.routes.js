import { Router } from "express";
import {
    getOpeningHours, getOpeningHour,
    createOpeningHour, deleteOpeningHour,
    updateOpeningHour, goOpeningHour
} from "../controllers/openingHour.controller.js";

const router = Router();

router.get("/view-opening-hour", goOpeningHour);

router.post("/create-hour", createOpeningHour);

router.get("/get-hour", getOpeningHours);

router.get("/get-hour/:id", getOpeningHour);

router.delete("/delete-hour/:id", deleteOpeningHour);

router.put("/update-hour/:id", updateOpeningHour);

export default router