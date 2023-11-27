import OpeningHour from "../models/openingHour.model.js";
import moment from 'moment';
import { Op } from 'sequelize'


export const goOpeningHour = async (req, res) => {
    const openingHour = await OpeningHour.findAll();
    res.render("openingHour_create", { OpeningHour: openingHour });
}

export const createOpeningHour = async (req, res) => {
    try {
        const { lunMorningStartTime, lunMorningEndTime, lunEveningStartTime, lunEveningEndTime,
            marMorningStartTime, marMorningEndTime, marEveningStartTime, marEveningEndTime,
            mierMorningStartTime, mierMorningEndTime, mierEveningStartTime, mierEveningEndTime,
            jueMorningStartTime, jueMorningEndTime, jueEveningStartTime, jueEveningEndTime,
            vieMorningStartTime, vieMorningEndTime, vieEveningStartTime, vieEveningEndTime,
            sabMorningStartTime, sabMorningEndTime, sabEveningStartTime, sabEveningEndTime,
            domMorningStartTime, domMorningEndTime, domEveningStartTime, domEveningEndTime,
        } = req.body;


        const lunOpeningHour = await OpeningHour.findOrCreate({
            where: dayOfWeek === "Lunes",
            morningStartTime: lunMorningStartTime ? moment.utc(lunMorningStartTime, 'HH:mm').toDate() : null,
            morningEndTime: lunMorningEndTime ? moment.utc(lunMorningEndTime, 'HH:mm').toDate() : null,
            eveningStartTime: lunEveningStartTime ? moment.utc(lunEveningStartTime, 'HH:mm').toDate() : null,
            eveningEndTime: lunEveningEndTime ? moment.utc(lunEveningEndTime, 'HH:mm').toDate() : null,
        });

        const marOpeningHour = await OpeningHour.findOrCreate({
            where: dayOfWeek === "Martes",
            morningStartTime: marMorningStartTime ? moment.utc(marMorningStartTime, 'HH:mm').toDate() : null,
            morningEndTime: marMorningEndTime ? moment.utc(marMorningEndTime, 'HH:mm').toDate() : null,
            eveningStartTime: marEveningStartTime ? moment.utc(marEveningStartTime, 'HH:mm').toDate() : null,
            eveningEndTime: marEveningEndTime ? moment.utc(marEveningEndTime, 'HH:mm').toDate() : null,
        });

        const mierOpeningHour = await OpeningHour.findOrCreate({
            where: dayOfWeek === "Miercoles",
            morningStartTime: mierMorningStartTime ? moment.utc(mierMorningStartTime, 'HH:mm').toDate() : null,
            morningEndTime: mierMorningEndTime ? moment.utc(mierMorningEndTime, 'HH:mm').toDate() : null,
            eveningStartTime: mierEveningStartTime ? moment.utc(mierEveningStartTime, 'HH:mm').toDate() : null,
            eveningEndTime: mierEveningEndTime ? moment.utc(mierEveningEndTime, 'HH:mm').toDate() : null,
        });

        const jueOpeningHour = await OpeningHour.findOrCreate({
            where: dayOfWeek === "Jueves",
            morningStartTime: jueMorningStartTime ? moment.utc(jueMorningStartTime, 'HH:mm').toDate() : null,
            morningEndTime: jueMorningEndTime ? moment.utc(jueMorningEndTime, 'HH:mm').toDate() : null,
            eveningStartTime: jueEveningStartTime ? moment.utc(jueEveningStartTime, 'HH:mm').toDate() : null,
            eveningEndTime: jueEveningEndTime ? moment.utc(jueEveningEndTime, 'HH:mm').toDate() : null,
        });

        const vieOpeningHour = await OpeningHour.findOrCreate({
            where: dayOfWeek === "Viernes",
            morningStartTime: vieMorningStartTime ? moment.utc(vieMorningStartTime, 'HH:mm').toDate() : null,
            morningEndTime: vieMorningEndTime ? moment.utc(vieMorningEndTime, 'HH:mm').toDate() : null,
            eveningStartTime: vieEveningStartTime ? moment.utc(vieEveningStartTime, 'HH:mm').toDate() : null,
            eveningEndTime: vieEveningEndTime ? moment.utc(vieEveningEndTime, 'HH:mm').toDate() : null,
        });

        const sabOpeningHour = await OpeningHour.findOrCreate({
            where: dayOfWeek === "Sabado",
            morningStartTime: sabMorningStartTime ? moment.utc(sabMorningStartTime, 'HH:mm').toDate() : null,
            morningEndTime: sabMorningEndTime ? moment.utc(sabMorningEndTime, 'HH:mm').toDate() : null,
            eveningStartTime: sabEveningStartTime ? moment.utc(sabEveningStartTime, 'HH:mm').toDate() : null,
            eveningEndTime: sabEveningEndTime ? moment.utc(sabEveningEndTime, 'HH:mm').toDate() : null,
        });

        const domOpeningHour = await OpeningHour.findOrCreate({
            where: dayOfWeek === "Domingo",
            morningStartTime: domMorningStartTime ? moment.utc(domMorningStartTime, 'HH:mm').toDate() : null,
            morningEndTime: domMorningEndTime ? moment.utc(domMorningEndTime, 'HH:mm').toDate() : null,
            eveningStartTime: domEveningStartTime ? moment.utc(domEveningStartTime, 'HH:mm').toDate() : null,
            eveningEndTime: domEveningEndTime ? moment.utc(domEveningEndTime, 'HH:mm').toDate() : null,
        });

        res.status(201).json({ lunOpeningHour, marOpeningHour, mierOpeningHour, jueOpeningHour, vieOpeningHour, sabOpeningHour, domOpeningHour });

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