import app from './app.js';
import connectionBD from './db.js';

/* import './models/associations.js'; */

connectionBD.sync().then(() => {
    app.listen(3000, () => {
        console.log('server on port', 3000);
    });
});
