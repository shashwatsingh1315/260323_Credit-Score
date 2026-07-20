ALTER TABLE public.review_cycles
  ADD COLUMN required_stage integer
  CHECK (required_stage BETWEEN 1 AND 3);

UPDATE public.personas
SET minimum_score = NULL
WHERE minimum_score = 0;
