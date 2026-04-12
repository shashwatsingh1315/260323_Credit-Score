-- Phase 3 ID Logic Tables Setup

CREATE TABLE IF NOT EXISTS public.city_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(3) NOT NULL UNIQUE CHECK (code ~ '^[A-Z]{3}$'),
    name VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.id_prefixes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR NOT NULL UNIQUE,
    prefix VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.city_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.id_prefixes ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage city codes" ON public.city_codes
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'founder_admin'
        )
    );

-- Everyone can read city codes
CREATE POLICY "Everyone can view city codes" ON public.city_codes
    FOR SELECT
    USING (true);

-- Admins can do everything
CREATE POLICY "Admins can manage id prefixes" ON public.id_prefixes
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'founder_admin'
        )
    );

-- Everyone can read id prefixes
CREATE POLICY "Everyone can view id prefixes" ON public.id_prefixes
    FOR SELECT
    USING (true);

-- Seed Initial Data
INSERT INTO public.city_codes (code, name) VALUES
    ('RPR', 'Raipur'),
    ('NAG', 'Nagpur')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.id_prefixes (entity_type, prefix) VALUES
    ('contractor', 'C'),
    ('interior', 'IA'),
    ('lead_site', 'L'),
    ('converted_site', '')
ON CONFLICT (entity_type) DO NOTHING;
