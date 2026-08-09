-- Normaliza nombres históricos y conserva el id como sufijo para evitar colisiones.
UPDATE `product`
SET `slug` = CONCAT(
  TRIM(BOTH '-' FROM REGEXP_REPLACE(
    LOWER(
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        `name`,
        'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u'),
        'ü', 'u'), 'ñ', 'n'), 'Á', 'a'), 'É', 'e'), 'Í', 'i'), 'Ó', 'o')
    ),
    '[^a-z0-9]+',
    '-'
  )),
  '-',
  `id`
);

UPDATE `category`
SET `slug` = CONCAT(
  TRIM(BOTH '-' FROM REGEXP_REPLACE(
    LOWER(
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        `name`,
        'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u'),
        'ü', 'u'), 'ñ', 'n'), 'Á', 'a'), 'É', 'e'), 'Í', 'i'), 'Ó', 'o')
    ),
    '[^a-z0-9]+',
    '-'
  )),
  '-',
  `id`
);
