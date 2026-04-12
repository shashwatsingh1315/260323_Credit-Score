import { createClient } from '@/utils/supabase/server';

export type IdGenerationParams = {
  cityCode: string; // e.g. RPR, NAG
  phoneNumber?: string; 
  panName?: string;
  nickname?: string;
  firstName?: string;
  lastName?: string;
  siteDate?: Date; // To derive MMYY for Converted Sites
  rmFirstName?: string;
  rmLastName?: string;
  siteSequenceNumber?: number; // E.g., 1 or 43
  transferredFrom?: string; // Optional old RM initials (e.g. NIA)
  transferSequence?: number; // e.g. 1 for first transfer (appends -01)
  orderSequenceNumber?: number; // e.g., 4 for (04)
};

class IdEngine {
  // Helper: Normalize name strings
  private cleanStr(str: string | undefined): string {
    return (str || '').trim();
  }

  // Helper: Last 5 digits of a phone number
  private getLast5Phone(phone: string | undefined): string {
    const cleaned = this.cleanStr(phone).replace(/\D/g, '');
    if (cleaned.length < 5) return cleaned.padStart(5, '0');
    return cleaned.slice(-5);
  }

  // Helper: RM Initials building (First 2 of First Name, 1st of Last Name)
  private getRmInitials(first: string | undefined, last: string | undefined): string {
    const fn = this.cleanStr(first).toUpperCase();
    const ln = this.cleanStr(last).toUpperCase();
    
    let initials = '';
    if (fn.length >= 2) {
      initials = fn.substring(0, 2);
    } else {
      initials = fn.padEnd(2, 'X'); 
    }

    if (ln.length >= 1) {
      initials += ln.substring(0, 1);
    } else if (fn.length >= 3) {
       // Edge Case A: No last name, use 3rd char of first name
       initials += fn.substring(2, 3);
    } else {
       initials += 'X';
    }

    return initials;
  }

  private formatSequence(num: number | undefined): string {
    if (!num) return '01';
    return num < 10 ? `0${num}` : `${num}`;
  }

  private formatMMYY(date: Date | undefined): string {
    if (!date) return ''; // fallback if not provided
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const yy = date.getFullYear().toString().slice(-2);
    return `${mm}${yy}`;
  }

  // Retrieve configurable prefix from DB
  private async getPrefix(entityType: string): Promise<string> {
    const supabase = await createClient();
    const { data } = await supabase
      .from('id_prefixes')
      .select('prefix')
      .eq('entity_type', entityType)
      .single();
    return data?.prefix ?? '';
  }

  // a) Contractor ID
  public async generateContractorId(params: IdGenerationParams): Promise<string> {
    let prefix = await this.getPrefix('contractor');
    if (prefix) prefix += '/';

    const phoneSegment = this.getLast5Phone(params.phoneNumber);
    const city = this.cleanStr(params.cityCode).toUpperCase();
    
    const pan = this.cleanStr(params.panName);
    const nick = this.cleanStr(params.nickname);
    
    const firstName = pan.split(' ')[0];
    let nameSegment = firstName;
    // Case-insensitive check: only append if Nickname exists and differs from first name
    if (nick && nick.toLowerCase() !== firstName.toLowerCase()) {
      nameSegment += `(${nick})`;
    }

    // Example expected: C/49438/RPR/Irshad(Nillu)
    // The rules state names are preserved in case, but city/prefix are uppercase.
    // User requested "Force all uppercase", we will capitalize entire string at end.
    
    const id = `${prefix}${phoneSegment}/${city}/${nameSegment}`;
    return id.toUpperCase();
  }

  // b) Interiors/Arci ID
  public async generateInteriorId(params: IdGenerationParams): Promise<string> {
    let prefix = await this.getPrefix('interior');
    if (prefix) prefix += '/';

    const phoneSegment = this.getLast5Phone(params.phoneNumber);
    const city = this.cleanStr(params.cityCode).toUpperCase();

    // Use full name, fallback to first name if last is empty
    const first = this.cleanStr(params.firstName);
    const last = this.cleanStr(params.lastName);
    let nameSegment = first;
    if (last) {
      nameSegment += ` ${last}`;
    }

    // Example: IA/08875/RPR/JITESH PARWANI
    const id = `${prefix}${phoneSegment}/${city}/${nameSegment}`;
    return id.toUpperCase();
  }

  // e) Site ID (Leads) 
  public async generateLeadSiteId(params: IdGenerationParams): Promise<string> {
     let prefix = await this.getPrefix('lead_site');
     if (prefix) prefix += '/';

     const mmyy = this.formatMMYY(params.siteDate);
     const city = this.cleanStr(params.cityCode).toUpperCase();
     const rm = this.getRmInitials(params.rmFirstName, params.rmLastName);
     const seq = this.formatSequence(params.siteSequenceNumber);

     // Example: L/1025/RPR/ANB-01
     const id = `${prefix}${mmyy}/${city}/${rm}-${seq}`;
     return id.toUpperCase();
  }

  // f) Site ID (Converted) & g) Order ID
  public async generateConvertedSiteOrOrderId(params: IdGenerationParams): Promise<string> {
    let prefix = await this.getPrefix('converted_site');
    if (prefix) prefix += '/';

    const mmyy = this.formatMMYY(params.siteDate); // Dynamic MMYY based on transaction date 
    const city = this.cleanStr(params.cityCode).toUpperCase();
    
    const currentRm = this.getRmInitials(params.rmFirstName, params.rmLastName);
    
    let rmCluster = currentRm;
    
    // Handle Transfers
    if (params.transferredFrom) {
       // NIA-SAS-43-01 format
       // params.transferredFrom would be 'NIA'
       const prevRm = this.cleanStr(params.transferredFrom).toUpperCase();
       const seqNumber = params.siteSequenceNumber ? String(params.siteSequenceNumber) : '01';
       const transferSeq = this.formatSequence(params.transferSequence);
       
       rmCluster = `${prevRm}-${currentRm}-${seqNumber}-${transferSeq}`;
    } else {
       // Standard format NIA-43
       const seqNumber = this.formatSequence(params.siteSequenceNumber);
       rmCluster = `${currentRm}-${seqNumber}`;
    }

    let id = `${prefix}${mmyy}/${city}/${rmCluster}`;

    // Handle Order formatting
    if (params.orderSequenceNumber) {
      const orderSeq = this.formatSequence(params.orderSequenceNumber);
      id += ` (${orderSeq})`;
    }

    return id.toUpperCase();
  }
}

export const idEngine = new IdEngine();
