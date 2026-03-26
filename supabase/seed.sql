-- Insert a default founder_admin user into auth.users
-- Email: admin@creditflow.local
-- Password: password123 (This is a hardcoded hashed version for development purposes)

INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'admin@creditflow.local',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  FALSE,
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Since the trigger might not have updated the profile or we need to guarantee the role:
-- We'll just upsert it

INSERT INTO public.profiles (id, full_name, email)
VALUES ('00000000-0000-0000-0000-000000000000', 'System Admin', 'admin@creditflow.local')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email;

INSERT INTO public.user_roles (user_id, role)
VALUES ('00000000-0000-0000-0000-000000000000', 'founder_admin')
ON CONFLICT (user_id, role) DO NOTHING;
