import { Router } from "express"
import {
    login, register,
    logout, getUsers,
    getUser, updateUser,
    deleteUser, goLogin,
    updateUserAdmin
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


router.post("/update-user", authMiddleware, updateUser)

router.put("/update-user-admin/:id", authMiddleware, adminMiddleware, updateUserAdmin)

router.delete("/delete-user/:id", authMiddleware, adminMiddleware, deleteUser)


export default router