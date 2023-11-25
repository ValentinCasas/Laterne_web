import { Router } from "express"
import {
    login, register,
    logout, getUsers,
    getUser, updateUser,
    deleteUser, goLogin
} from "../controllers/auth.controller.js";

import {
    authMiddleware,
    adminMiddleware,
    isLoggedin
} from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/view-login", isLoggedin, goLogin);

router.post("/register", authMiddleware, adminMiddleware, register);
router.post("/login", login);
router.get("/logout", logout)

router.get("/get-users", authMiddleware, adminMiddleware, getUsers)
router.get("/get-user", authMiddleware, getUser)


router.put("/update-user/:id", authMiddleware, updateUser)

router.delete("/delete-user/:id", authMiddleware, adminMiddleware, deleteUser)


export default router