"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileSpreadsheet,
  Info,
  LoaderCircle,
  LockKeyhole,
  PencilLine,
  Trash2,
  Upload,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import CardImportModal from "@/components/card/CardImportModal";

import {
  createClient,
} from "@/lib/supabase/client";

import type {
  CardDatasetType,
  CardImportTarget,
  CardSourceMethod,
} from "@/types/card-performance";


export type CardImportBatchSummary = {
  id: string;
  report_date: string;
  period_start_date: string;
  period_end_date: string;
  dataset_type: string;
  status: string;
  source_method: string | null;
  source_file_name: string | null;
  source_sheet_name: string | null;
  row_count: number;
  created_at: string | null;
  updated_at: string | null;
  applied_at: string | null;
};


type CardStoreSummary = {
  daily_approval_amount: number;
  daily_cancel_amount: number;
  daily_net_amount: number;
  mtd_approval_amount: number;
  mtd_cancel_amount: number;
  mtd_net_amount: number;
};


type CardManagerSummary = {
  manager_id: string | null;
  manager_name: string;
  daily_approval_amount: number;
  daily_cancel_amount: number;
  daily_net_amount: number;
  mtd_approval_amount: number;
  mtd_cancel_amount: number;
  mtd_net_amount: number;
};


type ManagerRow = {
  id: string;
  name: string;
  employee_no: string;
};


type Props = {
  reportDate: string;
};


type DatasetConfig = {
  datasetType: CardDatasetType;
  title: string;
  description: string;
  dateLabel: string;
};


type SlotState = {
  applied: CardImportBatchSummary | null;
  draft: CardImportBatchSummary | null;
  current: CardImportBatchSummary | null;
  status:
    | "missing"
    | "draft"
    | "editing"
    | "applied"
    | "no_performance";
};


const DATASETS: DatasetConfig[] = [
  {
    datasetType: "approval",
    title: "카드승인",
    description:
      "신용카드 승인내역 월 누적 원본 전체를 입력하고 승인일자 기준으로 당일·누적 실적을 계산합니다.",
    dateLabel: "승인일",
  },
  {
    datasetType: "cancel",
    title: "카드취소",
    description:
      "신용카드 승인취소내역 월 누적 원본 전체를 입력하고 취소일자 기준으로 당일·누적 실적을 계산합니다.",
    dateLabel: "취소일",
  },
];


const EMPTY_STORE_SUMMARY: CardStoreSummary = {
  daily_approval_amount: 0,
  daily_cancel_amount: 0,
  daily_net_amount: 0,
  mtd_approval_amount: 0,
  mtd_cancel_amount: 0,
  mtd_net_amount: 0,
};


function toNumber(
  value: unknown
) {
  const numberValue =
    typeof value === "number"
      ? value
      : Number(value ?? 0);

  return Number.isFinite(numberValue)
    ? numberValue
    : 0;
}


function normalizeStoreSummary(
  row: Record<string, unknown> | null | undefined
): CardStoreSummary {
  return {
    daily_approval_amount:
      toNumber(row?.daily_approval_amount),
    daily_cancel_amount:
      toNumber(row?.daily_cancel_amount),
    daily_net_amount:
      toNumber(row?.daily_net_amount),
    mtd_approval_amount:
      toNumber(row?.mtd_approval_amount),
    mtd_cancel_amount:
      toNumber(row?.mtd_cancel_amount),
    mtd_net_amount:
      toNumber(row?.mtd_net_amount),
  };
}


function normalizeManagerSummary(
  row: Record<string, unknown>
): CardManagerSummary {
  return {
    manager_id:
      typeof row.manager_id === "string"
        ? row.manager_id
        : null,
    manager_name:
      typeof row.manager_name === "string"
        ? row.manager_name
        : "미매칭",
    daily_approval_amount:
      toNumber(row.daily_approval_amount),
    daily_cancel_amount:
      toNumber(row.daily_cancel_amount),
    daily_net_amount:
      toNumber(row.daily_net_amount),
    mtd_approval_amount:
      toNumber(row.mtd_approval_amount),
    mtd_cancel_amount:
      toNumber(row.mtd_cancel_amount),
    mtd_net_amount:
      toNumber(row.mtd_net_amount),
  };
}


