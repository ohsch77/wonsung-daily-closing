"use client";

import type {
  ChangeEvent,
  DragEvent,
  FormEvent,
} from "react";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
  parseCardPerformanceExcel,
  parseCardPerformancePaste,
} from "@/lib/card-performance-parser";

import type {
  CardImportTarget,
  CardParsedRow,
  CardParseResult,
  CardSourceMethod,
} from "@/types/card-performance";


type Props = {
  target: CardImportTarget;
  onClose: () => void;
  onApplied: (
    message: string
  ) => void;
};


type ManagerRow = {
  id: string;
  name: string;
  employee_no: string;
};


type StoredCardRow = {
  source_row_no: number;
  card_company: string | null;
  approval_date: string | null;
  approval_time: string | null;
  amount: number | string;
  approval_number: string | null;
  approval_employee_name: string | null;
  cancel_date: string | null;
  cancel_reason: string | null;
  cancel_employee_name: string | null;
  employee_no: string | null;
  source_manager_name: string | null;
};


function normalizeEmployeeNo(
  value: string | null
) {
  return (
    value ?? ""
  )
    .replace(/\s+/g, "")
    .toUpperCase();
}


function normalizeName(
  value: string | null
) {
  return (
    value ?? ""
  )
    .replace(/\s+/g, "")
    .trim();
}


function formatAmount(
  value: number
) {
  return new Intl.NumberFormat(
    "ko-KR",
    {
      maximumFractionDigits: 0,
    }
  ).format(value);
}


function storedRowToParsedRow(
  row: StoredCardRow
): CardParsedRow {
  const amount =
    typeof row.amount === "number"
      ? row.amount
      : Number(row.amount);

  return {
    source_row_no:
      row.source_row_no,
    card_company:
      row.card_company,
    approval_date:
      row.approval_date,
    approval_time:
      row.approval_time,
    amount:
      Number.isFinite(amount)
        ? amount
        : 0,
    approval_number:
      row.approval_number,
    approval_employee_name:
      row.approval_employee_name,
    cancel_date:
      row.cancel_date,
    cancel_reason:
      row.cancel_reason,
    cancel_employee_name:
      row.cancel_employee_name,
    employee_no:
      row.employee_no,
    source_manager_name:
      row.source_manager_name,
  };
}


