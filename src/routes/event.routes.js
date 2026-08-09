import { Router } from "express";
import {
    getEvents, getEvent,
    createEvent, deleteEvent,
    updateEvent, goEvents, goEditEvent
} from "../controllers/event.controller.js";

const router = Router();

router.get("/view-create-event", goEvents);
router.get("/view-edit-event/:id", goEditEvent);

router.post("/create-event", createEvent);

router.get("/get-events", getEvents);

router.get("/get-event/:id", getEvent);

router.delete("/delete-event/:id", deleteEvent);

router.post("/update-event", updateEvent);

export default router