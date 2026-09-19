export type CardDatasetType =
  | "approval"
  | "cancel";

export type CardSourceMethod =
  | "upload"
  | "paste";

export type CardParsedRow = {
  source_row_no: number;
  card_company: string | null;
  approval_date: string | null;
  approval_time: string | null;
  amount: number;
  approval_number: string | null;
  approval_employee_name: string | null;
  cancel_date: string | null;
  cancel_reason: string | null;
  cancel_employee_name: string | null;
  employee_no: string | null;
  source_manager_name: string | null;
};

export type CardParseResult = {
  rows: CardParsedRow[];
  monthlyRows: CardParsedRow[];
  sheetName: string | null;
  sourceRowCount: number;
  matchedDateRowCount: number;
  monthlyRowCount: number;
  monthlyAmount: number;
  ignoredRowCount: number;
  detectedDatasetType: CardDatasetType | null;
  warnings: string[];
};

export type CardImportTarget = {
  reportDate: string;
  datasetType: CardDatasetType;
  datasetTitle: string;
  draftBatchId: string | null;
  appliedBatchId: string | null;
  sourceMethod: CardSourceMethod | null;
  sourceFileName: string | null;
  sourceSheetName: string | null;
};

export type CardMonthlySnapshotInput = {
  manager_key: string;
  manager_id: string | null;
  manager_name: string;
  amount: number;
  transaction_count: number;
};
