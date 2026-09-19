import {
  readExcelMatrix,
} from "@/lib/excel/read-excel-matrix";

import type {
  ExcelMatrix,
  ExcelMatrixValue,
} from "@/lib/excel/read-excel-matrix";

import type {
  CardDatasetType,
  CardParsedRow,
  CardParseResult,
} from "@/types/card-performance";


type HeaderMap = {
  headerIndex: number;
  organizationName: number;
  cardCompany: number;
  approvalDate: number;
  approvalTime: number;
  amount: number;
  approvalNumber: number;
  approvalEmployeeName: number;
  cancelDate: number;
  cancelReason: number;
  cancelEmployeeName: number;
  employeeNo: number;
  sourceManagerName: number;
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
    .replace(/\r?\n/g, " ")
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
  const normalized =
    normalizeText(value)
      .replace(/\s+/g, "")
      .toUpperCase();

  return normalized === ""
    ? null
    : normalized;
}


function nullableText(
  value: ExcelMatrixValue
) {
  const text = normalizeText(value);

  return text === ""
    ? null
    : text;
}


function parseAmount(
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
      .replace(/[₩￦원]/g, "")
      .replace(/,/g, "")
      .replace(/\s+/g, "")
      .replace(/[()]/g, "");

  if (
    cleaned === "" ||
    cleaned === "-"
  ) {
    return null;
  }

  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return negativeByParentheses
    ? -Math.abs(parsed)
    : parsed;
}


function pad2(value: number) {
  return String(value).padStart(2, "0");
}


function formatYmd(
  year: number,
  month: number,
  day: number
) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}


function parseDateString(
  text: string
): string | null {
  const compact =
    text.trim();

  if (compact === "") {
    return null;
  }

  const match = compact.match(
    /^(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})(?:일)?(?:\s+.*)?$/
  );

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  return formatYmd(
    year,
    month,
    day
  );
}


function parseExcelDate(
  value: ExcelMatrixValue
): string | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (value instanceof Date) {
    return formatYmd(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate()
    );
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    const wholeDays = Math.floor(value);

    const millis =
      Date.UTC(1899, 11, 30) +
      wholeDays * 86400000;

    const date = new Date(millis);

    if (
      !Number.isNaN(date.getTime())
    ) {
      return formatYmd(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate()
      );
    }
  }

  return parseDateString(
    normalizeText(value)
  );
}


function parseExcelTime(
  value: ExcelMatrixValue
): string | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (value instanceof Date) {
    return `${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(value.getSeconds())}`;
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    const fraction =
      ((value % 1) + 1) % 1;

    const totalSeconds =
      Math.round(
        fraction * 24 * 60 * 60
      ) % 86400;

    const hour =
      Math.floor(
        totalSeconds / 3600
      );

    const minute =
      Math.floor(
        (totalSeconds % 3600) / 60
      );

    const second =
      totalSeconds % 60;

    return `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
  }

  const text = normalizeText(value);

  const match = text.match(
    /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? "0");

  if (
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  return `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
}


function findHeaderColumn(
  headers: string[],
  aliases: string[]
) {
  return headers.findIndex(
    (header) =>
      aliases.includes(header)
  );
}


function createHeaderMap(
  headers: string[],
  headerIndex: number
): HeaderMap | null {
  const cardCompany =
    findHeaderColumn(
      headers,
      ["카드사"]
    );

  const approvalDate =
    findHeaderColumn(
      headers,
      [
        "승인일자",
        "승인일",
        "승인내역일자",
      ]
    );

  const amount =
    findHeaderColumn(
      headers,
      [
        "금액",
        "승인금액",
        "승인내역금액",
      ]
    );

  const approvalNumber =
    findHeaderColumn(
      headers,
      [
        "번호",
        "승인번호",
        "승인내역번호",
      ]
    );

  const cancelDate =
    findHeaderColumn(
      headers,
      [
        "취소일자",
        "취소일",
      ]
    );

  if (
    cardCompany < 0 ||
    approvalDate < 0 ||
    amount < 0 ||
    approvalNumber < 0 ||
    cancelDate < 0
  ) {
    return null;
  }

  return {
    headerIndex,

    organizationName:
      findHeaderColumn(
        headers,
        ["조직명", "조직"]
      ),

    cardCompany,

    approvalDate,

    approvalTime:
      findHeaderColumn(
        headers,
        [
          "승인시간",
          "시간",
          "승인내역시간",
        ]
      ),

    amount,

    approvalNumber,

    approvalEmployeeName:
      findHeaderColumn(
        headers,
        ["승인사원"]
      ),

    cancelDate,

    cancelReason:
      findHeaderColumn(
        headers,
        ["취소사유"]
      ),

    cancelEmployeeName:
      findHeaderColumn(
        headers,
        [
          "사원",
          "취소사원",
        ]
      ),

    employeeNo:
      findHeaderColumn(
        headers,
        [
          "사번",
          "판매사원사번",
        ]
      ),

    sourceManagerName:
      findHeaderColumn(
        headers,
        [
          "매니저명",
          "판매사원성명",
          "성명",
        ]
      ),
  };
}


