import app from './app.js';
import connectionBD from './db.js';
import './models/associations.js';

connectionBD.sync().then(() => {
    app.listen(3000, '0.0.0.0', () => {
        console.log('Server is running on port 3000');
    });
    
});
