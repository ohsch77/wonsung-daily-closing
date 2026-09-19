"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  FileSpreadsheet,
  Info,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  PencilLine,
  Trash2,
  Upload,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import SystemPerformanceInputModal from "@/components/system-performance/SystemPerformanceInputModal";

import type {
  SystemPerformanceInputTarget,
} from "@/components/system-performance/SystemPerformanceInputModal";

import {
  createClient,
} from "@/lib/supabase/client";

import type {
  SystemPerformanceDatasetType,
  SystemPerformanceSnapshotType,
  SystemPerformanceSourceMethod,
} from "@/types/system-performance";


export type SystemPerformanceBatchSummary = {
  id: string;

  report_date: string;

  dataset_type: string;

  snapshot_type: string;

  version_no: number;

  status: string;

  is_current: boolean;

  row_count: number;

  source_method:
    string | null;

  source_file_name:
    string | null;

  source_sheet_name:
    string | null;

  created_at:
    string | null;
};


type Props = {
  reportDate: string;

  batches:
    SystemPerformanceBatchSummary[];
};


type SlotState = {
  applied:
    SystemPerformanceBatchSummary | null;

  draft:
    SystemPerformanceBatchSummary | null;

  status:
    | "missing"
    | "draft"
    | "editing"
    | "applied"
    | "no_performance";

  rowCount:
    number | null;
};


type DatasetConfig = {
  datasetType:
    SystemPerformanceDatasetType;

  title: string;

  description: string;
};


const DATASETS:
  DatasetConfig[] = [
    {
      datasetType:
        "sales",

      title:
        "사원별 판매",

      description:
        "판매 전일누적과 당일누적을 각각 입력·관리하며, 두 누적값의 차이로 당일실적을 계산합니다.",
    },

    {
      datasetType:
        "revenue",

      title:
        "사원별 매출",

      description:
        "매출 전일누적과 당일누적을 각각 입력·관리하며, 두 누적값의 차이로 당일실적을 계산합니다.",
    },
  ];


function getSlotState(
  batches:
    SystemPerformanceBatchSummary[],
  datasetType:
    SystemPerformanceDatasetType,
  snapshotType:
    SystemPerformanceSnapshotType
): SlotState {
  const matched =
    batches.filter(
      (batch) =>
        batch.dataset_type ===
          datasetType &&
        batch.snapshot_type ===
          snapshotType
    );


  const applied =
    matched.find(
      (batch) =>
        batch.status ===
          "applied" &&
        batch.is_current ===
          true
    ) ?? null;


  const draft =
    matched.find(
      (batch) =>
        batch.status ===
        "draft"
    ) ?? null;


  if (
    draft &&
    applied
  ) {
    return {
      applied,
      draft,
      status:
        "editing",
      rowCount:
        draft.row_count,
    };
  }


  if (
    draft
  ) {
    return {
      applied: null,
      draft,
      status:
        "draft",
      rowCount:
        draft.row_count,
    };
  }


  if (
    applied
  ) {
    const noPerformance =
      applied.source_method ===
        "manual" &&
      applied.row_count ===
        0;

    return {
      applied,
      draft: null,
      status:
        noPerformance
          ? "no_performance"
          : "applied",
      rowCount:
        applied.row_count,
    };
  }


  return {
    applied: null,
    draft: null,
    status:
      "missing",
    rowCount: null,
  };
}


function getStatusInfo(
  status:
    SlotState["status"]
) {
  switch (
    status
  ) {
    case "no_performance":
      return {
        label:
          "무실적 확정",
        className:
          "bg-[#F1F3F5] text-[#555A63]",
        Icon:
          CheckCircle2,
      };

    case "applied":
      return {
        label:
          "입력완료",
        className:
          "bg-[#EDF8F1] text-[#287348]",
        Icon:
          CheckCircle2,
      };

    case "draft":
      return {
        label:
          "작성중",
        className:
          "bg-[#FFF7E8] text-[#9A6513]",
        Icon:
          PencilLine,
      };

    case "editing":
      return {
        label:
          "수정중",
        className:
          "bg-[#FFF7E8] text-[#9A6513]",
        Icon:
          PencilLine,
      };

    default:
      return {
        label:
          "미입력",
        className:
          "bg-[#F2F3F5] text-[#737881]",
        Icon:
          Clock3,
      };
  }
}