function buildTwoRowHeaders(
  parentRow: ExcelMatrixValue[],
  childRow: ExcelMatrixValue[]
) {
  const columnCount =
    Math.max(
      parentRow.length,
      childRow.length
    );

  const result: string[] = [];

  let currentParent = "";

  for (
    let columnIndex = 0;
    columnIndex < columnCount;
    columnIndex += 1
  ) {
    const parent =
      normalizeHeader(
        parentRow[
          columnIndex
        ]
      );

    const child =
      normalizeHeader(
        childRow[
          columnIndex
        ]
      );

    /*
     * 회사 카드 원본은 2단 헤더를 사용합니다.
     *
     * 예)
     * 승인내역 |      |      |      |      | ... | 취소 |      |      | ... | 판매사원 |      |
     * 일자     | 시간 | 금액 | 번호 | 형태 | ... | 일자 | 사유 | 사원 | ... | 사번     | 성명 |
     *
     * Excel에서 병합된 상위 헤더는 첫 셀에만 값이 있으므로,
     * 다음 상위 헤더가 나타날 때까지 직전 상위 헤더를 이어받습니다.
     */
    if (parent !== "") {
      currentParent =
        parent;
    }

    if (child !== "") {
      result.push(
        currentParent !== ""
          ? `${currentParent}${child}`
          : child
      );

      continue;
    }

    result.push(parent);
  }

  return result;
}


function resolveHeaderMap(
  matrix: ExcelMatrix
): HeaderMap {
  const scanRows =
    Math.min(matrix.length, 30);

  /*
   * 1차: 기존 마감 Excel처럼 한 행에 헤더가 모두 있는 형식
   */
  for (
    let rowIndex = 0;
    rowIndex < scanRows;
    rowIndex += 1
  ) {
    const headers =
      (matrix[rowIndex] ?? [])
        .map(normalizeHeader);

    const map =
      createHeaderMap(
        headers,
        rowIndex
      );

    if (map) {
      return map;
    }
  }

  /*
   * 2차: 회사에서 직접 내려받는 카드 원본의 2단 병합 헤더
   *
   * 실제 구조 예)
   * 상단: 승인내역 / 취소 / 판매사원
   * 하단: 일자·시간·금액·번호·형태 / 일자·사유·사원 / 사번·성명
   */
  for (
    let rowIndex = 0;
    rowIndex + 1 < scanRows;
    rowIndex += 1
  ) {
    const headers =
      buildTwoRowHeaders(
        matrix[rowIndex] ?? [],
        matrix[rowIndex + 1] ?? []
      );

    const map =
      createHeaderMap(
        headers,
        rowIndex + 1
      );

    if (map) {
      return map;
    }
  }

  throw new Error(
    "카드실적 표의 헤더를 찾지 못했습니다. 조직명·카드사와 승인내역(일자·시간·금액·번호), 취소(일자·사유·사원), 판매사원(사번·성명)이 포함된 원본 표를 사용해주세요."
  );
}


function detectDatasetType(
  matrix: ExcelMatrix,
  headerIndex: number
): CardDatasetType | null {
  const scanEnd =
    Math.min(
      matrix.length,
      Math.max(headerIndex + 1, 10)
    );

  const titleText =
    matrix
      .slice(0, scanEnd)
      .flat()
      .map(normalizeText)
      .join(" ")
      .replace(/\s+/g, " ");

  if (
    /승인취소내역|승인\s*취소\s*내역|취소내역/.test(
      titleText
    )
  ) {
    return "cancel";
  }

  if (
    /신용카드\s*승인내역|카드\s*승인내역/.test(
      titleText
    )
  ) {
    return "approval";
  }

  return null;
}


function getCell(
  row: ExcelMatrixValue[],
  index: number
) {
  if (index < 0) {
    return null;
  }

  return row[index] ?? null;
}


function isBusinessRow(
  row: ExcelMatrixValue[],
  map: HeaderMap
) {
  return (
    normalizeText(
      getCell(row, map.cardCompany)
    ) !== "" ||
    normalizeText(
      getCell(row, map.approvalNumber)
    ) !== "" ||
    parseAmount(
      getCell(row, map.amount)
    ) !== null ||
    parseExcelDate(
      getCell(row, map.approvalDate)
    ) !== null ||
    parseExcelDate(
      getCell(row, map.cancelDate)
    ) !== null
  );
}


