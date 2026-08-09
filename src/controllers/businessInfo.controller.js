import BusinessInfo from "../models/businessInfo.model.js";
import OpeningHour from "../models/openingHour.model.js";


export const goBusinessInfo = async (req, res) => {

    try {
        const businessInfo = await BusinessInfo.findAll();
        const openingHour = await OpeningHour.findAll();

        res.render('pages/business-info',
            {
                BusinessInfo: businessInfo[0],
                OpeningHour: openingHour
            });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al traer info' });

    }
}

export const getbusinessInfo = async (req, res) => {
    try {

        const businessInfo = await BusinessInfo.findAll();

        res.status(200).json({ BusinessInfo: businessInfo[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al traer la información de la empresa' });
    }
}

export const updateBusinessInfo = async (req, res) => {

    const {  latitude,
        longitude, address,
        email, phoneNumber,
        instagramUrl, facebookUrl } = req.body;

    try {
        const businessInfo = await BusinessInfo.findAll();

        if (!businessInfo[0]) {
            return res.status(404).json({ message: 'Información de negocio no encontrada' });
        }

        businessInfo[0].latitude = latitude || businessInfo[0].latitude;
        businessInfo[0].longitude = longitude || businessInfo[0].longitude;
        businessInfo[0].address = address || businessInfo[0].address;
        businessInfo[0].email = email || businessInfo[0].email;
        businessInfo[0].phoneNumber = phoneNumber || businessInfo[0].phoneNumber;
        businessInfo[0].instagramUrl = instagramUrl || businessInfo[0].instagramUrl;
        businessInfo[0].facebookUrl = facebookUrl || businessInfo[0].facebookUrl;

        await businessInfo[0].save();

        res.status(200).json({
            BusinessInfo: businessInfo[0],
            success: true,
            message: "Información de negocio actualizada exitosamente"
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar información de negocio' });
    }
};

