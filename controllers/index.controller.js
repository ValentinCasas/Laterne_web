import Event from "../models/event.model.js";

export const goIndex = async (req, res) => {
    const events = await Event.findAll();
    res.render("index", {Events : events})
};

export const goCardVirtual = async (req, res) => {

    //lo que necesito mandar a esta vista
    /* pasar todos los productos
    
     const products = [
     { id: 1, name: 'Producto 1', category: 'Bebidas sin alcohol' },
     { id: 2, name: 'Producto 2', category: 'Bebidas sin alcohol' },
     { id: 3, name: 'Producto 3', category: 'Comida' },
     // ... más productos
        ];


    const groupedProducts = products.reduce((acc, product) => {
    const category = product.category;

    if (!acc[category]) {
    acc[category] = [];
     }

     acc[category].push(product);
     return acc;
    }, {});
    */

    res.render("card_virtual")
};

export const goHome = async (req, res) => {
    res.render("home");
}
