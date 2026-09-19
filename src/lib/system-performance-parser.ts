import {
  readExcelMatrix,
} from "@/lib/excel/read-excel-matrix";

import type {
  ExcelMatrix,
  ExcelMatrixValue,
} from "@/lib/excel/read-excel-matrix";

import type {
  SystemPerformanceDatasetType,
  SystemPerformanceParsedRow,
  SystemPerformanceParseResult,
  SystemPerformanceSnapshotType,
} from "@/types/system-performance";


type ColumnMap = {
  organizationName: number;
  employeeNo: number;
  employeeName: number;
  targetAmount: number;
  performanceAmount: number;
  performanceShare: number;
  achievementRate: number;
  profitAmount: number;
  profitShare: number;
  profitRate: number;
  sellingPriceRate: number;
};


type HeaderLayout = {
  headerTopIndex: number;
  dataStartIndex: number;
  detectedDatasetType:
    SystemPerformanceDatasetType | null;
  columnMap: ColumnMap;
};


function normalizeText(
  value: ExcelMatrixValue
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .replace(/\u00a0/g, " ")
    .trim();
}


function normalizeHeader(
  value: ExcelMatrixValue
) {
  return normalizeText(value)
    .replace(/\s+/g, "")
    .replace(/[()]/g, "")
    .toLowerCase();
}


function normalizeEmployeeNo(
  value: ExcelMatrixValue
) {
  return normalizeText(value)
    .replace(/\s+/g, "")
    .toUpperCase();
}


function parseNumericValue(
  value: ExcelMatrixValue
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value === "number"
  ) {
    return Number.isFinite(value)
      ? value
      : null;
  }

  const original =
    normalizeText(value);

  if (
    original === "" ||
    original === "-" ||
    original === "--"
  ) {
    return null;
  }

  const negativeByParentheses =
    original.startsWith("(") &&
    original.endsWith(")");

  const cleaned =
    original
      .replace(/[₩￦원,%]/g, "")
      .replace(/\s+/g, "")
      .replace(/,/g, "")
      .replace(/[()]/g, "");

  if (
    cleaned === "" ||
    cleaned === "-"
  ) {
    return null;
  }

  const parsed =
    Number(cleaned);

  if (
    !Number.isFinite(parsed)
  ) {
    return null;
  }

  return negativeByParentheses
    ? -Math.abs(parsed)
    : parsed;
}


function findColumn(
  headers: string[],
  names: string[],
  startIndex = 0
) {
  for (
    let index = Math.max(0, startIndex);
    index < headers.length;
    index += 1
  ) {
    if (
      names.includes(headers[index])
    ) {
      return index;
    }
  }

  return -1;
}


function findColumnInRange(
  headers: string[],
  names: string[],
  startIndex: number,
  endIndex: number
) {
  for (
    let index = Math.max(0, startIndex);
    index < Math.min(headers.length, endIndex);
    index += 1
  ) {
    if (
      names.includes(headers[index])
    ) {
      return index;
    }
  }

  return -1;
}


