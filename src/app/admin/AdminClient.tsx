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
    <div className="space-y-10 pb-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin Panel</h1>
        <p className="text-sm font-medium text-muted-foreground">Manage parties, users, roles, and system logs</p>
      </div>

      <Tabs defaultValue="parties" className="mt-8">
        <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center w-full gap-4 mb-8">
          <TabsList className="h-14 bg-muted/40 p-1 rounded-2xl w-full md:w-auto justify-start overflow-x-auto flex-nowrap border border-border/40 shadow-inner">
            <TabsTrigger value="parties" className="rounded-xl px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all font-semibold"><Building2 size={16} className="mr-2" /> Party Master</TabsTrigger>
            <TabsTrigger value="users" className="rounded-xl px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all font-semibold"><UserCog size={16} className="mr-2" /> Users & Roles</TabsTrigger>
            <TabsTrigger value="audit" className="rounded-xl px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all font-semibold"><History size={16} className="mr-2" /> Global Audit Log</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3">
             <Button variant="outline" className="h-10 px-5 rounded-xl font-bold shadow-sm" asChild>
               <a href="/admin/imports">Data Imports</a>
             </Button>
             <Button variant="outline" className="h-10 px-5 rounded-xl font-bold shadow-sm" asChild>
               <a href="/admin/aliases">Merge & Aliases</a>
             </Button>
          </div>
        </div>

        {/* ─── Party Master ─── */}
        <TabsContent value="parties" className="space-y-6 focus:outline-none focus-visible:ring-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/20 p-4 rounded-2xl border border-border/40">
            <p className="text-sm font-bold text-muted-foreground tracking-wide uppercase px-2">{parties.length} parties registered</p>
            <div className="flex flex-wrap gap-3">
              <Button className="h-10 px-5 rounded-xl font-bold shadow-sm" variant="outline" onClick={() => setImportOpen(true)}>
                <Upload size={16} className="mr-2" /> Import CSV
              </Button>
              <Button className="h-10 px-5 rounded-xl font-bold shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => { setEditingParty(null); setPartyOpen(true); }}>
                <Plus size={16} className="mr-2" /> Add Party
              </Button>
            </div>
          </div>
          <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-bold uppercase tracking-wider text-xs">Legal Name</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-xs">Code</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-xs">Type</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-xs">Industry</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-xs">GSTIN</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-xs">PAN</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-xs">Status</TableHead>
                    <TableHead className="text-right font-bold uppercase tracking-wider text-xs pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parties.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-16 font-medium">No parties yet.</TableCell></TableRow>
                  )}
                  {parties.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell className="font-bold text-foreground">{p.legal_name}</TableCell>
                      <TableCell className="text-muted-foreground font-medium text-xs">{p.customer_code}</TableCell>
                      <TableCell>
                        <span className="capitalize font-semibold text-sm">{p.party_type || 'Both'}</span>
                        {p.influencer_subtype && (
                          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider ml-1.5 opacity-70">({p.influencer_subtype})</span>
                        )}
                      </TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize px-2.5 py-0.5 rounded-md font-bold text-[11px] tracking-wider">{p.industry_category || '—'}</Badge></TableCell>
                      <TableCell className="text-muted-foreground font-medium text-xs">{p.gst_number || '—'}</TableCell>
                      <TableCell className="text-muted-foreground font-medium text-xs">{p.pan_number || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={p.is_active ? 'success' : 'secondary'} className="px-2.5 py-0.5 rounded-md font-bold text-[11px] tracking-wider uppercase">{p.is_active ? 'Active' : 'Inactive'}</Badge>
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex justify-end gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:text-primary hover:bg-primary/10 transition-colors" onClick={() => { setEditingParty(p); setPartyOpen(true); }}>
                            <Pencil size={15} />
                          </Button>
                          <form action={(fd) => handleRoleAction(fd, deactivateParty, 'Party deactivated')}>
                            <input type="hidden" name="id" value={p.id} />
                            <Button variant="ghost" size="icon" type="submit" className="h-8 w-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 size={15} /></Button>
                          </form>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ─── Users & Roles ─── */}
        <TabsContent value="users" className="space-y-6 focus:outline-none focus-visible:ring-0">
          <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/30 bg-muted/10">
              <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                  <ShieldCheck size={16} />
                </div>
                Create New User
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleCreateUserSubmit} className="flex flex-col lg:flex-row gap-5 items-start lg:items-end">
                <div className="space-y-2 w-full lg:w-48">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name</Label>
                  <Input name="full_name" required placeholder="John Doe" className="h-11 rounded-xl w-full" />
                </div>
                <div className="space-y-2 w-full lg:w-48">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</Label>
                  <Input name="email" type="email" required placeholder="john@example.com" className="h-11 rounded-xl w-full" />
                </div>
                <div className="space-y-2 w-full lg:w-48">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Password</Label>
                  <Input name="password" type="password" required placeholder="Password123" className="h-11 rounded-xl w-full" />
                </div>
                <div className="space-y-2 w-full lg:w-48">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Initial Role</Label>
                  <select name="role" required className="flex h-11 rounded-xl border border-input bg-background px-4 py-2 text-sm shadow-sm focus:ring-1 focus:ring-primary w-full outline-none font-medium">
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <Button type="submit" className="h-11 px-8 rounded-xl font-bold shadow-sm w-full lg:w-auto">Create User</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/30 bg-muted/10">
              <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                  <UserCog size={16} />
                </div>
                User Role Management
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-bold uppercase tracking-wider text-xs pl-6">User</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-xs">Email</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-xs">Current Roles</TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-xs">Assign Role</TableHead>
                    <TableHead className="text-right font-bold uppercase tracking-wider text-xs pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-16 font-medium">No users yet.</TableCell></TableRow>
                  )}
                  {users.map((u) => (
                    <TableRow key={u.id} className="hover:bg-muted/5 transition-colors">
                      <TableCell className="font-bold text-foreground pl-6">{u.full_name || 'No name'}</TableCell>
                      <TableCell className="text-muted-foreground font-medium text-sm">{u.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {(u.roles || []).map((r: any) => (
                            <form key={r.role} action={(fd) => handleRoleAction(fd, revokeRole, 'Role revoked')} className="inline">
                              <input type="hidden" name="userId" value={u.id} />
                              <input type="hidden" name="role" value={r.role} />
                              <button type="submit" title="Click to revoke" className="hover:scale-105 transition-transform">
                                <Badge variant="info" className="capitalize px-2.5 py-1 rounded-md font-bold text-[11px] tracking-wider hover:bg-destructive/10 hover:text-destructive hover:border-transparent transition-colors">
                                  {r.role}
                                </Badge>
                              </button>
                            </form>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <form action={(fd) => handleRoleAction(fd, assignRole, 'Role assigned')} className="flex items-center gap-2">
                          <input type="hidden" name="userId" value={u.id} />
                          <select name="role" className="flex h-9 rounded-lg border border-input bg-background px-3 text-sm font-medium outline-none focus:ring-1 focus:ring-primary shadow-sm min-w-[140px]">
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <Button type="submit" size="sm" variant="outline" className="h-9 px-4 rounded-lg font-bold shadow-sm">Assign</Button>
                        </form>
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <form action={(fd) => handleRoleAction(fd, adminDeleteUser, 'User deleted')}>
                          <input type="hidden" name="userId" value={u.id} />
                          <Button type="submit" variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors">
                            <Trash2 size={15} />
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ─── Global Audit Log ─── */}
        <TabsContent value="audit" className="focus:outline-none focus-visible:ring-0">
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="p-8">
              <div className="relative pl-8 space-y-0">
                <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border/60 rounded-full" />
                {auditLog.length === 0 && <p className="text-muted-foreground font-medium py-12 text-center">No audit events yet.</p>}
                {auditLog.map((e: any, idx: number) => (
                  <div key={e.id} className={`relative pb-8 ${idx === auditLog.length - 1 ? 'pb-0' : ''}`}>
                    <div className="absolute -left-[26px] top-1.5 w-3 h-3 rounded-full bg-primary ring-4 ring-background border border-primary/20" />
                    <div className="bg-muted/10 p-5 rounded-xl border border-border/40 hover:bg-muted/20 transition-colors w-full">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-1.5">
                          <p className="text-base font-bold text-foreground leading-snug">{e.description}</p>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                            <span className="text-foreground/70">{e.actor?.full_name || e.actor?.email || 'System'}</span> <span className="mx-1 opacity-50">·</span> {e.event_type}
                          </p>
                        </div>
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider bg-background px-2.5 py-1 rounded-md border border-border/50 shrink-0 self-start">{new Date(e.created_at).toLocaleString()}</span>
                      </div>
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
