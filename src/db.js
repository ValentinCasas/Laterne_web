import { Sequelize } from "sequelize";
import { DATABASE } from './config.js';

const connectionBD = new Sequelize(
    DATABASE.name,
    DATABASE.user,
    DATABASE.password,
    {
        host: DATABASE.host,
        port: DATABASE.port,
        dialect: 'mysql',
        logging: false,
    }
);

export default connectionBD;