function resolveHeaderLayout(
  matrix: ExcelMatrix
): HeaderLayout {
  const maxRows =
    Math.min(
      matrix.length - 1,
      30
    );

  for (
    let topIndex = 0;
    topIndex < maxRows;
    topIndex += 1
  ) {
    const topRow =
      matrix[topIndex] ?? [];

    const subRow =
      matrix[topIndex + 1] ?? [];

    const topHeaders =
      topRow.map(normalizeHeader);

    const subHeaders =
      subRow.map(normalizeHeader);

    const organizationName =
      findColumn(
        topHeaders,
        ["조직명", "조직"]
      );

    const employeeNo =
      findColumn(
        topHeaders,
        ["사번", "사원번호"]
      );

    const employeeName =
      findColumn(
        topHeaders,
        ["사원명", "성명"]
      );

    if (
      employeeNo < 0 ||
      employeeName < 0
    ) {
      continue;
    }

    const salesGroupStart =
      findColumn(
        topHeaders,
        ["판매"]
      );

    const revenueGroupStart =
      findColumn(
        topHeaders,
        ["매출"]
      );

    let detectedDatasetType:
      SystemPerformanceDatasetType | null =
        null;

    let performanceGroupStart =
      -1;

    if (
      salesGroupStart >= 0
    ) {
      detectedDatasetType =
        "sales";

      performanceGroupStart =
        salesGroupStart;
    }
    else if (
      revenueGroupStart >= 0
    ) {
      detectedDatasetType =
        "revenue";

      performanceGroupStart =
        revenueGroupStart;
    }

    if (
      performanceGroupStart < 0
    ) {
      continue;
    }

    const profitGroupStart =
      findColumn(
        topHeaders,
        ["이익"],
        performanceGroupStart + 1
      );

    if (
      profitGroupStart < 0
    ) {
      continue;
    }

    const targetAmount =
      findColumn(
        topHeaders,
        ["목표", "목표액"]
      );

    const profitRate =
      findColumn(
        topHeaders,
        ["이익율", "이익률"],
        profitGroupStart + 1
      );

    const sellingPriceRate =
      findColumn(
        topHeaders,
        ["판가율", "판가률"],
        profitGroupStart + 1
      );

    const performanceAmount =
      findColumnInRange(
        subHeaders,
        ["실적"],
        performanceGroupStart,
        profitGroupStart
      );

    const performanceShare =
      findColumnInRange(
        subHeaders,
        ["비중"],
        performanceGroupStart,
        profitGroupStart
      );

    const achievementRate =
      findColumnInRange(
        subHeaders,
        ["달성율", "달성률"],
        performanceGroupStart,
        profitGroupStart
      );

    const profitGroupEnd =
      profitRate >= 0
        ? profitRate
        : topHeaders.length;

    const profitAmount =
      findColumnInRange(
        subHeaders,
        ["실적"],
        profitGroupStart,
        profitGroupEnd
      );

    const profitShare =
      findColumnInRange(
        subHeaders,
        ["비중"],
        profitGroupStart,
        profitGroupEnd
      );

    if (
      performanceAmount < 0
    ) {
      continue;
    }

    return {
      headerTopIndex:
        topIndex,
      dataStartIndex:
        topIndex + 2,
      detectedDatasetType,
      columnMap: {
        organizationName,
        employeeNo,
        employeeName,
        targetAmount,
        performanceAmount,
        performanceShare,
        achievementRate,
        profitAmount,
        profitShare,
        profitRate,
        sellingPriceRate,
      },
    };
  }

  throw new Error(
    "전산실적 2단 헤더를 찾을 수 없습니다. 조직명·사번·사원명·판매/매출·이익 항목이 포함되어 있는지 확인해주세요."
  );
}


function getCell(
  row: ExcelMatrixValue[],
  index: number
) {
  if (
    index < 0 ||
    index >= row.length
  ) {
    return null;
  }

  return row[index] ?? null;
}


function rowHasContent(
  row: ExcelMatrixValue[]
) {
  return row.some(
    (value) =>
      normalizeText(value) !== ""
  );
}


function isTotalRow(
  row: ExcelMatrixValue[],
  columnMap: ColumnMap
) {
  const organization =
    normalizeText(
      getCell(
        row,
        columnMap.organizationName
      )
    ).replace(/\s+/g, "");

  const employeeName =
    normalizeText(
      getCell(
        row,
        columnMap.employeeName
      )
    ).replace(/\s+/g, "");

  return (
    organization === "계" ||
    organization === "합계" ||
    organization === "총계" ||
    employeeName === "계" ||
    employeeName === "합계" ||
    employeeName === "총계"
  );
}


function validateDatasetType(
  detected:
    SystemPerformanceDatasetType | null,
  expected:
    SystemPerformanceDatasetType
) {
  if (
    !detected ||
    detected === expected
  ) {
    return;
  }

  const expectedLabel =
    expected === "sales"
      ? "판매"
      : "매출";

  const detectedLabel =
    detected === "sales"
      ? "판매"
      : "매출";

  throw new Error(
    `${expectedLabel} 입력 화면에 ${detectedLabel} 자료를 불러왔습니다. 올바른 파일인지 확인해주세요.`
  );
}


