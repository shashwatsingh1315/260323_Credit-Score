-- Keep administrator-managed vocabulary stable under retries and double submits.
-- Retain the earliest active spelling of each category/value pair.
WITH ranked_reasons AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY category, lower(btrim(value))
      ORDER BY is_active DESC, created_at ASC NULLS LAST, id ASC
    ) AS duplicate_rank
  FROM public.admin_enumerations
  WHERE category IN ('reason_for_credit', 'delay_reason')
)
DELETE FROM public.admin_enumerations
WHERE id IN (
  SELECT id
  FROM ranked_reasons
  WHERE duplicate_rank > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_enumerations_category_normalized_value_key
  ON public.admin_enumerations (category, lower(btrim(value)))
  WHERE category IN ('reason_for_credit', 'delay_reason');
