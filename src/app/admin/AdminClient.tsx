"use client";
import { formatDateTimeIST } from '@/lib/format';
import { useEffect, useState, useTransition } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PartyDialog } from '@/components/admin/PartyDialog';
import { ConfirmDialog } from '@/components/creditflow/ConfirmDialog';
import { LoadFailed } from '@/components/creditflow/LoadFailed';
import {
  deactivateParty, reactivateParty, assignRole, revokeRole, adminCreateUser, adminDeleteUser,
  fetchUserDeletionImpact, updateCommitteeRoster, recomputePartyHistoryFromOutcomes,
} from './actions';
import { SubmitButton } from '@/components/ui/submit-button';

import { Plus, Pencil, Trash2, UserCog, Building2, History, ShieldCheck, Upload, Users, Ban, X } from 'lucide-react';
import { toast } from 'sonner';

const ROLES = ['rm', 'kam', 'accounts', 'bdo', 'ordinary_approver', 'board_member', 'founder_admin'];

type UserRole = { role: string };

type AdminUser = {
  id: string;
  full_name: string | null;
  email: string;
  roles?: UserRole[] | null;
};

type AdminParty = {
  id: string;
  legal_name: string;
  customer_code: string | null;
  party_type: string | null;
  influencer_subtype: string | null;
  industry_category: string | null;
  gst_number: string | null;
  pan_number: string | null;
  is_active: boolean;
};

type AuditEvent = {
  id: string;
  description: string | null;
  event_type: string;
  created_at: string;
  actor?: { full_name: string | null; email: string | null } | null;
};

interface AdminClientProps {
  users: AdminUser[];
  parties: AdminParty[];
  partiesError?: boolean;
  auditLog: AuditEvent[];
  auditError?: boolean;
  activeRoster?: { member_ids: string[] | null } | null;
}

type DeletionImpact = {
  isSelf: boolean;
  ownedCases: number;
  tasks: number;
  auditRecords: number;
  onRoster: boolean;
};