function normalizeSourceMethod(
  value:
    string | null
): SystemPerformanceSourceMethod | null {
  if (
    value ===
      "upload" ||
    value ===
      "paste" ||
    value ===
      "manual"
  ) {
    return value;
  }

  return null;
}


function getSourceLabel(
  sourceMethod:
    string | null
) {
  switch (
    sourceMethod
  ) {
    case "upload":
      return "Excel 업로드";

    case "paste":
      return "붙여넣기";

    case "manual":
      return "직접입력";

    default:
      return "-";
  }
}


function formatCreatedAt(
  value:
    string | null
) {
  if (
    !value
  ) {
    return "-";
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }


  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone:
        "Asia/Seoul",
      month:
        "2-digit",
      day:
        "2-digit",
      hour:
        "2-digit",
      minute:
        "2-digit",
      hour12:
        false,
    }
  ).format(
    date
  );
}


function getKstTodayString() {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const year =
    parts.find(
      (part) =>
        part.type === "year"
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type === "month"
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type === "day"
    )?.value;

  if (
    !year ||
    !month ||
    !day
  ) {
    return "";
  }

  return `${year}-${month}-${day}`;
}


function getSlotKey(
  datasetType:
    SystemPerformanceDatasetType,
  snapshotType:
    SystemPerformanceSnapshotType
) {
  return `${datasetType}:${snapshotType}`;
}


