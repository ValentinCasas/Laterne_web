import { Router } from "express";
import {
    getEvents, getEvent,
    createEvent, deleteEvent,
    updateEvent
} from "../controllers/event.controller.js";

const router = Router();


router.post("/create-event", createEvent);

router.get("/get-events", getEvents);

router.get("/get-event/:id", getEvent);

router.delete("/delete-event/:id", deleteEvent);

router.put("/update-event/:id", updateEvent);

export default router