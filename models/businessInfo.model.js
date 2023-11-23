
import { DataTypes } from "sequelize";
import connectionBD from "../db.js";

const BusinessInfo = connectionBD.define(
    "BusinessInfo",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        latitude: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        longitude: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        adress: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        phoneNumber: {
            type: DataTypes.BIGINT,
            allowNull: true,
        },
        instagramUrl: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        facebookUrl: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    },
    {
        tableName: "BusinessInfo",
        timestamps: false,
    }
);

export default BusinessInfo;
