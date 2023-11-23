
import { DataTypes } from "sequelize";
import connectionBD from "../db.js";

const OpeningHour = connectionBD.define(
    "OpeningHour",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        dayOfWeek: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        morningStartTime: {
            type: DataTypes.TIME,
            allowNull: true,
        },
        morningEndTime: {
            type: DataTypes.TIME,
            allowNull: true,
        },
        eveningStartTime: {
            type: DataTypes.TIME,
            allowNull: true,
        },
        eveningEndTime: {
            type: DataTypes.TIME,
            allowNull: true,
        },
    },
    {
        tableName: "OpeningHour",
        timestamps: false,
    }
);

export default OpeningHour;
