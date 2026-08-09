import User from "../models/user.model.js";


export const goProfile = async (req, res) => {
    try {
        const id = req.session.userId;

        const user = await User.findByPk(id);
        if (!user) {
            return res.render('pages/login');
        }
        res.render('pages/profile', { User: user });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}

/* te lleva a la vista de los usuarios -Admin- */
export const goUsers = async (req, res) => {
    try {
        const users = await User.findAll();

        res.render('pages/users', { Users: users });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

export const goEditUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        res.render('pages/user-edit', { User: user });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}
