import { TOKEN_SECRET } from "../config.js";
import jwt from 'jsonwebtoken';

export const authMiddleware = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        res.locals.isLoggedIn = false;
        res.locals.role = null;
        return res.redirect("/auth/view-login");
    }

    try {
        const decoded = jwt.verify(token, TOKEN_SECRET);
        req.user = decoded; 

        /* res.locals lo agrego para poder manipular estos datos desde el layout */
        res.locals.isLoggedIn = true;
        res.locals.role = decoded.role;

        next();
    } catch (error) {
        res.locals.isLoggedIn = false;
        res.locals.role = null;
        return res.status(401).json({ message: 'Token no válido' });
    }
};

export const adminMiddleware = async (req, res, next) => {
    const role = res.locals.role;

    if (role !== 1) {
        return res.status(403).json({ message: 'No tenés permisos de administrador' });
    }

    next();
};

export const employeeMiddleware = async (req, res, next) => {
    const role = res.locals.role;

    if (role !== 2) {
        return res.status(403).json({ message: 'No tenés permisos de empleado' });
    }

    next();
};

export const isLoggedin = (req, res, next) => {
    const token = req.cookies.token;

    if (token) {
        try {
            const decoded = jwt.verify(token, TOKEN_SECRET);
            req.user = decoded;

            return res.redirect("/home");
        } catch (error) {

        }
    }

    next();
};
