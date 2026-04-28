"use client";
import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { upsertParty } from '@/app/admin/actions';
import { toast } from 'sonner';
import { generatePartyIdPreview } from '@/app/cases/new/actions';
import { Wand2 } from 'lucide-react';

interface PartyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (party: any) => void;
  editingParty?: any;
}

export function PartyDialog({ open, onOpenChange, onSuccess, editingParty }: PartyDialogProps) {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedType, setSelectedType] = useState(editingParty?.party_type || 'both');
  const [influencerSubtype, setInfluencerSubtype] = useState(editingParty?.influencer_subtype || 'contractor');
  
  const formRef = useRef<HTMLFormElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);



  useEffect(() => {
    if (open) {
      setSelectedType(editingParty?.party_type || 'both');
      setInfluencerSubtype(editingParty?.influencer_subtype || 'contractor');
    }
  }, [open, editingParty]);

  useEffect(() => {
    if (selectedType === 'customer' && codeRef.current && !editingParty) {
      codeRef.current.value = '';
    }
  }, [selectedType, editingParty]);

  const handleGenerate = async () => {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    const phone = fd.get('contact_phone') as string;
    const rawCity = fd.get('city') as string;
    const cityCode = rawCity?.substring(0, 3).toUpperCase();
    const panName = fd.get('legal_name') as string;
    const nickname = fd.get('nickname') as string;

    if (!phone || !cityCode || !panName) {
      toast.error('Legal Name, City, and Contact Phone are required to generate an ID.');
      return;
    }

    setGenerating(true);
    try {
      const type = (selectedType === 'influencer' || selectedType === 'both') && influencerSubtype === 'interior' ? 'interior' : 'contractor';
      const id = await generatePartyIdPreview({
        type: type as 'contractor' | 'interior',
        cityCode,
        phoneNumber: phone,
        panName,
        firstName: panName.split(' ')[0],
        lastName: panName.split(' ').slice(1).join(' '),
        nickname
      });
      if (id && codeRef.current) {
        codeRef.current.value = id;
      }
    } catch (e: any) {
      toast.error('Failed to generate ID: ' + e.message);
    }
    setGenerating(false);
  };

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
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          {editingParty && <input type="hidden" name="id" value={editingParty.id} />}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Legal Name (PAN Name) *</Label>
              <Input name="legal_name" defaultValue={editingParty?.legal_name} required />
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label>Customer Code / ID *</Label>
                {(selectedType === 'influencer' || selectedType === 'both') && (
                  <button type="button" onClick={handleGenerate} className="text-[10px] text-primary flex items-center gap-1 hover:underline disabled:opacity-50" disabled={generating}>
                    <Wand2 size={10} /> {generating ? '...' : 'Auto-Generate'}
                  </button>
                )}
              </div>
              <Input ref={codeRef} name="customer_code" defaultValue={editingParty?.customer_code} placeholder="e.g. CUST-001" required />
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
              <div className="col-span-2 grid grid-cols-2 gap-4 outline outline-1 outline-border p-3 rounded-md bg-muted/20">
                <div className="space-y-1">
                  <Label>Influencer Subtype</Label>
                  <select 
                    name="influencer_subtype" 
                    value={influencerSubtype}
                    onChange={(e) => setInfluencerSubtype(e.target.value)}
                    className="flex h-9 w-full rounded-lg border border-input bg-background/50 px-3 py-1 text-sm"
                  >
                    <option value="contractor">Contractor</option>
                    <option value="interior">Interior</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Contact Phone</Label>
                  <Input name="contact_phone" defaultValue={editingParty?.contact_phone || ''} placeholder="Phone required for ID" />
                </div>
                <div className="space-y-1">
                  <Label>Nickname (Market Name)</Label>
                  <Input name="nickname" defaultValue={editingParty?.display_name || ''} placeholder="Optional" />
                </div>
              </div>
            )}
            
            <div className="space-y-1">
              <Label>GSTIN</Label>
              <Input name="gstin" defaultValue={editingParty?.gst_number} placeholder="22AAAAA0000A1Z5" />
            </div>
            <div className="space-y-1">
              <Label>PAN</Label>
              <Input name="pan" defaultValue={editingParty?.pan_number} placeholder="AAAAA0000A" />
            </div>
            <div className="space-y-1">
              <Label>City (3-letters for ID Code)</Label>
              <Input name="city" defaultValue={editingParty?.address?.split(', ')[0] || ''} placeholder="e.g. Raipur or RPR" />
            </div>
            <div className="space-y-1">
              <Label>State</Label>
              <Input name="state" defaultValue={editingParty?.address?.split(', ')[1] || ''} />
            </div>
            <div className="space-y-1">
              <Label>Industry Sector</Label>
              <Input name="industry_sector" defaultValue={editingParty?.industry_category} />
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
