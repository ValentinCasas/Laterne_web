-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 29-11-2023 a las 18:42:07
-- Versión del servidor: 10.4.24-MariaDB
-- Versión de PHP: 8.1.6

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `laterne`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `businessinfo`
--

CREATE TABLE `businessinfo` (
  `id` int(11) NOT NULL,
  `latitude` varchar(255) DEFAULT NULL,
  `longitude` varchar(255) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phoneNumber` bigint(20) DEFAULT NULL,
  `instagramUrl` varchar(255) DEFAULT NULL,
  `facebookUrl` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Volcado de datos para la tabla `businessinfo`
--

INSERT INTO `businessinfo` (`id`, `latitude`, `longitude`, `address`, `email`, `phoneNumber`, `instagramUrl`, `facebookUrl`) VALUES
(1, '-33.18273216', '-66.30910230', 'La Punta/San Luis', 'laterne@gmail.com', 2665018537, 'https://www.instagram.com/laternelapunta/', 'https://www.facebook.com/laternelapunta');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `category`
--

CREATE TABLE `category` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` varchar(255) NOT NULL,
  `imageUrl` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Volcado de datos para la tabla `category`
--

INSERT INTO `category` (`id`, `name`, `description`, `imageUrl`) VALUES
(52, 'BEBIDA SIN ALCOHOL', 'bebidas sin alcohol', 'bottle-1-svgrepo-com.png'),
(53, 'CERVEZAS LATERNE', 'cervezas', 'beer-svgrepo-com.png'),
(54, 'HAPPY HOUR Y PROMOS BEBIDAS', 'cervezas', 'offer-svgrepo-com.png'),
(55, 'MORFI Y ENTRE PANES', 'morfi y entre panes', 'fast-food-sandwich-svgrepo-com (1).png'),
(56, 'PIZZAS', 'pizzas', 'food-pizza-slice-svgrepo-com.png'),
(57, 'PROMOS Y DELIVERY', 'promos y delivery', 'shopping-cart-svgrepo-com.png'),
(58, 'EXTRAS', 'extras', 'cake-svgrepo-com.png'),
(59, 'VINOS Y ESPUMANTES', 'vinos y espumantes', 'glass-of-wine-svgrepo-com.png'),
(60, 'APERITIVOS', 'aperitivos', 'glass-svgrepo-com.png'),
(61, 'WHISKYS Y ESPIRITUOSOS', 'aperitivos', 'glass-svgrepo-com.png'),
(62, 'POSTRES', 'postres', 'ice-cream-in-cup-svgrepo-com.png'),
(63, 'CAFETERIA', 'cafeteria', 'coffee-svgrepo-com.png'),
(64, 'GIN ETERNAL', 'gin eternal', 'glass-of-wine-svgrepo-com.png'),
(65, 'BEBIDAS CON ALCOHOL', '', 'bottle-svgrepo-com.png');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `event`
--

CREATE TABLE `event` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `date` datetime DEFAULT NULL,
  `time` time DEFAULT NULL,
  `description` varchar(255) NOT NULL,
  `location` varchar(255) NOT NULL,
  `imageUrl` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `openinghour`
--

CREATE TABLE `openinghour` (
  `id` int(11) NOT NULL,
  `dayOfWeek` varchar(255) NOT NULL,
  `morningStartTime` time DEFAULT NULL,
  `morningEndTime` time DEFAULT NULL,
  `eveningStartTime` time DEFAULT NULL,
  `eveningEndTime` time DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Volcado de datos para la tabla `openinghour`
--

INSERT INTO `openinghour` (`id`, `dayOfWeek`, `morningStartTime`, `morningEndTime`, `eveningStartTime`, `eveningEndTime`) VALUES
(1, 'Lunes', '10:00:00', '14:00:00', '17:00:00', '23:00:00'),
(2, 'Martes', '10:00:00', '14:00:00', '17:00:00', '23:00:00'),
(3, 'Miércoles', '10:00:00', '14:00:00', '17:00:00', '23:00:00'),
(4, 'Jueves', '10:00:00', '14:00:00', '17:00:00', '23:00:00'),
(5, 'Viernes', '10:00:00', '14:00:00', '17:00:00', '23:00:00'),
(6, 'Sábado', '10:00:00', '14:00:00', '17:00:00', '23:00:00'),
(9, 'Domingo', '10:01:00', '14:00:00', '17:00:00', '23:00:00');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `product`
--

CREATE TABLE `product` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` varchar(700) NOT NULL,
  `availavility` varchar(255) DEFAULT NULL,
  `price` decimal(10,0) DEFAULT NULL,
  `imageUrl` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Volcado de datos para la tabla `product`
--

INSERT INTO `product` (`id`, `name`, `description`, `availavility`, `price`, `imageUrl`) VALUES
(47, 'Pizza peperoni', 'pizza con pedacitos de peperoni', 'disponible', '2700', 'fa8459e0-8e36-11ee-9ee3-e176a50db0b4.jpg'),
(48, 'Pizza rucula', 'pizza con pedacitos de rucula', 'disponible', '2700', '05826080-8e37-11ee-9ee3-e176a50db0b4.jpg'),
(49, 'Fideos con camarón', 'fideos con pedacitos de camaron', 'agotado', '5000', '17af1640-8e37-11ee-9ee3-e176a50db0b4.jpg'),
(50, 'Fideos con cebolla de verdeo', 'fideos con pedacitos de cebolla de verdeo', 'disponible', '1499', '2adf8060-8e37-11ee-9ee3-e176a50db0b4.jpg'),
(51, 'Fideos con milanesa', 'fideos con pedacitos de milanesa de pollo', 'disponible', '1499', '38fca150-8e37-11ee-9ee3-e176a50db0b4.jpg'),
(52, 'Camarones', 'camarones recien sacados del agua', 'disponible', '16000', '4c07a920-8e37-11ee-9ee3-e176a50db0b4.jpg'),
(53, 'Tacos', 'tacos bien picantes con los siguientes ingredientes: ingrediente 1, ingrediente 2, ...', 'disponible', '16000', '61646920-8e37-11ee-9ee3-e176a50db0b4.jpg'),
(54, 'Lasaña', 'La misma de la que come gaturro', 'disponible', '3250', '6dcb9cb0-8e37-11ee-9ee3-e176a50db0b4.jpg'),
(55, 'Papas con ketchup', 'no hay mucho que aclarar', 'disponible', '1200', '7d02e030-8e37-11ee-9ee3-e176a50db0b4.jpg'),
(56, 'Sanguche de pollo', 'sanguche de pollo bien salado', 'agotado', '1245', '367b3120-8e38-11ee-9ee3-e176a50db0b4.jpg'),
(57, 'Pancitos', 'Pancitos blancos rellenos de quedo', 'disponible', '600', '456edbf0-8e38-11ee-9ee3-e176a50db0b4.jpg'),
(58, 'Flan', 'flan de vainilla', 'disponible', '1200', '50f3ece0-8e38-11ee-9ee3-e176a50db0b4.jpg'),
(59, 'Cookieas laterne', 'galletitas con chispas de chocolate', 'disponible', '1200', '9e91c490-8e38-11ee-9ee3-e176a50db0b4.jpg'),
(60, 'Daikiri', 'bebida cheta', 'disponible', '1600', 'ac98ec80-8e38-11ee-9ee3-e176a50db0b4.jpg'),
(61, 'Jugo de naranja', 'naranja exprimida', 'disponible', '1000', 'c5d9eb90-8e38-11ee-9ee3-e176a50db0b4.jpg'),
(62, 'CAZUELA DE QUESO CRIOLLO Y CEREZAS AL MARRASQUINO', 'Macerado con la mejor botánica, seleccionados específicamente para esta versión de nuestro Gin Eternal. Enebro, coriandro, cardamomo, pimienta negra y/o rosa, romero, canela, clavo de olor, jengibre, anís, piel de naranja y piel de limón, son perfectamente cuidados y mezclados para obtener un gin perfumado, delicado, que explota de aromas y sabores al prepararlo.', 'disponible', '1000', 'd13a8490-8e38-11ee-9ee3-e176a50db0b4.jpg'),
(63, 'Cerveza IPA', 'traido de un tal rené', 'disponible', '1200', 'e1699590-8e38-11ee-9ee3-e176a50db0b4.jpg'),
(64, 'Cerveza CORONA', 'cerveza chetita', 'disponible', '1200', 'f78ba160-8e38-11ee-9ee3-e176a50db0b4.jpg'),
(66, 'vacio', 'vacio', 'disponible', '1222', 'product_default.png');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `productcategory`
--

CREATE TABLE `productcategory` (
  `id` int(11) NOT NULL,
  `productId` int(11) NOT NULL,
  `categoryId` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Volcado de datos para la tabla `productcategory`
--

INSERT INTO `productcategory` (`id`, `productId`, `categoryId`) VALUES
(386, 47, 56),
(387, 48, 56),
(388, 49, 55),
(389, 50, 55),
(390, 51, 55),
(391, 52, 55),
(392, 53, 55),
(393, 54, 55),
(394, 55, 58),
(395, 56, 55),
(396, 57, 60),
(397, 58, 62),
(398, 59, 62),
(400, 60, 65),
(401, 61, 52),
(403, 63, 53),
(404, 63, 65),
(405, 64, 53),
(406, 64, 65),
(407, 66, 52),
(409, 62, 52);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `testimonial`
--

CREATE TABLE `testimonial` (
  `id` int(11) NOT NULL,
  `description` varchar(255) NOT NULL,
  `state` tinyint(1) NOT NULL,
  `date` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `user`
--

CREATE TABLE `user` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` int(11) NOT NULL,
  `imageUrl` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Volcado de datos para la tabla `user`
--

INSERT INTO `user` (`id`, `name`, `email`, `password`, `role`, `imageUrl`) VALUES
(1, 'Valentin Casas', 'valen@gmail.com', '$2a$10$Q/Hd3Gbe9tgx6lSxXkmfNeDdOTMZ/.yxMEfuVPX6iCgVXebvOfxGq', 1, 'e8e94800-8cd1-11ee-8025-0bd2a50f1e16.jpg'),
(2, 'gino', 'gino@gmail.com', '$2a$10$v1cB.a6ze9Yk0tktojsbS.fv6K.W5tIkOsjFL5MlEf1sZEyduQQVq', 1, '5fa30190-8d5c-11ee-bfc2-d386c278be3f.jpg'),
(10, 'Empleado', 'empleado@gmail.com', '$2a$10$RSwRnDYoC4BjKnLobfOt9.CDgCXgbdW6sMyvUUmWVLefC3WWjD8eS', 2, 'avatar_profile_default.png');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `businessinfo`
--
ALTER TABLE `businessinfo`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `category`
--
ALTER TABLE `category`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `event`
--
ALTER TABLE `event`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `openinghour`
--
ALTER TABLE `openinghour`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `product`
--
ALTER TABLE `product`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `productcategory`
--
ALTER TABLE `productcategory`
  ADD PRIMARY KEY (`id`),
  ADD KEY `productId` (`productId`),
  ADD KEY `categoryId` (`categoryId`);

--
-- Indices de la tabla `testimonial`
--
ALTER TABLE `testimonial`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `user`
--
ALTER TABLE `user`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `businessinfo`
--
ALTER TABLE `businessinfo`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `category`
--
ALTER TABLE `category`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=66;

--
-- AUTO_INCREMENT de la tabla `event`
--
ALTER TABLE `event`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=108;

--
-- AUTO_INCREMENT de la tabla `openinghour`
--
ALTER TABLE `openinghour`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT de la tabla `product`
--
ALTER TABLE `product`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=67;

--
-- AUTO_INCREMENT de la tabla `productcategory`
--
ALTER TABLE `productcategory`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=410;

--
-- AUTO_INCREMENT de la tabla `testimonial`
--
ALTER TABLE `testimonial`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `user`
--
ALTER TABLE `user`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `productcategory`
--
ALTER TABLE `productcategory`
  ADD CONSTRAINT `productcategory_ibfk_1` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT `productcategory_ibfk_2` FOREIGN KEY (`categoryId`) REFERENCES `category` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