export default function AdminClient({ users, parties, partiesError = false, auditLog, auditError = false, activeRoster }: AdminClientProps) {
  const [partyOpen, setPartyOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<AdminParty | null>(null);
  const [userOpen, setUserOpen] = useState(false);
  const [rosterMemberIds, setRosterMemberIds] = useState<string[]>(activeRoster?.member_ids || []);
  const [isSavingRoster, setIsSavingRoster] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [pendingDeactivate, setPendingDeactivate] = useState<AdminParty | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<DeletionImpact | null>(null);
  const [impactError, setImpactError] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<{ user: AdminUser; role: string } | null>(null);

  const founderCount = users.filter(u => u.roles?.some(r => r.role === 'founder_admin')).length;

  const openDelete = (user: AdminUser) => {
    setDeleteImpact(null);
    setImpactError(false);
    setPendingDelete(user);
  };

  const closeDelete = () => {
    setPendingDelete(null);
    setDeleteImpact(null);
    setImpactError(false);
  };

  // Load the consequence preview for the user being deleted. State is cleared in openDelete/closeDelete.
  useEffect(() => {
    if (!pendingDelete) return;
    let cancelled = false;
    fetchUserDeletionImpact(pendingDelete.id)
      .then(res => {
        if (cancelled) return;
        if (res.success) setDeleteImpact(res.impact);
        else setImpactError(true);
      })
      .catch(() => { if (!cancelled) setImpactError(true); });
    return () => { cancelled = true; };
  }, [pendingDelete]);

  const deleteBlocked = !!deleteImpact && !deleteImpact.isSelf &&
    deleteImpact.ownedCases + deleteImpact.tasks + deleteImpact.auditRecords > 0;

  const deleteConsequences = (() => {
    if (!pendingDelete) return [];
    if (impactError) {
      return [
        'Their sign-in is permanently removed and they lose access immediately.',
        "Couldn't load linked records. The server will still check before deleting.",
      ];
    }
    if (!deleteImpact) return ['Checking linked cases, tasks and history…'];
    if (deleteImpact.isSelf) return ['This is your own account. You cannot delete it.'];
    const items: string[] = [];
    items.push('Their sign-in is permanently removed and they lose access immediately.');
    if (deleteBlocked) {
      items.push(`Blocked: linked to ${deleteImpact.ownedCases} case(s), ${deleteImpact.tasks} task(s) (assigned or completed) and ${deleteImpact.auditRecords} audit record(s). Revoke their roles instead.`);
    } else {
      items.push('No open cases, tasks or audit records found. The delete may still be blocked if the user has other history.');
    }
    if (deleteImpact.onRoster) items.push('They are still on the committee roster and will show as Unknown User.');
    return items;
  })();

  const handleCreateUserSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await adminCreateUser(formData);
      if (res?.success) {
        toast.success('User created successfully');
        setUserOpen(false);
      } else {
        toast.error(res?.error || 'Failed to create user');
      }
    });
  };

  const handleRoleAction = async (
    formData: FormData,
    action: (fd: FormData) => Promise<{ success?: boolean; error?: string } | undefined>,
    successMsg: string,
  ) => {
    startTransition(async () => {
      const res = await action(formData);
      if (res?.success) {
        toast.success(successMsg);
      } else {
        toast.error(res?.error || 'Action failed');
      }
    });
  };

  const handleUpdateRoster = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingRoster(true);
    const formData = new FormData();
    formData.append('memberIds', JSON.stringify(rosterMemberIds));
    const res = await updateCommitteeRoster(formData);
    setIsSavingRoster(false);
    if (res.success) {
      toast.success('Committee roster updated');
    } else {
      toast.error(res.error || 'Failed to update roster');
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
            <TabsTrigger value="roster"><Users size={15} /> Committee Roster</TabsTrigger>
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
            <p className="text-sm text-muted-foreground">{partiesError ? 'Party master unavailable' : `${parties.length} parties registered`}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  startTransition(async () => {
                    try {
                      const res = await recomputePartyHistoryFromOutcomes();
                      toast.success(`Recomputed history for ${res.updated} parties.`);
                    } catch (e) {
                      toast.error((e instanceof Error && e.message) || 'Failed to sync history');
                    }
                  });
                }}
                disabled={isPending}
              >
                <History size={15} className="mr-1" /> Sync Payment History
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href="/admin/imports?type=party_master"><Upload size={15} /> Import CSV</a>
              </Button>
              <Button size="sm" onClick={() => { setEditingParty(null); setPartyOpen(true); }}>
                <Plus size={15} /> Add Party
              </Button>
            </div>
          </div>
          {partiesError ? <LoadFailed what="the party master" /> : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Legal Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>PAN</TableHead>
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
                    <TableCell>
                      <span className="capitalize">{p.party_type || 'Both'}</span>
                      {p.influencer_subtype && (
                        <span className="text-xs text-muted-foreground ml-1">({p.influencer_subtype})</span>
                      )}
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{p.industry_category || '—'}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{p.gst_number || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{p.pan_number || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={p.is_active ? 'success' : 'secondary'}>{p.is_active ? 'Active' : 'Inactive'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1">
                        <Button variant="ghost" size="icon" aria-label={`Edit ${p.legal_name}`} onClick={() => { setEditingParty(p); setPartyOpen(true); }}>
                          <Pencil size={15} />
                        </Button>
                        {p.is_active ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            aria-label={`Deactivate ${p.legal_name}`}
                            title="Deactivate party"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setPendingDeactivate(p)}
                          >
                            <Ban size={15} />
                          </Button>
                        ) : (
                          <form action={(fd) => handleRoleAction(fd, reactivateParty, 'Party reactivated')}>
                            <input type="hidden" name="id" value={p.id} />
                            <Button variant="ghost" size="sm" type="submit">Reactivate</Button>
                          </form>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          )}
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
                {users.map((u) => {
                  const displayName = u.full_name || u.email;
                  return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || 'No name'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(u.roles || []).map((r) => {
                          const lastFounder = r.role === 'founder_admin' && founderCount <= 1;
                          return (
                            <Badge key={r.role} variant="info" className="capitalize gap-1 pr-1">
                              {r.role}
                              <button
                                type="button"
                                aria-label={`Remove ${r.role} role from ${displayName}`}
                                title={lastFounder ? 'The last Founder Admin cannot be removed' : `Remove ${r.role} role`}
                                disabled={lastFounder}
                                onClick={() => setPendingRevoke({ user: u, role: r.role })}
                                className="rounded-full p-0.5 hover:bg-destructive/15 hover:text-destructive disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-current"
                              >
                                <X size={11} aria-hidden="true" />
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <form action={(fd) => handleRoleAction(fd, assignRole, 'Role assigned')} className="flex gap-2">
                        <input type="hidden" name="userId" value={u.id} />
                        <select name="role" className="flex h-8 rounded-lg border border-input bg-transparent px-2 text-xs">
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <SubmitButton type="submit" size="sm" variant="outline">Assign</SubmitButton>
                      </form>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete user ${displayName}`}
                        title="Delete user permanently"
                        className="text-destructive hover:text-destructive"
                        onClick={() => openDelete(u)}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ─── Committee Roster ─── */}
        <TabsContent value="roster" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck size={16} className="text-primary" /> Active Committee Roster
              </CardTitle>
              <p className="text-xs text-muted-foreground">Manage the permanent voting board members for Ambiguity Board reviews.</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Current Members</h3>
                  <div className="divide-y border rounded-lg">
                    {rosterMemberIds.length === 0 && (
                      <div className="p-4 text-center text-sm text-muted-foreground italic">No members assigned.</div>
                    )}
                    {rosterMemberIds.map(mid => {
                      const u = users.find(x => x.id === mid);
                      return (
                        <div key={mid} className="flex items-center justify-between p-3">
                          <div>
                            <p className="text-sm font-medium">{u?.full_name || 'Unknown User'}</p>
                            <p className="text-xs text-muted-foreground">{u?.email || mid}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => setRosterMemberIds(prev => prev.filter(id => id !== mid))}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="pt-2">
                    <form onSubmit={handleUpdateRoster} className="flex gap-2">
                      <Button type="submit" disabled={isSavingRoster}>
                        {isSavingRoster ? 'Saving...' : 'Save Roster Changes'}
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setRosterMemberIds(activeRoster?.member_ids || [])}>
                        Reset
                      </Button>
                    </form>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Eligible Board Members</h3>
                  <div className="max-h-[400px] overflow-y-auto divide-y border rounded-lg">
                    {users
                      .filter(u => u.roles?.some(r => r.role === 'board_member' || r.role === 'founder_admin'))
                      .filter(u => !rosterMemberIds.includes(u.id))
                      .map(u => (
                        <div key={u.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                          <div>
                            <p className="text-sm font-medium">{u.full_name}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setRosterMemberIds(prev => [...prev, u.id])}
                          >
                            Add to Roster
                          </Button>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Global Audit Log ─── */}
        <TabsContent value="audit">
          <Card>
            <CardContent className="pt-4">
              {auditError ? <LoadFailed what="the audit log" /> : (
              <div className="relative pl-6 space-y-0">
                <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
                {auditLog.length === 0 && <p className="text-muted-foreground text-sm">No audit events yet.</p>}
                {auditLog.map((e) => (
                  <div key={e.id} className="relative pb-4 last:pb-0">
                    <div className="absolute -left-4 top-1.5 w-2 h-2 rounded-full bg-muted-foreground" />
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm">{e.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {e.actor?.full_name || e.actor?.email || 'System'} · {e.event_type}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{formatDateTimeIST(e.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Party Form Dialog */}
      <PartyDialog open={partyOpen} onOpenChange={setPartyOpen} editingParty={editingParty} />

      {/* Party deactivation */}
      <ConfirmDialog
        open={!!pendingDeactivate}
        onOpenChange={(open) => { if (!open) setPendingDeactivate(null); }}
        title={`Deactivate ${pendingDeactivate?.legal_name ?? 'party'}?`}
        description="Deactivation is reversible. Use Reactivate on the party row to restore it."
        consequences={[
          'The party is marked Inactive in the master list.',
          'Existing cases and history linked to this party are kept unchanged.',
        ]}
        tone="destructive"
        confirmLabel="Deactivate party"
        reasonLabel=""
        hiddenFields={pendingDeactivate ? { id: pendingDeactivate.id } : {}}
        action={(fd) => handleRoleAction(fd, deactivateParty, 'Party deactivated')}
      />

      {/* User deletion: type-to-confirm with a consequence preview */}
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => { if (!open) closeDelete(); }}
        title={`Permanently delete ${pendingDelete?.full_name || pendingDelete?.email || 'user'}?`}
        description="Use this only when an account should never sign in again. To remove access only, revoke their roles."
        consequences={deleteConsequences}
        irreversible
        tone="destructive"
        confirmLabel="Delete user"
        reasonLabel=""
        requireMatchText={pendingDelete?.email}
        hiddenFields={pendingDelete ? { userId: pendingDelete.id } : {}}
        action={(fd) => {
          if (deleteBlocked) {
            toast.error('This user is still linked to cases, tasks or history. Revoke their roles instead.');
            return;
          }
          return handleRoleAction(fd, adminDeleteUser, 'User deleted');
        }}
      />

      {/* Role revocation */}
      <ConfirmDialog
        open={!!pendingRevoke}
        onOpenChange={(open) => { if (!open) setPendingRevoke(null); }}
        title={`Remove ${pendingRevoke?.role ?? ''} role?`}
        description={pendingRevoke ? `${pendingRevoke.user.full_name || pendingRevoke.user.email} will lose this role.` : undefined}
        consequences={pendingRevoke ? [
          `They lose every permission granted by the ${pendingRevoke.role} role.`,
          ...((pendingRevoke.user.roles || []).length <= 1
            ? ['This is their only role. They will have no access until a role is assigned.']
            : []),
        ] : []}
        tone="destructive"
        confirmLabel="Remove role"
        reasonLabel=""
        hiddenFields={pendingRevoke ? { userId: pendingRevoke.user.id, role: pendingRevoke.role } : {}}
        action={(fd) => handleRoleAction(fd, revokeRole, 'Role revoked')}
      />
    </div>
  );
}
