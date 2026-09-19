"use client";

import type {
  ChangeEvent,
  DragEvent,
} from "react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  CheckCircle2,
  ClipboardPaste,
  Eye,
  EyeOff,
  FileSpreadsheet,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/client";

import {
  isExcelPasswordRejectedError,
  isExcelPasswordRequiredError,
} from "@/lib/excel/read-excel-matrix";

import {
  parseSystemPerformanceExcel,
  parseSystemPerformancePaste,
} from "@/lib/system-performance-parser";

import type {
  SystemPerformanceDatasetType,
  SystemPerformanceParsedRow,
  SystemPerformanceSnapshotType,
  SystemPerformanceSourceMethod,
} from "@/types/system-performance";


export type SystemPerformanceInputTarget = {
  reportDate: string;

  datasetType:
    SystemPerformanceDatasetType;

  snapshotType:
    SystemPerformanceSnapshotType;

  datasetTitle: string;

  snapshotTitle: string;

  draftBatchId:
    string | null;

  appliedBatchId:
    string | null;

  sourceMethod:
    SystemPerformanceSourceMethod | null;

  sourceFileName:
    string | null;

  sourceSheetName:
    string | null;
};


type Props = {
  target:
    SystemPerformanceInputTarget;

  onClose:
    () => void;

  onApplied:
    (
      message: string
    ) => void;
};


type BusyAction =
  | "save"
  | "apply"
  | null;


type NumericField =
  | "target_amount"
  | "performance_amount"
  | "performance_share"
  | "achievement_rate"
  | "profit_amount"
  | "profit_share"
  | "profit_rate"
  | "selling_price_rate";


type EditableSystemPerformanceRow = {
  client_key: string;

  source_row_no: number;

  row_type:
    "employee" |
    "total";

  organization_name: string;

  employee_no: string;

  employee_name: string;

  target_amount: string;

  performance_amount: string;

  performance_share: string;

  achievement_rate: string;

  profit_amount: string;

  profit_share: string;

  profit_rate: string;

  selling_price_rate: string;

  is_excluded: boolean;

  exclude_reason: string;
};


const NUMERIC_COLUMNS:
  {
    key: NumericField;
    label: string;
    kind:
      "amount" |
      "rate";
    minWidth: string;
  }[] = [
    {
      key:
        "target_amount",

      label:
        "목표",

      kind:
        "amount",

      minWidth:
        "130px",
    },

    {
      key:
        "performance_amount",

      label:
        "실적",

      kind:
        "amount",

      minWidth:
        "130px",
    },

    {
      key:
        "performance_share",

      label:
        "비중",

      kind:
        "rate",

      minWidth:
        "95px",
    },

    {
      key:
        "achievement_rate",

      label:
        "달성율",

      kind:
        "rate",

      minWidth:
        "95px",
    },

    {
      key:
        "profit_amount",

      label:
        "이익실적",

      kind:
        "amount",

      minWidth:
        "130px",
    },

    {
      key:
        "profit_share",

      label:
        "이익비중",

      kind:
        "rate",

      minWidth:
        "95px",
    },

    {
      key:
        "profit_rate",

      label:
        "이익율",

      kind:
        "rate",

      minWidth:
        "95px",
    },

    {
      key:
        "selling_price_rate",

      label:
        "판가율",

      kind:
        "rate",

      minWidth:
        "95px",
    },
  ];


function createClientKey() {
  if (
    typeof crypto !==
      "undefined" &&
    "randomUUID" in crypto
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}


function normalizeEmployeeNo(
  value: string
) {
  return value
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}


function numberToInput(
  value:
    number | null
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value);
}


function sanitizeNumericInput(
  value: string
) {
  return value
    .replace(
      /[^0-9.,()\-%₩￦원]/g,
      ""
    );
}


function parseNumericInput(
  value: string
): {
  value:
    number | null;

  valid: boolean;
} {
  const original =
    value.trim();


  if (
    original === ""
  ) {
    return {
      value: null,
      valid: true,
    };
  }


  const negativeByParentheses =
    original.startsWith("(") &&
    original.endsWith(")");


  const cleaned =
    original
      .replace(/[₩￦원,%]/g, "")
      .replace(/,/g, "")
      .replace(/\s+/g, "")
      .replace(/[()]/g, "");


  if (
    cleaned === "" ||
    cleaned === "-" ||
    cleaned === "." ||
    cleaned === "-."
  ) {
    return {
      value: null,
      valid: false,
    };
  }


  const parsed =
    Number(cleaned);


  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return {
      value: null,
      valid: false,
    };
  }


  return {
    value:
      negativeByParentheses
        ? -Math.abs(parsed)
        : parsed,

    valid: true,
  };
}


function formatNumericInput(
  value: string,
  kind:
    "amount" |
    "rate"
) {
  const parsed =
    parseNumericInput(
      value
    );


  if (
    !parsed.valid ||
    parsed.value === null
  ) {
    return value;
  }


  if (
    kind ===
    "amount"
  ) {
    return parsed.value
      .toLocaleString(
        "ko-KR",
        {
          maximumFractionDigits: 2,
        }
      );
  }


  return String(
    parsed.value
  );
}


function getErrorMessage(
  error: unknown,
  fallback: string
) {
  if (
    error instanceof Error
  ) {
    return error.message;
  }


  if (
    typeof error ===
      "object" &&
    error !== null &&
    "message" in error
  ) {
    const message =
      (
        error as {
          message?: unknown;
        }
      ).message;


    if (
      typeof message ===
        "string" &&
      message.trim() !==
        ""
    ) {
      return message;
    }
  }


  return fallback;
}


function toEditableRow(
  row:
    SystemPerformanceParsedRow
): EditableSystemPerformanceRow {
  return {
    client_key:
      createClientKey(),

    source_row_no:
      row.source_row_no,

    row_type:
      row.row_type,

    organization_name:
      row.organization_name,

    employee_no:
      row.employee_no,

    employee_name:
      row.employee_name,

    target_amount:
      numberToInput(
        row.target_amount
      ),

    performance_amount:
      numberToInput(
        row.performance_amount
      ),

    performance_share:
      numberToInput(
        row.performance_share
      ),

    achievement_rate:
      numberToInput(
        row.achievement_rate
      ),

    profit_amount:
      numberToInput(
        row.profit_amount
      ),

    profit_share:
      numberToInput(
        row.profit_share
      ),

    profit_rate:
      numberToInput(
        row.profit_rate
      ),

    selling_price_rate:
      numberToInput(
        row.selling_price_rate
      ),

    is_excluded:
      row.is_excluded,

    exclude_reason:
      row.exclude_reason,
  };
}


