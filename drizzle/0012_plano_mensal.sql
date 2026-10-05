DROP TABLE `monthly_initial_balances`;
--> statement-breakpoint
-- Orçamento por categoria vira estimativa (plano mensal), descontando as estimativas já existentes
-- nas subcategorias. Vai para a conta mais usada pelas estimativas; sem nenhuma, a 1ª conta corrente.
INSERT INTO `recurring_entries` (`account_id`, `category_id`, `description`, `day`, `amount`, `active`, `is_estimate`, `frequency`, `interval_months`)
SELECT
  COALESCE(
    (SELECT `account_id` FROM `recurring_entries` WHERE `is_estimate` = 1 AND `active` = 1 GROUP BY `account_id` ORDER BY COUNT(*) DESC, `account_id` LIMIT 1),
    (SELECT `id` FROM `accounts` WHERE `type` = 'bank_account' AND `is_active` = 1 ORDER BY `display_order`, `id` LIMIT 1)
  ),
  c.`id`,
  c.`name` || ' (outros)',
  15,
  -(ABS(c.`budget`) - COALESCE((
    SELECT SUM(ABS(r.`amount`)) FROM `recurring_entries` r
    JOIN `categories` sub ON sub.`id` = r.`category_id`
    WHERE r.`is_estimate` = 1 AND r.`active` = 1 AND sub.`parent_id` = c.`id`
  ), 0)),
  1, 1, 'monthly', 1
FROM `categories` c
WHERE c.`budget` IS NOT NULL
  AND ABS(c.`budget`) > COALESCE((
    SELECT SUM(ABS(r.`amount`)) FROM `recurring_entries` r
    JOIN `categories` sub ON sub.`id` = r.`category_id`
    WHERE r.`is_estimate` = 1 AND r.`active` = 1 AND sub.`parent_id` = c.`id`
  ), 0)
  AND NOT EXISTS (SELECT 1 FROM `recurring_entries` r WHERE r.`is_estimate` = 1 AND r.`category_id` = c.`id`)
  AND EXISTS (SELECT 1 FROM `accounts` WHERE `is_active` = 1);
--> statement-breakpoint
UPDATE `categories` SET `budget` = NULL WHERE `budget` IS NOT NULL;
