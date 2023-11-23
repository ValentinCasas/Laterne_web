import OpeningHour from "../models/openingHour.model.js";
import moment from 'moment';
import { Op } from 'sequelize'

export const createOpeningHour = async (req, res) => {
    try {
        const { dayOfWeek, morningStartTime, morningEndTime, eveningStartTime, eveningEndTime } = req.body;

        // Verificar si ya existe un OpeningHour con el mismo dayOfWeek
        const existingOpeningHour = await OpeningHour.findOne({ where: { dayOfWeek } });
        if (existingOpeningHour) {
            return res.status(400).json({ success: false, error: 'Ya existe un horario de apertura para este día de la semana' });
        }

        const newOpeningHour = await OpeningHour.create({
            dayOfWeek,
            morningStartTime: morningStartTime ? moment.utc(morningStartTime, 'HH:mm').toDate() : null,
            morningEndTime: morningEndTime ? moment.utc(morningEndTime, 'HH:mm').toDate() : null,
            eveningStartTime: eveningStartTime ? moment.utc(eveningStartTime, 'HH:mm').toDate() : null,
            eveningEndTime: eveningEndTime ? moment.utc(eveningEndTime, 'HH:mm').toDate() : null,
        });

        res.status(201).json({ OpeningHour: newOpeningHour });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Error al crear el horario de apertura' });
    }
};

export const getOpeningHours = async (req, res) => {
    try {
        const openingHours = await OpeningHour.findAll();
        res.status(200).json({ OpeningHours: openingHours });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Error al obtener los horarios de apertura' });
    }
};

export const getOpeningHour = async (req, res) => {
    const { id } = req.params;
    try {
        const openingHour = await OpeningHour.findByPk(id);
        if (!openingHour) {
            return res.status(404).json({ message: 'Horario de apertura no encontrado' });
        }
        res.status(200).json({ OpeningHour: openingHour });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Error al obtener el horario de apertura' });
    }
};

export const deleteOpeningHour = async (req, res) => {
    const { id } = req.params;
    try {
        const openingHour = await OpeningHour.findByPk(id);

        if (!openingHour) {
            return res.status(404).json({ message: 'Horario de apertura no encontrado' });
        }

        await openingHour.destroy();
        res.status(200).json({ success: true, message: 'Horario de apertura eliminado exitosamente' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Error al eliminar el horario de apertura' });
    }
};

export const updateOpeningHour = async (req, res) => {
    const { id } = req.params;
    const { dayOfWeek, morningStartTime, morningEndTime, eveningStartTime, eveningEndTime } = req.body;

    try {
        const openingHour = await OpeningHour.findByPk(id);

        if (!openingHour) {
            return res.status(404).json({ message: 'Horario de apertura no encontrado' });
        }

        // Verificar si ya existe otro OpeningHour con el mismo dayOfWeek
        const existingOpeningHour = await OpeningHour.findOne({ where: { dayOfWeek, id: { [Op.not]: id } } });
        if (existingOpeningHour) {
            return res.status(400).json({ success: false, error: 'Ya existe un horario de apertura para este día de la semana' });
        }

        openingHour.dayOfWeek = dayOfWeek || openingHour.dayOfWeek;
        openingHour.morningStartTime = morningStartTime ? moment.utc(morningStartTime, 'HH:mm').toDate() : openingHour.morningStartTime;
        openingHour.morningEndTime = morningEndTime ? moment.utc(morningEndTime, 'HH:mm').toDate() : openingHour.morningEndTime;
        openingHour.eveningStartTime = eveningStartTime ? moment.utc(eveningStartTime, 'HH:mm').toDate() : openingHour.eveningStartTime;
        openingHour.eveningEndTime = eveningEndTime ? moment.utc(eveningEndTime, 'HH:mm').toDate() : openingHour.eveningEndTime;

        await openingHour.save();

        res.status(200).json({
            OpeningHour: openingHour,
            success: true,
            message: 'Horario de apertura actualizado exitosamente'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar el horario de apertura' + error.message });
    }
};