function parseMatrix(
  matrix: ExcelMatrix,
  datasetType: CardDatasetType,
  reportDate: string,
  sheetName: string | null
): CardParseResult {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      reportDate
    )
  ) {
    throw new Error(
      "카드실적 기준일 형식이 올바르지 않습니다."
    );
  }

  const periodStartDate =
    `${reportDate.slice(0, 7)}-01`;

  const headerMap =
    resolveHeaderMap(matrix);

  const detectedDatasetType =
    detectDatasetType(
      matrix,
      headerMap.headerIndex
    );

  if (
    detectedDatasetType !== null &&
    detectedDatasetType !== datasetType
  ) {
    throw new Error(
      datasetType === "approval"
        ? "카드취소 파일이 선택되었습니다. 카드승인 입력에는 승인내역 파일을 사용해주세요."
        : "카드승인 파일이 선택되었습니다. 카드취소 입력에는 승인취소내역 파일을 사용해주세요."
    );
  }

  const sourceRows =
    matrix.slice(
      headerMap.headerIndex + 1
    );

  const parsedRows: CardParsedRow[] = [];
  const monthlyRows: CardParsedRow[] = [];
  const invalidAmountRows: number[] = [];
  const invalidDateRows: number[] = [];

  let sourceRowCount = 0;

  for (
    let index = 0;
    index < sourceRows.length;
    index += 1
  ) {
    const row =
      sourceRows[index] ?? [];

    if (
      !isBusinessRow(
        row,
        headerMap
      )
    ) {
      continue;
    }

    sourceRowCount += 1;

    const sourceRowNo =
      headerMap.headerIndex +
      index +
      2;

    const approvalDate =
      parseExcelDate(
        getCell(
          row,
          headerMap.approvalDate
        )
      );

    const cancelDate =
      parseExcelDate(
        getCell(
          row,
          headerMap.cancelDate
        )
      );

    const targetDate =
      datasetType === "approval"
        ? approvalDate
        : cancelDate;

    if (targetDate === null) {
      const rawTargetDate =
        datasetType === "approval"
          ? normalizeText(
              getCell(
                row,
                headerMap.approvalDate
              )
            )
          : normalizeText(
              getCell(
                row,
                headerMap.cancelDate
              )
            );

      if (rawTargetDate !== "") {
        invalidDateRows.push(
          sourceRowNo
        );
      }

      continue;
    }

    /*
     * 회사 원본은 월 1일부터 기준일까지의 누적 자료입니다.
     * 월 누계 계산에는 같은 달의 1일 ~ 기준일까지 전체 행을 사용하고,
     * 당일 Grid에는 기준일 행만 표시합니다.
     */
    if (
      targetDate < periodStartDate ||
      targetDate > reportDate
    ) {
      continue;
    }

    const amount =
      parseAmount(
        getCell(
          row,
          headerMap.amount
        )
      );

    if (
      amount === null ||
      amount < 0
    ) {
      invalidAmountRows.push(
        sourceRowNo
      );
      continue;
    }

    const cancelEmployeeName =
      nullableText(
        getCell(
          row,
          headerMap.cancelEmployeeName
        )
      );

    const rawManagerName =
      nullableText(
        getCell(
          row,
          headerMap.sourceManagerName
        )
      );

    const sourceManagerName =
      datasetType === "approval"
        ? (
            rawManagerName ??
            cancelEmployeeName
          )
        : cancelEmployeeName;

    const parsedRow: CardParsedRow = {
      source_row_no:
        sourceRowNo,

      card_company:
        nullableText(
          getCell(
            row,
            headerMap.cardCompany
          )
        ),

      approval_date:
        approvalDate,

      approval_time:
        parseExcelTime(
          getCell(
            row,
            headerMap.approvalTime
          )
        ),

      amount,

      approval_number:
        nullableText(
          getCell(
            row,
            headerMap.approvalNumber
          )
        ),

      approval_employee_name:
        nullableText(
          getCell(
            row,
            headerMap.approvalEmployeeName
          )
        ),

      cancel_date:
        cancelDate,

      cancel_reason:
        nullableText(
          getCell(
            row,
            headerMap.cancelReason
          )
        ),

      cancel_employee_name:
        cancelEmployeeName,

      /*
       * 기존 마감보고 Excel과 동일한 담당자 기준
       *
       * 승인: 사번(AE) 우선 + 매니저명(AF),
       *       AF가 없으면 취소사원(V) 이름을 보조 사용
       *
       * 취소: 원본 Excel 수식이 V열 취소사원을 기준으로 하므로
       *       판매사원 사번(AE)은 사용하지 않는다.
       */
      employee_no:
        datasetType === "approval"
          ? normalizeEmployeeNo(
              getCell(
                row,
                headerMap.employeeNo
              )
            )
          : null,

      source_manager_name:
        sourceManagerName,
    };

    monthlyRows.push(
      parsedRow
    );

    if (
      targetDate === reportDate
    ) {
      parsedRows.push(
        parsedRow
      );
    }
  }

  if (
    invalidAmountRows.length > 0
  ) {
    const preview =
      invalidAmountRows
        .slice(0, 8)
        .join(", ");

    throw new Error(
      `금액이 비어있거나 음수인 월 누적 자료가 있습니다. 원본 행: ${preview}${invalidAmountRows.length > 8 ? " 외" : ""}`
    );
  }

  const warnings: string[] = [];

  if (
    invalidDateRows.length > 0
  ) {
    warnings.push(
      `날짜 형식을 읽지 못한 원본 행 ${invalidDateRows.length}건은 제외되었습니다.`
    );
  }

  const unmatchedManagerCount =
    monthlyRows.filter(
      (row) =>
        row.source_manager_name === null &&
        row.employee_no === null
    ).length;

  if (
    unmatchedManagerCount > 0
  ) {
    warnings.push(
      `담당자 정보가 없는 월 누적 자료가 ${unmatchedManagerCount}건 있습니다.`
    );
  }

  const monthlyAmount =
    monthlyRows.reduce(
      (sum, row) =>
        sum + row.amount,
      0
    );

  return {
    rows: parsedRows,
    monthlyRows,
    sheetName,
    sourceRowCount,
    matchedDateRowCount:
      parsedRows.length,
    monthlyRowCount:
      monthlyRows.length,
    monthlyAmount,
    ignoredRowCount:
      Math.max(
        0,
        sourceRowCount -
          parsedRows.length
      ),
    detectedDatasetType,
    warnings,
  };
}


