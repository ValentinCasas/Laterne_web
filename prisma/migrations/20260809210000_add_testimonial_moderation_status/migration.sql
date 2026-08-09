ALTER TABLE `testimonial`
ADD COLUMN `moderationStatus` VARCHAR(20) NOT NULL DEFAULT 'pending';

UPDATE `testimonial`
SET `moderationStatus` = CASE
  WHEN `state` = 1 THEN 'approved'
  ELSE 'pending'
END;
