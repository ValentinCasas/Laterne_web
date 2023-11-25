import Event from "../models/event.model.js";
import moment from 'moment';
import { fileURLToPath } from 'url';
import { v1 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export const goEvents = async (req, res) => {
    try {
        const events = await Event.findAll();
        res.render("event_create", { Events: events });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al traer evento' });
    }
}

export const goEditEvent = async (req, res) => {
    const { id } = req.params;
    try {
        const event = await Event.findByPk(id);

        res.render("event_edit", { Event: event });

    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al traer evento' });
    }
}

export const createEvent = async (req, res) => {
    try {
        const { name, date, time, description, location } = req.body;

        const formattedDate = date ? moment.utc(date, 'YYYY/MM/DD').toDate() : null;
        const formattedTime = time ? moment.utc(time, 'HH:mm').toDate() : null;

        let imagePath = null;

        if (req.files && req.files.imageFile) {
            const eventImage = req.files.imageFile;
            imagePath = uuid() + path.extname(eventImage.name);
            const uploadPath = path.join(__dirname, '../public/images/images_event', imagePath);

            await eventImage.mv(uploadPath);
        }

        const newEvent = await Event.create({
            name,
            date: date ? formattedDate : null,
            time: formattedTime,
            description,
            location,
            imageUrl: imagePath,
        });

        res.status(201).json({ Event: newEvent });

    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al crear el evento' });
    }
};

export const getEvents = async (req, res) => {
    try {
        const events = await Event.findAll();

        res.status(200).json({ Events: events });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al traer eventos' });
    }
}

export const getEvent = async (req, res) => {
    const { id } = req.params;
    try {

        const event = await Event.findByPk(id);

        res.status(200).json({ Event: event });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al traer evento' });
    }
}

export const deleteEvent = async (req, res) => {
    const { id } = req.params;
    try {
        const event = await Event.findByPk(id);

        if (!event) {
            return res.status(404).json({ message: 'Evento no encontrado' });
        }

        await event.destroy();

        if (event.imageUrl !== null) {
            const imagePath = path.join(__dirname, '../public/images/images_event', event.imageUrl);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        res.status(204).json({
            Event: event,
            success: true,
            message: "Evento eliminado exitosamente"
        });
    } catch (error) {

        res.status(500).json({ error: 'Error al eliminar evento' });
    }
};

export const updateEvent = async (req, res) => {
    const { name, date, time, description, location, id } = req.body;

    try {
        const event = await Event.findByPk(id);

        if (!event) {
            return res.status(404).json({ message: 'Evento no encontrado' });
        }

        event.name = name || event.name;

        if (date) {
            const formattedDate = moment.utc(date, 'YYYY/MM/DD').toDate();
            event.date = formattedDate;
        }

        event.time = time;
        event.description = description || event.description;
        event.location = location || event.location;

        if (req.files && req.files.imageFile) {
            const newImage = req.files.imageFile;
            const newImagePath = uuid() + path.extname(newImage.name);
            const uploadPath = path.join(__dirname, '../public/images/images_event', newImagePath);

            if (event.imageUrl) {
                const oldImagePath = path.join(__dirname, '../public/images/images_event', event.imageUrl);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }

            await newImage.mv(uploadPath);
            event.imageUrl = newImagePath;
        }

        await event.save();

        res.status(200).json({
            Event: event,
            success: true,
            message: "Evento actualizado exitosamente"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar evento' + error.message });
    }
};
