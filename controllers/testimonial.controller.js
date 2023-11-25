import Testimonial from "../models/testimonial.model.js";

export const goTestimonials = async (req, res) => {
    try {
        const testimonial = await Testimonial.findAll();
        res.render("testimonial",{ Testimonial: testimonial });

    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al traer feedbacks' });
    }
}

export const createTestimonial = async (req, res) => {
    try {
        const { description } = req.body;

        const newTestimonial = await Testimonial.create({
            description,
            state: 0,
            date: new Date(),
        });

        res.status(201).json({ Testimonial: newTestimonial, message: "Gracias por dejar tu comentario!" });

    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al crear el feedback' });
    }
};

export const getTestimonials = async (req, res) => {
    try {
        const testimonial = await Testimonial.findAll();

        res.status(200).json({ Testimonial: testimonial });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al traer feedbacks' });
    }
}

export const getTestimonial = async (req, res) => {
    const { id } = req.params;
    try {

        const testimonial = await Testimonial.findByPk(id);

        res.status(200).json({ Testimonial: testimonial });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al traer feedback' });
    }
}

export const deleteTestimonial = async (req, res) => {
    const { id } = req.params;
    try {
        const testimonial = await Testimonial.findByPk(id);

        if (!testimonial) {
            return res.status(404).json({ message: 'Feedback no encontrado' });
        }

        await testimonial.destroy();

        res.status(204).json({
            Testimonial: testimonial,
            success: true,
            message: "Feedback eliminado exitosamente"
        });
    } catch (error) {

        res.status(500).json({ error: 'Error al eliminar feedback' });
    }
};

export const updateTestimonial = async (req, res) => {
    const { id } = req.params;
    const { description, state } = req.body;

    try {
        const testimonial = await Testimonial.findByPk(id);

        if (!testimonial) {
            return res.status(404).json({ message: 'Feedback no encontrado' });
        }

        testimonial.description = description || testimonial.description;
        testimonial.state = state !== undefined ? state : testimonial.state;

        await testimonial.save();

        res.status(200).json({
            Testimonial: testimonial,
            success: true,
            message: "Feedback actualizado exitosamente"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar feedback' });
    }
};