export default function CardImportModal({
  target,
  onClose,
  onApplied,
}: Props) {
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  const [rows, setRows] =
    useState<CardParsedRow[]>([]);

  /*
   * null = 기존 월 누계 스냅샷을 유지
   * []   = 월 누계 0건으로 명시 교체
   * 배열 = 새 원본의 월 1일~기준일 누적 자료
   */
  const [monthlyRows, setMonthlyRows] =
    useState<CardParsedRow[] | null>(
      null
    );

  const [managers, setManagers] =
    useState<ManagerRow[]>([]);

  const [pasteText, setPasteText] =
    useState("");

  const [sourceMethod, setSourceMethod] =
    useState<CardSourceMethod | null>(
      target.sourceMethod
    );

  const [sourceFileName, setSourceFileName] =
    useState<string | null>(
      target.sourceFileName
    );

  const [sourceSheetName, setSourceSheetName] =
    useState<string | null>(
      target.sourceSheetName
    );

  const [parseSummary, setParseSummary] =
    useState<CardParseResult | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [busy, setBusy] =
    useState(false);

  const [dragging, setDragging] =
    useState(false);

  const [dirty, setDirty] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [pendingPasswordFile, setPendingPasswordFile] =
    useState<File | null>(null);

  const [excelPassword, setExcelPassword] =
    useState("");

  const [passwordError, setPasswordError] =
    useState<string | null>(null);

  const [passwordBusy, setPasswordBusy] =
    useState(false);

  const [showExcelPassword, setShowExcelPassword] =
    useState(false);


  const managerLookup =
    useMemo(() => {
      const byEmployeeNo =
        new Map<string, ManagerRow>();

      const byName =
        new Map<string, ManagerRow>();

      for (const manager of managers) {
        const employeeNo =
          normalizeEmployeeNo(
            manager.employee_no
          );

        if (employeeNo !== "") {
          byEmployeeNo.set(
            employeeNo,
            manager
          );
        }

        const name =
          normalizeName(
            manager.name
          );

        if (name !== "") {
          byName.set(
            name,
            manager
          );
        }
      }

      return {
        byEmployeeNo,
        byName,
      };
    }, [managers]);


  const getMatchedManager =
    useCallback(
      (row: CardParsedRow) => {
        if (
          target.datasetType ===
          "approval"
        ) {
          const employeeNo =
            normalizeEmployeeNo(
              row.employee_no
            );

          if (
            employeeNo !== "" &&
            managerLookup.byEmployeeNo.has(
              employeeNo
            )
          ) {
            return managerLookup.byEmployeeNo.get(
              employeeNo
            ) ?? null;
          }
        }

        const managerName =
          normalizeName(
            row.source_manager_name
          );

        if (
          managerName !== "" &&
          managerLookup.byName.has(
            managerName
          )
        ) {
          return managerLookup.byName.get(
            managerName
          ) ?? null;
        }

        return null;
      },
      [
        managerLookup,
        target.datasetType,
      ]
    );


  const unmatchedCount =
    useMemo(
      () =>
        rows.filter(
          (row) =>
            getMatchedManager(row) ===
            null
        ).length,
      [
        getMatchedManager,
        rows,
      ]
    );


  const totalAmount =
    useMemo(
      () =>
        rows.reduce(
          (sum, row) =>
            sum + row.amount,
          0
        ),
      [rows]
    );




  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const batchId =
          target.draftBatchId ??
          target.appliedBatchId;

        const managerResult =
          await supabase
            .from("managers")
            .select(
              "id,name,employee_no"
            );

        if (managerResult.error) {
          throw managerResult.error;
        }

        let storedRows: StoredCardRow[] = [];

        if (batchId) {
          const rowResult =
            await supabase
              .from("card_transactions")
              .select(
                "source_row_no,card_company,approval_date,approval_time,amount,approval_number,approval_employee_name,cancel_date,cancel_reason,cancel_employee_name,employee_no,source_manager_name"
              )
              .eq(
                "batch_id",
                batchId
              )
              .order(
                "source_row_no",
                {
                  ascending: true,
                }
              );

          if (rowResult.error) {
            throw rowResult.error;
          }

          storedRows =
            (rowResult.data ?? []) as StoredCardRow[];
        }

        if (cancelled) {
          return;
        }

        setManagers(
          (managerResult.data ?? []) as ManagerRow[]
        );

        const parsedStoredRows =
          storedRows.map(
            storedRowToParsedRow
          );

        setMonthlyRows(
          parsedStoredRows
        );

        setRows(
          parsedStoredRows.filter(
            (row) =>
              target.datasetType ===
              "approval"
                ? row.approval_date ===
                  target.reportDate
                : row.cancel_date ===
                  target.reportDate
          )
        );
      }
      catch (error) {
        if (cancelled) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "기존 카드실적을 불러오지 못했습니다."
        );
      }
      finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [
    supabase,
    target.appliedBatchId,
    target.datasetType,
    target.draftBatchId,
    target.reportDate,
  ]);


  const applyParsedResult =
    useCallback(
      (
        result: CardParseResult,
        method: CardSourceMethod,
        fileName: string | null
      ) => {
        setRows(result.rows);
        setMonthlyRows(
          result.monthlyRows
        );
        setParseSummary(result);
        setSourceMethod(method);
        setSourceFileName(fileName);
        setSourceSheetName(
          result.sheetName
        );
        setDirty(true);
        setErrorMessage(null);

        setMessage(
          `${target.reportDate} 기준 ${target.datasetTitle} ${result.rows.length.toLocaleString("ko-KR")}건을 새 자료로 불러왔습니다. 적용 전까지 DB의 기존 최종실적은 변경되지 않습니다.`
        );
      },
      [
        target.datasetTitle,
        target.reportDate,
      ]
    );


  const readFile =
    useCallback(
      async (
        file: File,
        password?: string
      ) => {
        setBusy(true);
        setErrorMessage(null);
        setMessage(null);

        try {
          const result =
            await parseCardPerformanceExcel(
              file,
              target.datasetType,
              target.reportDate,
              password
            );

          applyParsedResult(
            result,
            "upload",
            file.name
          );

          setPendingPasswordFile(null);
          setExcelPassword("");
          setPasswordError(null);
          setShowExcelPassword(false);
        }
        catch (error) {
          if (
            isExcelPasswordRequiredError(
              error
            )
          ) {
            setPendingPasswordFile(file);
            setExcelPassword("");
            setPasswordError(null);
            setShowExcelPassword(false);
            return;
          }

          if (
            isExcelPasswordRejectedError(
              error
            )
          ) {
            setPasswordError(
              error.message
            );
            return;
          }

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "카드실적 Excel 파일을 읽지 못했습니다."
          );
        }
        finally {
          setBusy(false);
        }
      },
      [
        applyParsedResult,
        target.datasetType,
        target.reportDate,
      ]
    );


  const handleFileChange =
    useCallback(
      async (
        event: ChangeEvent<HTMLInputElement>
      ) => {
        const file =
          event.target.files?.[0];

        event.target.value = "";

        if (!file) {
          return;
        }

        await readFile(file);
      },
      [readFile]
    );


  const handleDrop =
    useCallback(
      async (
        event: DragEvent<HTMLDivElement>
      ) => {
        event.preventDefault();
        setDragging(false);

        const file =
          event.dataTransfer.files?.[0];

        if (!file) {
          return;
        }

        await readFile(file);
      },
      [readFile]
    );


  const handlePasteApply =
    useCallback(() => {
      try {
        const result =
          parseCardPerformancePaste(
            pasteText,
            target.datasetType,
            target.reportDate
          );

        applyParsedResult(
          result,
          "paste",
          null
        );
      }
      catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "붙여넣기 자료를 읽지 못했습니다."
        );
      }
    }, [
      applyParsedResult,
      pasteText,
      target.datasetType,
      target.reportDate,
    ]);


  const handlePasswordSubmit =
    useCallback(
      async (
        event: FormEvent<HTMLFormElement>
      ) => {
        event.preventDefault();

        if (
          !pendingPasswordFile ||
          excelPassword.trim() === ""
        ) {
          setPasswordError(
            "Excel 파일 암호를 입력해주세요."
          );
          return;
        }

        setPasswordBusy(true);
        setPasswordError(null);

        try {
          await readFile(
            pendingPasswordFile,
            excelPassword
          );
        }
        finally {
          setPasswordBusy(false);
        }
      },
      [
        excelPassword,
        pendingPasswordFile,
        readFile,
      ]
    );


  const closePasswordDialog =
    useCallback(() => {
      if (passwordBusy) {
        return;
      }

      setPendingPasswordFile(null);
      setExcelPassword("");
      setPasswordError(null);
      setShowExcelPassword(false);
    }, [passwordBusy]);


  const handleClearGrid =
    useCallback(() => {
      const confirmed =
        window.confirm(
          "현재 화면의 카드실적 자료를 모두 비울까요?\n\n[카드실적 적용]을 누르기 전까지 기존 DB 최종실적은 유지됩니다."
        );

      if (!confirmed) {
        return;
      }

      setRows([]);
      setMonthlyRows([]);
      setParseSummary(null);
      setSourceMethod("paste");
      setSourceFileName(null);
      setSourceSheetName(null);
      setPasteText("");
      setDirty(true);
      setErrorMessage(null);
      setMessage(
        "화면 자료를 모두 비웠습니다. 0건 실적으로 적용하거나 새 파일을 다시 업로드할 수 있습니다."
      );
    }, []);


  const handleApply =
    useCallback(async () => {
      if (!dirty) {
        return;
      }

      setBusy(true);
      setErrorMessage(null);
      setMessage(null);

      try {
        const editableResult =
          await supabase.rpc(
            "is_performance_upload_editable",
            {
              p_report_date:
                target.reportDate,
            }
          );

        if (editableResult.error) {
          throw editableResult.error;
        }

        if (editableResult.data !== true) {
          throw new Error(
            "마감이 확정된 카드실적입니다. 마감보고에서 [수정]을 누른 뒤 다시 작업해주세요."
          );
        }

        let draftBatchId =
          target.draftBatchId;

        if (!draftBatchId) {
          const createResult =
            await supabase.rpc(
              "create_card_import_draft",
              {
                p_report_date:
                  target.reportDate,
                p_dataset_type:
                  target.datasetType,
                p_source_method:
                  sourceMethod ?? "paste",
                p_source_file_name:
                  sourceFileName,
                p_source_sheet_name:
                  sourceSheetName,
              }
            );

          if (createResult.error) {
            throw createResult.error;
          }

          draftBatchId =
            createResult.data as string;
        }

        const rowsToStore =
          monthlyRows ??
          rows;

        const replaceResult =
          await supabase.rpc(
            "replace_card_import_monthly_rows",
            {
              p_batch_id:
                draftBatchId,
              p_rows:
                rowsToStore,
              p_source_method:
                sourceMethod ?? "paste",
              p_source_file_name:
                sourceFileName,
              p_source_sheet_name:
                sourceSheetName,
            }
          );

        if (replaceResult.error) {
          throw replaceResult.error;
        }

        const applyResult =
          await supabase.rpc(
            "apply_card_import_batch",
            {
              p_batch_id:
                draftBatchId,
            }
          );

        if (applyResult.error) {
          throw applyResult.error;
        }

        const messageText =
          monthlyRows !== null
            ? `${target.datasetTitle} 당일 ${rows.length.toLocaleString("ko-KR")}건 · ${formatAmount(totalAmount)}원, 월 누계 ${monthlyRows.length.toLocaleString("ko-KR")}건 · ${formatAmount(
                monthlyRows.reduce(
                  (sum, row) =>
                    sum + row.amount,
                  0
                )
              )}원을 최종 적용했습니다.`
            : `${target.datasetTitle} ${rows.length.toLocaleString("ko-KR")}건, ${formatAmount(totalAmount)}원을 최종 적용했습니다.`;

        onApplied(messageText);
        router.refresh();
        onClose();
      }
      catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "카드실적을 적용하지 못했습니다."
        );
      }
      finally {
        setBusy(false);
      }
    }, [
      dirty,
      onApplied,
      onClose,
      router,
      rows,
      monthlyRows,
      sourceFileName,
      sourceMethod,
      sourceSheetName,
      supabase,
      target.datasetTitle,
      target.datasetType,
      target.draftBatchId,
      target.reportDate,
      totalAmount,
    ]);


  const titleDateLabel =
    target.datasetType === "approval"
      ? "승인일"
      : "취소일";


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 backdrop-blur-[2px] sm:p-5">
      <div className="flex max-h-[94vh] w-full max-w-[1480px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-7">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#A50034]/10 px-2.5 py-1 text-xs font-bold text-[#A50034]">
                카드관리
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {target.reportDate}
              </span>
            </div>

            <h2 className="mt-2 truncate text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
              {target.datasetTitle} 입력
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              월 1일부터 기준일까지의 전체 원본을 업로드하세요. 시스템은 {target.reportDate} {titleDateLabel} 자료만 추출하며, 새 자료를 적용하면 기존 최종실적을 전체 교체합니다.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy || passwordBusy}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-[#A50034]" />
                <h3 className="font-black text-slate-900">
                  Excel 전체 업로드
                </h3>
              </div>

              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => {
                  setDragging(false);
                }}
                onDrop={handleDrop}
                className={`mt-4 flex min-h-36 flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-6 text-center transition ${
                  dragging
                    ? "border-[#A50034] bg-[#A50034]/5"
                    : "border-slate-300 bg-white"
                }`}
              >
                <FileSpreadsheet className="h-9 w-9 text-slate-400" />

                <p className="mt-3 text-sm font-bold text-slate-800">
                  .xls / .xlsx 파일을 여기에 놓으세요
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  암호가 설정된 회사 .xls 파일은 자동으로 암호 입력창을 표시합니다.
                </p>

                <button
                  type="button"
                  disabled={busy || loading}
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  파일 선택
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xls,.xlsx"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <ClipboardPaste className="h-5 w-5 text-[#A50034]" />
                <h3 className="font-black text-slate-900">
                  Excel 복사 · 붙여넣기
                </h3>
              </div>

              <textarea
                value={pasteText}
                disabled={busy || loading}
                onChange={(event) => {
                  setPasteText(
                    event.target.value
                  );
                }}
                placeholder="Excel 원본 표를 전체 선택 → Ctrl+C → 이곳에 Ctrl+V"
                className="mt-4 min-h-28 w-full resize-y rounded-2xl border border-slate-300 bg-white px-4 py-3 text-xs leading-5 text-slate-800 outline-none transition focus:border-[#A50034] focus:ring-2 focus:ring-[#A50034]/10 disabled:opacity-50"
              />

              <button
                type="button"
                disabled={
                  busy ||
                  loading ||
                  pasteText.trim() === ""
                }
                onClick={handlePasteApply}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:border-[#A50034] hover:text-[#A50034] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ClipboardPaste className="h-4 w-4" />
                붙여넣기 자료 반영하기
              </button>
            </section>
          </div>

          {(errorMessage || message) && (
            <div className="mt-4 space-y-2">
              {errorMessage && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {message && (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{message}</span>
                </div>
              )}
            </div>
          )}

          {parseSummary && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-600">
                <span>
                  원본 거래행 <strong className="text-slate-950">{parseSummary.sourceRowCount.toLocaleString("ko-KR")}건</strong>
                </span>
                <span>
                  기준일 반영 <strong className="text-[#A50034]">{parseSummary.matchedDateRowCount.toLocaleString("ko-KR")}건</strong>
                </span>
                <span>
                  월 누계 <strong className="text-slate-950">{parseSummary.monthlyRowCount.toLocaleString("ko-KR")}건 · {formatAmount(parseSummary.monthlyAmount)}원</strong>
                </span>
                <span>
                  기준일 외 원본 <strong className="text-slate-950">{parseSummary.ignoredRowCount.toLocaleString("ko-KR")}건</strong>
                </span>
                {sourceFileName && (
                  <span className="truncate">
                    파일 {sourceFileName}
                  </span>
                )}
              </div>

              {parseSummary.warnings.length > 0 && (
                <div className="mt-2 space-y-1 text-xs text-amber-700">
                  {parseSummary.warnings.map(
                    (warning) => (
                      <p key={warning}>
                        • {warning}
                      </p>
                    )
                  )}
                </div>
              )}
            </div>
          )}

          <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
              <div>
                <h3 className="font-black text-slate-950">
                  {target.reportDate} {target.datasetTitle}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  고객명·전화번호·카드번호는 읽어오거나 저장하지 않습니다.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
                  {rows.length.toLocaleString("ko-KR")}건
                </span>
                <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
                  {formatAmount(totalAmount)}원
                </span>
                {unmatchedCount > 0 && (
                  <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
                    담당자 미매칭 {unmatchedCount}건
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleClearGrid}
                  disabled={busy || loading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  전체 비우기
                </button>
              </div>
            </div>

            <div className="max-h-[42vh] overflow-auto">
              <table className="min-w-[1060px] w-full border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
                  <tr>
                    <th className="border-b border-slate-200 px-3 py-2.5 text-right font-bold">원본행</th>
                    <th className="border-b border-slate-200 px-3 py-2.5 text-left font-bold">{titleDateLabel}</th>
                    <th className="border-b border-slate-200 px-3 py-2.5 text-left font-bold">시간</th>
                    <th className="border-b border-slate-200 px-3 py-2.5 text-left font-bold">카드사</th>
                    <th className="border-b border-slate-200 px-3 py-2.5 text-left font-bold">승인번호</th>
                    <th className="border-b border-slate-200 px-3 py-2.5 text-right font-bold">금액</th>
                    <th className="border-b border-slate-200 px-3 py-2.5 text-left font-bold">사번</th>
                    <th className="border-b border-slate-200 px-3 py-2.5 text-left font-bold">담당자</th>
                    <th className="border-b border-slate-200 px-3 py-2.5 text-left font-bold">매칭</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin" />
                        <p className="mt-2">카드실적을 불러오는 중입니다.</p>
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                        기준일 카드실적이 0건입니다. 0건 실적도 정상적으로 적용할 수 있습니다.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const matchedManager =
                        getMatchedManager(row);

                      const targetDate =
                        target.datasetType === "approval"
                          ? row.approval_date
                          : row.cancel_date;

                      return (
                        <tr
                          key={`${row.source_row_no}-${row.approval_number ?? ""}-${row.amount}`}
                          className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                        >
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">
                            {row.source_row_no}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-slate-800">
                            {targetDate ?? "-"}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums text-slate-600">
                            {row.approval_time?.slice(0, 5) ?? "-"}
                          </td>
                          <td className="max-w-48 truncate px-3 py-2.5 text-slate-700">
                            {row.card_company ?? "-"}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums text-slate-700">
                            {row.approval_number ?? "-"}
                          </td>
                          <td className="px-3 py-2.5 text-right font-black tabular-nums text-slate-950">
                            {formatAmount(row.amount)}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-slate-600">
                            {row.employee_no ?? "-"}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-slate-800">
                            {row.source_manager_name ?? "-"}
                          </td>
                          <td className="px-3 py-2.5">
                            {matchedManager ? (
                              <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 font-bold text-emerald-700">
                                {matchedManager.name}
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-amber-50 px-2 py-1 font-bold text-amber-700">
                                미매칭
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-7">
          <p className="text-xs leading-5 text-slate-500">
            적용 시 해당 월의 기존 {target.datasetTitle} 누적 최종본은 삭제되고 새 월 누적 자료 1개만 남습니다.
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy || passwordBusy}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              닫기
            </button>

            <button
              type="button"
              onClick={handleApply}
              disabled={
                busy ||
                loading ||
                passwordBusy ||
                !dirty
              }
              className="inline-flex items-center gap-2 rounded-xl bg-[#A50034] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-[#8b002c] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              카드실적 적용
            </button>
          </div>
        </div>
      </div>

      {pendingPasswordFile && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]">
          <form
            onSubmit={handlePasswordSubmit}
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#A50034]/10 text-[#A50034]">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-black text-slate-950">
                  Excel 파일 암호
                </h3>
                <p className="mt-1 break-all text-sm leading-6 text-slate-500">
                  {pendingPasswordFile.name}
                </p>
              </div>

              <button
                type="button"
                onClick={closePasswordDialog}
                disabled={passwordBusy}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                aria-label="암호 입력 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label
              htmlFor="card-excel-password"
              className="mt-5 block text-sm font-bold text-slate-700"
            >
              파일 암호
            </label>

            <div className="relative mt-2">
              <input
                id="card-excel-password"
                autoFocus
                type={
                  showExcelPassword
                    ? "text"
                    : "password"
                }
                value={excelPassword}
                disabled={passwordBusy}
                onChange={(event) => {
                  setExcelPassword(
                    event.target.value
                  );
                  setPasswordError(null);
                }}
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 pr-12 text-base font-semibold text-slate-950 outline-none transition focus:border-[#A50034] focus:ring-2 focus:ring-[#A50034]/10"
                autoComplete="off"
              />

              <button
                type="button"
                onClick={() => {
                  setShowExcelPassword(
                    (current) => !current
                  );
                }}
                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="암호 표시 전환"
              >
                {showExcelPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {passwordError && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <p className="mt-3 text-xs leading-5 text-slate-500">
              입력한 암호는 Excel 파일을 여는 동안에만 사용하며 Supabase, DB, LocalStorage에 저장하지 않습니다.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closePasswordDialog}
                disabled={passwordBusy}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                취소
              </button>

              <button
                type="submit"
                disabled={
                  passwordBusy ||
                  excelPassword.trim() === ""
                }
                className="inline-flex items-center gap-2 rounded-xl bg-[#A50034] px-4 py-2.5 text-sm font-black text-white hover:bg-[#8b002c] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {passwordBusy ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <LockKeyhole className="h-4 w-4" />
                )}
                파일 열기
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
