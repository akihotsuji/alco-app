ALTER TABLE `bottles` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `bottles_cellar_type_sort_idx` ON `bottles` (`cellar_id`,`drink_type`,`status`,`sort_order`);--> statement-breakpoint
-- 現行の棚表示（created_at 降順・同値は id 降順）を種類内の sort_order 0,1,2… に写す
UPDATE `bottles`
SET `sort_order` = (
  SELECT COUNT(*)
  FROM `bottles` AS `newer`
  WHERE `newer`.`cellar_id` = `bottles`.`cellar_id`
    AND `newer`.`drink_type` = `bottles`.`drink_type`
    AND `newer`.`status` = 'sealed'
    AND `bottles`.`status` = 'sealed'
    AND (
      `newer`.`created_at` > `bottles`.`created_at`
      OR (`newer`.`created_at` = `bottles`.`created_at` AND `newer`.`id` > `bottles`.`id`)
    )
)
WHERE `status` = 'sealed';
