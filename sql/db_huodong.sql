CREATE TABLE IF NOT EXISTS `huodong` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `charid` INT(11) NOT NULL,
  `huodongid` INT(11) NOT NULL,
  `status` INT(11) NOT NULL DEFAULT '0',
  `expiration` bigint(20) NOT NULL DEFAULT '-1',
  PRIMARY KEY (`id`)
) ENGINE=INNODB DEFAULT CHARSET=utf8 AUTO_INCREMENT=1;

UPDATE inventoryitems SET expiration = 1654911285218 WHERE itemid = 5360000;
UPDATE inventoryitems SET expiration = 1654911285218 WHERE itemid = 5211060;