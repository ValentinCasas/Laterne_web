import { Router } from "express"
import {
    goProfile,
    goUsers,
    goEditUser
} from "../controllers/user.controller.js";

import {
    authMiddleware,
    adminMiddleware,
    employeeMiddleware
  } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/view-profile/:id", goProfile);

router.get("/view-users", adminMiddleware, goUsers);
router.get("/view-edit-users/:id", adminMiddleware, goEditUser);



export default router