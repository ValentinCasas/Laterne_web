import OpeningHour from "../models/openingHour.model.js";
import moment from 'moment';
import { Op } from 'sequelize'



export const goOpeningHour = async (req, res) => {
    const daysOfWeek = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
    let openingHours = await OpeningHour.findAll();

    if (openingHours.length === 0) {
        // Si el array está vacío, crear un nuevo array con objetos nulos para cada día de la semana
        openingHours = daysOfWeek.map(day => ({
            dayOfWeek: day,
            morningStartTime: null,
            morningEndTime: null,
            eveningStartTime: null,
            eveningEndTime: null,
        }));
    } else {
        // Crear un mapa para acceder fácilmente a las horas existentes por día
        const existingHoursMap = new Map(openingHours.map(hour => [hour.dayOfWeek, hour]));

        // Iterar sobre los días de la semana
        for (const day of daysOfWeek) {
            // Verificar si el día ya existe en la base de datos
            if (!existingHoursMap.has(day)) {
                // Si no existe, agregar un nuevo objeto con todos los valores a null al array openingHours
                openingHours.push({
                    dayOfWeek: day,
                    morningStartTime: null,
                    morningEndTime: null,
                    eveningStartTime: null,
                    eveningEndTime: null,
                });
            }
        }
    }

    // Enviar openingHours al render
    res.render("openingHour_create", { OpeningHour: openingHours });
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


        // Lunes
        const [lunOpeningHour, lunCreated] = await OpeningHour.findOrCreate({
            where: { dayOfWeek: "Lunes" },
            defaults: {
                dayOfWeek: "Lunes",
                morningStartTime: lunMorningStartTime ? moment.utc(lunMorningStartTime, 'HH:mm').toDate() : null,
                morningEndTime: lunMorningEndTime ? moment.utc(lunMorningEndTime, 'HH:mm').toDate() : null,
                eveningStartTime: lunEveningStartTime ? moment.utc(lunEveningStartTime, 'HH:mm').toDate() : null,
                eveningEndTime: lunEveningEndTime ? moment.utc(lunEveningEndTime, 'HH:mm').toDate() : null,
            },
        });

        if (!lunCreated) {
            await lunOpeningHour.update({
                morningStartTime: lunMorningStartTime ? moment.utc(lunMorningStartTime, 'HH:mm').toDate() : null,
                morningEndTime: lunMorningEndTime ? moment.utc(lunMorningEndTime, 'HH:mm').toDate() : null,
                eveningStartTime: lunEveningStartTime ? moment.utc(lunEveningStartTime, 'HH:mm').toDate() : null,
                eveningEndTime: lunEveningEndTime ? moment.utc(lunEveningEndTime, 'HH:mm').toDate() : null,
            });
        }

        // Martes
        const [marOpeningHour, marCreated] = await OpeningHour.findOrCreate({
            where: { dayOfWeek: "Martes" },
            defaults: {
                dayOfWeek: "Martes",
                morningStartTime: marMorningStartTime ? moment.utc(marMorningStartTime, 'HH:mm').toDate() : null,
                morningEndTime: marMorningEndTime ? moment.utc(marMorningEndTime, 'HH:mm').toDate() : null,
                eveningStartTime: marEveningStartTime ? moment.utc(marEveningStartTime, 'HH:mm').toDate() : null,
                eveningEndTime: marEveningEndTime ? moment.utc(marEveningEndTime, 'HH:mm').toDate() : null,
            },
        });

        if (!marCreated) {
            await marOpeningHour.update({
                morningStartTime: marMorningStartTime ? moment.utc(marMorningStartTime, 'HH:mm').toDate() : null,
                morningEndTime: marMorningEndTime ? moment.utc(marMorningEndTime, 'HH:mm').toDate() : null,
                eveningStartTime: marEveningStartTime ? moment.utc(marEveningStartTime, 'HH:mm').toDate() : null,
                eveningEndTime: marEveningEndTime ? moment.utc(marEveningEndTime, 'HH:mm').toDate() : null,
            });
        }

        // Miércoles
        const [mierOpeningHour, mierCreated] = await OpeningHour.findOrCreate({
            where: { dayOfWeek: "Miércoles" },
            defaults: {
                dayOfWeek: "Miércoles",
                morningStartTime: mierMorningStartTime ? moment.utc(mierMorningStartTime, 'HH:mm').toDate() : null,
                morningEndTime: mierMorningEndTime ? moment.utc(mierMorningEndTime, 'HH:mm').toDate() : null,
                eveningStartTime: mierEveningStartTime ? moment.utc(mierEveningStartTime, 'HH:mm').toDate() : null,
                eveningEndTime: mierEveningEndTime ? moment.utc(mierEveningEndTime, 'HH:mm').toDate() : null,
            },
        });

        if (!mierCreated) {
            await mierOpeningHour.update({
                morningStartTime: mierMorningStartTime ? moment.utc(mierMorningStartTime, 'HH:mm').toDate() : null,
                morningEndTime: mierMorningEndTime ? moment.utc(mierMorningEndTime, 'HH:mm').toDate() : null,
                eveningStartTime: mierEveningStartTime ? moment.utc(mierEveningStartTime, 'HH:mm').toDate() : null,
                eveningEndTime: mierEveningEndTime ? moment.utc(mierEveningEndTime, 'HH:mm').toDate() : null,
            });
        }

        // Jueves
        const [jueOpeningHour, jueCreated] = await OpeningHour.findOrCreate({
            where: { dayOfWeek: "Jueves" },
            defaults: {
                dayOfWeek: "Jueves",
                morningStartTime: jueMorningStartTime ? moment.utc(jueMorningStartTime, 'HH:mm').toDate() : null,
                morningEndTime: jueMorningEndTime ? moment.utc(jueMorningEndTime, 'HH:mm').toDate() : null,
                eveningStartTime: jueEveningStartTime ? moment.utc(jueEveningStartTime, 'HH:mm').toDate() : null,
                eveningEndTime: jueEveningEndTime ? moment.utc(jueEveningEndTime, 'HH:mm').toDate() : null,
            },
        });

        if (!jueCreated) {
            await jueOpeningHour.update({
                morningStartTime: jueMorningStartTime ? moment.utc(jueMorningStartTime, 'HH:mm').toDate() : null,
                morningEndTime: jueMorningEndTime ? moment.utc(jueMorningEndTime, 'HH:mm').toDate() : null,
                eveningStartTime: jueEveningStartTime ? moment.utc(jueEveningStartTime, 'HH:mm').toDate() : null,
                eveningEndTime: jueEveningEndTime ? moment.utc(jueEveningEndTime, 'HH:mm').toDate() : null,
            });
        }

        // Viernes
        const [vieOpeningHour, vieCreated] = await OpeningHour.findOrCreate({
            where: { dayOfWeek: "Viernes" },
            defaults: {
                dayOfWeek: "Viernes",
                morningStartTime: vieMorningStartTime ? moment.utc(vieMorningStartTime, 'HH:mm').toDate() : null,
                morningEndTime: vieMorningEndTime ? moment.utc(vieMorningEndTime, 'HH:mm').toDate() : null,
                eveningStartTime: vieEveningStartTime ? moment.utc(vieEveningStartTime, 'HH:mm').toDate() : null,
                eveningEndTime: vieEveningEndTime ? moment.utc(vieEveningEndTime, 'HH:mm').toDate() : null,
            },
        });

        if (!vieCreated) {
            await vieOpeningHour.update({
                morningStartTime: vieMorningStartTime ? moment.utc(vieMorningStartTime, 'HH:mm').toDate() : null,
                morningEndTime: vieMorningEndTime ? moment.utc(vieMorningEndTime, 'HH:mm').toDate() : null,
                eveningStartTime: vieEveningStartTime ? moment.utc(vieEveningStartTime, 'HH:mm').toDate() : null,
                eveningEndTime: vieEveningEndTime ? moment.utc(vieEveningEndTime, 'HH:mm').toDate() : null,
            });
        }

        // Sábado
        const [sabOpeningHour, sabCreated] = await OpeningHour.findOrCreate({
            where: { dayOfWeek: "Sábado" },
            defaults: {
                dayOfWeek: "Sábado",
                morningStartTime: sabMorningStartTime ? moment.utc(sabMorningStartTime, 'HH:mm').toDate() : null,
                morningEndTime: sabMorningEndTime ? moment.utc(sabMorningEndTime, 'HH:mm').toDate() : null,
                eveningStartTime: sabEveningStartTime ? moment.utc(sabEveningStartTime, 'HH:mm').toDate() : null,
                eveningEndTime: sabEveningEndTime ? moment.utc(sabEveningEndTime, 'HH:mm').toDate() : null,
            },
        });

        if (!sabCreated) {
            await sabOpeningHour.update({
                morningStartTime: sabMorningStartTime ? moment.utc(sabMorningStartTime, 'HH:mm').toDate() : null,
                morningEndTime: sabMorningEndTime ? moment.utc(sabMorningEndTime, 'HH:mm').toDate() : null,
                eveningStartTime: sabEveningStartTime ? moment.utc(sabEveningStartTime, 'HH:mm').toDate() : null,
                eveningEndTime: sabEveningEndTime ? moment.utc(sabEveningEndTime, 'HH:mm').toDate() : null,
            });
        }

        // Domingo
        const [domOpeningHour, domCreated] = await OpeningHour.findOrCreate({
            where: { dayOfWeek: "Domingo" },
            defaults: {
                dayOfWeek: "Domingo",
                morningStartTime: domMorningStartTime ? moment.utc(domMorningStartTime, 'HH:mm').toDate() : null,
                morningEndTime: domMorningEndTime ? moment.utc(domMorningEndTime, 'HH:mm').toDate() : null,
                eveningStartTime: domEveningStartTime ? moment.utc(domEveningStartTime, 'HH:mm').toDate() : null,
                eveningEndTime: domEveningEndTime ? moment.utc(domEveningEndTime, 'HH:mm').toDate() : null,
            },
        });

        if (!domCreated) {
            await domOpeningHour.update({
                morningStartTime: domMorningStartTime ? moment.utc(domMorningStartTime, 'HH:mm').toDate() : null,
                morningEndTime: domMorningEndTime ? moment.utc(domMorningEndTime, 'HH:mm').toDate() : null,
                eveningStartTime: domEveningStartTime ? moment.utc(domEveningStartTime, 'HH:mm').toDate() : null,
                eveningEndTime: domEveningEndTime ? moment.utc(domEveningEndTime, 'HH:mm').toDate() : null,
            });
        }



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