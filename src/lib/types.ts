export const CATEGORIES = ["Lease", "Detention", "EXIM", "M&R", "Other"] as const;
export type Category = (typeof CATEGORIES)[number];

export type DocType = "Invoice" | "Credit Note" | "Debit Note";

/** One charge line of a sales invoice / credit note (tblInvoice, recordType "C"). */
export interface SalesLine {
  id: string;
  invoiceId: number;
  invoiceNo: string;
  date: string;            // YYYY-MM-DD (invoiceDate)
  docType: DocType;
  voucher: string;         // voucherName, e.g. "Principal Sales Invoice"
  charge: string;
  category: Category;
  amount: number;          // USD, signed: credit notes are negative
  currency: string;        // invoice currency
  amountFc: number;        // amount in invoice currency (unsigned, as billed)
  agent: string;           // billing party
  pol: string;
  pod: string;
  lane: string | null;     // "POL → POD"; null for sundry / no-BL entries
  blNo: string;
  jobNo: string;
  company: string;
  segment: string;
}

export interface ChargeMapping {
  chargeName: string;
  revenueCategory: Category;
}

export interface SalesPayload {
  lines: SalesLine[];
  mappings: ChargeMapping[];
  lastSync: string | null;   // ISO time of the last successful tblInvoice sync
  generatedAt: string;
}
