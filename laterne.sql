-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 14-12-2023 a las 00:51:29
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
(1, '-33.18273216', '-66.30910230', 'Bv. Carolina Tobar García 1000, Ciudad de La Punta. San Luis', 'laternelapunta@gmail.com', 2664466728, 'https://www.instagram.com/laternelapunta/', 'https://www.facebook.com/laternelapunta');

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
(65, 'BEBIDAS CON ALCOHOL', '', 'bottle-svgrepo-com.png'),
(66, 'MENÚ SIN TACC', '', 'wheat-svgrepo-com-removebg-preview.png'),
(69, 'ENTRADA Y PICOTEO', '', 'chicken-food-fries-svgrepo-com.png');

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

--
-- Volcado de datos para la tabla `event`
--

INSERT INTO `event` (`id`, `name`, `date`, `time`, `description`, `location`, `imageUrl`) VALUES
(108, 'YSY', '2023-10-31 00:00:00', '21:55:00', 'a volaaar', 'La Punta/ San Luis', '3ff44450-8fcb-11ee-9444-b1e84c5d1297.webp'),
(109, 'DUKI', '2023-10-28 00:00:00', '01:55:00', 'duki y emilia', 'La Punta/ San Luis', '51a2a250-8fcb-11ee-9444-b1e84c5d1297.webp'),
(110, 'OTRO GRUPO', '2023-10-30 00:00:00', '00:00:00', 'otro grupoooo', 'La Punta/ San Luis', NULL),
(111, 'MARIA BECERRA', NULL, '21:57:00', 'la nena de arg', 'La Punta/ San Luis', '8bf1d980-8fcb-11ee-9444-b1e84c5d1297.webp');

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
(1, 'Lunes', '11:30:00', '15:00:00', '19:00:00', NULL),
(2, 'Martes', '11:30:00', '15:00:00', '19:00:00', NULL),
(3, 'Miércoles', '11:30:00', '15:00:00', '19:00:00', NULL),
(4, 'Jueves', '11:30:00', '15:00:00', '19:00:00', NULL),
(5, 'Viernes', '11:30:00', '15:00:00', '19:00:00', NULL),
(6, 'Sábado', '11:30:00', '15:00:00', '19:00:00', NULL),
(9, 'Domingo', NULL, NULL, '20:00:00', '11:55:00');

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
(69, 'agua cn gas', '', 'agotado', '950', 'product_default.png'),
(70, 'AGUA MINERAL CON GAS 500CC', '', 'disponible', '950', 'product_default.png'),
(71, 'AGUA SABORIZADA LIMONADA 500CC', '', 'disponible', '950', 'product_default.png'),
(72, 'AGUA SABORIZADA MANZANA 500CC', '', 'disponible', '950', 'product_default.png'),
(73, 'AGUA SABORIZADA NARANJA DURAZNO 500CC', '', 'disponible', '950', 'product_default.png'),
(74, 'AGUA SABORIZADA PERA 500CC', '', 'disponible', '950', 'product_default.png'),
(75, 'AGUA SABORIZADA POMELO 500CC', '', 'disponible', '1800', 'product_default.png'),
(76, 'AGUA SABORIZADA 1,5 LTS', '', 'disponible', '950', 'product_default.png'),
(77, ' COCA COLA / PEPSI 500CC', '', 'disponible', '1000', 'product_default.png'),
(78, 'FANTA / MIRINDA NARANJA 500CC', '', 'disponible', '1000', 'product_default.png'),
(79, 'PASO DE LOS TOROS POMELO 500CC', '', 'disponible', '1000', 'product_default.png'),
(80, 'JARRA LIMONADA 1.5LTS', 'Jarra de Limonada con Menta y Jengibre', 'disponible', '2000', 'product_default.png'),
(81, 'GASEOSA 1,5 LTS (LÍNEA PEPSI O COCA COLA)', '', 'disponible', '2000', 'product_default.png'),
(82, 'LICUADOS', '', 'disponible', '1800', 'product_default.png'),
(83, 'JUGO EXPRIMIDO GRANDE', '', 'disponible', '1700', 'product_default.png'),
(84, 'GERMAN PILSEN PINTA', '', 'disponible', '1500', 'product_default.png'),
(85, 'GOLDEN ALE PINTA', '', 'disponible', '1500', 'product_default.png'),
(86, 'AMERICAN AMBER ALE PINTA', '', 'disponible', '1500', 'product_default.png'),
(87, 'BLACK RYE / STOUT PINTA', '', 'disponible', '1600', 'product_default.png'),
(88, 'NEIPA / IPA PINTA', '', 'disponible', '1700', 'product_default.png'),
(89, 'APA PINTA', '', 'disponible', '1600', 'product_default.png'),
(90, 'DOBLE IPA PINTA', '', 'disponible', '1700', 'product_default.png'),
(91, 'GERMAN PILSEN PITCHER', '', 'disponible', '3900', 'product_default.png'),
(92, 'GOLDEN ALE PITCHER', '', 'disponible', '3900', 'product_default.png'),
(93, 'AMERICAN AMBER ALE PITCHER', '', 'disponible', '3900', 'product_default.png'),
(94, 'APA PITCHER', '', 'disponible', '4300', 'product_default.png'),
(95, 'BLACK RYE / STOUT PITCHER', '', 'disponible', '4300', 'product_default.png'),
(96, 'NEIPA / IPA PITCHER', '', 'disponible', '4300', 'product_default.png'),
(97, 'DOBLE IPA PITCHER', '', 'disponible', '4300', 'product_default.png'),
(98, 'HAPPY HOUR GERMAN PILSEN', 'Promoción válida de 19 a 21Hs', 'disponible', '1200', 'product_default.png'),
(99, 'HAPPY HOUR GOLDEN ALE', 'Promoción válida de 19 a 21Hs', 'disponible', '1200', 'product_default.png'),
(100, 'HAPPY HOUR AMERICAN AMBER', 'Promoción válida de 19 a 21Hs', 'disponible', '1200', 'product_default.png'),
(101, 'HAPPY HOUR BLACK RYE / STOUT', 'Promoción válida de 19 a 21Hs', 'disponible', '1200', 'product_default.png'),
(102, 'HAPPY HOUR APA / IPA / DOBLE IPA', 'Promoción válida de 19 a 21Hs', 'disponible', '1200', 'product_default.png'),
(103, 'PROMO BOTELLA FERNET + COCA COLA', 'Promoción válida de 19 a 21Hs', 'disponible', '9900', 'product_default.png'),
(104, 'EMPANADA X 1 UN', 'Empanadas de Carne Desmechada / Jamón y Muzzarella', 'disponible', '450', 'product_default.png'),
(105, 'EMPANADA X 6 UNIDADES', 'Empanadas de Carne Desmechada / Jamón y Muzzarella', 'disponible', '2400', 'product_default.png'),
(106, 'EMPANADAS X 12 UNIDADES', 'Empanadas de Carne Desmechada / Jamón y Muzzarella', 'disponible', '4500', 'product_default.png'),
(107, 'TACOS DE CARNE', 'Tres Tacos de Carne Vacuna en Fajitas caseras. Se acompañan con salsas: Guacamole, Berenjenas Asadas y Picante.', 'disponible', '3800', 'product_default.png'),
(108, 'CAZUELA DE QUESO CRIOLLO Y CEREZAS AL MARRASQUINO', 'Cazuela de Queso Criollo y Cerezas al Marrasquino', 'disponible', '2400', 'product_default.png'),
(109, 'CROQUE LATERNE', 'Pan Árabe Tostado, Jamón Cocido, Cheddar, Cubierto de Salsa de Queso Azúl, Huevos Fritos y Cebollitas de Verdeo', 'disponible', '3200', 'product_default.png'),
(110, 'FRITAS ABURRIDAS', '', 'disponible', '2800', 'product_default.png'),
(111, 'FRITAS CON CHEDDAR', '', 'disponible', '2900', 'product_default.png'),
(112, 'FRITAS LATERNE', 'Con salsa de queso azul, cebollitas de verdeo y panceta crocante', 'disponible', '3200', 'product_default.png'),
(113, 'MEDIO TOSTADO', 'Pan de Elaboración Propia tipo Árabe, Jamón y Queso', 'disponible', '1300', 'product_default.png'),
(114, 'TOSTADO', 'Pan de Elaboración Propia tipo Árabe, Jamón y Queso', 'disponible', '2100', 'product_default.png'),
(115, 'NUGGET DE POLLO', 'Bocados de Pollo rebozados crocantes, Salsa Cheddar Y Tomate picante', 'disponible', '3900', 'product_default.png'),
(116, 'RABAS', 'Rabas Rebozadas Fritas con Lactonesa de ajo y Limón', 'disponible', '5500', 'product_default.png'),
(117, 'PANCHOTOTOTE', 'Pan de elaboración Propia, Salchicha Ahumada y Guacamole', 'disponible', '1550', 'product_default.png'),
(118, 'SANDWICH CERVECERO', 'En Pan de Elaboración Propia, Lechuga, Tomate, Queso, Jamón Crudo y Lacotonesa de Ajo', 'disponible', '2800', 'product_default.png'),
(119, 'ENSALADA LATERNE', 'Lechuga, Tomates, Rúcula, Pollo Grillado y Queso Parmesano', 'disponible', '2500', 'product_default.png'),
(120, 'TABLA LATERNE', 'Jamón crudo, queso criollo, queso azul, jamón cocido, salame picado fino, aceitunas, papitas y maní salado. Especial para Compartir!!!', 'disponible', '6800', 'product_default.png'),
(121, 'TABLA LA SATANAS', 'Milanesas Cortadas, Rabas, Empanadas de Carne Desmechada, Nugget´s de Pollo, Papas Fritas. Se acompaña con diferentes salsas. Especial Para Compartir', 'disponible', '9000', 'product_default.png'),
(122, 'LASAGNA DE CARNE Y VERDURA', 'Lasagna de Carne, Ricota y Verdura con corazón de Muzzarellla', 'disponible', '3800', 'product_default.png'),
(123, 'SANDWICH DE BONDIOLA BRASEADA', 'Bondiola de Cerdo, Vegetales, miel, cerveza English Brown; se acompaña con lechuga y tomates.Guarnición Papas Fritas', 'disponible', '3500', 'product_default.png'),
(124, 'HAMBURGUESA ARGENTA', 'Medallón de Carne, Provolone, Tomates Asados y Chimi. Guarnición de Papas Fritas', 'disponible', '3500', 'product_default.png'),
(125, 'HAMBURGUESA AZUL', 'Medallón de Carne, Queso Azúl y Rúcula. Guarnición de Papas Fritas', 'disponible', '3500', 'product_default.png'),
(126, 'HAMBURGUESA CLASICA', 'Medallón de Carne, Lechuga, Tomate, Jamón, Cheddar y Huevo. Guarnición de Papas Fritas', 'disponible', '3500', 'product_default.png'),
(127, 'HAMBURGUESA MEDITERRANEA', 'Medallón de Carne, Jamón Cocido, Muzzarella, Morrón Asado y Pasta de Aceitunas. Guarnición de Papas Fritas', 'disponible', '3700', 'product_default.png'),
(128, 'HAMBURGUESA MEXICANA', 'Medallón de Carne, Lechuga, Tomate, Cebolla Morada y Guacamole. Guarnición de Papas Fritas', 'disponible', '3600', 'product_default.png'),
(129, 'HAMBURGUESA AMERICANA', 'Doble Medallón de Carne, Doble Cheddar, Panceta, Pepinos, Cebolla Caramelizada y Salsa Barbacoa. Guarnición de Papas Fritas', 'disponible', '3900', 'product_default.png'),
(130, 'HAMBURGUESA VEGGIE', 'Medallón a base de lentejas, avena, remolacha, cebollas, zanahorias; se acompaña con lechuga y tomates. Guarnición de Papas Fritas', 'disponible', '3100', 'product_default.png'),
(131, 'LOMITO TRANKA', 'En Pan de Elaboración propia, Lomo de Ternera o Pollo, Jamón Cocido, Queso, Huevo, Tomate y Lechuga. Guarnición de Papas Fritas', 'disponible', '4900', 'product_default.png'),
(132, 'LOMO CLASICO', 'ESPECIAL PARA COMPARTIR!!! En Pan de Elaboración propia, Lomo de Ternera, Jamón Cocido, Queso, Huevos, Tomates y Lechuga. Guarnición de Papas Fritas', 'disponible', '8000', 'product_default.png'),
(133, 'LOMO DE POLLO CLASICO', 'ESPECIAL PARA COMPARTIR!!! En Pan de Elaboración propia, Suprema a la Plancha, Lechuga, Tomates, Jamón Cocido, Cheddar y Guarnición de Papas Fritas', 'disponible', '7700', 'product_default.png'),
(134, 'LOMO LATERNE', 'ESPECIAL PARA COMPARTIR!!! En Pan de Elaboración Propia, Lomo de Ternera, Cebolla Caramelizada, Panceta Ahumada., Cheddar, Rucula y Tomates. Guarnición de Papas Fritas', 'disponible', '8300', 'product_default.png'),
(135, 'MILANGA LA PUNALADA', 'ESPECIAL PARA COMPARTIR!!! Milanesa de Ternera, Salsa de Tomates, Jamón cocido, Muzzarella y Alioli de Ajo. Guarnición de Papas Fritas', 'disponible', '8000', 'product_default.png'),
(136, 'MILANESA OLD LATERNE', 'ESPECIAL PARA COMPARTIR!!! Milanesa de Ternera, Salsa de Tomates, Muzzarella, Rúcula, Nueces y Pasas. Guarnición de Papas Fritas', 'disponible', '8500', 'product_default.png'),
(137, 'PIZZA MUZZARELLA', 'Salsa, muzzarella y aceitunas', 'disponible', '3700', 'product_default.png'),
(138, 'PIZZA DOBLE MUZZARELLA', 'Salsa, doble muzzarella y aceitunas', 'disponible', '4050', 'product_default.png'),
(139, 'PIZZA MUZARELLA C/HUEVO', 'Salsa, muzzarella, huevo rallado y aceitunas', 'disponible', '4100', 'product_default.png'),
(140, 'PIZZA DE JAMON Y MORRONES', 'Salsa, jamón cocido, muzzarella, morrones y aceitunas', 'disponible', '4400', 'product_default.png'),
(141, 'PIZZA NAPOLITANA', 'Salsa, muzzarella, tomates, alioli de ajo y aceitunas', 'disponible', '4500', 'product_default.png'),
(142, 'PIZZA FUGAZZETA', 'Salsa, cebolla caramelizada, muzzarella y aceitunas', 'disponible', '4750', 'product_default.png'),
(143, 'PIZZA CALABRESA', 'Salsa, muzzarella, longaniza calabresa y aceitunas negras', 'disponible', '4800', 'product_default.png'),
(144, 'PIZZA CUATRO QUESOS', 'Salsa, muzzarella, provolone, parmesano, roquefort y aceitunas negras', 'disponible', '5100', 'product_default.png'),
(145, 'PIZZA PANCETA AHUMADA CON HUEVO', 'Salsa, muzzarella, panceta ahumada, huevo frito y aceitunas negras', 'disponible', '5150', 'product_default.png'),
(146, 'PIZZA PROVOLONE', 'Salsa, muzzarella, provolone y aceitunas negras', 'disponible', '5150', 'product_default.png'),
(147, 'PIZZA ROQUEFORT', 'Salsa, muzzarella, queso azul y aceitunas negras', 'disponible', '5150', 'product_default.png'),
(148, 'PIZZA RUCULA Y PARMESANO', 'Salsa, muzzarella, rúcula, parmesano, jamón crudo y aceitunas negras', 'disponible', '5200', 'product_default.png'),
(149, 'PIZZA TROPICAL', 'Salsa, muzzarella, ananá, azucar negro y Cerezas al Marrasquino', 'disponible', '5200', 'product_default.png'),
(150, 'CERVEZA NILSA BEER SIN TACC', 'Cerveza Nilsa a Base de Mijo. Consultar estilos Disponibles', 'disponible', '1950', 'product_default.png'),
(151, 'EMPANADAS SIN TACC X 3', 'Carne Cortada a Cuchillo', 'disponible', '3000', 'product_default.png'),
(152, 'ÑOQUIS SIN TACC', 'Harina de Arroz, Nuez Moscada, Salsa Blanca y Verdeo', 'disponible', '3100', 'product_default.png'),
(153, 'BONDIOLA AL HORNO SIN TACC', 'Bondiola al Horno en su salsa (Miel, Hiervas y mostaza). Se acompaña con Arroz con queso Crema y Cebollitas Caramelizadas', 'disponible', '3800', 'product_default.png'),
(154, 'CANELONES SIN TACC', 'Ricota, Acelga y salsa bolognesa', 'disponible', '3410', 'product_default.png'),
(155, 'BOWNIE MANTECOL SIN TACC', 'Brownie, Dulce de Leche y Mantecol', 'disponible', '1900', 'product_default.png'),
(156, 'PROMO 1 - DOS PIZZAS MUZZARELLA', '', 'disponible', '6600', 'product_default.png'),
(157, 'PROMO 2 - HAMBURGUESA + GASEOSA 500CC', 'Hamburguesa a elección (Clásica, Azúl o Argenta) + Gaseosa o Agua Saborizada de 500cc', 'disponible', '3900', 'product_default.png'),
(158, 'PROMO 3 - DOS HAMBURGUESAS', 'Hamburguesas a elección (Clásica, Azúl o Argenta)', 'disponible', '6100', 'product_default.png'),
(159, 'PROMO 4 - PIZZA JAMON + 1,5LTS', '', 'disponible', '6150', 'product_default.png'),
(160, 'PROMO 5 - PIZZA MUZZARELLA + 6 EMPANADAS', '', 'disponible', '5300', 'product_default.png'),
(161, 'PROMO 6 - PIZZA MUZZARELLA + GASEOSA 1,5LTS', '', 'disponible', '5100', 'product_default.png'),
(162, 'PROMO 7 - PIZZA MUZZARELLA + 1 LITRO DE CERVEZA', 'Pizza Muzzarella + 1 Litro de Cerveza a elección (envase de Obsequio)', 'disponible', '6300', 'product_default.png'),
(163, 'PROMO 8 - DOS HAMBURGUESAS + 1LT CERVEZA', 'Hamburguesa a elección (Clásica, Azúl o Argenta) + 1 Litro de Cerveza a elección (envase de Obsequio)', 'disponible', '9100', 'product_default.png'),
(164, 'CAZUELA DE ACEITUNAS', '', 'disponible', '900', 'product_default.png'),
(165, 'EXTRA DIP CHEDDAR Y/O SALSA', '', 'disponible', '350', 'product_default.png'),
(166, 'EXTRA MEDALLÓN DE CARNE', '', 'disponible', '680', 'product_default.png'),
(167, 'COPA DE VINO', '', 'disponible', '1700', 'product_default.png'),
(168, 'VINO PARTRIDGE - VIÑA LAS PERDICES 3/4', '', 'disponible', '2700', 'product_default.png'),
(169, 'VINO CORDERO CON PIEL DE LOBO 3/4', '', 'disponible', '3200', 'product_default.png'),
(170, 'VINO TRIVENTO RESERVE 3/4', '', 'disponible', '4500', 'product_default.png'),
(171, 'VINO ESPUMANTE PARTRIDGE EXTRA BRUT - VIÑA LAS PERDICES', '', 'disponible', '4000', 'product_default.png'),
(172, 'GIN ETERNAL BOTÁNICO', 'Gin Eternal Botánico', 'disponible', '2300', 'product_default.png'),
(173, 'GIN ETERNAL PINK/BLUE/MINT', 'Gin Eternal Pink/Blue/Mint', 'disponible', '2500', 'product_default.png'),
(174, 'GIN ETERNAL ROBLE', 'Gin Eternal Roble', 'disponible', '2500', 'product_default.png'),
(175, 'GIN ETERNAL CACAO', 'Gin Eterna Cacao', 'disponible', '2400', 'product_default.png'),
(176, 'APEROL SPRITZ', '', 'disponible', '2000', 'product_default.png'),
(177, 'CAMPARI ORANGE', 'Campari, Jugo de Naranja, Naranja y Hielo', 'disponible', '2200', 'product_default.png'),
(178, 'CAMPARI & TONIC', 'Campari, Tónica, Limón y Hielo', 'disponible', '2200', 'product_default.png'),
(179, 'CUBA LIBRE', 'Ron Blanco, Coca cola y hielo', 'disponible', '2400', 'product_default.png'),
(180, 'CYNAR JULEP', 'Cynar, Menta, Limón, Jugo de Limón, Almibar, Hielo y Gaseosa de Pomelo', 'disponible', '2200', 'product_default.png'),
(181, 'DAIKIRI', 'Fruta a alección (consultar), Almibar, Ron Blanco, Jugo de limón y Hielo', 'disponible', '2300', 'product_default.png'),
(182, 'FERNET CON COCA', 'Fernet Branca, Coca cola y hielo', 'disponible', '2300', 'product_default.png'),
(183, 'FERNET MENTA SPRITE', 'Fernet Branca Menta, Sprite y hielo', 'disponible', '2300', 'product_default.png'),
(184, 'GANCIA CON SPRITE', 'Gancia, Almibar, jugo de limón, Sprite y hielo', 'disponible', '2300', 'product_default.png'),
(185, 'HOP COLLINS', 'Gin, Jugo de Limón, Almíbar, Shot de Ipa y Hielo', 'disponible', '2400', 'product_default.png'),
(186, 'MALIBU PUNCH', 'Jugo de Naranja, Ron Malibú y Hielo', 'disponible', '2400', 'product_default.png'),
(187, 'PICO Y POMELO', 'Amargo Obrero, Gaseosa de Pomelo y Hielo', 'disponible', '2200', 'product_default.png'),
(188, 'VERMOUTH & TONIC', 'Carpano Rosso, Tónica, Naranja y Hielo', 'disponible', '2000', 'product_default.png'),
(189, 'SPEED CON VODKA', 'Sernova, Speed y Hielo', 'disponible', '2300', 'product_default.png'),
(190, 'MOJITO', 'Almibar, Menta, Lima, Ron Blanco, Soda y Hielo', 'disponible', '2400', 'product_default.png'),
(191, 'NEGRONI', 'Gin, Campari, Vermouth Rosso, Naranja y Hielo', 'disponible', '2500', 'product_default.png'),
(192, 'WHISKY SOUR', 'Whisky, Jugo de Limón, Almibar y Clara de Huevo', 'disponible', '3000', 'product_default.png'),
(193, 'IRISH LOVE', 'Coctel de Crema Irlandesa, Whisky, Crema Batida, Tía maría, Cacao y Hielo', 'disponible', '3000', 'product_default.png'),
(194, 'TRAGO ESPECIAL', '', 'disponible', '2600', 'product_default.png'),
(195, 'LEBLIM CREAM MEDIDA', 'Crema Irlandesa', 'disponible', '2100', 'product_default.png'),
(196, 'MEDIDA WHISKY JAMESON', '', 'disponible', '2700', 'product_default.png'),
(197, 'MEDIDA WHISKY JOHNNIE WALKER RED LABEL', '', 'disponible', '2900', 'product_default.png'),
(198, 'MEDIDA WHISKY JACK DANIELS', '', 'disponible', '3900', 'product_default.png'),
(199, 'MEDIDA LEBLIM CREAM (CREMA IRLANDESA)', '', 'disponible', '2200', 'product_default.png'),
(200, 'MEDIDA TÍA MARÍA', '', 'disponible', '2500', 'product_default.png'),
(201, 'BIRRAMISU', 'Nuestra Versión del tradicional postre, pero con un Toque de Cerveza Artesanal. Ideal para Compartir', 'disponible', '1800', 'product_default.png'),
(202, 'BOMBON ESCOSES', 'Bombón de crema helada de chocolate y chantilly relleno con ddl y cubierto con baño de repostería y crocante de maní', 'disponible', '980', 'product_default.png'),
(203, 'BOMBON SUIZO', 'Bombón de crema helada de Americana y Dulce de leche y cubierto con baño de repostería', 'disponible', '980', 'product_default.png'),
(204, 'CHOCOTORTA / OREO', 'Galletitas de chocolate, dulce de leche y queso crema.', 'disponible', '1450', 'product_default.png'),
(205, 'FLAN CASERO / BUDIN DE PAN', '', 'disponible', '1300', 'product_default.png'),
(206, 'PORCION TARTA', '', 'disponible', '1210', 'product_default.png'),
(207, 'CAFE EXPRESSO', '', 'disponible', '650', 'product_default.png'),
(208, 'CAFE AMERICANO/JARRITO', '', 'disponible', '700', 'product_default.png'),
(209, 'INFUSION', '', 'disponible', '700', 'product_default.png'),
(210, 'CAFE CON LECHE', '', 'disponible', '800', 'product_default.png'),
(211, 'CAFE DOBLE/CORTADO', '', 'disponible', '800', 'product_default.png'),
(212, 'CHOCOLATADA', '', 'disponible', '1200', 'product_default.png'),
(213, 'SUBMARINO', '', 'disponible', '1300', 'product_default.png'),
(214, 'GIN ETERNAL BOTANICO BOTELLA 760ML', 'Macerado con la mejor botánica, seleccionados específicamente para esta versión de nuestro Gin Eternal. Enebro, coriandro, cardamomo, pimienta negra y/o rosa, romero, canela, clavo de olor, jengibre, anís, piel de naranja y piel de limón, son perfectamente cuidados y mezclados para obtener un gin perfumado, delicado, que explota de aromas y sabores al prepararlo.', 'disponible', '13999', 'fc75a800-9267-11ee-aefa-3529348b1b8e.webp'),
(215, 'GIN ETERNAL CACAO 760ML', 'Versión invernal, con nibs de cacao de Ecuador y vainas de vainilla natural, que le otorgan un perfil único, que permite disfrutarlo solo o con hielo.', 'disponible', '15999', '10698930-9268-11ee-aefa-3529348b1b8e.webp'),
(216, 'GIN ETERNAL PINK/BLUE/MINT BOTELLA 760ML', '', 'disponible', '14999', 'product_default.png'),
(217, 'GIN ETERNAL ROBLE BOTELLA 760ML', 'Macerar nuestro Eternal Gin con chips de roble, con paciencia y tranquilidad, produce un gin diferente a todo lo que conoces. Notas a vainillas, cacao y la sedosidad propia de la madera, balancea a la perfección con los taninos de la madera y la botánica que seleccionamos para esta variedad.', 'disponible', '15999', '1e569970-9268-11ee-aefa-3529348b1b8e.webp');

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
(438, 70, 52),
(439, 71, 52),
(440, 72, 52),
(441, 73, 52),
(442, 74, 52),
(444, 76, 52),
(445, 75, 52),
(446, 77, 52),
(447, 78, 52),
(448, 79, 52),
(449, 80, 52),
(450, 81, 52),
(451, 82, 52),
(452, 83, 52),
(453, 84, 53),
(454, 85, 53),
(455, 86, 53),
(456, 87, 53),
(457, 88, 53),
(458, 89, 53),
(459, 90, 53),
(460, 91, 53),
(461, 92, 53),
(462, 93, 53),
(463, 94, 53),
(464, 95, 53),
(465, 96, 53),
(466, 97, 53),
(467, 98, 54),
(468, 99, 54),
(469, 100, 54),
(470, 101, 54),
(471, 102, 54),
(472, 103, 54),
(473, 104, 69),
(474, 105, 69),
(475, 106, 69),
(476, 107, 69),
(477, 108, 69),
(478, 109, 69),
(479, 110, 69),
(480, 111, 69),
(482, 112, 69),
(483, 113, 69),
(484, 114, 69),
(485, 115, 69),
(486, 116, 69),
(487, 117, 69),
(488, 118, 69),
(489, 119, 69),
(490, 120, 69),
(491, 121, 69),
(492, 122, 55),
(493, 123, 55),
(494, 124, 55),
(495, 125, 55),
(496, 126, 55),
(497, 127, 55),
(498, 128, 55),
(499, 129, 55),
(500, 130, 55),
(501, 131, 55),
(502, 132, 55),
(503, 133, 55),
(504, 134, 55),
(505, 135, 55),
(506, 136, 55),
(507, 137, 56),
(508, 138, 56),
(509, 139, 56),
(510, 140, 56),
(511, 141, 56),
(512, 142, 56),
(513, 143, 56),
(514, 144, 56),
(515, 145, 56),
(516, 146, 56),
(517, 147, 56),
(518, 148, 56),
(519, 149, 56),
(520, 150, 66),
(521, 151, 66),
(522, 152, 66),
(523, 153, 66),
(524, 154, 66),
(525, 155, 66),
(526, 156, 57),
(527, 157, 57),
(528, 158, 57),
(529, 159, 57),
(530, 160, 57),
(531, 161, 57),
(532, 162, 57),
(533, 163, 57),
(534, 164, 58),
(535, 165, 58),
(536, 166, 58),
(537, 167, 59),
(538, 168, 59),
(539, 169, 59),
(540, 170, 59),
(541, 171, 59),
(542, 172, 60),
(543, 173, 60),
(544, 174, 60),
(545, 175, 60),
(546, 176, 60),
(547, 177, 60),
(548, 178, 60),
(549, 179, 60),
(550, 180, 60),
(551, 181, 60),
(552, 182, 60),
(553, 183, 60),
(554, 184, 60),
(555, 185, 60),
(556, 186, 60),
(557, 187, 60),
(558, 188, 60),
(559, 189, 60),
(560, 190, 60),
(561, 191, 60),
(562, 192, 60),
(563, 193, 60),
(564, 194, 60),
(565, 195, 60),
(566, 196, 61),
(567, 197, 61),
(569, 199, 61),
(570, 200, 61),
(571, 198, 61),
(572, 201, 62),
(573, 202, 62),
(574, 203, 62),
(575, 204, 62),
(576, 205, 62),
(577, 206, 62),
(578, 207, 63),
(579, 208, 63),
(580, 209, 63),
(581, 210, 63),
(582, 211, 63),
(583, 212, 63),
(584, 213, 63),
(587, 216, 64),
(589, 214, 64),
(590, 215, 64),
(591, 217, 64),
(601, 69, 52),
(602, 69, 53);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `testimonial`
--

