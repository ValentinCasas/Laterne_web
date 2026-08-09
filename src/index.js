import app from './app.js';
import connectionBD from './db.js';
import './models/associations.js';
import { HOST, PORT } from './config.js';

const startServer = async () => {
  try {
    await connectionBD.authenticate();
    await connectionBD.sync();

    app.listen(PORT, HOST, () => {
      console.log(`Laterne disponible en http://${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error('No se pudo iniciar Laterne:', error);
    process.exitCode = 1;
  }
};

startServer();
