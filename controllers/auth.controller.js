import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import { createAccessToken } from './../libs/jwt.js';
import { fileURLToPath } from 'url';
import { v1 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export const goLogin = async (req, res) => {
    res.render("login");
}

export const register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        const userExists = await User.findOne({ where: { email } });

        if (userExists) {
            return res.status(400).json({ error: 'El email ya existe' });
        }

        let imagePath = 'avatar_profile_default.png';

        if (req.files && req.files.imageFile) {
            const userImage = req.files.imageFile;
            imagePath = uuid() + path.extname(userImage.name);
            const uploadPath = path.join(__dirname, '../public/images/images_profile', imagePath);

            await userImage.mv(uploadPath);
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            name,
            email,
            password: passwordHash,
            role: role,
            imageUrl: imagePath,
        });

        res.status(201).json({ User: newUser });

    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al registrar usuario' });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const userFound = await User.findAll({ where: { email } });

        if (userFound.length === 0) {
            return res.status(400).json({ message: 'Usuario no encontrado' });
        }

        const isMatch = await bcrypt.compare(password, userFound[0].password);

        if (!isMatch) {
            return res.status(400).json({ message: 'Contraseña incorrecta' });
        }

        const token = await createAccessToken({ id: userFound[0].id, role:userFound[0].role });
        const role = userFound[0].role;
        req.session.userId = userFound[0].id;

        res.cookie("token", token);
        res.redirect("/home");

    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};



export const logout = (req, res) => {
    res.cookie('token', "", {
        expires: new Date(0),
    })
    return res.render("login");
}

export const getUsers = async (req, res) => {
    try {
        const users = await User.findAll();
        res.status(201).json({ Users: users });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error: ' + error.message });
    }
}

export const getUser = async (req, res) => {
    const { id } = req.params;
    try {
        const user = await User.findByPk(id);
        res.status(200).json({ User: user });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error: ' + error.message });
    }
}

export const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        const user = await User.findByPk(id);

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }


        await user.destroy();

        if (user.imageUrl !== 'avatar_profile_default.png') {
            const imagePath = path.join(__dirname, '../public/images/images_profile', user.imageUrl);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        res.status(204).json({
            User: user,
            success: true,
            message: "Usuario eliminado exitosamente"
        });
    } catch (error) {

        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
};

export const updateUserAdmin = async (req, res) => {
    const { id } = req.params;
    const { name, email, currentPassword, newPassword } = req.body;

    try {
        const user = await User.findByPk(id);

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Verificar la contraseña actual si se proporciona
        if (currentPassword) {
            const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ message: 'La contraseña "antigua" no coincide con la vigente' });
            }
        }

        // Actualizar el nombre y el correo electrónico
        user.name = name || user.name;
        user.email = email || user.email;

        //corroborar que no exista un usuario con ese mail (solo puede existir uno)
        const existEmail = await User.findAll({ where: { email: email } });

        if (existEmail.length > 1) {
            return res.status(401).json({ message: 'Ya hay un usuario con ese email' });
        }

        // Actualizar la contraseña si se proporciona una nueva
        if (newPassword) {
            const newPasswordHash = await bcrypt.hash(newPassword, 10);
            user.password = newPasswordHash;
        }

        // Actualizar la imagen si se proporciona una nueva
        if (req.files && req.files.imageFile) {
            const newImage = req.files.imageFile;
            const newImagePath = uuid() + path.extname(newImage.name);
            const uploadPath = path.join(__dirname, '../public/images/images_profile', newImagePath);

            // Eliminar la imagen anterior si existe
            if (user.imageUrl !== 'avatar_profile_default.png') {
                const oldImagePath = path.join(__dirname, '../public/images/images_profile', user.imageUrl);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }

            // Guardar la nueva imagen
            await newImage.mv(uploadPath);
            user.imageUrl = newImagePath;
        }

        // Guardar los cambios en la base de datos
        await user.save();

        res.status(200).json({
            User: user,
            success: true,
            message: "Usuario actualizado exitosamente"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
};

export const updateUser = async (req, res) => {
    const { name, email, currentPassword, newPassword,id } = req.body;

    try {
        const user = await User.findByPk(id);

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Verificar la contraseña actual si se proporciona
        if (currentPassword) {
            const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ message: 'La contraseña "antigua" no coincide con la vigente' });
            }
        }

        // Actualizar el nombre y el correo electrónico
        user.name = name || user.name;
        user.email = email || user.email;

        //corroborar que no exista un usuario con ese mail (solo puede existir uno)
        const existEmail = await User.findAll({ where: { email: email } });

        if (existEmail.length > 1) {
            return res.status(401).json({ message: 'Ya hay un usuario con ese email' });
        }

        // Actualizar la contraseña si se proporciona una nueva
        if (newPassword) {
            const newPasswordHash = await bcrypt.hash(newPassword, 10);
            user.password = newPasswordHash;
        }

        // Actualizar la imagen si se proporciona una nueva
        if (req.files && req.files.imageFile) {
            const newImage = req.files.imageFile;
            const newImagePath = uuid() + path.extname(newImage.name);
            const uploadPath = path.join(__dirname, '../public/images/images_profile', newImagePath);

            // Eliminar la imagen anterior si existe
            if (user.imageUrl !== 'avatar_profile_default.png') {
                const oldImagePath = path.join(__dirname, '../public/images/images_profile', user.imageUrl);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }

            // Guardar la nueva imagen
            await newImage.mv(uploadPath);
            user.imageUrl = newImagePath;
        }

        // Guardar los cambios en la base de datos
        await user.save();

        res.status(200).json({
            User: user,
            success: true,
            message: "Usuario actualizado exitosamente"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
};
