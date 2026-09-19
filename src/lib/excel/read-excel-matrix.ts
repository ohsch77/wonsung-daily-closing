export type ExcelMatrixValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined;

export type ExcelMatrix =
  ExcelMatrixValue[][];

export type ExcelFileType =
  | "xls"
  | "xlsx";

export type ExcelMatrixResult = {
  rows: ExcelMatrix;
  sheetName: string;
  fileType: ExcelFileType;
  availableSheets: string[];
};

export class ExcelPasswordRequiredError extends Error {
  readonly code =
    "EXCEL_PASSWORD_REQUIRED";

  constructor(
    message =
      "암호화된 Excel 파일입니다. 파일 암호를 입력해주세요."
  ) {
    super(message);
    this.name =
      "ExcelPasswordRequiredError";
  }
}

export class ExcelPasswordRejectedError extends Error {
  readonly code =
    "EXCEL_PASSWORD_REJECTED";

  constructor(
    message =
      "Excel 파일 암호가 올바르지 않습니다. 암호를 다시 확인해주세요."
  ) {
    super(message);
    this.name =
      "ExcelPasswordRejectedError";
  }
}

export function isExcelPasswordRequiredError(
  error: unknown
): error is ExcelPasswordRequiredError {
  return (
    error instanceof ExcelPasswordRequiredError ||
    (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (
        error as {
          code?: unknown;
        }
      ).code ===
        "EXCEL_PASSWORD_REQUIRED"
    )
  );
}

export function isExcelPasswordRejectedError(
  error: unknown
): error is ExcelPasswordRejectedError {
  return (
    error instanceof ExcelPasswordRejectedError ||
    (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (
        error as {
          code?: unknown;
        }
      ).code ===
        "EXCEL_PASSWORD_REJECTED"
    )
  );
}

const MAX_EXCEL_FILE_SIZE =
  15 * 1024 * 1024;


function getExtension(
  fileName: string
) {
  return fileName
    .split(".")
    .pop()
    ?.trim()
    .toLowerCase() ?? "";
}


function normalizeSheetName(
  value: string
) {
  return value
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}


function chooseSheetName(
  availableSheets: string[],
  preferredSheetName?: string
) {
  if (
    availableSheets.length === 0
  ) {
    throw new Error(
      "Excel 파일에 읽을 수 있는 시트가 없습니다."
    );
  }


  if (preferredSheetName) {
    const preferredNormalized =
      normalizeSheetName(
        preferredSheetName
      );


    const exact =
      availableSheets.find(
        (sheetName) =>
          normalizeSheetName(
            sheetName
          ) ===
          preferredNormalized
      );


    if (exact) {
      return exact;
    }


    const partial =
      availableSheets.find(
        (sheetName) => {
          const normalized =
            normalizeSheetName(
              sheetName
            );

          return (
            normalized.includes(
              preferredNormalized
            ) ||
            preferredNormalized.includes(
              normalized
            )
          );
        }
      );


    if (partial) {
      return partial;
    }
  }


  /*
   * 회사 전산 파일은 실제 시트명이
   * Sheet1 등으로 내려오는 경우가 있습니다.
   * 업무별 Parser가 헤더를 다시 검증하므로
   * 예상 시트명이 없으면 첫 번째 시트를 사용합니다.
   */
  return availableSheets[0];
}


function getRawErrorMessage(
  error: unknown
) {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  if (
    typeof error === "string"
  ) {
    return error;
  }

  return "";
}


function looksLikePasswordError(
  message: string
) {
  return /password|encrypted|encryption|crypto|decrypt|암호/i.test(
    message
  );
}


function getFriendlyReadError(
  error: unknown
) {
  const message =
    getRawErrorMessage(
      error
    );

  if (
    /unsupported|format|corrupt|invalid|biff/i.test(
      message
    )
  ) {
    return "Excel 파일 형식을 해석하지 못했습니다. 파일을 다시 내려받아 시도하거나 Ctrl+C / Ctrl+V 붙여넣기를 이용해주세요.";
  }

  return "Excel 파일을 읽지 못했습니다. 파일을 다시 내려받아 시도하거나 Excel 표를 Ctrl+C / Ctrl+V로 붙여넣어주세요.";
}


type WorkbookLike = {
  SheetNames?: string[];
  Sheets: Record<
    string,
    unknown
  >;
};


async function parseWorkbookBuffer(
  arrayBuffer: ArrayBuffer,
  extension: ExcelFileType,
  preferredSheetName?: string,
  password?: string
): Promise<ExcelMatrixResult> {
  const XLSX =
    await import(
      "@e965/xlsx"
    );


  const normalizedPassword =
    password?.trim() ?? "";


  const workbook =
    XLSX.read(
      arrayBuffer,
      {
        type: "array",
        password:
          normalizedPassword !== ""
            ? normalizedPassword
            : undefined,
        cellDates: false,
        cellFormula: false,
        cellHTML: false,
        cellNF: false,
        cellStyles: false,
        bookVBA: false,
        WTF: false,
      }
    ) as WorkbookLike;


  const availableSheets =
    workbook.SheetNames ?? [];


  const selectedSheetName =
    chooseSheetName(
      availableSheets,
      preferredSheetName
    );


  const worksheet =
    workbook.Sheets[
      selectedSheetName
    ];


  if (!worksheet) {
    throw new Error(
      "선택한 Excel 시트를 읽을 수 없습니다."
    );
  }


  const rows =
    XLSX.utils.sheet_to_json<
      ExcelMatrixValue[]
    >(
      worksheet,
      {
        header: 1,
        raw: true,
        defval: "",
        blankrows: false,
      }
    ) as ExcelMatrix;


  return {
    rows,
    sheetName:
      selectedSheetName,
    fileType:
      extension,
    availableSheets,
  };
}