function SnapshotCard({
  label,
  state,
  onOpen,
  onDelete,
  onNoPerformance,
  deleting,
  confirmingNoPerformance,
  locked,
}: {
  label: string;
  state:
    SlotState;
  onOpen:
    () => void;
  onDelete:
    () => void;
  onNoPerformance:
    () => void;
  deleting:
    boolean;
  confirmingNoPerformance:
    boolean;
  locked:
    boolean;
}) {
  const statusInfo =
    getStatusInfo(
      state.status
    );


  const StatusIcon =
    statusInfo.Icon;


  const displayBatch =
    state.draft ??
    state.applied;


  const hasData =
    Boolean(
      state.draft ||
      state.applied
    );


  const inputLabel =
    locked
      ? "마감완료"
      : state.status ===
          "no_performance"
        ? "수정"
        : hasData
          ? "수정"
          : "입력";


  return (
    <div className="flex min-h-[270px] flex-col rounded-[18px] border border-[#E5E7EA] bg-[#FAFAFB] p-4 sm:p-5">

      <div className="flex items-start justify-between gap-3">

        <div>
          <p className="text-[11px] font-semibold text-[#92969D]">
            SNAPSHOT
          </p>

          <h4 className="mt-1 text-[17px] font-bold tracking-[-0.025em] text-[#292C31]">
            {label}
          </h4>
        </div>


        <span
          className={[
            "inline-flex min-h-[30px] items-center gap-1.5 rounded-full px-3 text-[11px] font-bold",
            statusInfo.className,
          ].join(" ")}
        >
          <StatusIcon
            size={13}
          />

          {statusInfo.label}
        </span>

      </div>


      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">

        <div>
          <p className="text-[10px] font-semibold text-[#9A9EA5]">
            행 수
          </p>

          <p className="mt-1 text-[15px] font-bold tabular-nums text-[#3B3F45]">
            {state.rowCount ===
            null
              ? "-"
              : `${state.rowCount.toLocaleString(
                  "ko-KR"
                )}건`}
          </p>
        </div>


        <div>
          <p className="text-[10px] font-semibold text-[#9A9EA5]">
            저장 상태
          </p>

          <p className="mt-1 text-[15px] font-bold text-[#3B3F45]">
            {state.draft
              ? "수정중"
              : state.status ===
                  "no_performance"
                ? "무실적 확정"
                : state.applied
                  ? "최종 적용"
                  : "-"}
          </p>
        </div>


        <div>
          <p className="text-[10px] font-semibold text-[#9A9EA5]">
            입력 방식
          </p>

          <p className="mt-1 truncate text-[12px] font-semibold text-[#5C6168]">
            {state.status ===
              "no_performance"
              ? "무실적 확정"
              : getSourceLabel(
                  displayBatch
                    ?.source_method ??
                    null
                )}
          </p>
        </div>


        <div>
          <p className="text-[10px] font-semibold text-[#9A9EA5]">
            입력 시각
          </p>

          <p className="mt-1 text-[12px] font-semibold text-[#5C6168]">
            {formatCreatedAt(
              displayBatch
                ?.created_at ??
                null
            )}
          </p>
        </div>

      </div>


      {displayBatch
        ?.source_file_name && (
        <div className="mt-4 flex items-start gap-2 rounded-[10px] bg-white px-3 py-2.5">
          <FileSpreadsheet
            size={14}
            className="mt-0.5 shrink-0 text-[#8A8F97]"
          />

          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold text-[#5E636B]">
              {displayBatch.source_file_name}
            </p>

            {displayBatch
              .source_sheet_name && (
              <p className="mt-0.5 truncate text-[10px] text-[#9A9EA5]">
                {displayBatch.source_sheet_name}
              </p>
            )}
          </div>
        </div>
      )}


      {state.status ===
        "editing" && (
        <div className="mt-4 rounded-[10px] border border-[#F1DFC0] bg-[#FFF9EF] px-3 py-2.5 text-[10px] font-medium leading-4 text-[#87621E]">
          현재 최종 적용 자료를 유지한 상태에서 수정 자료를 작성 중입니다. 적용하면 새 자료가 기존 최종 자료를 전체 교체합니다.
        </div>
      )}


      <div className="mt-auto flex gap-2 pt-5">
        <button
          type="button"
          onClick={
            onOpen
          }
          disabled={
            deleting ||
            confirmingNoPerformance ||
            locked
          }
          className="inline-flex h-[40px] flex-1 items-center justify-center gap-1.5 rounded-[11px] bg-[#A50034] px-4 text-[11px] font-bold text-white transition hover:bg-[#8D002C] disabled:opacity-40"
        >
          <Upload
            size={14}
          />

          {inputLabel}
        </button>


        {(state.status ===
          "missing" ||
          state.status ===
            "no_performance") && (
          <button
            type="button"
            onClick={
              onNoPerformance
            }
            disabled={
              deleting ||
              confirmingNoPerformance ||
              locked ||
              state.status ===
                "no_performance"
            }
            className="inline-flex h-[40px] min-w-[106px] items-center justify-center gap-1.5 rounded-[11px] border border-[#DDE0E5] bg-white px-3 text-[11px] font-bold text-[#5F646C] transition hover:border-[#BFC3C9] hover:bg-[#F7F8F9] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {confirmingNoPerformance ? (
              <LoaderCircle
                size={14}
                className="animate-spin"
              />
            ) : (
              <CheckCircle2
                size={14}
              />
            )}

            무실적 확정
          </button>
        )}


        {hasData && (
          <button
            type="button"
            onClick={
              onDelete
            }
            disabled={
              deleting ||
              confirmingNoPerformance ||
              locked
            }
            className="inline-flex h-[40px] min-w-[82px] items-center justify-center gap-1.5 rounded-[11px] border border-[#E6DADD] bg-white px-3 text-[11px] font-bold text-[#A50034] transition hover:bg-[#FFF7F9] disabled:cursor-not-allowed disabled:border-[#E7E8EA] disabled:bg-[#F3F4F6] disabled:text-[#B5B8BD]"
          >
            {deleting ? (
              <LoaderCircle
                size={14}
                className="animate-spin"
              />
            ) : (
              <Trash2
                size={14}
              />
            )}

            삭제
          </button>
        )}
      </div>

    </div>
  );
}


