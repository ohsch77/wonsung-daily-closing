"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Umbrella,
  UserCheck,
} from "lucide-react";
import {
  useRouter,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/client";


type DailyManagerStatus = {
  manager_id: string;
  manager_name: string;
  is_present: boolean;
  status_code:
    | "input_complete"
    | "no_performance"
    | "holiday"
    | "incomplete"
    | "attendance_mismatch"
    | "offday_performance";
  status_label: string;
  has_actual_performance: boolean;
  no_performance_confirmed: boolean;
  confirmed_at: string | null;
};


type Props = {
  reportDate: string;
  className?: string;
  onChanged?: () => void;
};


function getStatusStyle(
  status: DailyManagerStatus["status_code"]
) {
  switch (status) {
    case "input_complete":
      return {
        label: "입력완료",
        Icon: CheckCircle2,
        badge:
          "bg-[#EDF8F1] text-[#287348]",
      };

    case "no_performance":
      return {
        label: "무실적 확정",
        Icon: ShieldCheck,
        badge:
          "bg-[#EEF4FF] text-[#315F9B]",
      };

    case "incomplete":
      return {
        label: "미완료",
        Icon: Clock3,
        badge:
          "bg-[#FFF2E2] text-[#986219]",
      };

    case "attendance_mismatch":
      return {
        label: "출근선택 필요",
        Icon: AlertCircle,
        badge:
          "bg-[#FFF0F3] text-[#A50034]",
      };

    case "offday_performance":
      return {
        label: "휴무실적",
        Icon: CheckCircle2,
        badge:
          "bg-[#FFF2E2] text-[#986219]",
      };

    default:
      return {
        label: "휴무",
        Icon: Umbrella,
        badge:
          "bg-[#F2F3F5] text-[#737881]",
      };
  }
}


function getBasisText(
  row: DailyManagerStatus
) {
  switch (row.status_code) {
    case "input_complete":
      return "출근 · 실제 일실적 있음";

    case "no_performance":
      return "출근 · 0실적 확인완료";

    case "incomplete":
      return "출근 · 실적입력/무실적확정 필요";

    case "attendance_mismatch":
      return "실적 있음 · 출근 미선택";

    case "offday_performance":
      return "휴무 · 귀속실적 저장완료";

    default:
      return "출근 미선택 · 실적 없음";
  }
}


export default function DailyManagerClosingStatusPanel({
  reportDate,
  className = "",
  onChanged,
}: Props) {
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [rows, setRows] =
    useState<DailyManagerStatus[]>([]);
  const [editable, setEditable] =
    useState(false);
  const [loading, setLoading] =
    useState(true);
  const [busyManagerId, setBusyManagerId] =
    useState<string | null>(null);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [message, setMessage] =
    useState<string | null>(null);

  const loadData = useCallback(
    async (
      showLoading = true
    ) => {
      if (showLoading) {
        setLoading(true);
      }
      setErrorMessage(null);

      try {
        const [
          statusResult,
          editableResult,
        ] = await Promise.all([
          supabase.rpc(
            "get_daily_manager_attendance_status",
            {
              p_report_date:
                reportDate,
            }
          ),
          supabase.rpc(
            "is_closing_date_editable",
            {
              p_report_date:
                reportDate,
            }
          ),
        ]);

        if (statusResult.error) {
          throw statusResult.error;
        }

        if (editableResult.error) {
          throw editableResult.error;
        }

        setRows(
          (statusResult.data ?? []) as
            DailyManagerStatus[]
        );
        setEditable(
          editableResult.data === true
        );
      }
      catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "일실적 상태를 불러오지 못했습니다."
        );
      }
      finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [
      reportDate,
      supabase,
    ]
  );

  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        void loadData();
      },
      0
    );

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadData]);

  useEffect(() => {
    const reload = () => {
      void loadData(false);
    };

    const channel = supabase
      .channel(
        `daily-closing-status-${reportDate}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "daily_manager_attendance",
          filter:
            `attendance_date=eq.${reportDate}`,
        },
        reload
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "daily_reports",
          filter:
            `report_date=eq.${reportDate}`,
        },
        reload
      )
      .subscribe();

    const handleStatusChanged = (
      event: Event
    ) => {
      const customEvent =
        event as CustomEvent<{
          reportDate?: string;
        }>;

      if (
        !customEvent.detail
          ?.reportDate ||
        customEvent.detail
          .reportDate === reportDate
      ) {
        reload();
      }
    };

    window.addEventListener(
      "daily-performance-status-changed",
      handleStatusChanged
    );

    return () => {
      window.removeEventListener(
        "daily-performance-status-changed",
        handleStatusChanged
      );
      void supabase.removeChannel(
        channel
      );
    };
  }, [
    loadData,
    reportDate,
    supabase,
  ]);

  const summary = useMemo(
    () => {
      return rows.reduce(
        (acc, row) => {
          if (row.is_present) {
            acc.present += 1;
          }

          switch (
            row.status_code
          ) {
            case "input_complete":
              acc.input += 1;
              break;

            case "no_performance":
              acc.noPerformance += 1;
              break;

            case "incomplete":
              acc.incomplete += 1;
              break;

            case "attendance_mismatch":
              acc.mismatch += 1;
              break;

            case "offday_performance":
              acc.offdayPerformance += 1;
              break;

            default:
              acc.holiday += 1;
          }

          return acc;
        },
        {
          present: 0,
          input: 0,
          noPerformance: 0,
          incomplete: 0,
          holiday: 0,
          mismatch: 0,
          offdayPerformance: 0,
        }
      );
    },
    [rows]
  );

  const changeNoPerformance =
    useCallback(
      async (
        row: DailyManagerStatus,
        confirmNoPerformance: boolean
      ) => {
        if (!editable) {
          setErrorMessage(
            "마감이 확정된 날짜입니다. 마감보고에서 [수정]을 누른 뒤 변경해주세요."
          );
          return;
        }

        if (
          confirmNoPerformance &&
          !row.is_present
        ) {
          setErrorMessage(
            `${row.manager_name} 매니저를 먼저 상단의 출근 매니저로 선택해주세요.`
          );
          return;
        }

        if (
          row.has_actual_performance &&
          confirmNoPerformance
        ) {
          setErrorMessage(
            `${row.manager_name} 매니저는 이미 일실적이 입력되어 있어 무실적 확정할 수 없습니다.`
          );
          return;
        }

        if (
          confirmNoPerformance &&
          !window.confirm(
            `${reportDate} ${row.manager_name} 매니저를 무실적 확정할까요?\n\n출근한 날이지만 실제 실적이 0인 근무일로 기록됩니다.`
          )
        ) {
          return;
        }

        if (
          !confirmNoPerformance &&
          !window.confirm(
            `${row.manager_name} 매니저의 무실적 확정을 취소할까요?\n\n출근 선택은 유지되므로 취소 후 상태는 미완료가 됩니다.`
          )
        ) {
          return;
        }

        setBusyManagerId(
          row.manager_id
        );
        setErrorMessage(null);
        setMessage(null);

        try {
          const result =
            confirmNoPerformance
              ? await supabase.rpc(
                  "confirm_daily_manager_no_performance",
                  {
                    p_report_date:
                      reportDate,
                    p_manager_id:
                      row.manager_id,
                  }
                )
              : await supabase.rpc(
                  "cancel_daily_manager_no_performance",
                  {
                    p_report_date:
                      reportDate,
                    p_manager_id:
                      row.manager_id,
                  }
                );

          if (result.error) {
            throw result.error;
          }

          setMessage(
            confirmNoPerformance
              ? `${row.manager_name} 매니저를 무실적 확정했습니다.`
              : `${row.manager_name} 매니저의 무실적 확정을 취소했습니다.`
          );

          await loadData(false);
          router.refresh();
          onChanged?.();

          window.dispatchEvent(
            new CustomEvent(
              "daily-performance-status-changed",
              {
                detail: {
                  reportDate,
                },
              }
            )
          );
        }
        catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "일실적 상태 변경 중 오류가 발생했습니다."
          );
        }
        finally {
          setBusyManagerId(null);
        }
      },
      [
        editable,
        loadData,
        onChanged,
        reportDate,
        router,
        supabase,
      ]
    );

  return (
    <section
      className={`overflow-hidden rounded-[22px] border border-[#E5E7EA] bg-white shadow-sm ${className}`}
    >
      <div className="flex flex-col gap-3 border-b border-[#ECEEF1] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck
              size={17}
              className="text-[#A50034]"
            />
            <h3 className="text-[16px] font-black tracking-[-0.025em] text-[#25282D]">
              매니저별 일실적 상태
            </h3>
          </div>

          <p className="mt-1 text-[12px] leading-5 text-[#969AA2]">
            출근자는 입력완료 또는 무실적 확정이 필요하며, 실제 휴무자의 저장완료 귀속실적은 휴무실적으로 별도 표시됩니다.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 text-[10px] font-black">
          <span className="rounded-full bg-[#FFF1F4] px-2.5 py-1 text-[#A50034]">
            출근 {summary.present}
          </span>
          <span className="rounded-full bg-[#EDF8F1] px-2.5 py-1 text-[#287348]">
            입력 {summary.input}
          </span>
          <span className="rounded-full bg-[#EEF4FF] px-2.5 py-1 text-[#315F9B]">
            무실적 {summary.noPerformance}
          </span>
          <span className="rounded-full bg-[#FFF9EF] px-2.5 py-1 text-[#986219]">
            휴무실적 {summary.offdayPerformance}
          </span>
          <span className="rounded-full bg-[#FFF2E2] px-2.5 py-1 text-[#986219]">
            미완료 {summary.incomplete}
          </span>
          <span className="rounded-full bg-[#F2F3F5] px-2.5 py-1 text-[#737881]">
            휴무 {summary.holiday}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[132px] items-center justify-center px-5 py-6">
          <span className="inline-flex items-center gap-2 text-[12px] font-bold text-[#8B9098]">
            <LoaderCircle
              size={15}
              className="animate-spin"
            />
            매니저 상태 확인 중
          </span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-[#ECEEF1] bg-[#FAFAFB] text-[10px] font-black text-[#777C84]">
                <th className="px-5 py-3 text-left">매니저</th>
                <th className="px-4 py-3 text-center">출근</th>
                <th className="px-4 py-3 text-center">상태</th>
                <th className="px-4 py-3 text-left">판정 기준</th>
                <th className="px-5 py-3 text-right">처리</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const style =
                  getStatusStyle(
                    row.status_code
                  );
                const Icon = style.Icon;
                const busy =
                  busyManagerId ===
                  row.manager_id;

                return (
                  <tr
                    key={row.manager_id}
                    className="border-b border-[#F0F1F3] last:border-b-0"
                  >
                    <td className="px-5 py-3.5 text-[12px] font-black text-[#34383E]">
                      {row.manager_name}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      {row.is_present ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF1F4] px-2 py-1 text-[9px] font-black text-[#A50034]">
                          <UserCheck size={11} />
                          출근
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-[#A0A4AA]">
                          -
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-black ${style.badge}`}
                      >
                        <Icon size={11} />
                        {style.label}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-[11px] font-semibold text-[#777C84]">
                      {getBasisText(row)}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      {row.status_code ===
                        "no_performance" ? (
                        <button
                          type="button"
                          disabled={
                            !editable || busy
                          }
                          onClick={() =>
                            void changeNoPerformance(
                              row,
                              false
                            )
                          }
                          className="inline-flex h-[32px] items-center justify-center gap-1.5 rounded-[9px] border border-[#DDE0E5] bg-white px-3 text-[10px] font-black text-[#62676F] transition hover:bg-[#F7F8F9] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy ? (
                            <LoaderCircle
                              size={12}
                              className="animate-spin"
                            />
                          ) : (
                            <RotateCcw
                              size={12}
                            />
                          )}
                          확정취소
                        </button>
                      ) : row.status_code ===
                          "incomplete" ? (
                        <button
                          type="button"
                          disabled={
                            !editable || busy
                          }
                          onClick={() =>
                            void changeNoPerformance(
                              row,
                              true
                            )
                          }
                          className="inline-flex h-[32px] items-center justify-center gap-1.5 rounded-[9px] bg-[#315F9B] px-3 text-[10px] font-black text-white transition hover:bg-[#294F82] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy ? (
                            <LoaderCircle
                              size={12}
                              className="animate-spin"
                            />
                          ) : (
                            <ShieldCheck
                              size={12}
                            />
                          )}
                          무실적 확정
                        </button>
                      ) : row.status_code ===
                          "attendance_mismatch" ? (
                        <span className="text-[10px] font-black text-[#A50034]">
                          상단 출근선택 필요
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-[#A0A4AA]">
                          -
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(errorMessage || message) && (
        <div className="border-t border-[#ECEEF1] px-5 py-3 sm:px-6">
          {errorMessage ? (
            <p className="flex items-center gap-2 text-[11px] font-bold text-[#A50034]">
              <AlertCircle size={13} />
              {errorMessage}
            </p>
          ) : message ? (
            <p className="flex items-center gap-2 text-[11px] font-bold text-[#287348]">
              <CheckCircle2 size={13} />
              {message}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
