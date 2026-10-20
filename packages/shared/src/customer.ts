/**
 * Bridge API (v0) — Customer domain.
 *
 * A customer progresses through KYC; endorsements grant access to
 * specific payment rails once approved.
 */

export type CustomerStatus =
  | 'not_started'
  | 'incomplete'
  | 'under_review'
  | 'approved'
  | 'rejected';

/**
 * Bridge endorsements. Each unlocks a rail/region:
 * - `base`             → United States (ACH / Wire)
 * - `sepa`             → Eurozone (IBAN)
 * - `spei`             → Mexico (CLABE)
 * - `pix`              → Brazil (Pix)
 * - `cop`              → Colombia
 * - `faster_payments`  → United Kingdom
 */
export type EndorsementName =
  | 'base'
  | 'sepa'
  | 'spei'
  | 'pix'
  | 'cop'
  | 'faster_payments';

export type EndorsementStatus = 'pending' | 'approved' | 'rejected' | 'incomplete';

export interface Endorsement {
  name: EndorsementName;
  status: EndorsementStatus;
}

export interface Customer {
  id: string;
  full_name: string;
  email: string;
  status: CustomerStatus;
  endorsements: Endorsement[];
  /** Hosted KYC URL returned by POST /kyc_links (present while actionable). */
  kyc_link?: string;
  created_at: string;
  updated_at: string;
}