CREATE TABLE `testimonial` (
  `id` int(11) NOT NULL,
  `description` varchar(255) NOT NULL,
  `state` tinyint(1) NOT NULL,
  `date` date NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Volcado de datos para la tabla `testimonial`
--

INSERT INTO `testimonial` (`id`, `description`, `state`, `date`) VALUES
(2, 'Maravilloso lugar, super recomendable', 1, '2023-12-01'),
(3, 'No tardan nada en traer la comida :)', 1, '2023-12-08'),
(4, 'a mi si me gustó mucho!!', 1, '2023-12-01'),
(12, 'Bla bla bla ', 0, '2023-12-01'),
(13, 'Este es un comentario de prueba', 0, '2023-12-01'),
(14, 'Bla bla bla Bla bla Bla bla bla Bla bla bla Bla bla bla Bla bla bla Bla bla bla Bla bla bla Bla bBla bla bla Bla bla bla Bla bla bla Bla bla bla Bla bla bla Bla bla bla Bla bla bla Bla bla bla Bla bla bla Bla bla bla Bla bla bla Bla bla bla Bla bla bla Bl', 0, '2023-12-01'),
(15, 'Bla bla bla ', 1, '2023-12-01'),
(16, 'esto es un feedback malo', 1, '2023-12-02'),
(17, 'opino esto', 0, '2023-12-04'),
(18, 'qv ruzxzfzxf', 1, '2023-12-05');

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
(1, 'Valentin Casas', 'valen@gmail.com', '$2a$10$Q/Hd3Gbe9tgx6lSxXkmfNeDdOTMZ/.yxMEfuVPX6iCgVXebvOfxGq', 1, '0f564430-9307-11ee-8041-55ce02da9205.jpg'),
(2, 'gino', 'gino@gmail.com', '$2a$10$v1cB.a6ze9Yk0tktojsbS.fv6K.W5tIkOsjFL5MlEf1sZEyduQQVq', 1, '5fa30190-8d5c-11ee-bfc2-d386c278be3f.jpg'),
(10, 'b@gmail.com', 'b@gmail.com', '$2a$10$Fi2PcuD8huZpjBLV33koreoyMIhNhlsaWdEXFM3CJxYgptEk9lpuu', 2, 'avatar_profile_default.png');

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=73;

--
-- AUTO_INCREMENT de la tabla `event`
--
ALTER TABLE `event`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=121;

--
-- AUTO_INCREMENT de la tabla `openinghour`
--
ALTER TABLE `openinghour`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT de la tabla `product`
--
ALTER TABLE `product`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=221;

--
-- AUTO_INCREMENT de la tabla `productcategory`
--
ALTER TABLE `productcategory`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=603;

--
-- AUTO_INCREMENT de la tabla `testimonial`
--
ALTER TABLE `testimonial`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

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
