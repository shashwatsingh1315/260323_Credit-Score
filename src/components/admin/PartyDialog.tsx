"use client";
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { upsertParty } from '@/app/admin/actions';
import { toast } from 'sonner';

interface PartyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (party: any) => void;
  editingParty?: any;
}

export function PartyDialog({ open, onOpenChange, onSuccess, editingParty }: PartyDialogProps) {
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState(editingParty?.party_type || 'both');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const res = await upsertParty(formData);
    setLoading(false);
    if (res?.success) {
      toast.success('Party saved successfully');
      onOpenChange(false);
      if (onSuccess) {
        onSuccess(res.party);
      }
    } else {
      toast.error(res?.error || 'Failed to save party');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editingParty ? 'Edit' : 'Add'} Party</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {editingParty && <input type="hidden" name="id" value={editingParty.id} />}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Legal Name *</Label>
              <Input name="legal_name" defaultValue={editingParty?.legal_name} required />
            </div>
            <div className="space-y-1">
              <Label>Customer Code *</Label>
              <Input name="customer_code" defaultValue={editingParty?.customer_code} placeholder="e.g. CUST-001" required />
            </div>
            <div className="space-y-1">
              <Label>Party Type</Label>
              <select 
                name="party_type" 
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="customer">Customer</option>
                <option value="influencer">Influencer</option>
                <option value="both">Both</option>
              </select>
            </div>
            
            {(selectedType === 'influencer' || selectedType === 'both') && (
              <div className="space-y-1">
                <Label>Influencer Subtype</Label>
                <select 
                  name="influencer_subtype" 
                  defaultValue={editingParty?.influencer_subtype || 'contractor'}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="contractor">Contractor</option>
                  <option value="interior">Interior</option>
                </select>
              </div>
            )}
            <div className="space-y-1">
              <Label>GSTIN</Label>
              <Input name="gstin" defaultValue={editingParty?.gstin} placeholder="22AAAAA0000A1Z5" />
            </div>
            <div className="space-y-1">
              <Label>PAN</Label>
              <Input name="pan" defaultValue={editingParty?.pan} placeholder="AAAAA0000A" />
            </div>
            <div className="space-y-1">
              <Label>City</Label>
              <Input name="city" defaultValue={editingParty?.city} />
            </div>
            <div className="space-y-1">
              <Label>State</Label>
              <Input name="state" defaultValue={editingParty?.state} />
            </div>
            <div className="space-y-1">
              <Label>Industry Sector</Label>
              <Input name="industry_sector" defaultValue={editingParty?.industry_sector} />
            </div>
            <div className="space-y-1">
              <Label>Credit Limit (₹)</Label>
              <Input name="credit_limit" type="number" defaultValue={editingParty?.credit_limit} placeholder="0" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving...' : (editingParty ? 'Save Changes' : 'Create Party')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
