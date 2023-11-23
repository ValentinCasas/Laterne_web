import { DataTypes } from "sequelize";
import connectionBD from "../db.js";

const Category = connectionBD.define(
    "Category",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        description: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        imageUrl: {
            type: DataTypes.STRING,
            allowNull: false,
        },

    },
    {
        tableName: "Category",
        timestamps: false,
    }
);

export default Category;