function getSlotState(
  batches: CardImportBatchSummary[],
  datasetType: CardDatasetType,
  reportDate: string
): SlotState {
  const matched =
    batches.filter(
      (batch) =>
        batch.dataset_type ===
          datasetType &&
        (
          batch.status ===
            "draft"
            ? batch.report_date ===
              reportDate
            : batch.period_end_date >=
              reportDate
        )
    );

  const applied =
    matched.find(
      (batch) =>
        batch.status === "applied"
    ) ?? null;

  const draft =
    matched.find(
      (batch) =>
        batch.status === "draft"
    ) ?? null;

  if (
    applied &&
    draft
  ) {
    return {
      applied,
      draft,
      current: draft,
      status: "editing",
    };
  }

  if (draft) {
    return {
      applied: null,
      draft,
      current: draft,
      status: "draft",
    };
  }

  if (applied) {
    const noPerformance =
      applied.source_method ===
        "manual" &&
      applied.report_date ===
        reportDate;

    return {
      applied,
      draft: null,
      current: applied,
      status:
        noPerformance
          ? "no_performance"
          : "applied",
    };
  }

  return {
    applied: null,
    draft: null,
    current: null,
    status: "missing",
  };
}


function getStatusInfo(
  status: SlotState["status"]
) {
  switch (status) {
    case "no_performance":
      return {
        label: "무실적 확정",
        className:
          "bg-[#F1F3F5] text-[#555A63]",
        Icon: CheckCircle2,
      };

    case "applied":
      return {
        label: "입력완료",
        className:
          "bg-[#EDF8F1] text-[#287348]",
        Icon: CheckCircle2,
      };

    case "draft":
      return {
        label: "작성중",
        className:
          "bg-[#FFF7E8] text-[#9A6513]",
        Icon: PencilLine,
      };

    case "editing":
      return {
        label: "수정중",
        className:
          "bg-[#FFF7E8] text-[#9A6513]",
        Icon: PencilLine,
      };

    default:
      return {
        label: "미입력",
        className:
          "bg-[#F2F3F5] text-[#737881]",
        Icon: Clock3,
      };
  }
}


function normalizeSourceMethod(
  value: string | null
): CardSourceMethod | null {
  if (
    value === "upload" ||
    value === "paste"
  ) {
    return value;
  }

  return null;
}


