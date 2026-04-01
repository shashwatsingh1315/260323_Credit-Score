sed -i -e 's/rm_user_id: string;/rm_user_id: string;\n  kam_user_id?: string;/' src/utils/engine.ts
sed -i -e 's/rm_user_id: data.rm_user_id,/rm_user_id: data.rm_user_id,\n      kam_user_id: data.kam_user_id,/' src/utils/engine.ts