function mapDatabaseRow(
  row:
    Record<
      string,
      unknown
    >
): EditableSystemPerformanceRow {
  return {
    client_key:
      createClientKey(),

    source_row_no:
      Number(
        row.source_row_no ??
        0
      ),

    row_type:
      row.row_type ===
      "total"
        ? "total"
        : "employee",

    organization_name:
      String(
        row.organization_name ??
        ""
      ),

    employee_no:
      String(
        row.employee_no ??
        ""
      ),

    employee_name:
      String(
        row.employee_name ??
        ""
      ),

    target_amount:
      row.target_amount ===
        null ||
      row.target_amount ===
        undefined
        ? ""
        : String(
            row.target_amount
          ),

    performance_amount:
      row.performance_amount ===
        null ||
      row.performance_amount ===
        undefined
        ? ""
        : String(
            row.performance_amount
          ),

    performance_share:
      row.performance_share ===
        null ||
      row.performance_share ===
        undefined
        ? ""
        : String(
            row.performance_share
          ),

    achievement_rate:
      row.achievement_rate ===
        null ||
      row.achievement_rate ===
        undefined
        ? ""
        : String(
            row.achievement_rate
          ),

    profit_amount:
      row.profit_amount ===
        null ||
      row.profit_amount ===
        undefined
        ? ""
        : String(
            row.profit_amount
          ),

    profit_share:
      row.profit_share ===
        null ||
      row.profit_share ===
        undefined
        ? ""
        : String(
            row.profit_share
          ),

    profit_rate:
      row.profit_rate ===
        null ||
      row.profit_rate ===
        undefined
        ? ""
        : String(
            row.profit_rate
          ),

    selling_price_rate:
      row.selling_price_rate ===
        null ||
      row.selling_price_rate ===
        undefined
        ? ""
        : String(
            row.selling_price_rate
          ),

    is_excluded:
      Boolean(
        row.is_excluded
      ),

    exclude_reason:
      String(
        row.exclude_reason ??
        ""
      ),
  };
}


function createEmptyRow(
  sourceRowNo: number
): EditableSystemPerformanceRow {
  return {
    client_key:
      createClientKey(),

    source_row_no:
      sourceRowNo,

    row_type:
      "employee",

    organization_name:
      "",

    employee_no:
      "",

    employee_name:
      "",

    target_amount:
      "",

    performance_amount:
      "",

    performance_share:
      "",

    achievement_rate:
      "",

    profit_amount:
      "",

    profit_share:
      "",

    profit_rate:
      "",

    selling_price_rate:
      "",

    is_excluded:
      false,

    exclude_reason:
      "",
  };
}


