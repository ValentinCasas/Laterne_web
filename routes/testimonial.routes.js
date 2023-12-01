import { Router } from "express";
import {
    getTestimonials, getTestimonial,
    createTestimonial, deleteTestimonial,
    updateTestimonial, goTestimonials
} from "../controllers/testimonial.controller.js";

import {
    authMiddleware,
    adminMiddleware,
    employeeMiddleware
  } from "../middlewares/authMiddleware.js";


const router = Router();

router.get("/view-testimonials", authMiddleware, goTestimonials);

router.post("/create-testimonial", createTestimonial);

router.get("/get-testimonials", authMiddleware, getTestimonials);

router.get("/get-testimonial/:id", authMiddleware, getTestimonial);

router.delete("/delete-testimonial/:id", authMiddleware, deleteTestimonial);

router.post("/update-testimonial", authMiddleware, updateTestimonial);

export default router