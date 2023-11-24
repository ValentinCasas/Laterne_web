import { TOKEN_SECRET } from "../config.js";
import jwt from 'jsonwebtoken';

export const authMiddleware = (req, res, next) => {
    const token = req.cookies.token;
    const role = req.cookies.role;

    if (!token || !role) {
        return res.status(401).json({ message: 'No estás autenticado' });
    }

    try {
        const decoded = jwt.verify(token, TOKEN_SECRET);
        req.user = { ...decoded, role };  // Agrega el rol al objeto req.user
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token no válido' });
    }
};

export const adminMiddleware = async (req, res, next) => {
    const role = req.user.role;

    if (role !== 1) {
        return res.status(403).json({ message: 'No tenés permisos de administrador' });
    }

    next();
};

export const employeeMiddleware = async (req, res, next) => {
    const role = req.user.role;

    if (role !== 2) {
        return res.status(403).json({ message: 'No tenés permisos de empleado' });
    }

    next();
};