export default function SystemPerformanceInputModal({
  target,
  onClose,
  onApplied,
}: Props) {
  const router =
    useRouter();


  const supabase =
    useMemo(
      () =>
        createClient(),
      []
    );


  const sourceBatchId =
    target.draftBatchId ??
    target.appliedBatchId;


  const [
    rows,
    setRows,
  ] = useState<
    EditableSystemPerformanceRow[]
  >([]);


  const [
    draftBatchId,
    setDraftBatchId,
  ] = useState<
    string | null
  >(
    target.draftBatchId
  );


  const [
    sourceMethod,
    setSourceMethod,
  ] = useState<
    SystemPerformanceSourceMethod | null
  >(
    target.sourceMethod
  );


  const [
    sourceFileName,
    setSourceFileName,
  ] = useState<
    string | null
  >(
    target.sourceFileName
  );


  const [
    sourceSheetName,
    setSourceSheetName,
  ] = useState<
    string | null
  >(
    target.sourceSheetName
  );


  const [
    knownEmployeeNos,
    setKnownEmployeeNos,
  ] = useState<
    string[]
  >([]);


  const [
    warnings,
    setWarnings,
  ] = useState<
    string[]
  >([]);


  const [
    pasteText,
    setPasteText,
  ] = useState("");


  const [
    isLoading,
    setIsLoading,
  ] = useState(true);


  const [
    parseBusy,
    setParseBusy,
  ] = useState(false);


  const [
    isDragging,
    setIsDragging,
  ] = useState(false);


  const [
    busyAction,
    setBusyAction,
  ] = useState<
    BusyAction
  >(null);


  const [
    dirty,
    setDirty,
  ] = useState(false);


  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");


  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");


  const [
    pendingEncryptedFile,
    setPendingEncryptedFile,
  ] = useState<File | null>(null);


  const [
    excelPassword,
    setExcelPassword,
  ] = useState("");


  const [
    passwordError,
    setPasswordError,
  ] = useState("");


  const [
    passwordBusy,
    setPasswordBusy,
  ] = useState(false);


  const [
    showExcelPassword,
    setShowExcelPassword,
  ] = useState(false);


  useEffect(() => {
    const previousOverflow =
      document.body.style
        .overflow;


    document.body.style
      .overflow =
      "hidden";


    return () => {
      document.body.style
        .overflow =
        previousOverflow;
    };
  }, []);


  useEffect(() => {
    let cancelled =
      false;


    async function loadInitialData() {
      try {
        const managerPromise =
          supabase
            .from(
              "managers"
            )
            .select(
              "employee_no"
            )
            .eq(
              "is_active",
              true
            );


        const rowsPromise =
          sourceBatchId
            ? supabase
                .from(
                  "system_performance_rows"
                )
                .select(
                  `
                    source_row_no,
                    row_type,
                    organization_name,
                    employee_no,
                    employee_name,
                    target_amount,
                    performance_amount,
                    performance_share,
                    achievement_rate,
                    profit_amount,
                    profit_share,
                    profit_rate,
                    selling_price_rate,
                    is_excluded,
                    exclude_reason
                  `
                )
                .eq(
                  "batch_id",
                  sourceBatchId
                )
                .order(
                  "source_row_no",
                  {
                    ascending:
                      true,
                  }
                )
            : Promise.resolve({
                data: [],
                error: null,
              });


        const [
          managerResult,
          rowResult,
        ] =
          await Promise.all([
            managerPromise,
            rowsPromise,
          ]);


        if (
          managerResult.error
        ) {
          throw managerResult.error;
        }


        if (
          rowResult.error
        ) {
          throw rowResult.error;
        }


        if (
          cancelled
        ) {
          return;
        }


        setKnownEmployeeNos(
          (
            managerResult.data ??
            []
          )
            .map(
              (manager) =>
                normalizeEmployeeNo(
                  String(
                    manager.employee_no ??
                    ""
                  )
                )
            )
            .filter(
              (employeeNo) =>
                employeeNo !==
                ""
            )
        );


        setRows(
          (
            rowResult.data ??
            []
          ).map(
            (row) =>
              mapDatabaseRow(
                row
              )
          )
        );


        setIsLoading(
          false
        );
      }
      catch (error) {
        if (
          cancelled
        ) {
          return;
        }


        setErrorMessage(
          getErrorMessage(
            error,
            "전산실적 자료를 불러오지 못했습니다."
          )
        );


        setIsLoading(
          false
        );
      }
    }


    void loadInitialData();


    return () => {
      cancelled =
        true;
    };
  }, [
    sourceBatchId,
    supabase,
  ]);


  const knownEmployeeSet =
    useMemo(
      () =>
        new Set(
          knownEmployeeNos
        ),
      [
        knownEmployeeNos,
      ]
    );


  const unmatchedCount =
    useMemo(
      () =>
        rows.filter(
          (row) => {
            if (
              row.row_type !==
              "employee"
            ) {
              return false;
            }


            const employeeNo =
              normalizeEmployeeNo(
                row.employee_no
              );


            if (
              employeeNo ===
              ""
            ) {
              return false;
            }


            return (
              !knownEmployeeSet.has(
                employeeNo
              )
            );
          }
        ).length,
      [
        rows,
        knownEmployeeSet,
      ]
    );


  const missingEmployeeNoCount =
    useMemo(
      () =>
        rows.filter(
          (row) =>
            row.row_type ===
              "employee" &&
            row.employee_no
              .trim() ===
              ""
        ).length,
      [rows]
    );


  const markChanged =
    useCallback(
      () => {
        setDirty(
          true
        );


        setSuccessMessage(
          ""
        );


        setErrorMessage(
          ""
        );


        if (
          sourceMethod ===
          null
        ) {
          setSourceMethod(
            "manual"
          );
        }
      },
      [sourceMethod]
    );


  const requestClose =
    useCallback(
      () => {
        if (
          parseBusy ||
          passwordBusy ||
          busyAction !==
            null
        ) {
          return;
        }


        if (
          pendingEncryptedFile
        ) {
          setPendingEncryptedFile(
            null
          );

          setExcelPassword(
            ""
          );

          setPasswordError(
            ""
          );

          setShowExcelPassword(
            false
          );

          return;
        }


        if (
          dirty
        ) {
          const confirmed =
            window.confirm(
              "저장하지 않은 변경사항이 있습니다. 입력 화면을 닫으시겠습니까?"
            );


          if (
            !confirmed
          ) {
            return;
          }
        }


        onClose();
      },
      [
        busyAction,
        dirty,
        onClose,
        parseBusy,
        passwordBusy,
        pendingEncryptedFile,
      ]
    );


  useEffect(() => {
    const handleKeyDown =
      (
        event:
          KeyboardEvent
      ) => {
        if (
          event.key ===
          "Escape"
        ) {
          requestClose();
        }
      };


    window.addEventListener(
      "keydown",
      handleKeyDown
    );


    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    requestClose,
  ]);


  const applyExcelResult =
    (
      file: File,
      result: Awaited<
        ReturnType<
          typeof parseSystemPerformanceExcel
        >
      >
    ) => {
      const previousRowCount =
        rows.length;


      // 재업로드는 기존 Grid에 누적하지 않고 새 파일의 전체 스냅샷으로 교체한다.
      // DB 저장 시에도 replace_system_performance_draft_rows RPC가 기존 Draft 행을
      // 삭제한 뒤 현재 Grid 전체를 다시 저장하므로 동일한 덮어쓰기 규칙이 유지된다.
      setRows(
        result.rows.map(
          (row) =>
            toEditableRow(
              row
            )
        )
      );


      setWarnings(
        result.warnings
      );


      setSourceMethod(
        "upload"
      );


      setSourceFileName(
        file.name
      );


      setSourceSheetName(
        result.sheetName
      );


      setDirty(
        true
      );


      setPasteText(
        ""
      );


      setSuccessMessage(
        previousRowCount > 0
          ? `기존 ${previousRowCount.toLocaleString(
              "ko-KR"
            )}개 행을 새 업로드 파일 '${file.name}'의 ${result.rows.length.toLocaleString(
              "ko-KR"
            )}개 행으로 교체했습니다.`
          : `${result.rows.length.toLocaleString(
              "ko-KR"
            )}개 행을 '${file.name}'에서 불러왔습니다.`
      );


      setPendingEncryptedFile(
        null
      );


      setExcelPassword(
        ""
      );


      setPasswordError(
        ""
      );


      setShowExcelPassword(
        false
      );
    };


  const processExcelFile =
    async (
      file: File
    ) => {
      if (
        parseBusy ||
        passwordBusy ||
        busyAction !==
          null
      ) {
        return;
      }


      setParseBusy(
        true
      );


      setErrorMessage(
        ""
      );


      setSuccessMessage(
        ""
      );


      setPasswordError(
        ""
      );


      try {
        const result =
          await parseSystemPerformanceExcel(
            file,
            target.datasetType,
            target.snapshotType
          );


        applyExcelResult(
          file,
          result
        );
      }
      catch (error) {
        if (
          isExcelPasswordRequiredError(
            error
          )
        ) {
          setPendingEncryptedFile(
            file
          );


          setExcelPassword(
            ""
          );


          setPasswordError(
            ""
          );


          setShowExcelPassword(
            false
          );


          return;
        }


        setErrorMessage(
          getErrorMessage(
            error,
            "Excel 파일을 읽지 못했습니다."
          )
        );
      }
      finally {
        setParseBusy(
          false
        );
      }
    };


  const closePasswordDialog =
    () => {
      if (
        passwordBusy
      ) {
        return;
      }


      setPendingEncryptedFile(
        null
      );


      setExcelPassword(
        ""
      );


      setPasswordError(
        ""
      );


      setShowExcelPassword(
        false
      );
    };


  const handlePasswordSubmit =
    async () => {
      const file =
        pendingEncryptedFile;


      if (
        !file ||
        passwordBusy
      ) {
        return;
      }


      if (
        excelPassword.trim() ===
        ""
      ) {
        setPasswordError(
          "Excel 파일 암호를 입력해주세요."
        );

        return;
      }


      setPasswordBusy(
        true
      );


      setPasswordError(
        ""
      );


      try {
        const result =
          await parseSystemPerformanceExcel(
            file,
            target.datasetType,
            target.snapshotType,
            excelPassword
          );


        applyExcelResult(
          file,
          result
        );
      }
      catch (error) {
        if (
          isExcelPasswordRejectedError(
            error
          ) ||
          isExcelPasswordRequiredError(
            error
          )
        ) {
          setPasswordError(
            "암호가 올바르지 않거나 이 Excel 암호화 방식은 브라우저에서 지원되지 않습니다. 암호를 다시 확인해주세요."
          );
        }
        else {
          setPasswordError(
            getErrorMessage(
              error,
              "Excel 파일을 열지 못했습니다."
            )
          );
        }
      }
      finally {
        setPasswordBusy(
          false
        );
      }
    };


  const handleFileChange =
    async (
      event:
        ChangeEvent<HTMLInputElement>
    ) => {
      const file =
        event.target
          .files?.[0];


      event.target.value =
        "";


      if (
        !file
      ) {
        return;
      }


      await processExcelFile(
        file
      );
    };


  const handleDrop =
    (
      event:
        DragEvent<HTMLDivElement>
    ) => {
      event.preventDefault();


      setIsDragging(
        false
      );


      const file =
        event.dataTransfer
          .files?.[0];


      if (
        !file
      ) {
        return;
      }


      void processExcelFile(
        file
      );
    };


  const handlePasteImport =
    () => {
      if (
        pasteText.trim() ===
        ""
      ) {
        setErrorMessage(
          "먼저 Excel 표 전체를 복사한 뒤 붙여넣기 영역에 Ctrl+V 해주세요."
        );

        return;
      }


      setErrorMessage(
        ""
      );


      setSuccessMessage(
        ""
      );


      try {
        const result =
          parseSystemPerformancePaste(
            pasteText,
            target.datasetType
          );


        const previousRowCount =
          rows.length;


        // 재붙여넣기도 업로드와 동일하게 기존 내용을 누적하지 않고 전체 교체한다.
        setRows(
          result.rows.map(
            (row) =>
              toEditableRow(
                row
              )
          )
        );


        setWarnings(
          result.warnings
        );


        setSourceMethod(
          "paste"
        );


        setSourceFileName(
          null
        );


        setSourceSheetName(
          null
        );


        setDirty(
          true
        );


        setPasteText(
          ""
        );


        setSuccessMessage(
          previousRowCount > 0
            ? `기존 ${previousRowCount.toLocaleString(
                "ko-KR"
              )}개 행을 새 붙여넣기 자료의 ${result.rows.length.toLocaleString(
                "ko-KR"
              )}개 행으로 교체했습니다.`
            : `${result.rows.length.toLocaleString(
                "ko-KR"
              )}개 행을 붙여넣기 자료에서 불러왔습니다.`
        );
      }
      catch (error) {


        setErrorMessage(
          getErrorMessage(
            error,
            "붙여넣기 자료를 분석하지 못했습니다."
          )
        );
      }
    };


  const updateTextField =
    (
      rowIndex: number,
      field:
        | "organization_name"
        | "employee_no"
        | "employee_name"
        | "exclude_reason",
      value: string
    ) => {
      setRows(
        (previous) =>
          previous.map(
            (
              row,
              index
            ) => {
              if (
                index !==
                rowIndex
              ) {
                return row;
              }


              return {
                ...row,
                [field]:
                  value,
              };
            }
          )
      );


      markChanged();
    };


  const updateNumericField =
    (
      rowIndex: number,
      field:
        NumericField,
      value: string
    ) => {
      const sanitized =
        sanitizeNumericInput(
          value
        );


      setRows(
        (previous) =>
          previous.map(
            (
              row,
              index
            ) => {
              if (
                index !==
                rowIndex
              ) {
                return row;
              }


              return {
                ...row,
                [field]:
                  sanitized,
              };
            }
          )
      );


      markChanged();
    };


  const normalizeNumericField =
    (
      rowIndex: number,
      field:
        NumericField,
      kind:
        "amount" |
        "rate"
    ) => {
      setRows(
        (previous) =>
          previous.map(
            (
              row,
              index
            ) => {
              if (
                index !==
                rowIndex
              ) {
                return row;
              }


              return {
                ...row,
                [field]:
                  formatNumericInput(
                    row[field],
                    kind
                  ),
              };
            }
          )
      );
    };


  const updateRowType =
    (
      rowIndex: number,
      value:
        "employee" |
        "total"
    ) => {
      setRows(
        (previous) =>
          previous.map(
            (
              row,
              index
            ) => {
              if (
                index !==
                rowIndex
              ) {
                return row;
              }


              return {
                ...row,
                row_type:
                  value,
              };
            }
          )
      );


      markChanged();
    };


  const updateExcluded =
    (
      rowIndex: number,
      checked: boolean
    ) => {
      setRows(
        (previous) =>
          previous.map(
            (
              row,
              index
            ) => {
              if (
                index !==
                rowIndex
              ) {
                return row;
              }


              return {
                ...row,

                is_excluded:
                  checked,

                exclude_reason:
                  checked
                    ? row.exclude_reason
                    : "",
              };
            }
          )
      );


      markChanged();
    };


  const handleEmployeeNoBlur =
    (
      rowIndex: number
    ) => {
      setRows(
        (previous) =>
          previous.map(
            (
              row,
              index
            ) => {
              if (
                index !==
                rowIndex
              ) {
                return row;
              }


              return {
                ...row,

                employee_no:
                  normalizeEmployeeNo(
                    row.employee_no
                  ),
              };
            }
          )
      );
    };


  const addRow =
    () => {
      const maxRowNo =
        rows.reduce(
          (
            currentMax,
            row
          ) =>
            Math.max(
              currentMax,
              row.source_row_no
            ),
          0
        );


      setRows(
        (previous) => [
          ...previous,
          createEmptyRow(
            maxRowNo + 1
          ),
        ]
      );


      markChanged();
    };


  const deleteRow =
    (
      rowIndex: number
    ) => {
      setRows(
        (previous) =>
          previous.filter(
            (
              _row,
              index
            ) =>
              index !==
              rowIndex
          )
      );


      markChanged();
    };


  const clearRows =
    () => {
      const confirmed =
        window.confirm(
          "현재 입력 Grid를 전체 삭제할까요?\n\n삭제 후 바로 다른 파일을 드래그하거나 다시 붙여넣을 수 있습니다.\nDB 자료는 [임시저장] 또는 [전산실적 적용] 전까지 변경되지 않습니다."
        );


      if (
        !confirmed
      ) {
        return;
      }


      setRows(
        []
      );


      setWarnings(
        []
      );


      setSourceMethod(
        "manual"
      );


      setSourceFileName(
        null
      );


      setSourceSheetName(
        null
      );


      setPasteText(
        ""
      );


      setDirty(
        true
      );


      setSuccessMessage(
        "입력 Grid를 비웠습니다. 새 파일을 드래그하거나 다시 붙여넣을 수 있습니다."
      );


      setErrorMessage(
        ""
      );
    };


  const validateAndBuildPayload =
    () => {
      const payload:
        SystemPerformanceParsedRow[] =
          [];


      for (
        let index = 0;
        index <
          rows.length;
        index += 1
      ) {
        const row =
          rows[index];


        const numericValues =
          {} as Record<
            NumericField,
            number | null
          >;


        for (
          const column of
          NUMERIC_COLUMNS
        ) {
          const parsed =
            parseNumericInput(
              row[column.key]
            );


          if (
            !parsed.valid
          ) {
            throw new Error(
              `${index + 1}번째 행의 '${column.label}' 숫자를 확인해주세요.`
            );
          }


          numericValues[
            column.key
          ] = parsed.value;
        }


        payload.push({
          source_row_no:
            row.source_row_no >
            0
              ? row.source_row_no
              : index + 1,

          row_type:
            row.row_type,

          organization_name:
            row.organization_name
              .trim(),

          employee_no:
            normalizeEmployeeNo(
              row.employee_no
            ),

          employee_name:
            row.employee_name
              .trim(),

          target_amount:
            numericValues
              .target_amount,

          performance_amount:
            numericValues
              .performance_amount,

          performance_share:
            numericValues
              .performance_share,

          achievement_rate:
            numericValues
              .achievement_rate,

          profit_amount:
            numericValues
              .profit_amount,

          profit_share:
            numericValues
              .profit_share,

          profit_rate:
            numericValues
              .profit_rate,

          selling_price_rate:
            numericValues
              .selling_price_rate,

          is_excluded:
            row.is_excluded,

          exclude_reason:
            row.is_excluded
              ? row.exclude_reason
                  .trim()
              : "",
        });
      }


      return payload;
    };


  const ensureDraftBatch =
    async () => {
      if (
        draftBatchId
      ) {
        return draftBatchId;
      }


      const effectiveSourceMethod:
        SystemPerformanceSourceMethod =
          sourceMethod ??
          "manual";


      const {
        data,
        error,
      } =
        await supabase.rpc(
          "create_system_performance_draft",
          {
            p_report_date:
              target.reportDate,

            p_dataset_type:
              target.datasetType,

            p_snapshot_type:
              target.snapshotType,

            p_source_method:
              effectiveSourceMethod,

            p_source_file_name:
              sourceFileName,

            p_source_sheet_name:
              sourceSheetName,

            p_note:
              target.appliedBatchId
                ? "전산실적 수정 Draft"
                : null,
          }
        );


      if (
        error
      ) {
        throw error;
      }


      if (
        typeof data !==
          "string" ||
        data.trim() ===
          ""
      ) {
        throw new Error(
          "전산실적 Draft ID를 생성하지 못했습니다."
        );
      }


      setDraftBatchId(
        data
      );


      return data;
    };


  const saveDraftInternal =
    async () => {
      const payload =
        validateAndBuildPayload();


      const batchId =
        await ensureDraftBatch();


      const effectiveSourceMethod:
        SystemPerformanceSourceMethod =
          sourceMethod ??
          "manual";


      const {
        error,
      } =
        await supabase.rpc(
          "replace_system_performance_draft_rows",
          {
            p_batch_id:
              batchId,

            p_rows:
              payload,

            p_source_method:
              effectiveSourceMethod,

            p_source_file_name:
              effectiveSourceMethod ===
              "upload"
                ? sourceFileName
                : null,

            p_source_sheet_name:
              effectiveSourceMethod ===
              "upload"
                ? sourceSheetName
                : null,
          }
        );


      if (
        error
      ) {
        throw error;
      }


      setSourceMethod(
        effectiveSourceMethod
      );


      setDirty(
        false
      );


      return batchId;
    };


  const handleSaveDraft =
    async () => {
      if (
        busyAction !==
          null ||
        parseBusy
      ) {
        return;
      }


      setBusyAction(
        "save"
      );


      setErrorMessage(
        ""
      );


      setSuccessMessage(
        ""
      );


      try {
        await saveDraftInternal();


        setSuccessMessage(
          `임시저장 완료 · ${rows.length.toLocaleString(
            "ko-KR"
          )}개 행`
        );


        router.refresh();
      }
      catch (error) {


        setErrorMessage(
          getErrorMessage(
            error,
            "전산실적 임시저장 중 오류가 발생했습니다."
          )
        );
      }
      finally {
        setBusyAction(
          null
        );
      }
    };


  const handleApply =
    async () => {
      if (
        busyAction !==
          null ||
        parseBusy
      ) {
        return;
      }


      setBusyAction(
        "apply"
      );


      setErrorMessage(
        ""
      );


      setSuccessMessage(
        ""
      );


      try {
        const batchId =
          await saveDraftInternal();


        const {
          error,
        } =
          await supabase.rpc(
            "finalize_system_performance_batch",
            {
              p_batch_id:
                batchId,
            }
          );


        if (
          error
        ) {
          throw error;
        }


        onApplied(
          `${target.datasetTitle} · ${target.snapshotTitle} 적용완료 (${rows.length.toLocaleString(
            "ko-KR"
          )}개 행)`
        );
      }
      catch (error) {


        setErrorMessage(
          getErrorMessage(
            error,
            "전산실적 적용 중 오류가 발생했습니다."
          )
        );


        setBusyAction(
          null
        );
      }
    };


  const isBusy =
    isLoading ||
    parseBusy ||
    passwordBusy ||
    busyAction !==
      null;


  const saveDraftDisabled =
    isBusy ||
    (
      target.appliedBatchId !==
        null &&
      draftBatchId ===
        null &&
      !dirty
    );


  const applyDisabled =
    isBusy ||
    (
      target.appliedBatchId !==
        null &&
      draftBatchId ===
        null &&
      !dirty
    );


  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">

      <button
        type="button"
        aria-label="전산실적 입력창 닫기"
        onClick={
          requestClose
        }
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />


      <section className="relative flex max-h-[96vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-[22px] border border-[#DADDE2] bg-[#F6F7F9] shadow-[0_30px_100px_rgba(0,0,0,0.25)]">

        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#E2E4E8] bg-white px-5 py-4 sm:px-6">

          <div className="min-w-0">

            <p className="text-[10px] font-bold tracking-[0.12em] text-[#A50034]">
              SYSTEM PERFORMANCE INPUT
            </p>


            <div className="mt-1 flex flex-wrap items-center gap-2">

              <h2 className="text-[21px] font-bold tracking-[-0.03em] text-[#24272C]">
                {target.datasetTitle}
              </h2>


              <span className="rounded-full bg-[#F2F3F5] px-2.5 py-1 text-[10px] font-bold text-[#666B73]">
                {target.snapshotTitle}
              </span>


            </div>


            <p className="mt-1 text-[11px] text-[#8A8F97]">
              기준일 {target.reportDate} · 적용 시 기존 최종 자료를 새 자료로 전체 교체
            </p>

          </div>


          <button
            type="button"
            aria-label="닫기"
            onClick={
              requestClose
            }
            disabled={
              isBusy
            }
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F2F3F5] text-[#5E636B] transition hover:bg-[#E8EAED] disabled:opacity-40"
          >
            <X
              size={18}
            />
          </button>

        </header>


        <div className="min-h-0 flex-1 overflow-y-auto">

          <div className="space-y-4 p-4 sm:p-5">

            <section className="grid gap-4 xl:grid-cols-2">

              <div className="rounded-[18px] border border-[#E1E3E7] bg-white p-4">

                <div className="flex items-start gap-3">

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#F2F3F5] text-[#596069]">
                    <FileSpreadsheet
                      size={18}
                    />
                  </div>


                  <div>
                    <h3 className="text-[14px] font-bold text-[#35393F]">
                      Excel 파일 불러오기
                    </h3>

                    <p className="mt-1 text-[11px] leading-4 text-[#8A8F97]">
                      회사 원본 .xls / .xlsx 파일을 드래그하거나 파일 선택으로 불러올 수 있습니다.
                    </p>
                  </div>

                </div>


                <div
                  onDragEnter={(event) => {
                    event.preventDefault();

                    if (!isBusy) {
                      setIsDragging(true);
                    }
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();

                    if (
                      event.currentTarget ===
                      event.target
                    ) {
                      setIsDragging(false);
                    }
                  }}
                  onDrop={
                    handleDrop
                  }
                  className={[
                    "mt-4 rounded-[14px] border-2 border-dashed px-4 py-5 text-center transition",
                    isDragging
                      ? "border-[#A50034] bg-[#FFF5F8]"
                      : "border-[#DADDE2] bg-[#FAFAFB]",
                  ].join(" ")}
                >
                  {parseBusy ? (
                    <LoaderCircle
                      size={26}
                      className="mx-auto animate-spin text-[#A50034]"
                    />
                  ) : (
                    <Upload
                      size={26}
                      className="mx-auto text-[#737881]"
                    />
                  )}


                  <p className="mt-3 text-[12px] font-bold text-[#484D54]">
                    .xls / .xlsx 파일을 여기에 끌어놓으세요
                  </p>


                  <p className="mt-1 text-[10px] text-[#969AA1]">
                    잘못 불러왔다면 아래 Grid의 [전체 삭제] 후 바로 다시 작업할 수 있습니다.
                  </p>


                  <label className="mt-3 inline-flex h-[38px] cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-[#4D5259] px-4 text-[11px] font-bold text-white transition hover:bg-[#3E4248]">
                    <Upload
                      size={14}
                    />

                    파일 선택

                    <input
                      type="file"
                      accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      disabled={
                        isBusy
                      }
                      onChange={
                        handleFileChange
                      }
                      className="hidden"
                    />
                  </label>
                </div>


                {sourceMethod ===
                  "upload" &&
                  sourceFileName && (
                  <div className="mt-3 flex items-start justify-between gap-3 rounded-[10px] bg-[#F7F8F9] px-3 py-2.5">

                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-bold text-[#555A62]">
                        {sourceFileName}
                      </p>

                      {sourceSheetName && (
                        <p className="mt-1 truncate text-[10px] text-[#92969D]">
                          시트 · {sourceSheetName}
                        </p>
                      )}
                    </div>


                    <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[9px] font-bold text-[#6D727A]">
                      파일
                    </span>

                  </div>
                )}

              </div>


              <div className="rounded-[18px] border border-[#E1E3E7] bg-white p-4">

                <div className="flex items-start gap-3">

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#F2F3F5] text-[#596069]">
                    <ClipboardPaste
                      size={18}
                    />
                  </div>


                  <div>
                    <h3 className="text-[14px] font-bold text-[#35393F]">
                      복사 / 붙여넣기
                    </h3>

                    <p className="mt-1 text-[11px] leading-4 text-[#8A8F97]">
                      Excel의 2단 헤더를 포함한 표 전체를 Ctrl+C한 뒤 아래 영역에 Ctrl+V하세요.
                    </p>
                  </div>

                </div>


                <textarea
                  value={
                    pasteText
                  }
                  disabled={
                    isBusy
                  }
                  onChange={(event) =>
                    setPasteText(
                      event.target.value
                    )
                  }
                  placeholder="Excel 표 전체를 Ctrl+C → 이곳에서 Ctrl+V"
                  className="mt-4 h-[105px] w-full resize-none rounded-[11px] border border-[#DADDE2] bg-[#FAFAFB] px-3 py-2.5 text-[11px] leading-5 text-[#44484F] outline-none transition placeholder:text-[#B2B5BA] focus:border-[#8D9299] focus:bg-white"
                />


                <button
                  type="button"
                  disabled={
                    isBusy
                  }
                  onClick={
                    handlePasteImport
                  }
                  className="mt-2 inline-flex h-[38px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#4D5259] text-[11px] font-bold text-white transition hover:bg-[#3E4248] disabled:bg-[#C7CACF]"
                >
                  <ClipboardPaste
                    size={14}
                  />

                  붙여넣기 자료 반영하기
                </button>

              </div>

            </section>


            {errorMessage && (
              <section className="flex items-start gap-2.5 rounded-[13px] border border-[#F0D4DB] bg-[#FFF5F7] px-4 py-3">
                <AlertCircle
                  size={16}
                  className="mt-0.5 shrink-0 text-[#A50034]"
                />

                <p className="text-[11px] font-semibold leading-5 text-[#A50034]">
                  {errorMessage}
                </p>
              </section>
            )}


            {successMessage && (
              <section className="flex items-start gap-2.5 rounded-[13px] border border-[#D6E8DD] bg-[#F2FAF5] px-4 py-3">
                <CheckCircle2
                  size={16}
                  className="mt-0.5 shrink-0 text-[#287348]"
                />

                <p className="text-[11px] font-semibold leading-5 text-[#3F7053]">
                  {successMessage}
                </p>
              </section>
            )}


            {warnings.length >
              0 && (
              <section className="rounded-[13px] border border-[#F0E1C3] bg-[#FFF9EF] px-4 py-3">

                <p className="text-[11px] font-bold text-[#87621E]">
                  데이터 확인사항
                </p>


                <div className="mt-2 space-y-1">
                  {warnings.map(
                    (
                      warning,
                      index
                    ) => (
                      <p
                        key={`${warning}-${index}`}
                        className="text-[10px] leading-4 text-[#8A6A31]"
                      >
                        · {warning}
                      </p>
                    )
                  )}
                </div>

              </section>
            )}


            <section className="overflow-hidden rounded-[18px] border border-[#E1E3E7] bg-white">

              <div className="flex flex-col gap-3 border-b border-[#ECEEF1] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">

                <div>
                  <h3 className="text-[14px] font-bold text-[#35393F]">
                    입력 데이터
                  </h3>

                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-semibold text-[#858A92]">
                    <span>
                      전체 {rows.length.toLocaleString(
                        "ko-KR"
                      )}행
                    </span>

                    {unmatchedCount >
                      0 && (
                      <span className="text-[#A50034]">
                        직원 미매칭 {unmatchedCount}건
                      </span>
                    )}

                    {missingEmployeeNoCount >
                      0 && (
                      <span className="text-[#9A6513]">
                        사번 미입력 {missingEmployeeNoCount}건
                      </span>
                    )}
                  </div>
                </div>


                <div className="flex flex-wrap gap-2">

                  <button
                    type="button"
                    disabled={
                      isBusy
                    }
                    onClick={
                      addRow
                    }
                    className="inline-flex h-[36px] items-center justify-center gap-1.5 rounded-[9px] border border-[#DADDE2] bg-white px-3 text-[10px] font-bold text-[#555A62] transition hover:bg-[#F5F6F7] disabled:opacity-40"
                  >
                    <Plus
                      size={13}
                    />

                    행 추가
                  </button>


                  <button
                    type="button"
                    disabled={
                      isBusy ||
                      rows.length ===
                        0
                    }
                    onClick={
                      clearRows
                    }
                    className="inline-flex h-[36px] items-center justify-center gap-1.5 rounded-[9px] border border-[#E6DADD] bg-white px-3 text-[10px] font-bold text-[#A50034] transition hover:bg-[#FFF7F9] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2
                      size={13}
                    />

                    전체 삭제
                  </button>

                </div>

              </div>


              {isLoading ? (
                <div className="flex min-h-[260px] items-center justify-center">
                  <div className="text-center">
                    <LoaderCircle
                      size={26}
                      className="mx-auto animate-spin text-[#8A8F97]"
                    />

                    <p className="mt-3 text-[11px] font-semibold text-[#777C84]">
                      기존 전산실적을 불러오는 중입니다.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="max-h-[460px] overflow-auto">

                  <table className="w-full min-w-[1650px] border-collapse text-left">

                    <thead className="sticky top-0 z-20 bg-[#F7F8F9] shadow-[0_1px_0_#E2E4E8]">
                      <tr>
                        <th className="w-[55px] px-2 py-3 text-center text-[10px] font-bold text-[#7C8189]">
                          No.
                        </th>

                        <th className="w-[90px] px-2 py-3 text-[10px] font-bold text-[#7C8189]">
                          구분
                        </th>

                        <th className="min-w-[150px] px-2 py-3 text-[10px] font-bold text-[#7C8189]">
                          조직명
                        </th>

                        <th className="min-w-[110px] px-2 py-3 text-[10px] font-bold text-[#7C8189]">
                          사번
                        </th>

                        <th className="min-w-[110px] px-2 py-3 text-[10px] font-bold text-[#7C8189]">
                          사원명
                        </th>

                        {NUMERIC_COLUMNS.map(
                          (column) => (
                            <th
                              key={
                                column.key
                              }
                              style={{
                                minWidth:
                                  column.minWidth,
                              }}
                              className="px-2 py-3 text-right text-[10px] font-bold text-[#7C8189]"
                            >
                              {column.label}
                            </th>
                          )
                        )}

                        <th className="w-[70px] px-2 py-3 text-center text-[10px] font-bold text-[#7C8189]">
                          제외
                        </th>

                        <th className="min-w-[150px] px-2 py-3 text-[10px] font-bold text-[#7C8189]">
                          제외사유
                        </th>

                        <th className="w-[60px] px-2 py-3 text-center text-[10px] font-bold text-[#7C8189]">
                          삭제
                        </th>
                      </tr>
                    </thead>


                    <tbody className="divide-y divide-[#ECEEF1]">
                      {rows.map(
                        (
                          row,
                          rowIndex
                        ) => {
                          const normalizedNo =
                            normalizeEmployeeNo(
                              row.employee_no
                            );


                          const unmatched =
                            row.row_type ===
                              "employee" &&
                            normalizedNo !==
                              "" &&
                            !knownEmployeeSet.has(
                              normalizedNo
                            );


                          return (
                            <tr
                              key={
                                row.client_key
                              }
                              className={[
                                "bg-white",
                                row.is_excluded
                                  ? "opacity-55"
                                  : "",
                              ].join(" ")}
                            >
                              <td className="px-2 py-2 text-center text-[10px] font-semibold tabular-nums text-[#92969D]">
                                {row.source_row_no}
                              </td>


                              <td className="px-2 py-2">
                                <select
                                  value={
                                    row.row_type
                                  }
                                  disabled={
                                    isBusy
                                  }
                                  onChange={(event) =>
                                    updateRowType(
                                      rowIndex,
                                      event.target.value ===
                                        "total"
                                        ? "total"
                                        : "employee"
                                    )
                                  }
                                  className="h-[34px] w-full rounded-[8px] border border-[#DDE0E5] bg-white px-2 text-[10px] font-semibold text-[#555A62] outline-none focus:border-[#8A8F97]"
                                >
                                  <option value="employee">
                                    직원
                                  </option>
                                  <option value="total">
                                    합계
                                  </option>
                                </select>
                              </td>


                              <td className="px-2 py-2">
                                <input
                                  type="text"
                                  value={
                                    row.organization_name
                                  }
                                  disabled={
                                    isBusy
                                  }
                                  onChange={(event) =>
                                    updateTextField(
                                      rowIndex,
                                      "organization_name",
                                      event.target.value
                                    )
                                  }
                                  className="h-[34px] w-full rounded-[8px] border border-[#DDE0E5] px-2 text-[10px] text-[#44484F] outline-none focus:border-[#8A8F97]"
                                />
                              </td>


                              <td className="px-2 py-2">
                                <div className="relative pb-2">
                                  <input
                                    type="text"
                                    value={
                                      row.employee_no
                                    }
                                    disabled={
                                      isBusy
                                    }
                                    onChange={(event) =>
                                      updateTextField(
                                        rowIndex,
                                        "employee_no",
                                        event.target.value
                                      )
                                    }
                                    onBlur={() =>
                                      handleEmployeeNoBlur(
                                        rowIndex
                                      )
                                    }
                                    className={[
                                      "h-[34px] w-full rounded-[8px] border px-2 text-[10px] font-semibold outline-none",
                                      unmatched
                                        ? "border-[#E3A9B8] bg-[#FFF6F8] text-[#A50034]"
                                        : "border-[#DDE0E5] bg-white text-[#44484F] focus:border-[#8A8F97]",
                                    ].join(" ")}
                                  />

                                  {unmatched && (
                                    <span className="absolute bottom-[-3px] left-0 whitespace-nowrap text-[8px] font-bold text-[#A50034]">
                                      미매칭
                                    </span>
                                  )}
                                </div>
                              </td>


                              <td className="px-2 py-2">
                                <input
                                  type="text"
                                  value={
                                    row.employee_name
                                  }
                                  disabled={
                                    isBusy
                                  }
                                  onChange={(event) =>
                                    updateTextField(
                                      rowIndex,
                                      "employee_name",
                                      event.target.value
                                    )
                                  }
                                  className="h-[34px] w-full rounded-[8px] border border-[#DDE0E5] px-2 text-[10px] text-[#44484F] outline-none focus:border-[#8A8F97]"
                                />
                              </td>


                              {NUMERIC_COLUMNS.map(
                                (column) => (
                                  <td
                                    key={
                                      column.key
                                    }
                                    className="px-2 py-2"
                                  >
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={
                                        row[
                                          column.key
                                        ]
                                      }
                                      disabled={
                                        isBusy
                                      }
                                      onChange={(event) =>
                                        updateNumericField(
                                          rowIndex,
                                          column.key,
                                          event.target.value
                                        )
                                      }
                                      onFocus={(event) =>
                                        event.currentTarget.select()
                                      }
                                      onBlur={() =>
                                        normalizeNumericField(
                                          rowIndex,
                                          column.key,
                                          column.kind
                                        )
                                      }
                                      className="h-[34px] w-full rounded-[8px] border border-[#DDE0E5] px-2 text-right text-[10px] font-semibold tabular-nums text-[#44484F] outline-none focus:border-[#8A8F97]"
                                    />
                                  </td>
                                )
                              )}


                              <td className="px-2 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={
                                    row.is_excluded
                                  }
                                  disabled={
                                    isBusy
                                  }
                                  onChange={(event) =>
                                    updateExcluded(
                                      rowIndex,
                                      event.target.checked
                                    )
                                  }
                                  className="h-4 w-4 accent-[#A50034]"
                                />
                              </td>


                              <td className="px-2 py-2">
                                <input
                                  type="text"
                                  value={
                                    row.exclude_reason
                                  }
                                  disabled={
                                    isBusy ||
                                    !row.is_excluded
                                  }
                                  onChange={(event) =>
                                    updateTextField(
                                      rowIndex,
                                      "exclude_reason",
                                      event.target.value
                                    )
                                  }
                                  placeholder={
                                    row.is_excluded
                                      ? "제외 사유"
                                      : ""
                                  }
                                  className="h-[34px] w-full rounded-[8px] border border-[#DDE0E5] px-2 text-[10px] text-[#44484F] outline-none disabled:bg-[#F4F5F6] focus:border-[#8A8F97]"
                                />
                              </td>


                              <td className="px-2 py-2 text-center">
                                <button
                                  type="button"
                                  aria-label={`${rowIndex + 1}번째 행 삭제`}
                                  disabled={
                                    isBusy
                                  }
                                  onClick={() =>
                                    deleteRow(
                                      rowIndex
                                    )
                                  }
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#9A9EA5] transition hover:bg-[#FFF1F4] hover:text-[#A50034] disabled:opacity-40"
                                >
                                  <Trash2
                                    size={14}
                                  />
                                </button>
                              </td>
                            </tr>
                          );
                        }
                      )}


                      {rows.length ===
                        0 && (
                        <tr>
                          <td
                            colSpan={16}
                            className="px-6 py-14 text-center"
                          >
                            <p className="text-[12px] font-bold text-[#777C84]">
                              입력된 행이 없습니다.
                            </p>

                            <p className="mt-2 text-[10px] text-[#A0A4AA]">
                              Excel 파일 드래그, 파일 선택, Ctrl+V 또는 행 추가를 이용하세요.
                            </p>

                            <p className="mt-1 text-[10px] font-semibold text-[#6F737A]">
                              0행 자료도 정상적으로 임시저장·적용할 수 있습니다.
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                </div>
              )}

            </section>


            {(unmatchedCount >
              0 ||
              missingEmployeeNoCount >
                0) && (
              <section className="flex items-start gap-2.5 rounded-[13px] border border-[#EEDBE0] bg-[#FFF8FA] px-4 py-3">
                <AlertCircle
                  size={16}
                  className="mt-0.5 shrink-0 text-[#A50034]"
                />

                <p className="text-[10px] leading-5 text-[#755C63]">
                  직원관리와 매칭되지 않는 사번도
                  <strong className="mx-1 text-[#A50034]">
                    저장을 차단하지 않습니다.
                  </strong>
                  원본 사번·사원명은 그대로 저장되고 manager_id만 비어 있게 됩니다.
                </p>
              </section>
            )}

          </div>

        </div>


        <footer className="shrink-0 border-t border-[#DFE2E6] bg-white px-4 py-3.5 sm:px-6">

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <p className="text-[10px] font-bold text-[#555A62]">
                {target.datasetTitle}
                {" · "}
                {target.snapshotTitle}
                {" · "}
                {rows.length.toLocaleString(
                  "ko-KR"
                )}행
              </p>

              <p className="mt-1 text-[9px] text-[#9A9EA5]">
                회사 원본 전체를 저장하지 않고 마감·분석에 필요한 항목만 Supabase에 저장합니다.
              </p>
            </div>


            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={
                  isBusy
                }
                onClick={
                  requestClose
                }
                className="h-[42px] rounded-[11px] border border-[#DADDE2] bg-white px-4 text-[11px] font-bold text-[#62676E] transition hover:bg-[#F5F6F7] disabled:opacity-40"
              >
                닫기
              </button>


              <button
                type="button"
                disabled={
                  saveDraftDisabled
                }
                onClick={
                  handleSaveDraft
                }
                className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[11px] border border-[#C9CDD3] bg-[#F7F8F9] px-5 text-[11px] font-bold text-[#484D54] transition hover:bg-[#ECEEF1] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busyAction ===
                "save" ? (
                  <LoaderCircle
                    size={14}
                    className="animate-spin"
                  />
                ) : (
                  <Save
                    size={14}
                  />
                )}

                임시저장
              </button>


              <button
                type="button"
                disabled={
                  applyDisabled
                }
                onClick={
                  handleApply
                }
                className="inline-flex h-[42px] min-w-[120px] items-center justify-center gap-2 rounded-[11px] bg-[#A50034] px-5 text-[11px] font-bold text-white transition hover:bg-[#8D002C] disabled:cursor-not-allowed disabled:bg-[#C7CACF]"
              >
                {busyAction ===
                "apply" ? (
                  <LoaderCircle
                    size={14}
                    className="animate-spin"
                  />
                ) : (
                  <CheckCircle2
                    size={14}
                  />
                )}

                전산실적 적용
              </button>
            </div>

          </div>

        </footer>

      </section>


      {pendingEncryptedFile && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">

          <button
            type="button"
            aria-label="암호 입력창 닫기"
            onClick={
              closePasswordDialog
            }
            disabled={
              passwordBusy
            }
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          />


          <section className="relative w-full max-w-[430px] rounded-[20px] border border-[#E0E2E6] bg-white p-5 shadow-[0_28px_90px_rgba(0,0,0,0.28)] sm:p-6">

            <div className="flex items-start justify-between gap-4">

              <div className="flex min-w-0 items-start gap-3">

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#FFF2F5] text-[#A50034]">
                  <LockKeyhole
                    size={19}
                  />
                </div>


                <div className="min-w-0">
                  <p className="text-[10px] font-bold tracking-[0.1em] text-[#A50034]">
                    ENCRYPTED EXCEL
                  </p>

                  <h3 className="mt-1 text-[18px] font-bold tracking-[-0.03em] text-[#292C31]">
                    Excel 파일 암호 입력
                  </h3>

                  <p className="mt-2 text-[11px] leading-5 text-[#7F848C]">
                    암호가 설정된 회사 실적 파일입니다. 다운로드할 때 설정한 암호를 입력해주세요.
                  </p>
                </div>

              </div>


              <button
                type="button"
                aria-label="닫기"
                onClick={
                  closePasswordDialog
                }
                disabled={
                  passwordBusy
                }
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F2F3F5] text-[#62676E] disabled:opacity-40"
              >
                <X
                  size={16}
                />
              </button>

            </div>


            <div className="mt-5 rounded-[11px] bg-[#F7F8F9] px-3 py-2.5">
              <p className="text-[9px] font-semibold text-[#92969D]">
                선택한 파일
              </p>

              <p className="mt-1 truncate text-[11px] font-bold text-[#555A62]">
                {pendingEncryptedFile.name}
              </p>
            </div>


            <form
              className="mt-4"
              onSubmit={(event) => {
                event.preventDefault();

                void handlePasswordSubmit();
              }}
            >
              <label
                htmlFor="excel-file-password"
                className="text-[11px] font-bold text-[#555A62]"
              >
                파일 암호
              </label>


              <div className="relative mt-2">
                <input
                  id="excel-file-password"
                  type={
                    showExcelPassword
                      ? "text"
                      : "password"
                  }
                  value={
                    excelPassword
                  }
                  autoFocus
                  autoComplete="off"
                  disabled={
                    passwordBusy
                  }
                  onChange={(event) => {
                    setExcelPassword(
                      event.target.value
                    );

                    setPasswordError(
                      ""
                    );
                  }}
                  placeholder="다운로드 시 설정한 암호"
                  className="h-[46px] w-full rounded-[11px] border border-[#DADDE2] bg-white pl-3 pr-11 text-[13px] font-semibold text-[#30343A] outline-none transition focus:border-[#8C9198] focus:ring-4 focus:ring-black/[0.035]"
                />


                <button
                  type="button"
                  aria-label={
                    showExcelPassword
                      ? "암호 숨기기"
                      : "암호 보기"
                  }
                  onClick={() =>
                    setShowExcelPassword(
                      (previous) =>
                        !previous
                    )
                  }
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[8px] text-[#858A92] hover:bg-[#F2F3F5]"
                >
                  {showExcelPassword ? (
                    <EyeOff
                      size={16}
                    />
                  ) : (
                    <Eye
                      size={16}
                    />
                  )}
                </button>
              </div>


              {passwordError && (
                <div className="mt-3 flex items-start gap-2 rounded-[10px] border border-[#F0D4DB] bg-[#FFF5F7] px-3 py-2.5">
                  <AlertCircle
                    size={14}
                    className="mt-0.5 shrink-0 text-[#A50034]"
                  />

                  <p className="text-[10px] font-semibold leading-4 text-[#A50034]">
                    {passwordError}
                  </p>
                </div>
              )}


              <p className="mt-3 text-[9px] leading-4 text-[#969AA1]">
                입력한 암호는 파일을 여는 동안 브라우저 메모리에서만 사용하며 Supabase, LocalStorage, 로그에 저장하지 않습니다.
              </p>


              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={
                    closePasswordDialog
                  }
                  disabled={
                    passwordBusy
                  }
                  className="h-[40px] rounded-[10px] border border-[#DADDE2] bg-white px-4 text-[11px] font-bold text-[#62676E] hover:bg-[#F5F6F7] disabled:opacity-40"
                >
                  취소
                </button>


                <button
                  type="submit"
                  disabled={
                    passwordBusy ||
                    excelPassword.trim() ===
                      ""
                  }
                  className="inline-flex h-[40px] min-w-[108px] items-center justify-center gap-2 rounded-[10px] bg-[#A50034] px-4 text-[11px] font-bold text-white hover:bg-[#8D002C] disabled:cursor-not-allowed disabled:bg-[#C7CACF]"
                >
                  {passwordBusy ? (
                    <LoaderCircle
                      size={14}
                      className="animate-spin"
                    />
                  ) : (
                    <LockKeyhole
                      size={14}
                    />
                  )}

                  파일 열기
                </button>
              </div>
            </form>

          </section>

        </div>
      )}

    </div>
  );
}