function parseMatrix(
  matrix: ExcelMatrix,
  sheetName: string | null,
  expectedDatasetType:
    SystemPerformanceDatasetType
): SystemPerformanceParseResult {
  if (
    matrix.length === 0
  ) {
    throw new Error(
      "입력된 데이터가 없습니다."
    );
  }

  const layout =
    resolveHeaderLayout(
      matrix
    );

  validateDatasetType(
    layout.detectedDatasetType,
    expectedDatasetType
  );

  const rows:
    SystemPerformanceParsedRow[] =
      [];

  const warnings:
    string[] = [];

  for (
    let rowIndex =
      layout.dataStartIndex;
    rowIndex < matrix.length;
    rowIndex += 1
  ) {
    const row =
      matrix[rowIndex] ?? [];

    if (
      !rowHasContent(row)
    ) {
      continue;
    }

    const map =
      layout.columnMap;

    const organizationName =
      normalizeText(
        getCell(
          row,
          map.organizationName
        )
      );

    const employeeNo =
      normalizeEmployeeNo(
        getCell(
          row,
          map.employeeNo
        )
      );

    const employeeName =
      normalizeText(
        getCell(
          row,
          map.employeeName
        )
      );

    const targetAmount =
      parseNumericValue(
        getCell(
          row,
          map.targetAmount
        )
      );

    const performanceAmount =
      parseNumericValue(
        getCell(
          row,
          map.performanceAmount
        )
      );

    const performanceShare =
      parseNumericValue(
        getCell(
          row,
          map.performanceShare
        )
      );

    const achievementRate =
      parseNumericValue(
        getCell(
          row,
          map.achievementRate
        )
      );

    const profitAmount =
      parseNumericValue(
        getCell(
          row,
          map.profitAmount
        )
      );

    const profitShare =
      parseNumericValue(
        getCell(
          row,
          map.profitShare
        )
      );

    const profitRate =
      parseNumericValue(
        getCell(
          row,
          map.profitRate
        )
      );

    const sellingPriceRate =
      parseNumericValue(
        getCell(
          row,
          map.sellingPriceRate
        )
      );

    const meaningful =
      organizationName !== "" ||
      employeeNo !== "" ||
      employeeName !== "" ||
      performanceAmount !== null ||
      profitAmount !== null;

    if (
      !meaningful
    ) {
      continue;
    }

    rows.push({
      source_row_no:
        rowIndex + 1,
      row_type:
        isTotalRow(
          row,
          map
        )
          ? "total"
          : "employee",
      organization_name:
        organizationName,
      employee_no:
        employeeNo,
      employee_name:
        employeeName,
      target_amount:
        targetAmount,
      performance_amount:
        performanceAmount,
      performance_share:
        performanceShare,
      achievement_rate:
        achievementRate,
      profit_amount:
        profitAmount,
      profit_share:
        profitShare,
      profit_rate:
        profitRate,
      selling_price_rate:
        sellingPriceRate,
      is_excluded:
        false,
      exclude_reason:
        "",
    });
  }

  const employeeRows =
    rows.filter(
      (row) =>
        row.row_type === "employee"
    );

  const noEmployeeNoCount =
    employeeRows.filter(
      (row) =>
        row.employee_no === ""
    ).length;

  if (
    noEmployeeNoCount > 0
  ) {
    warnings.push(
      `사번이 없는 직원 행이 ${noEmployeeNoCount}건 있습니다. 원본 행은 유지됩니다.`
    );
  }

  if (
    rows.length === 0
  ) {
    warnings.push(
      "헤더는 인식했지만 저장할 데이터 행이 없습니다."
    );
  }

  return {
    rows,
    headerRowNumber:
      layout.headerTopIndex + 1,
    sheetName,
    sourceRowCount:
      matrix.length,
    warnings,
  };
}


export function getExpectedSystemPerformanceSheetName(
  datasetType:
    SystemPerformanceDatasetType,
  snapshotType:
    SystemPerformanceSnapshotType
) {
  if (
    datasetType === "sales" &&
    snapshotType === "previous"
  ) {
    return "사원별판매_전일누적";
  }

  if (
    datasetType === "sales" &&
    snapshotType === "current"
  ) {
    return "사원별판매_당일누적";
  }

  if (
    datasetType === "revenue" &&
    snapshotType === "previous"
  ) {
    return "사원별매출_전일누적";
  }

  return "사원별매출_당일누적";
}


export function parseSystemPerformancePaste(
  clipboardText: string,
  expectedDatasetType:
    SystemPerformanceDatasetType
): SystemPerformanceParseResult {
  const normalized =
    clipboardText
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");

  const lines =
    normalized.split("\n");

  while (
    lines.length > 0 &&
    lines[
      lines.length - 1
    ].trim() === ""
  ) {
    lines.pop();
  }

  const matrix:
    ExcelMatrix =
      lines.map(
        (line) =>
          line.split("\t")
      );

  return parseMatrix(
    matrix,
    null,
    expectedDatasetType
  );
}


export async function parseSystemPerformanceExcel(
  file: File,
  datasetType:
    SystemPerformanceDatasetType,
  snapshotType:
    SystemPerformanceSnapshotType,
  password?: string
): Promise<SystemPerformanceParseResult> {
  const wantedSheetName =
    getExpectedSystemPerformanceSheetName(
      datasetType,
      snapshotType
    );

  const result =
    await readExcelMatrix(
      file,
      wantedSheetName,
      password
    );

  const parsed =
    parseMatrix(
      result.rows,
      result.sheetName,
      datasetType
    );

  if (
    result.sheetName !==
    wantedSheetName
  ) {
    parsed.warnings.unshift(
      `예상 시트 '${wantedSheetName}' 대신 '${result.sheetName}' 시트를 사용했습니다.`
    );
  }

  return parsed;
}