function parsePasteMatrix(
  text: string
): ExcelMatrix {
  const normalized =
    text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");

  if (
    normalized.trim() === ""
  ) {
    throw new Error(
      "붙여넣을 카드실적 자료가 없습니다."
    );
  }


  /*
   * Excel에서 여러 셀을 복사하면 TSV 형식으로 전달되지만,
   * 셀 내부 줄바꿈이 있는 헤더는 아래처럼 큰따옴표로 감싸집니다.
   *
   * 예)
   * "할부
   * 개월"
   *
   * 단순히 \n으로 split하면 위 셀 내부 줄바꿈까지
   * 새로운 행으로 오인하여 2단 헤더 구조가 깨집니다.
   *
   * 따라서 Excel Clipboard의 TSV 규칙에 맞춰
   * 큰따옴표 안의 탭/줄바꿈은 셀 내용으로 유지하고,
   * 큰따옴표 밖의 탭/줄바꿈만 열/행 구분자로 처리합니다.
   */
  const matrix: ExcelMatrix = [];
  let row: ExcelMatrixValue[] = [];
  let cell = "";
  let inQuotes = false;


  const pushCell = () => {
    row.push(cell);
    cell = "";
  };


  const pushRow = () => {
    pushCell();

    const hasValue =
      row.some(
        (value) =>
          normalizeText(value) !== ""
      );

    if (hasValue) {
      matrix.push(row);
    }

    row = [];
  };


  for (
    let index = 0;
    index < normalized.length;
    index += 1
  ) {
    const character =
      normalized[index];

    if (character === '"') {
      if (
        inQuotes &&
        normalized[index + 1] === '"'
      ) {
        cell += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }


    if (
      character === "\t" &&
      !inQuotes
    ) {
      pushCell();
      continue;
    }


    if (
      character === "\n" &&
      !inQuotes
    ) {
      pushRow();
      continue;
    }


    cell += character;
  }


  if (
    cell !== "" ||
    row.length > 0
  ) {
    pushRow();
  }


  if (matrix.length === 0) {
    throw new Error(
      "붙여넣은 카드실적 자료를 표 형식으로 읽지 못했습니다."
    );
  }


  return matrix;
}


export async function parseCardPerformanceExcel(
  file: File,
  datasetType: CardDatasetType,
  reportDate: string,
  password?: string
): Promise<CardParseResult> {
  const result =
    await readExcelMatrix(
      file,
      undefined,
      password
    );

  return parseMatrix(
    result.rows,
    datasetType,
    reportDate,
    result.sheetName
  );
}


export function parseCardPerformancePaste(
  text: string,
  datasetType: CardDatasetType,
  reportDate: string
): CardParseResult {
  const matrix =
    parsePasteMatrix(text);

  return parseMatrix(
    matrix,
    datasetType,
    reportDate,
    null
  );
}