export default function SystemPerformanceOverview({
  reportDate,
  batches,
}: Props) {
  const router =
    useRouter();


  const supabase =
    useMemo(
      () =>
        createClient(),
      []
    );


  const dateInputRef =
    useRef<HTMLInputElement | null>(
      null
    );


  const [
    notice,
    setNotice,
  ] = useState<
    string | null
  >(null);


  const [
    inputTarget,
    setInputTarget,
  ] = useState<
    SystemPerformanceInputTarget | null
  >(null);


  const [
    deletingSlot,
    setDeletingSlot,
  ] = useState<
    string | null
  >(null);


  const [
    noPerformanceSlot,
    setNoPerformanceSlot,
  ] = useState<
    string | null
  >(null);


  const [
    closingStatus,
    setClosingStatus,
  ] = useState<
    "draft" |
    "closed" |
    "editing" |
    null
  >(null);


  const [
    closingStatusLoaded,
    setClosingStatusLoaded,
  ] = useState(
    false
  );


  useEffect(() => {
    const handleDocumentPointerDown =
      (event: PointerEvent) => {
        const dateInput =
          dateInputRef.current;

        if (
          !dateInput ||
          event.target ===
            dateInput
        ) {
          return;
        }

        dateInput.blur();
      };

    document.addEventListener(
      "pointerdown",
      handleDocumentPointerDown
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handleDocumentPointerDown
      );
    };
  }, []);


  useEffect(() => {
    let cancelled =
      false;


    const loadClosingStatus =
      async () => {
        const {
          data,
          error,
        } =
          await supabase.rpc(
            "is_performance_upload_editable",
            {
              p_report_date:
                reportDate,
            }
          );


        if (
          cancelled
        ) {
          return;
        }


        if (
          error
        ) {
          setNotice(
            "마감 상태를 확인하지 못했습니다. 새로고침 후 다시 시도해주세요."
          );
          setClosingStatus(
            "closed"
          );
          setClosingStatusLoaded(
            true
          );
          return;
        }


        /*
         * daily_closings의 실제 날짜 컬럼을 UI에서 직접 조회하지 않습니다.
         * DB 공통 함수가 마감 전 / 마감 완료 / 수정 모드 규칙을
         * 한 곳에서 판단하도록 통일합니다.
         *
         * true  = 현재 수정 가능
         * false = 마감 잠금
         */
        setClosingStatus(
          data === true
            ? "draft"
            : "closed"
        );


        setClosingStatusLoaded(
          true
        );
      };


    void loadClosingStatus();


    return () => {
      cancelled =
        true;
    };
  }, [
    reportDate,
    supabase,
  ]);


  const isClosingLocked =
    closingStatusLoaded &&
    closingStatus ===
      "closed";


  const handleDateChange =
    (value: string) => {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
          value
        )
      ) {
        return;
      }

      router.push(
        `/system-performance?date=${encodeURIComponent(value)}`
      );
    };


  const goToday = () => {
    const today =
      getKstTodayString();

    if (today) {
      handleDateChange(
        today
      );
    }
  };


  const slots = [
    getSlotState(
      batches,
      "sales",
      "previous"
    ),

    getSlotState(
      batches,
      "sales",
      "current"
    ),

    getSlotState(
      batches,
      "revenue",
      "previous"
    ),

    getSlotState(
      batches,
      "revenue",
      "current"
    ),
  ];


  const completedCount =
    slots.filter(
      (slot) =>
        slot.applied !==
        null
    ).length;


  const draftCount =
    slots.filter(
      (slot) =>
        slot.draft !==
        null
    ).length;


  const openInput =
    (
      datasetType:
        SystemPerformanceDatasetType,
      datasetTitle:
        string,
      snapshotType:
        SystemPerformanceSnapshotType,
      snapshotTitle:
        string,
      state:
        SlotState
    ) => {
      if (
        isClosingLocked
      ) {
        setNotice(
          "이미 마감이 확정된 날짜입니다. 마감보고에서 [수정]을 눌러 수정 모드로 전환한 뒤 실적을 변경할 수 있습니다."
        );
        return;
      }


      const sourceBatch =
        state.draft ??
        state.applied;


      setInputTarget({
        reportDate,
        datasetType,
        snapshotType,
        datasetTitle,
        snapshotTitle,
        draftBatchId:
          state.draft?.id ??
          null,
        appliedBatchId:
          state.applied?.id ??
          null,
        sourceMethod:
          normalizeSourceMethod(
            sourceBatch
              ?.source_method ??
              null
          ),
        sourceFileName:
          sourceBatch
            ?.source_file_name ??
          null,
        sourceSheetName:
          sourceBatch
            ?.source_sheet_name ??
          null,
      });


      setNotice(
        null
      );
    };


  const handleApplied =
    (
      message: string
    ) => {
      setInputTarget(
        null
      );


      setNotice(
        message
      );


      router.refresh();
    };


  const confirmNoPerformance =
    async (
      datasetType:
        SystemPerformanceDatasetType,
      datasetTitle:
        string,
      snapshotType:
        SystemPerformanceSnapshotType,
      snapshotTitle:
        string,
      state:
        SlotState
    ) => {
      if (
        isClosingLocked ||
        !closingStatusLoaded
      ) {
        setNotice(
          "이미 마감이 확정된 날짜입니다. 마감보고에서 [수정]을 눌러 수정 모드로 전환한 뒤 다시 작업해주세요."
        );
        return;
      }


      if (
        state.status !==
          "missing"
      ) {
        setNotice(
          `${datasetTitle} · ${snapshotTitle} 자료가 이미 입력되어 있습니다. 기존 자료를 삭제한 뒤 무실적 확정을 진행해주세요.`
        );
        return;
      }


      const confirmed =
        window.confirm(
          `${datasetTitle} · ${snapshotTitle} 실적이 없음을 확정할까요?\n\n무실적 확정은 정상 입력완료로 인정되며, 이후 [수정]으로 실제 자료를 다시 입력할 수 있습니다.`
        );


      if (
        !confirmed
      ) {
        return;
      }


      const slotKey =
        getSlotKey(
          datasetType,
          snapshotType
        );


      setNoPerformanceSlot(
        slotKey
      );


      setNotice(
        null
      );


      try {
        const {
          error,
        } =
          await supabase.rpc(
            "confirm_system_performance_no_performance",
            {
              p_report_date:
                reportDate,
              p_dataset_type:
                datasetType,
              p_snapshot_type:
                snapshotType,
            }
          );


        if (
          error
        ) {
          throw error;
        }


        setNotice(
          `${datasetTitle} · ${snapshotTitle}을 무실적으로 확정했습니다.`
        );


        router.refresh();
      }
      catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : "전산실적 무실적 확정 중 오류가 발생했습니다."
        );
      }
      finally {
        setNoPerformanceSlot(
          null
        );
      }
    };


  const deleteSlot =
    async (
      datasetType:
        SystemPerformanceDatasetType,
      datasetTitle:
        string,
      snapshotType:
        SystemPerformanceSnapshotType,
      snapshotTitle:
        string,
      state:
        SlotState
    ) => {
      if (
        isClosingLocked
      ) {
        setNotice(
          "이미 마감이 확정된 날짜입니다. 마감보고에서 [수정]을 눌러 수정 모드로 전환한 뒤 삭제 또는 재입력할 수 있습니다."
        );
        return;
      }


      const hasData =
        Boolean(
          state.draft ||
          state.applied
        );


      if (
        !hasData
      ) {
        return;
      }


      const confirmed =
        window.confirm(
          `${datasetTitle} · ${snapshotTitle} 현재 자료를 삭제할까요?\n\n삭제하면 해당 항목의 현재 저장 자료가 제거되며, 바로 다시 전체 업로드할 수 있습니다.`
        );


      if (
        !confirmed
      ) {
        return;
      }


      const slotKey =
        getSlotKey(
          datasetType,
          snapshotType
        );


      setDeletingSlot(
        slotKey
      );


      setNotice(
        null
      );


      try {
        const {
          data,
          error,
        } =
          await supabase.rpc(
            "delete_today_system_performance_slot",
            {
              p_report_date:
                reportDate,
              p_dataset_type:
                datasetType,
              p_snapshot_type:
                snapshotType,
              p_reason:
                "사용자 전산실적 재입력",
            }
          );


        if (
          error
        ) {
          throw error;
        }


        const deletedCount =
          Number(
            data ??
            0
          );


        setNotice(
          `${datasetTitle} · ${snapshotTitle} 자료를 삭제했습니다. 바로 다시 입력할 수 있습니다.${
            deletedCount > 1
              ? ` (${deletedCount}개 현재 자료 정리)`
              : ""
          }`
        );


        router.refresh();
      }
      catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "전산실적 삭제 중 오류가 발생했습니다.";


        setNotice(
          message
        );
      }
      finally {
        setDeletingSlot(
          null
        );
      }
    };


  return (
    <>
      <div className="space-y-5">

        <section className="rounded-[22px] border border-[#E5E7EA] bg-white p-5 sm:p-6">

          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">

            <div>
              <p className="text-[11px] font-bold tracking-[0.12em] text-[#A50034]">
                SYSTEM PERFORMANCE
              </p>

              <h2 className="mt-2 text-[26px] font-bold tracking-[-0.04em] text-[#202226]">
                전산실적
              </h2>

              <p className="mt-2 max-w-[760px] text-[13px] leading-6 text-[#7D828A]">
                회사 전산에서 받은 판매·매출 자료를 입력합니다. 각 항목은 최종 적용본 1개만 유지하며, 재업로드 시 기존 자료에 누적하지 않고 새 파일 전체로 교체합니다. 마감 확정 후에는 수정 모드에서만 변경할 수 있습니다.
              </p>
            </div>


            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-[46px] items-center gap-2 rounded-[14px] border border-[#DDE0E5] bg-[#FAFAFB] px-3">
                <CalendarDays
                  size={17}
                  className="text-[#777C85]"
                />

                <input
                  ref={dateInputRef}
                  type="date"
                  value={reportDate}
                  onChange={(event) =>
                    handleDateChange(
                      event.target.value
                    )
                  }
                  className="bg-transparent text-[14px] font-bold text-[#2D3035] outline-none"
                />
              </div>

              <button
                type="button"
                onClick={goToday}
                className="h-[46px] rounded-[14px] border border-[#DDE0E5] bg-white px-4 text-[13px] font-bold text-[#555A63] transition hover:bg-[#F6F7F8]"
              >
                오늘
              </button>
            </div>

          </div>


          <div className="mt-6 grid gap-3 border-t border-[#ECEEF1] pt-5 sm:grid-cols-3">

            <div className="rounded-[15px] bg-[#F7F8F9] px-4 py-4">
              <div className="flex items-center gap-2 text-[#737881]">
                <Database
                  size={15}
                />

                <span className="text-[11px] font-semibold">
                  전체 입력항목
                </span>
              </div>

              <p className="mt-3 text-[23px] font-bold tabular-nums text-[#292C31]">
                4
                <span className="ml-1 text-[11px] font-semibold text-[#92969D]">
                  건
                </span>
              </p>
            </div>


            <div className="rounded-[15px] bg-[#F3F9F5] px-4 py-4">
              <div className="flex items-center gap-2 text-[#47735B]">
                <CheckCircle2
                  size={15}
                />

                <span className="text-[11px] font-semibold">
                  입력완료
                </span>
              </div>

              <p className="mt-3 text-[23px] font-bold tabular-nums text-[#286B46]">
                {completedCount}
                <span className="ml-1 text-[11px] font-semibold text-[#75A087]">
                  / 4
                </span>
              </p>
            </div>


            <div className="rounded-[15px] bg-[#FFF9EF] px-4 py-4">
              <div className="flex items-center gap-2 text-[#87621E]">
                <PencilLine
                  size={15}
                />

                <span className="text-[11px] font-semibold">
                  작성·수정중
                </span>
              </div>

              <p className="mt-3 text-[23px] font-bold tabular-nums text-[#87621E]">
                {draftCount}
                <span className="ml-1 text-[11px] font-semibold text-[#B59B6E]">
                  건
                </span>
              </p>
            </div>

          </div>

        </section>


        {notice && (
          <section className="flex items-start justify-between gap-4 rounded-[15px] border border-[#DCE3EC] bg-[#F7FAFD] px-4 py-3.5">
            <div className="flex min-w-0 items-start gap-2.5">
              <Info
                size={17}
                className="mt-0.5 shrink-0 text-[#526B84]"
              />

              <p className="text-[12px] font-medium leading-5 text-[#52616F]">
                {notice}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setNotice(
                  null
                )
              }
              className="shrink-0 text-[11px] font-bold text-[#7B8088]"
            >
              닫기
            </button>
          </section>
        )}


        <section
          className={[
            "flex items-start gap-3 rounded-[15px] border px-4 py-3.5",
            isClosingLocked
              ? "border-[#E5E7EA] bg-[#F5F6F7]"
              : closingStatus === "editing"
                ? "border-[#F1DFC0] bg-[#FFF9EF]"
                : "border-[#ECE5E7] bg-[#FFF9FA]",
          ].join(" ")}
        >
          {isClosingLocked ? (
            <LockKeyhole
              size={17}
              className="mt-0.5 shrink-0 text-[#6F747C]"
            />
          ) : (
            <AlertCircle
              size={17}
              className="mt-0.5 shrink-0 text-[#A50034]"
            />
          )}

          <p className="text-[12px] leading-5 text-[#6F6065]">
            {isClosingLocked ? (
              <>
                마감이 확정되어 전산실적이 잠겨 있습니다. 마감보고에서
                <strong className="mx-1 text-[#A50034]">[수정]</strong>
                을 눌러 수정 모드로 전환하면 다시 업로드할 수 있으며, 새 파일은 기존 현재 자료를 전체 교체합니다.
              </>
            ) : closingStatus === "editing" ? (
              <>
                현재
                <strong className="mx-1 text-[#A50034]">수정 모드</strong>
                입니다. 파일을 다시 업로드하면 기존 현재 자료에 추가하지 않고 새 파일 내용으로 전체 교체됩니다.
              </>
            ) : (
              <>
                마감 확정 전에는 파일을 다시 업로드할 수 있으며,
                <strong className="mx-1 text-[#A50034]">재업로드 시 새 파일로 전체 교체</strong>
                됩니다. 마감 확정 후에는 마감보고에서 [수정]을 눌러야 변경할 수 있습니다.
              </>
            )}
          </p>
        </section>


        {DATASETS.map(
          (dataset) => {
            const previousState =
              getSlotState(
                batches,
                dataset.datasetType,
                "previous"
              );


            const currentState =
              getSlotState(
                batches,
                dataset.datasetType,
                "current"
              );


            const sectionCompleted =
              [
                previousState,
                currentState,
              ].filter(
                (state) =>
                  state.applied !==
                  null
              ).length;


            return (
              <section
                key={
                  dataset.datasetType
                }
                className="overflow-hidden rounded-[22px] border border-[#E5E7EA] bg-white"
              >

                <div className="border-b border-[#ECEEF1] px-5 py-5 sm:px-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#F3F4F6] text-[#5E636B]">
                      <Layers3
                        size={19}
                      />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[19px] font-bold tracking-[-0.03em] text-[#292C31]">
                          {dataset.title}
                        </h3>

                        <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[10px] font-bold text-[#777C84]">
                          {sectionCompleted}/2 완료
                        </span>
                      </div>

                      <p className="mt-1 text-[12px] text-[#8A8F97]">
                        {dataset.description}
                      </p>
                    </div>
                  </div>
                </div>


                <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
                  <SnapshotCard
                    label="전일누적"
                    state={
                      previousState
                    }
                    deleting={
                      deletingSlot ===
                      getSlotKey(
                        dataset.datasetType,
                        "previous"
                      )
                    }
                    locked={
                      isClosingLocked ||
                      !closingStatusLoaded
                    }
                    onOpen={() =>
                      openInput(
                        dataset.datasetType,
                        dataset.title,
                        "previous",
                        "전일누적",
                        previousState
                      )
                    }
                    onDelete={() =>
                      void deleteSlot(
                        dataset.datasetType,
                        dataset.title,
                        "previous",
                        "전일누적",
                        previousState
                      )
                    }
                    onNoPerformance={() =>
                      void confirmNoPerformance(
                        dataset.datasetType,
                        dataset.title,
                        "previous",
                        "전일누적",
                        previousState
                      )
                    }
                    confirmingNoPerformance={
                      noPerformanceSlot ===
                      getSlotKey(
                        dataset.datasetType,
                        "previous"
                      )
                    }
                  />


                  <SnapshotCard
                    label="당일누적"
                    state={
                      currentState
                    }
                    deleting={
                      deletingSlot ===
                      getSlotKey(
                        dataset.datasetType,
                        "current"
                      )
                    }
                    locked={
                      isClosingLocked ||
                      !closingStatusLoaded
                    }
                    onOpen={() =>
                      openInput(
                        dataset.datasetType,
                        dataset.title,
                        "current",
                        "당일누적",
                        currentState
                      )
                    }
                    onDelete={() =>
                      void deleteSlot(
                        dataset.datasetType,
                        dataset.title,
                        "current",
                        "당일누적",
                        currentState
                      )
                    }
                    onNoPerformance={() =>
                      void confirmNoPerformance(
                        dataset.datasetType,
                        dataset.title,
                        "current",
                        "당일누적",
                        currentState
                      )
                    }
                    confirmingNoPerformance={
                      noPerformanceSlot ===
                      getSlotKey(
                        dataset.datasetType,
                        "current"
                      )
                    }
                  />
                </div>

              </section>
            );
          }
        )}


        <section className="rounded-[18px] border border-[#E5E7EA] bg-white px-5 py-4">
          <div className="flex items-start gap-3">
            <FileSpreadsheet
              size={17}
              className="mt-0.5 shrink-0 text-[#7B8088]"
            />

            <div>
              <p className="text-[12px] font-bold text-[#555A62]">
                편한 방식으로 입력하세요
              </p>

              <p className="mt-1 text-[11px] leading-5 text-[#8A8F97]">
                .xls/.xlsx 파일 드래그앤드롭, 파일 선택, Excel Ctrl+C/Ctrl+V, Grid 직접수정을 지원합니다. 같은 항목에 새 파일을 다시 업로드하면 기존 내용에 누적하지 않고 새 파일 전체로 교체되며, 최종 적용본 1개만 유지됩니다. 마감 확정 후에는 마감보고에서 [수정]을 눌러 수정 모드로 전환해야 합니다.
              </p>
            </div>
          </div>
        </section>

      </div>


      {inputTarget && (
        <SystemPerformanceInputModal
          key={`${inputTarget.datasetType}-${inputTarget.snapshotType}-${inputTarget.draftBatchId ?? inputTarget.appliedBatchId ?? "new"}`}
          target={
            inputTarget
          }
          onClose={() =>
            setInputTarget(
              null
            )
          }
          onApplied={
            handleApplied
          }
        />
      )}
    </>
  );
}