function getSourceLabel(
  sourceMethod: string | null
) {
  switch (sourceMethod) {
    case "upload":
      return "Excel 업로드";

    case "paste":
      return "붙여넣기";

    case "manual":
      return "무실적 확정";

    default:
      return "-";
  }
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


function formatDateLabel(
  value: string
) {
  const match =
    value.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (!match) {
    return value;
  }

  return `${match[1]}.${match[2]}.${match[3]}`;
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


function SummaryCard({
  title,
  amount,
  caption,
  emphasis = false,
}: {
  title: string;
  amount: number;
  caption: string;
  emphasis?: boolean;
}) {
  const negative =
    amount < 0;

  return (
    <div
      className={[
        "rounded-[22px] border p-5 shadow-sm",
        emphasis
          ? "border-[#E7CBD4] bg-[#FFF8FA]"
          : "border-[#E6E8EC] bg-white",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-bold tracking-[-0.01em] text-[#7A7F88]">
          {title}
        </p>

        {emphasis && (
          <div className="rounded-full bg-[#A50034]/10 p-2 text-[#A50034]">
            <CreditCard size={15} />
          </div>
        )}
      </div>

      <div
        className={[
          "mt-4 break-words text-[24px] font-black tracking-[-0.045em] sm:text-[28px]",
          negative
            ? "text-[#B42318]"
            : "text-[#17191D]",
        ].join(" ")}
      >
        {formatAmount(amount)}
        <span className="ml-1 text-[13px] font-bold tracking-normal text-[#8B9098]">
          원
        </span>
      </div>

      <p className="mt-2 text-[12px] leading-5 text-[#9A9EA6]">
        {caption}
      </p>
    </div>
  );
}


export default function CardPerformanceOverview({
  reportDate,
}: Props) {
  const router =
    useRouter();

  const supabase =
    useMemo(
      () => createClient(),
      []
    );

  const [batches, setBatches] =
    useState<CardImportBatchSummary[]>([]);

  const [storeSummary, setStoreSummary] =
    useState<CardStoreSummary>(
      EMPTY_STORE_SUMMARY
    );

  const [managerSummary, setManagerSummary] =
    useState<CardManagerSummary[]>([]);

  const [managers, setManagers] =
    useState<ManagerRow[]>([]);

  const [editable, setEditable] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [busyDataset, setBusyDataset] =
    useState<CardDatasetType | null>(
      null
    );

  const [
    noPerformanceDataset,
    setNoPerformanceDataset,
  ] =
    useState<CardDatasetType | null>(
      null
    );

  const [inputTarget, setInputTarget] =
    useState<CardImportTarget | null>(
      null
    );

  const [message, setMessage] =
    useState<string | null>(null);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);


  const loadData =
    useCallback(
      async () => {
        setLoading(true);
        setErrorMessage(null);

        try {
          const [
            batchResult,
            editableResult,
            storeResult,
            managerResult,
            managerMasterResult,
          ] =
            await Promise.all([
              supabase
                .from("card_import_batches")
                .select(
                  "id,report_date,period_start_date,period_end_date,dataset_type,status,source_method,source_file_name,source_sheet_name,row_count,created_at,updated_at,applied_at"
                )
                .eq(
                  "period_start_date",
                  `${reportDate.slice(0, 7)}-01`
                )
                .order(
                  "report_date",
                  {
                    ascending: false,
                  }
                )
                .order(
                  "created_at",
                  {
                    ascending: false,
                  }
                ),

              supabase.rpc(
                "is_performance_upload_editable",
                {
                  p_report_date:
                    reportDate,
                }
              ),

              supabase.rpc(
                "get_card_store_summary",
                {
                  p_date:
                    reportDate,
                }
              ),

              supabase.rpc(
                "get_card_manager_summary",
                {
                  p_date:
                    reportDate,
                }
              ),

              supabase
                .from("managers")
                .select(
                  "id,name,employee_no"
                )
                .eq(
                  "is_active",
                  true
                ),
            ]);


          if (batchResult.error) {
            throw batchResult.error;
          }

          if (editableResult.error) {
            throw editableResult.error;
          }

          if (storeResult.error) {
            throw storeResult.error;
          }

          if (managerResult.error) {
            throw managerResult.error;
          }

          if (managerMasterResult.error) {
            throw managerMasterResult.error;
          }


          setBatches(
            (batchResult.data ?? []) as CardImportBatchSummary[]
          );

          setEditable(
            editableResult.data === true
          );

          const storeRow =
            Array.isArray(
              storeResult.data
            )
              ? (
                  storeResult.data[0] as
                    | Record<string, unknown>
                    | undefined
                )
              : null;

          setStoreSummary(
            normalizeStoreSummary(
              storeRow
            )
          );

          const managerRows =
            Array.isArray(
              managerResult.data
            )
              ? managerResult.data
                  .map(
                    (row) =>
                      normalizeManagerSummary(
                        row as Record<string, unknown>
                      )
                  )
              : [];

          setManagerSummary(
            managerRows
          );

          const masterRows =
            (
              managerMasterResult.data ??
              []
            ) as ManagerRow[];

          setManagers(
            [...masterRows].sort(
              (a, b) =>
                a.name.localeCompare(
                  b.name,
                  "ko-KR"
                )
            )
          );
        }
        catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "카드실적을 불러오지 못했습니다."
          );
        }
        finally {
          setLoading(false);
        }
      },
      [
        reportDate,
        supabase,
      ]
    );


  useEffect(() => {
    const timerId =
      window.setTimeout(
        () => {
          void loadData();
        },
        0
      );

    return () => {
      window.clearTimeout(
        timerId
      );
    };
  }, [loadData]);


  const mergedManagerSummary =
    useMemo(() => {
      const byManagerId =
        new Map<
          string,
          CardManagerSummary
        >();

      const unmatched:
        CardManagerSummary[] = [];

      for (
        const summary of
        managerSummary
      ) {
        if (summary.manager_id) {
          byManagerId.set(
            summary.manager_id,
            summary
          );
        }
        else {
          unmatched.push(
            summary
          );
        }
      }

      const matched =
        managers.map(
          (manager) => {
            const found =
              byManagerId.get(
                manager.id
              );

            if (found) {
              return found;
            }

            return {
              manager_id:
                manager.id,
              manager_name:
                manager.name,
              daily_approval_amount:
                0,
              daily_cancel_amount:
                0,
              daily_net_amount:
                0,
              mtd_approval_amount:
                0,
              mtd_cancel_amount:
                0,
              mtd_net_amount:
                0,
            } satisfies CardManagerSummary;
          }
        );

      return [
        ...matched,
        ...unmatched,
      ];
    }, [
      managerSummary,
      managers,
    ]);


  const openInput =
    useCallback(
      (
        dataset:
          DatasetConfig
      ) => {
        const state =
          getSlotState(
            batches,
            dataset.datasetType,
            reportDate
          );

        const source =
          state.draft ??
          state.applied;

        setInputTarget({
          reportDate,
          datasetType:
            dataset.datasetType,
          datasetTitle:
            dataset.title,
          draftBatchId:
            state.draft?.id ??
            null,
          appliedBatchId:
            state.applied?.id ??
            null,
          sourceMethod:
            normalizeSourceMethod(
              source?.source_method ??
              null
            ),
          sourceFileName:
            source?.source_file_name ??
            null,
          sourceSheetName:
            source?.source_sheet_name ??
            null,
        });
      },
      [
        batches,
        reportDate,
      ]
    );


  const confirmNoPerformance =
    useCallback(
      async (
        dataset:
          DatasetConfig
      ) => {
        if (!editable) {
          setErrorMessage(
            "마감이 확정된 날짜입니다. 마감보고에서 [수정]을 누른 뒤 카드실적을 변경해주세요."
          );
          return;
        }

        const state =
          getSlotState(
            batches,
            dataset.datasetType,
            reportDate
          );

        if (
          state.status !==
          "missing"
        ) {
          setErrorMessage(
            `${dataset.title} 자료가 이미 입력되어 있습니다. 기존 자료를 삭제한 뒤 무실적 확정을 진행해주세요.`
          );
          return;
        }

        const confirmed =
          window.confirm(
            `${reportDate} ${dataset.title} 당일 실적이 0건임을 확정할까요?\n\n월 누계는 직전 입력일의 누계를 그대로 이어받습니다.`
          );

        if (!confirmed) {
          return;
        }

        setNoPerformanceDataset(
          dataset.datasetType
        );
        setMessage(null);
        setErrorMessage(null);

        try {
          const result =
            await supabase.rpc(
              "confirm_card_no_performance",
              {
                p_report_date:
                  reportDate,
                p_dataset_type:
                  dataset.datasetType,
              }
            );

          if (result.error) {
            throw result.error;
          }

          setMessage(
            `${dataset.title}을 무실적(0건)로 확정했습니다.`
          );

          await loadData();
          router.refresh();
        }
        catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : `${dataset.title} 무실적 확정에 실패했습니다.`
          );
        }
        finally {
          setNoPerformanceDataset(
            null
          );
        }
      },
      [
        batches,
        editable,
        loadData,
        reportDate,
        router,
        supabase,
      ]
    );


  const deleteDataset =
    useCallback(
      async (
        dataset:
          DatasetConfig
      ) => {
        if (!editable) {
          setErrorMessage(
            "마감이 확정된 날짜입니다. 마감보고에서 [수정]을 누른 뒤 카드실적을 변경해주세요."
          );
          return;
        }

        const state =
          getSlotState(
            batches,
            dataset.datasetType,
            reportDate
          );

        if (
          !state.applied &&
          !state.draft
        ) {
          return;
        }

        const confirmed =
          window.confirm(
            `${reportDate} ${dataset.title} 자료를 삭제할까요?\n\n삭제 후에는 미입력 상태가 되며, 이전 버전은 보관하지 않습니다.`
          );

        if (!confirmed) {
          return;
        }

        setBusyDataset(
          dataset.datasetType
        );
        setMessage(null);
        setErrorMessage(null);

        try {
          const result =
            await supabase.rpc(
              "delete_card_dataset",
              {
                p_report_date:
                  reportDate,
                p_dataset_type:
                  dataset.datasetType,
              }
            );

          if (result.error) {
            throw result.error;
          }

          setMessage(
            `${dataset.title} 자료를 삭제했습니다.`
          );

          await loadData();
          router.refresh();
        }
        catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : `${dataset.title} 자료를 삭제하지 못했습니다.`
          );
        }
        finally {
          setBusyDataset(null);
        }
      },
      [
        batches,
        editable,
        loadData,
        reportDate,
        router,
        supabase,
      ]
    );


  const handleDateChange =
    useCallback(
      (
        value: string
      ) => {
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(
            value
          )
        ) {
          return;
        }

        router.push(
          `/card-management?date=${encodeURIComponent(value)}`
        );
      },
      [router]
    );


  const goToday =
    useCallback(() => {
      const today =
        getKstTodayString();

      if (today) {
        handleDateChange(
          today
        );
      }
    }, [handleDateChange]);


  const handleApplied =
    useCallback(
      (
        appliedMessage:
          string
      ) => {
        setMessage(
          appliedMessage
        );
        setErrorMessage(null);
        void loadData();
      },
      [loadData]
    );


  return (
    <>
      <div className="space-y-6">

        <section className="flex flex-col gap-4 rounded-[24px] border border-[#E6E8EC] bg-white p-5 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#A50034]">
              <CreditCard size={18} />
              <span className="text-[12px] font-black tracking-[0.12em]">
                CARD PERFORMANCE
              </span>
            </div>

            <h1 className="mt-2 text-[26px] font-black tracking-[-0.045em] text-[#17191D] sm:text-[30px]">
              카드관리
            </h1>

            <p className="mt-2 text-[13px] leading-6 text-[#777C85] sm:text-[14px]">
              카드승인·카드취소 자료를 기준일별로 전체 교체하고, 당일 및 월 누계 실적을 확인합니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-[46px] items-center gap-2 rounded-[14px] border border-[#DDE0E5] bg-[#FAFAFB] px-3">
              <CalendarDays
                size={17}
                className="text-[#777C85]"
              />

              <input
                type="date"
                value={reportDate}
                onChange={
                  (event) =>
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
        </section>


        {!loading &&
          !editable && (
            <section className="flex items-start gap-3 rounded-[18px] border border-[#F0D6DE] bg-[#FFF7F9] px-4 py-4 text-[#8C183B]">
              <LockKeyhole
                size={19}
                className="mt-0.5 shrink-0"
              />

              <div>
                <p className="text-[13px] font-black">
                  마감 확정으로 카드실적이 잠겨 있습니다.
                </p>

                <p className="mt-1 text-[12px] leading-5 text-[#9A4862]">
                  조회는 가능하며, 다시 업로드·교체·삭제하려면 마감보고에서 해당 날짜의 [수정]을 먼저 실행해주세요.
                </p>
              </div>
            </section>
          )}


        {message && (
          <section className="flex items-start gap-3 rounded-[18px] border border-[#CDE8D8] bg-[#F3FBF6] px-4 py-3.5 text-[#287348]">
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0"
            />
            <p className="text-[13px] font-bold leading-5">
              {message}
            </p>
          </section>
        )}


        {errorMessage && (
          <section className="flex items-start gap-3 rounded-[18px] border border-[#F0CDD3] bg-[#FFF5F6] px-4 py-3.5 text-[#A50034]">
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0"
            />
            <p className="text-[13px] font-bold leading-5">
              {errorMessage}
            </p>
          </section>
        )}


        <section>
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-[16px] font-black tracking-[-0.025em] text-[#25282D]">
                {formatDateLabel(reportDate)} 카드 요약
              </h2>

              <p className="mt-1 text-[12px] text-[#969AA2]">
                월 누계는 선택한 기준일이 속한 달의 1일부터 기준일까지 합산합니다.
              </p>
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-[12px] font-bold text-[#8B9098]">
                <LoaderCircle
                  size={15}
                  className="animate-spin"
                />
                불러오는 중
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <SummaryCard
              title="당일 승인"
              amount={
                storeSummary.daily_approval_amount
              }
              caption="선택 기준일 승인 합계"
            />

            <SummaryCard
              title="당일 취소"
              amount={
                storeSummary.daily_cancel_amount
              }
              caption="선택 기준일 취소 합계"
            />

            <SummaryCard
              title="당일 순카드"
              amount={
                storeSummary.daily_net_amount
              }
              caption="승인 - 취소"
              emphasis
            />

            <SummaryCard
              title="월 승인 누계"
              amount={
                storeSummary.mtd_approval_amount
              }
              caption="월 1일 ~ 선택 기준일"
            />

            <SummaryCard
              title="월 취소 누계"
              amount={
                storeSummary.mtd_cancel_amount
              }
              caption="월 1일 ~ 선택 기준일"
            />

            <SummaryCard
              title="월 순카드 누계"
              amount={
                storeSummary.mtd_net_amount
              }
              caption="월 승인 누계 - 월 취소 누계"
              emphasis
            />
          </div>
        </section>


        <section className="grid gap-4 xl:grid-cols-2">
          {DATASETS.map(
            (dataset) => {
              const state =
                getSlotState(
                  batches,
                  dataset.datasetType,
                  reportDate
                );

              const statusInfo =
                getStatusInfo(
                  state.status
                );

              const StatusIcon =
                statusInfo.Icon;

              const current =
                state.current;

              const coveredByLaterSource =
                Boolean(
                  current &&
                  current.status ===
                    "applied" &&
                  current.report_date >
                    reportDate
                );

              const busy =
                busyDataset ===
                dataset.datasetType;

              const noPerformanceBusy =
                noPerformanceDataset ===
                dataset.datasetType;

              return (
                <article
                  key={
                    dataset.datasetType
                  }
                  className="rounded-[24px] border border-[#E6E8EC] bg-white p-5 shadow-sm sm:p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <FileSpreadsheet
                          size={18}
                          className="text-[#A50034]"
                        />

                        <h3 className="text-[18px] font-black tracking-[-0.03em] text-[#202328]">
                          {dataset.title}
                        </h3>

                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${statusInfo.className}`}
                        >
                          <StatusIcon
                            size={12}
                          />
                          {statusInfo.label}
                        </span>
                      </div>

                      <p className="mt-2 max-w-xl text-[12px] leading-5 text-[#8A8F97]">
                        {dataset.description}
                      </p>
                    </div>

                    <div className="shrink-0 rounded-[14px] bg-[#F7F8F9] px-3 py-2 text-right">
                      <p className="text-[10px] font-bold text-[#9A9EA6]">
                        월 누적건수
                      </p>
                      <p className="mt-0.5 text-[17px] font-black text-[#30343A]">
                        {current
                          ? current.row_count.toLocaleString(
                              "ko-KR"
                            )
                          : "-"}
                        {current && (
                          <span className="ml-0.5 text-[11px] font-bold text-[#90959D]">
                            건
                          </span>
                        )}
                      </p>
                    </div>
                  </div>


                  <div className="mt-5 grid gap-2 rounded-[18px] border border-[#ECEEF1] bg-[#FAFAFB] p-4 text-[12px] sm:grid-cols-2">
                    <div>
                      <p className="font-bold text-[#999DA5]">
                        기준
                      </p>
                      <p className="mt-1 font-bold text-[#4E535B]">
                        {reportDate} {dataset.dateLabel}
                      </p>
                    </div>

                    <div>
                      <p className="font-bold text-[#999DA5]">
                        입력방식
                      </p>
                      <p className="mt-1 truncate font-bold text-[#4E535B]">
                        {getSourceLabel(
                          current?.source_method ??
                          null
                        )}
                      </p>
                    </div>

                    <div className="sm:col-span-2">
                      <p className="font-bold text-[#999DA5]">
                        원본
                      </p>
                      <p className="mt-1 truncate font-bold text-[#4E535B]">
                        {current?.source_file_name ??
                          current?.source_sheet_name ??
                          "-"}
                      </p>
                    </div>

                    {current &&
                      current.report_date !==
                        reportDate && (
                      <div className="sm:col-span-2 rounded-[12px] bg-[#F1F4F8] px-3 py-2 text-[11px] font-bold leading-5 text-[#68717C]">
                        {current.report_date}까지의 월 누적 원본을 기준으로 {reportDate} 실적을 계산하고 있습니다.
                      </div>
                    )}
                  </div>


                  {coveredByLaterSource && (
                    <p className="mt-4 text-[11px] font-bold leading-5 text-[#7A8089]">
                      과거 기준일 조회 중입니다. 월 누적 원본 수정은 최신 원본 기준일({current?.report_date})에서 진행해주세요.
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={
                        () =>
                          openInput(
                            dataset
                          )
                      }
                      disabled={
                        loading ||
                        busy ||
                        noPerformanceBusy ||
                        coveredByLaterSource ||
                        !editable
                      }
                      className="flex h-[44px] items-center gap-2 rounded-[13px] bg-[#A50034] px-4 text-[13px] font-black text-white transition hover:bg-[#8D002C] disabled:cursor-not-allowed disabled:bg-[#D8DADF] disabled:text-[#999DA5]"
                    >
                      <Upload size={15} />
                      {state.status ===
                      "missing"
                        ? "입력"
                        : "수정"}
                    </button>

                    <button
                      type="button"
                      onClick={
                        () =>
                          void confirmNoPerformance(
                            dataset
                          )
                      }
                      disabled={
                        loading ||
                        busy ||
                        noPerformanceBusy ||
                        coveredByLaterSource ||
                        !editable ||
                        state.status !==
                          "missing"
                      }
                      className="flex h-[44px] items-center gap-2 rounded-[13px] border border-[#DDE0E5] bg-white px-4 text-[13px] font-bold text-[#5F646C] transition hover:border-[#BFC3C9] hover:bg-[#F7F8F9] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {noPerformanceBusy
                        ? (
                            <LoaderCircle
                              size={15}
                              className="animate-spin"
                            />
                          )
                        : (
                            <CheckCircle2
                              size={15}
                            />
                          )}
                      무실적 확정
                    </button>

                    {(state.applied ||
                      state.draft) && (
                      <button
                        type="button"
                        onClick={
                          () =>
                            void deleteDataset(
                              dataset
                            )
                        }
                        disabled={
                          loading ||
                          busy ||
                          noPerformanceBusy ||
                          coveredByLaterSource ||
                          !editable
                        }
                        className="flex h-[44px] items-center gap-2 rounded-[13px] border border-[#E1E3E7] bg-white px-4 text-[13px] font-bold text-[#737881] transition hover:border-[#E8C8D2] hover:bg-[#FFF7F9] hover:text-[#A50034] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {busy
                          ? (
                              <LoaderCircle
                                size={15}
                                className="animate-spin"
                              />
                            )
                          : (
                              <Trash2
                                size={15}
                              />
                            )}
                        삭제
                      </button>
                    )}
                  </div>
                </article>
              );
            }
          )}
        </section>


        <section className="overflow-hidden rounded-[24px] border border-[#E6E8EC] bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-[#ECEEF1] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-[16px] font-black tracking-[-0.025em] text-[#25282D]">
                매니저별 카드실적
              </h2>

              <p className="mt-1 text-[12px] leading-5 text-[#969AA2]">
                카드승인은 판매사원 사번/매니저명을 우선하고, 카드취소는 취소사원명을 기준으로 집계합니다.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-full bg-[#F4F5F6] px-3 py-1.5 text-[11px] font-bold text-[#747982]">
              <Info size={13} />
              0원도 정상 실적으로 표시
            </div>
          </div>


          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full border-collapse">
              <thead>
                <tr className="bg-[#FAFAFB] text-left">
                  <th className="border-b border-[#ECEEF1] px-5 py-3 text-[11px] font-black text-[#7D828A] sm:px-6">
                    매니저
                  </th>
                  <th className="border-b border-[#ECEEF1] px-4 py-3 text-right text-[11px] font-black text-[#7D828A]">
                    당일 승인
                  </th>
                  <th className="border-b border-[#ECEEF1] px-4 py-3 text-right text-[11px] font-black text-[#7D828A]">
                    당일 취소
                  </th>
                  <th className="border-b border-[#ECEEF1] px-4 py-3 text-right text-[11px] font-black text-[#7D828A]">
                    당일 순카드
                  </th>
                  <th className="border-b border-[#ECEEF1] px-4 py-3 text-right text-[11px] font-black text-[#7D828A]">
                    월 승인
                  </th>
                  <th className="border-b border-[#ECEEF1] px-4 py-3 text-right text-[11px] font-black text-[#7D828A]">
                    월 취소
                  </th>
                  <th className="border-b border-[#ECEEF1] px-5 py-3 text-right text-[11px] font-black text-[#7D828A] sm:px-6">
                    월 순카드
                  </th>
                </tr>
              </thead>

              <tbody>
                {mergedManagerSummary.length ===
                  0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-12 text-center text-[13px] font-medium text-[#9A9EA6]"
                      >
                        표시할 매니저 정보가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    mergedManagerSummary.map(
                      (
                        row,
                        index
                      ) => {
                        const key =
                          row.manager_id ??
                          `unmatched-${row.manager_name}-${index}`;

                        return (
                          <tr
                            key={key}
                            className="transition hover:bg-[#FCFCFD]"
                          >
                            <td className="border-b border-[#F0F1F3] px-5 py-3.5 sm:px-6">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-black text-[#30343A]">
                                  {row.manager_name}
                                </span>

                                {!row.manager_id && (
                                  <span className="rounded-full bg-[#FFF1F2] px-2 py-0.5 text-[10px] font-black text-[#B42318]">
                                    미매칭
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="border-b border-[#F0F1F3] px-4 py-3.5 text-right text-[13px] font-bold text-[#4E535B]">
                              {formatAmount(
                                row.daily_approval_amount
                              )}
                            </td>

                            <td className="border-b border-[#F0F1F3] px-4 py-3.5 text-right text-[13px] font-bold text-[#4E535B]">
                              {formatAmount(
                                row.daily_cancel_amount
                              )}
                            </td>

                            <td className="border-b border-[#F0F1F3] px-4 py-3.5 text-right text-[13px] font-black text-[#25282D]">
                              {formatAmount(
                                row.daily_net_amount
                              )}
                            </td>

                            <td className="border-b border-[#F0F1F3] px-4 py-3.5 text-right text-[13px] font-bold text-[#4E535B]">
                              {formatAmount(
                                row.mtd_approval_amount
                              )}
                            </td>

                            <td className="border-b border-[#F0F1F3] px-4 py-3.5 text-right text-[13px] font-bold text-[#4E535B]">
                              {formatAmount(
                                row.mtd_cancel_amount
                              )}
                            </td>

                            <td className="border-b border-[#F0F1F3] px-5 py-3.5 text-right text-[13px] font-black text-[#25282D] sm:px-6">
                              {formatAmount(
                                row.mtd_net_amount
                              )}
                            </td>
                          </tr>
                        );
                      }
                    )
                  )}
              </tbody>
            </table>
          </div>
        </section>


        <section className="flex items-start gap-3 rounded-[20px] border border-[#E4E6E9] bg-[#F8F9FA] px-4 py-4 text-[#656A72] sm:px-5">
          <Info
            size={17}
            className="mt-0.5 shrink-0"
          />

          <div className="text-[12px] leading-5">
            <p className="font-black text-[#555A63]">
              입력 원칙
            </p>
            <p className="mt-1">
              월 1일부터 선택 기준일까지의 전체 원본을 업로드합니다. 시스템은 선택 기준일의 승인/취소 건만 저장하며, 같은 날짜의 새 파일을 적용하면 기존 자료를 전체 교체합니다. 과거 버전과 원본 파일은 별도로 보관하지 않습니다.
            </p>
          </div>
        </section>

      </div>


      {inputTarget && (
        <CardImportModal
          target={inputTarget}
          onClose={
            () =>
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
