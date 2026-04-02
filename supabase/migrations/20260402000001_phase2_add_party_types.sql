-- Add party_type and influencer_subtype to parties table
ALTER TABLE public.parties 
ADD COLUMN IF NOT EXISTS party_type TEXT,
ADD COLUMN IF NOT EXISTS influencer_subtype TEXT;

-- Normalize legacy contractor types
UPDATE public.parties 
SET party_type = 'influencer',
    influencer_subtype = 'contractor'
WHERE party_type = 'contractor';

-- Update existing records to have a safe default if needed (optional, assuming 'both' for existing backward compatibility)
UPDATE public.parties 
SET party_type = 'both' 
WHERE party_type IS NULL;
