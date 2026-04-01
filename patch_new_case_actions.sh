sed -i -e '/export async function fetchBranches/i \
/**\n * Server action: Fetch KAM users.\n */\nexport async function fetchKams() {\n  const supabase = await createClient();\n  const { data } = await supabase\n    .from('\''profiles'\'')\n    .select('\''id, full_name, user_roles!inner(role)'\'')\n    .eq('\''user_roles.role'\'', '\''kam'\'')\n    .order('\''full_name'\'');\n  return data || [];\n}\n' src/app/cases/new/actions.ts

sed -i -e 's/const action = formData.get('\''action'\'') as string;/const action = formData.get('\''action'\'') as string;\n  const kamUserId = formData.get('\''kamUserId'\'') as string || undefined;/' src/app/cases/new/actions.ts

sed -i -e 's/rm_user_id: user.id,/rm_user_id: user.id,\n    kam_user_id: kamUserId,/' src/app/cases/new/actions.ts