async function decryptExcelOnServer(
  file: File,
  password: string
) {
  const formData =
    new FormData();

  formData.append(
    "file",
    file,
    file.name
  );

  formData.append(
    "password",
    password
  );


  const response =
    await fetch(
      "/api/excel/decrypt",
      {
        method: "POST",
        body: formData,
        cache: "no-store",
      }
    );


  if (!response.ok) {
    let code = "";

    try {
      const body =
        await response.json() as {
          code?: string;
        };

      code =
        body.code ?? "";
    }
    catch {
      code = "";
    }


    if (
      code ===
      "INVALID_PASSWORD"
    ) {
      throw new ExcelPasswordRejectedError(
        "Excel 파일 암호가 올바르지 않습니다. 암호를 다시 확인해주세요."
      );
    }


    if (
      code ===
      "UNSUPPORTED_ENCRYPTION"
    ) {
      throw new ExcelPasswordRejectedError(
        "이 Excel 암호화 형식을 해제하지 못했습니다. 파일 암호와 원본 파일을 확인해주세요."
      );
    }


    throw new Error(
      "Excel 암호 해제 중 오류가 발생했습니다. 다시 시도해주세요."
    );
  }


  return response.arrayBuffer();
}


/**
 * 회사 전산 Excel 공통 Reader
 *
 * 지원:
 * - Excel 97-2003 .xls
 * - Excel 2007+ .xlsx
 * - 일반 SheetJS 지원 형식
 * - SheetJS가 직접 여는 암호화 형식
 * - RC4 계열 legacy .xls는 Next.js 서버에서 officecrypto-tool로 복호화 후 읽기
 *
 * 보안 원칙:
 * - 암호는 브라우저 메모리와 단일 복호화 요청에서만 사용합니다.
 * - 암호는 Supabase / DB / LocalStorage / Cookie에 저장하지 않습니다.
 * - 서버 API도 암호나 원본 파일을 디스크에 저장하지 않습니다.
 */
export async function readExcelMatrix(
  file: File,
  preferredSheetName?: string,
  password?: string
): Promise<ExcelMatrixResult> {
  if (
    file.size === 0
  ) {
    throw new Error(
      "빈 Excel 파일입니다."
    );
  }


  if (
    file.size >
    MAX_EXCEL_FILE_SIZE
  ) {
    throw new Error(
      "Excel 파일은 15MB 이하만 사용할 수 있습니다."
    );
  }


  const extension =
    getExtension(
      file.name
    );


  if (
    extension !== "xls" &&
    extension !== "xlsx"
  ) {
    throw new Error(
      "Excel 파일은 .xls 또는 .xlsx 형식만 사용할 수 있습니다."
    );
  }


  const fileType =
    extension as
      ExcelFileType;


  const normalizedPassword =
    password?.trim() ?? "";


  const originalBuffer =
    await file.arrayBuffer();


  /*
   * 1차: SheetJS 직접 읽기
   *
   * 비암호 파일 또는 SheetJS가 지원하는
   * 암호화 방식은 여기서 바로 처리됩니다.
   */
  try {
    return await parseWorkbookBuffer(
      originalBuffer,
      fileType,
      preferredSheetName,
      normalizedPassword !== ""
        ? normalizedPassword
        : undefined
    );
  }
  catch (error) {
    const rawMessage =
      getRawErrorMessage(
        error
      );


    if (
      !looksLikePasswordError(
        rawMessage
      )
    ) {
      throw new Error(
        getFriendlyReadError(
          error
        )
      );
    }


    if (
      normalizedPassword === ""
    ) {
      throw new ExcelPasswordRequiredError();
    }
  }


  /*
   * 2차: 정확한 암호를 입력했는데 SheetJS가
   * legacy .xls 암호화를 직접 지원하지 못한 경우
   * 서버 메모리에서 officecrypto-tool로 복호화합니다.
   */
  try {
    const decryptedBuffer =
      await decryptExcelOnServer(
        file,
        normalizedPassword
      );


    return await parseWorkbookBuffer(
      decryptedBuffer,
      fileType,
      preferredSheetName
    );
  }
  catch (error) {
    if (
      isExcelPasswordRejectedError(
        error
      )
    ) {
      throw error;
    }


    throw new ExcelPasswordRejectedError(
      "Excel 파일 암호를 확인했지만 파일을 열지 못했습니다. 암호를 다시 확인해주세요."
    );
  }
}
