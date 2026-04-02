"use client";
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PartyDialog } from '@/components/admin/PartyDialog';
import { deactivateParty, assignRole, revokeRole, importPartiesCsv, adminCreateUser, adminDeleteUser } from './actions';
import { Plus, Pencil, Trash2, UserCog, Building2, History, ShieldCheck, Upload } from 'lucide-react';
import { toast } from 'sonner';

const ROLES = ['rm', 'kam', 'accounts', 'bdo', 'ordinary_approver', 'board_member', 'founder_admin'];

interface AdminClientProps {
  users: any[];
  parties: any[];
  auditLog: any[];
}

export default function AdminClient({ users, parties, auditLog }: AdminClientProps) {
  const [partyOpen, setPartyOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  const handleImportSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsImporting(true);
    const formData = new FormData(e.currentTarget);
    const res = await importPartiesCsv(formData);
    setIsImporting(false);
    if (res?.success) {
      toast.success('Parties imported successfully');
      setImportOpen(false);
    } else {
      toast.error(res?.error || 'Import failed');
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const res = await adminCreateUser(formData);
    if (res?.success) {
      toast.success('User created successfully');
      setUserOpen(false);
    } else {
      toast.error(res?.error || 'Failed to create user');
    }
  };

  const handleRoleAction = async (formData: FormData, action: (fd: FormData) => Promise<any>, successMsg: string) => {
    const res = await action(formData);
    if (res?.success) {
      toast.success(successMsg);
    } else {
      toast.error(res?.error || 'Action failed');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage parties, users, roles, and system logs</p>
      </div>

      <Tabs defaultValue="parties">
        <div className="flex justify-between items-center w-full">
          <TabsList>
            <TabsTrigger value="parties"><Building2 size={15} /> Party Master</TabsTrigger>
            <TabsTrigger value="users"><UserCog size={15} /> Users & Roles</TabsTrigger>
            <TabsTrigger value="audit"><History size={15} /> Global Audit Log</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 pr-4">
             <Button variant="outline" size="sm" asChild>
               <a href="/admin/imports">Go to Data Imports</a>
             </Button>
             <Button variant="outline" size="sm" asChild>
               <a href="/admin/aliases">Party Merge & Aliases</a>
             </Button>
          </div>
        </div>

        {/* ─── Party Master ─── */}
        <TabsContent value="parties" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{parties.length} parties registered</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                <Upload size={15} /> Import CSV
              </Button>
              <Button size="sm" onClick={() => { setEditingParty(null); setPartyOpen(true); }}>
                <Plus size={15} /> Add Party
              </Button>
            </div>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Legal Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Credit Limit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parties.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No parties yet.</TableCell></TableRow>
                )}
                {parties.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.legal_name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.customer_code}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{p.industry_category || '—'}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{p.gst_number || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{p.address || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{p.pan_number || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={p.is_active ? 'success' : 'secondary'}>{p.is_active ? 'Active' : 'Inactive'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingParty(p); setPartyOpen(true); }}>
                          <Pencil size={15} />
                        </Button>
                        <form action={(fd) => handleRoleAction(fd, deactivateParty, 'Party deactivated')}>
                          <input type="hidden" name="id" value={p.id} />
                          <Button variant="ghost" size="icon" type="submit" className="text-destructive hover:text-destructive"><Trash2 size={15} /></Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ─── Users & Roles ─── */}
        <TabsContent value="users" className="space-y-4">
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck size={16} className="text-primary" /> Create New User
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateUserSubmit} className="flex flex-wrap gap-2 items-end">
                <div className="space-y-1">
                  <Label>Full Name</Label>
                  <Input name="full_name" required placeholder="John Doe" className="w-48" />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input name="email" type="email" required placeholder="john@example.com" className="w-48" />
                </div>
                <div className="space-y-1">
                  <Label>Password</Label>
                  <Input name="password" type="password" required placeholder="Password123" className="w-48" />
                </div>
                <div className="space-y-1">
                  <Label>Initial Role</Label>
                  <select name="role" required className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:ring-1 focus:ring-primary w-48">
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <Button type="submit">Create User</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck size={16} className="text-primary" /> User Role Management
              </CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Current Roles</TableHead>
                  <TableHead>Assign Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No users yet.</TableCell></TableRow>
                )}
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || 'No name'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(u.roles || []).map((r: any) => (
                          <form key={r.role} action={(fd) => handleRoleAction(fd, revokeRole, 'Role revoked')} className="inline">
                            <input type="hidden" name="userId" value={u.id} />
                            <input type="hidden" name="role" value={r.role} />
                            <button type="submit" title="Click to revoke">
                              <Badge variant="info" className="capitalize cursor-pointer hover:bg-red-500/20 hover:text-red-400">
                                {r.role}
                              </Badge>
                            </button>
                          </form>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <form action={(fd) => handleRoleAction(fd, assignRole, 'Role assigned')} className="flex gap-2">
                        <input type="hidden" name="userId" value={u.id} />
                        <select name="role" className="flex h-8 rounded-lg border border-input bg-transparent px-2 text-xs">
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <Button type="submit" size="sm" variant="outline">Assign</Button>
                      </form>
                    </TableCell>
                    <TableCell className="text-right">
                      <form action={(fd) => handleRoleAction(fd, adminDeleteUser, 'User deleted')}>
                        <input type="hidden" name="userId" value={u.id} />
                        <Button type="submit" variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 size={15} />
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ─── Global Audit Log ─── */}
        <TabsContent value="audit">
          <Card>
            <CardContent className="pt-4">
              <div className="relative pl-6 space-y-0">
                <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
                {auditLog.length === 0 && <p className="text-muted-foreground text-sm">No audit events yet.</p>}
                {auditLog.map((e: any) => (
                  <div key={e.id} className="relative pb-4 last:pb-0">
                    <div className="absolute -left-4 top-1.5 w-2 h-2 rounded-full bg-muted-foreground" />
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm">{e.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {e.actor?.full_name || e.actor?.email || 'System'} · {e.event_type}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{new Date(e.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Party Form Dialog */}
      <PartyDialog open={partyOpen} onOpenChange={setPartyOpen} editingParty={editingParty} />

      {/* CSV Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Import Parties (CSV)</DialogTitle></DialogHeader>
          <form onSubmit={handleImportSubmit} className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Upload a CSV file with the following headers: <code>legal_name, customer_code, party_type, gstin, pan, city, credit_limit</code>
              </p>
              <Input type="file" name="file" accept=".csv" required className="cursor-pointer" />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)} disabled={isImporting}>Cancel</Button>
              <Button type="submit" disabled={isImporting}>{isImporting ? 'Importing...' : 'Upload & Import'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
