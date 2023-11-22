import { Sequelize } from "sequelize";

const connectionBD = new Sequelize(
    "laterne",
    "root",
    "",
    {
        host: "localhost",
        dialect: "mysql",
    }
);

export default connectionBD;
