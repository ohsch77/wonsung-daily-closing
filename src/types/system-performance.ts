export type SystemPerformanceDatasetType =
  | "sales"
  | "revenue";


export type SystemPerformanceSnapshotType =
  | "previous"
  | "current";


export type SystemPerformanceSourceMethod =
  | "paste"
  | "upload"
  | "manual";


export type SystemPerformanceRowType =
  | "employee"
  | "total";


export type SystemPerformanceParsedRow = {
  source_row_no: number;

  row_type:
    SystemPerformanceRowType;

  organization_name: string;

  employee_no: string;

  employee_name: string;

  target_amount:
    number | null;

  performance_amount:
    number | null;

  performance_share:
    number | null;

  achievement_rate:
    number | null;

  profit_amount:
    number | null;

  profit_share:
    number | null;

  profit_rate:
    number | null;

  selling_price_rate:
    number | null;

  is_excluded: boolean;

  exclude_reason: string;
};


export type SystemPerformanceParseResult = {
  rows:
    SystemPerformanceParsedRow[];

  headerRowNumber: number;

  sheetName:
    string | null;

  sourceRowCount: number;

  warnings: string[];
};