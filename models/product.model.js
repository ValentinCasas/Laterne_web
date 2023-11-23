import { DataTypes } from "sequelize";
import connectionBD from "../db.js";

const Product = connectionBD.define(
    "Product",
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
        availavility: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        price: {
            type: DataTypes.DECIMAL,
            allowNull: true,
        },
        imageUrl: {
            type: DataTypes.STRING,
            allowNull: false,
        },

    },
    {
        tableName: "Product",
        timestamps: false,
    }
);

export default Product;
