import { Router } from "express";
import {
    getTestimonials, getTestimonial,
    createTestimonial, deleteTestimonial,
    updateTestimonial, goTestimonials
} from "../controllers/testimonial.controller.js";

const router = Router();

router.get("/viw-testimonials", goTestimonials);

router.post("/create-testimonial", createTestimonial);

router.get("/get-testimonials", getTestimonials);

router.get("/get-testimonial/:id", getTestimonial);

router.delete("/delete-testimonials/:id", deleteTestimonial);

router.put("/update-testimonials/:id", updateTestimonial);

export default router