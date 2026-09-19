import type {
  AnalyticsManager,
} from "@/lib/analytics/types";


export type SystemCompareDataset =
  | "sales"
  | "revenue";


export type SystemCompareStatus =
  | "match"
  | "mismatch"
  | "missing-daily"
  | "missing-system"
  | "missing-both";


export type SystemCompareRow = {
  reportDate: string;
  managerId: string;
  managerName: string;
  managerDisplayOrder: number;
  employeeNo: string;

  dailyTotalSalesAmount:
    number | null;

  systemSalesAmount:
    number | null;

  systemRevenueAmount:
    number | null;

  salesDifference:
    number | null;

  revenueDifference:
    number | null;

  salesStatus:
    SystemCompareStatus;

  revenueStatus:
    SystemCompareStatus;
};


export type SystemCompareSnapshot = {
  startDate: string;
  endDate: string;
  managers:
    AnalyticsManager[];
  rows:
    SystemCompareRow[];

  dailyRowCount: number;
  appliedBatchCount: number;
  systemEmployeeRowCount: number;
  unmatchedSystemEmployeeCount: number;

  generatedAt: string;
};


export function normalizeEmployeeNo(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}


export function toFiniteNumber(
  value: unknown
) {
  const numberValue =
    typeof value ===
    "number"
      ? value
      : Number(
          value ?? 0
        );

  return Number.isFinite(
    numberValue
  )
    ? numberValue
    : 0;
}


export function compareStatus(
  dailyValue:
    number | null,
  systemValue:
    number | null
): SystemCompareStatus {
  if (
    dailyValue === null &&
    systemValue === null
  ) {
    return "missing-both";
  }

  if (
    dailyValue === null
  ) {
    return "missing-daily";
  }

  if (
    systemValue === null
  ) {
    return "missing-system";
  }

  return (
    dailyValue -
      systemValue ===
    0
  )
    ? "match"
    : "mismatch";
}


export function differenceValue(
  dailyValue:
    number | null,
  systemValue:
    number | null
) {
  if (
    dailyValue === null ||
    systemValue === null
  ) {
    return null;
  }

  return (
    dailyValue -
    systemValue
  );
}
