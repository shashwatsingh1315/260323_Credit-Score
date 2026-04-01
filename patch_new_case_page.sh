sed -i -e 's/import { handleNewCase, fetchParties, fetchBranches, fetchEnumerations, fetchRmIntakeTasks, fetchActiveRoutingThresholds } from '\''\.\/actions'\'';/import { handleNewCase, fetchParties, fetchBranches, fetchEnumerations, fetchRmIntakeTasks, fetchActiveRoutingThresholds, fetchKams } from '\''\.\/actions'\'';/' src/app/cases/new/page.tsx

sed -i -e 's/const \[branches, setBranches\] = useState<any\[\]>(\[\]);/const [branches, setBranches] = useState<any[]>([]);\n  const [kams, setKams] = useState<any[]>([]);\n  const [kamUserId, setKamUserId] = useState<string>('\'''\'');/' src/app/cases/new/page.tsx

sed -i -e '/fetchBranches(),/i \        fetchKams(),' src/app/cases/new/page.tsx

sed -i -e 's/const \[p, b, prod, buckets, thresh\] = await Promise.all(\[/const [p, k, b, prod, buckets, thresh] = await Promise.all([/' src/app/cases/new/page.tsx

sed -i -e '/setBranches(b);/i \      setKams(k);' src/app/cases/new/page.tsx

sed -i -e 's/fd.set('\''branchId'\'', branchId);/fd.set('\''branchId'\'', branchId);\n    if (kamUserId) fd.set('\''kamUserId'\'', kamUserId);/' src/app/cases/new/page.tsx

sed -i -e '/<label>Branch \/ Region<\/label>/i \
              <div className={styles.inputGroup}>\n                <label>KAM Assignee *</label>\n                <select value={kamUserId} onChange={e => setKamUserId(e.target.value)} className={styles.input}>\n                  <option value="">-- Select KAM --</option>\n                  {kams.map((k: any) => <option key={k.id} value={k.id}>{k.full_name}<\/option>)}\n                </select>\n              <\/div>\n' src/app/cases/new/page.tsx

sed -i -e 's/if (!scenario || !customerPartyId) return false;/if (!scenario || !customerPartyId || !kamUserId) return false;/' src/app/cases/new/page.tsx
