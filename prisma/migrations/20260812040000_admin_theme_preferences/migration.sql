ALTER TABLE `brandsettings`
    ADD COLUMN `adminTheme` VARCHAR(30) NOT NULL DEFAULT 'menuclick-dark',
    ADD COLUMN `adminAccent` VARCHAR(20) NOT NULL DEFAULT '#ec4899';
