import { Router } from "express"
import {
    login, register,
    logout, getUsers,
    getUser, updateUser,
    deleteUser
} from "../controllers/auth.controller.js";

const router = Router();

router.post("/register", register);

router.post("/login", login);

router.get("/logout", logout)

router.get("/get-users", getUsers)

router.get("/get-user", getUser)

router.put("/update-user/:id", updateUser)

router.delete("/delete-user/:id", deleteUser)


export default router