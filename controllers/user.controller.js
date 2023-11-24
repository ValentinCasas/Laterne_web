import User from "../models/user.model.js";


export const goProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        res.render("profile", { User: user });
    } catch (error) {
        return res.status(500).json({ message: err.message });
    }
}

/* te lleva a la vista de los usuarios -Admin- */
export const goUsers = async (req, res) => {
    try {
        const users = await User.findAll();

        res.render("users", { Users: users });
    } catch (error) {
        return res.status(500).json({ message: err.message });
    }
}

export const goEditUser = async (req, res) =>{
    try {
        const { id } = req.params;
        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        res.render("user_edit", { User: user });
    } catch (error) {
        return res.status(500).json({ message: err.message });
    }   
}