import Category from './category.model.js';
import Product from './product.model.js';
import ProductCategory from './productCategory.model.js'


/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
- belongsTo: Indica una relación de pertenencia en la que un modelo "pertenece a" otro. 
             Esto se utiliza para definir relaciones de uno a uno o de muchos a uno. Por ejemplo,
             si tienes un modelo Comment y un modelo User, puedes decir que un comentario 
             "pertenece a" un usuario. En términos de base de datos, esto podría significar que 
             la tabla de comentarios tiene una columna que contiene el ID del usuario al que pertenece el comentario.
             
- belongsToMany: Indica una relación de muchos a muchos, que es un tipo de relación en la que muchos
             registros de una tabla pueden estar asociados a muchos registros de otra tabla. 
             En el ejemplo de belongsToMany, Sequelize asume que hay una tabla intermedia 
             (también llamada tabla de unión o tabla pivot) que se utiliza para almacenar las asociaciones 
             entre los registros de ambas tablas. En el contexto de una relación muchos a muchos,
             el método belongsToMany especifica la tabla intermedia y las claves foráneas que la conectan
              con las tablas principales.
 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */


Product.belongsToMany(Category, { through: ProductCategory, foreignKey: 'productId' });

Category.belongsToMany(Product, { through: ProductCategory, foreignKey: 'categoryId' });

