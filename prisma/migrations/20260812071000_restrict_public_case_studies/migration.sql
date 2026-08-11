UPDATE `successcase` AS `sc`
INNER JOIN `tenant` AS `t` ON `t`.`id` = `sc`.`tenantId`
SET `sc`.`isPublicCaseStudy` = false
WHERE `t`.`slug` NOT IN ('laterne', 'soderia');
