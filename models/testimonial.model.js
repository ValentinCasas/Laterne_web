
import { DataTypes } from "sequelize";
import connectionBD from "../db.js";

const Testimonial = connectionBD.define(
    "Testimonial",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        description: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        state: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
        },
        date: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    },
    {
        tableName: "Testimonial",
        timestamps: false,
    }
);

export default Testimonial;
