import { DataTypes } from "sequelize";
import connectionBD from "../db.js";

const ProductCategory = connectionBD.define(
    "ProductCategory",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        productId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "Product",
                key: "id",
            },
        },
        categoryId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "Category", 
                key: "id",        
            },
        },


    },
    {
        tableName: "ProductCategory",
        timestamps: false,
    }
);

export default ProductCategory;
