"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  LoaderCircle,
  Store,
  UserCheck,
} from "lucide-react";

import {
  createClient,
} from "@/lib/supabase/client";

import type {
  DailyManager,
} from "@/lib/daily-performance";


type DayStatus =
  | "normal"
  | "store_holiday"
  | "holiday_open";


type AttendanceRow = {
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


type DayState = {
  business_date: string;
  day_status: DayStatus;
  day_status_label: string;
  holiday_name: string | null;
  is_override: boolean;
};


type Props = {
  reportDate: string;
  managers: DailyManager[];
};


function rowStatusInfo(
  row: AttendanceRow
) {
  switch (row.status_code) {
    case "input_complete":
      return {
        label: "입력완료",
        className:
          "bg-[#EAF6EE] text-[#287348]",
      };

    case "no_performance":
      return {
        label: "무실적",
        className:
          "bg-[#EEF4FF] text-[#315F9B]",
      };

    case "incomplete":
      return {
        label: "미완료",
        className:
          "bg-[#FFF3E1] text-[#986219]",
      };

    case "attendance_mismatch":
      return {
        label: "출근선택 필요",
        className:
          "bg-[#FFF0F3] text-[#A50034]",
      };

    case "offday_performance":
      return {
        label: "휴무실적",
        className:
          "bg-[#FFF2E2] text-[#986219]",
      };

    default:
      return {
        label: "휴무",
        className:
          "bg-[#F1F2F4] text-[#777C84]",
      };
  }
}


export default function DailyAttendanceSelector({
  reportDate,
  managers,
}: Props) {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [rows, setRows] =
    useState<AttendanceRow[]>([]);
  const [dayState, setDayState] =
    useState<DayState | null>(null);
  const [editable, setEditable] =
    useState(false);
  const [loading, setLoading] =
    useState(true);
  const [busyManagerId, setBusyManagerId] =
    useState<string | null>(null);
  const [dayActionBusy, setDayActionBusy] =
    useState(false);
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
          dayResult,
          statusResult,
          editableResult,
        ] = await Promise.all([
          supabase.rpc(
            "get_store_day_state",
            {
              p_business_date:
                reportDate,
            }
          ),
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

        if (dayResult.error) {
          throw dayResult.error;
        }

        if (statusResult.error) {
          throw statusResult.error;
        }

        if (editableResult.error) {
          throw editableResult.error;
        }

        setDayState(
          dayResult.data as DayState
        );
        setRows(
          (statusResult.data ?? []) as
            AttendanceRow[]
        );
        setEditable(
          editableResult.data === true
        );
      }
      catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "출근정보를 불러오지 못했습니다."
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
        `daily-attendance-${reportDate}`
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
          table:
            "store_daily_calendar",
          filter:
            `business_date=eq.${reportDate}`,
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

  const rowMap = useMemo(
    () =>
      new Map(
        rows.map((row) => [
          row.manager_id,
          row,
        ])
      ),
    [rows]
  );

  const orderedRows = useMemo(
    () =>
      managers.map((manager) => {
        const existing =
          rowMap.get(manager.id);

        return existing ?? {
          manager_id: manager.id,
          manager_name: manager.name,
          is_present: false,
          status_code:
            "holiday" as const,
          status_label: "휴무",
          has_actual_performance:
            false,
          no_performance_confirmed:
            false,
          confirmed_at: null,
        };
      }),
    [managers, rowMap]
  );

  const summary = useMemo(
    () => {
      const presentRows =
        orderedRows.filter(
          (row) => row.is_present
        );

      const input =
        presentRows.filter(
          (row) =>
            row.status_code ===
            "input_complete"
        ).length;

      const noPerformance =
        presentRows.filter(
          (row) =>
            row.status_code ===
            "no_performance"
        ).length;

      const incomplete =
        presentRows.length -
        input -
        noPerformance;

      const mismatch =
        orderedRows.filter(
          (row) =>
            row.status_code ===
            "attendance_mismatch"
        ).length;

      const offdayPerformance =
        orderedRows.filter(
          (row) =>
            row.status_code ===
            "offday_performance"
        ).length;

      return {
        present:
          presentRows.length,
        input,
        noPerformance,
        incomplete,
        mismatch,
        offdayPerformance,
      };
    },
    [orderedRows]
  );

  const toggleAttendance =
    useCallback(
      async (
        row: AttendanceRow
      ) => {
        if (!editable) {
          setErrorMessage(
            "마감이 확정된 날짜입니다. 마감보고에서 [수정] 후 변경해주세요."
          );
          return;
        }

        if (
          dayState?.day_status ===
          "store_holiday"
        ) {
          setErrorMessage(
            "지점휴무일입니다. 실제 영업한 경우 먼저 휴일영업으로 전환해주세요."
          );
          return;
        }

        if (
          row.is_present &&
          row.status_code ===
            "no_performance"
        ) {
          setErrorMessage(
            `${row.manager_name} 매니저는 무실적 확정이 있어 출근 선택을 해제할 수 없습니다. 먼저 무실적 확정을 취소해주세요.`
          );
          return;
        }

        if (
          row.is_present &&
          row.status_code ===
            "input_complete"
        ) {
          const confirmed =
            window.confirm(
              `${row.manager_name} 매니저에게 입력완료 실적이 있습니다.\n\n실제로 휴무였다면 출근을 해제하고 기존 실적을 '휴무 귀속실적'으로 전환합니다.\n\n계속하시겠습니까?`
            );

          if (!confirmed) {
            return;
          }

          setBusyManagerId(
            row.manager_id
          );
          setErrorMessage(null);
          setMessage(null);

          try {
            const result =
              await supabase.rpc(
                "convert_daily_attendance_to_offday_attribution",
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
              `${row.manager_name} 매니저의 출근을 해제하고 기존 실적을 휴무 귀속실적으로 전환했습니다.`
            );

            await loadData(false);

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
                : "휴무 귀속실적 전환 중 오류가 발생했습니다."
            );

            await loadData(false);
          }
          finally {
            setBusyManagerId(null);
          }

          return;
        }

        if (
          !row.is_present &&
          row.status_code ===
            "offday_performance"
        ) {
          const confirmed =
            window.confirm(
              `${row.manager_name} 매니저는 현재 '휴무실적' 상태입니다.\n\n출근자로 선택하면 기존 휴무 귀속실적이 일반 출근실적으로 자동 전환됩니다.\n\n계속하시겠습니까?`
            );

          if (!confirmed) {
            return;
          }
        }

        setBusyManagerId(
          row.manager_id
        );
        setErrorMessage(null);
        setMessage(null);

        try {
          const result =
            await supabase.rpc(
              "set_daily_manager_attendance",
              {
                p_report_date:
                  reportDate,
                p_manager_id:
                  row.manager_id,
                p_is_present:
                  !row.is_present,
              }
            );

          if (result.error) {
            throw result.error;
          }

          setMessage(
            `${row.manager_name} 매니저를 ${
              row.is_present
                ? "출근 해제"
                : "출근 등록"
            }했습니다.`
          );

          await loadData(false);

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
              : "출근정보 저장 중 오류가 발생했습니다."
          );
          await loadData(false);
        }
        finally {
          setBusyManagerId(null);
        }
      },
      [
        dayState?.day_status,
        editable,
        loadData,
        reportDate,
        supabase,
      ]
    );

  const convertToHolidayOpen =
    useCallback(
      async () => {
        if (!editable) {
          setErrorMessage(
            "마감이 확정된 날짜는 운영상태를 변경할 수 없습니다."
          );
          return;
        }

        if (
          !window.confirm(
            `${reportDate} 지점휴무일을 휴일영업으로 전환할까요?\n\n전환 후 출근 매니저를 선택하고 일반 영업일과 동일하게 일마감을 진행합니다.`
          )
        ) {
          return;
        }

        setDayActionBusy(true);
        setErrorMessage(null);
        setMessage(null);

        try {
          const result =
            await supabase.rpc(
              "set_store_day_holiday_open",
              {
                p_business_date:
                  reportDate,
              }
            );

          if (result.error) {
            throw result.error;
          }

          setMessage(
            "휴일영업으로 전환했습니다. 출근 매니저를 선택해주세요."
          );
          await loadData(false);
        }
        catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "휴일영업 전환 중 오류가 발생했습니다."
          );
        }
        finally {
          setDayActionBusy(false);
        }
      },
      [
        editable,
        loadData,
        reportDate,
        supabase,
      ]
    );

  if (loading) {
    return (
      <section className="flex min-h-[118px] items-center justify-center rounded-[20px] border border-[#E5E7EA] bg-white px-5 py-5">
        <span className="inline-flex items-center gap-2 text-[12px] font-bold text-[#858A92]">
          <LoaderCircle
            size={15}
            className="animate-spin"
          />
          출근정보 확인 중
        </span>
      </section>
    );
  }

  if (errorMessage && !dayState) {
    return (
      <section className="rounded-[20px] border border-[#F0CDD3] bg-[#FFF5F6] px-5 py-4 text-[12px] font-bold text-[#A50034]">
        {errorMessage}
      </section>
    );
  }

  const isStoreHoliday =
    dayState?.day_status ===
    "store_holiday";

  const isHolidayOpen =
    dayState?.day_status ===
    "holiday_open";

  return (
    <section className="overflow-hidden rounded-[22px] border border-[#E5E7EA] bg-white shadow-sm">
      <div className="border-b border-[#ECEEF1] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <UserCheck
                size={18}
                className="text-[#A50034]"
              />
              <h3 className="text-[16px] font-black tracking-[-0.025em] text-[#25282D]">
                오늘 출근 매니저
              </h3>
            </div>

            <p className="mt-1 text-[12px] leading-5 text-[#92969D]">
              이름을 선택하면 즉시 저장됩니다. 이 출근기록이 월·연간 실제 근무일수의 기준이 됩니다.
            </p>
          </div>

          <span
            className={[
              "inline-flex h-[32px] items-center gap-1.5 self-start rounded-full px-3 text-[10px] font-black",
              isStoreHoliday
                ? "bg-[#F1F2F4] text-[#6F747C]"
                : isHolidayOpen
                  ? "bg-[#FFF2E2] text-[#986219]"
                  : "bg-[#EDF8F1] text-[#287348]",
            ].join(" ")}
          >
            {isStoreHoliday ? (
              <Building2 size={13} />
            ) : (
              <Store size={13} />
            )}
            {dayState?.day_status_label ??
              "정상영업"}
            {dayState?.holiday_name
              ? ` · ${dayState.holiday_name}`
              : ""}
          </span>
        </div>
      </div>

      {isStoreHoliday ? (
        <div className="p-5 sm:p-6">
          <div className="rounded-[16px] border border-[#E2E4E7] bg-[#F7F8F9] px-4 py-4">
            <div className="flex items-start gap-3">
              <Building2
                size={18}
                className="mt-0.5 shrink-0 text-[#6F747C]"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black text-[#44484E]">
                  지점 전체 휴무일입니다.
                </p>
                <p className="mt-1 text-[11px] font-medium leading-5 text-[#7E838B]">
                  일마감을 진행하지 않아도 됩니다. 실제로 출근하여 영업한 경우에만 휴일영업으로 전환해주세요.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              void convertToHolidayOpen()
            }
            disabled={
              !editable ||
              dayActionBusy
            }
            className="mt-3 inline-flex h-[40px] items-center justify-center gap-2 rounded-[11px] bg-[#A50034] px-4 text-[11px] font-black text-white transition hover:bg-[#8D002C] disabled:cursor-not-allowed disabled:bg-[#D7D9DE]"
          >
            {dayActionBusy ? (
              <LoaderCircle
                size={14}
                className="animate-spin"
              />
            ) : (
              <Store size={14} />
            )}
            휴일영업으로 전환
          </button>
        </div>
      ) : (
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap gap-2">
            {orderedRows.map((row) => {
              const status =
                rowStatusInfo(row);
              const busy =
                busyManagerId ===
                row.manager_id;

              return (
                <button
                  key={row.manager_id}
                  type="button"
                  disabled={
                    !editable ||
                    busyManagerId !== null
                  }
                  onClick={() =>
                    void toggleAttendance(
                      row
                    )
                  }
                  className={[
                    "min-w-[112px] rounded-[13px] border px-3 py-2.5 text-left transition",
                    row.is_present
                      ? "border-[#A50034] bg-[#FFF7F9] shadow-[0_0_0_1px_rgba(165,0,52,0.04)]"
                      : row.status_code ===
                          "offday_performance"
                        ? "border-[#E7D9BC] bg-[#FFF9EF] hover:border-[#D8C49C]"
                        : "border-[#E2E4E7] bg-white hover:border-[#C9CCD1] hover:bg-[#FAFAFB]",
                    !editable
                      ? "cursor-not-allowed opacity-60"
                      : "",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={[
                        "text-[12px] font-black",
                        row.is_present
                          ? "text-[#A50034]"
                          : "text-[#454950]",
                      ].join(" ")}
                    >
                      {row.manager_name}
                    </span>

                    {busy ? (
                      <LoaderCircle
                        size={13}
                        className="animate-spin text-[#A50034]"
                      />
                    ) : row.is_present ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#A50034] text-white">
                        <Check size={12} />
                      </span>
                    ) : null}
                  </div>

                  <span
                    className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[9px] font-black ${status.className}`}
                  >
                    {status.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[14px] bg-[#F7F8F9] px-4 py-3 text-[11px] font-bold text-[#686D75]">
            <span>
              출근 <strong className="text-[#25282D]">{summary.present}</strong>명
            </span>
            <span>
              입력완료 <strong className="text-[#287348]">{summary.input}</strong>명
            </span>
            <span>
              휴무실적 <strong className="text-[#986219]">{summary.offdayPerformance}</strong>명
            </span>
            <span>
              무실적 <strong className="text-[#315F9B]">{summary.noPerformance}</strong>명
            </span>
            <span>
              미완료 <strong className={summary.incomplete > 0 ? "text-[#A50034]" : "text-[#777C84]"}>{summary.incomplete}</strong>명
            </span>
          </div>

          {summary.present === 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-[13px] border border-[#F1DFC0] bg-[#FFF9EF] px-3.5 py-3 text-[11px] font-bold leading-5 text-[#87621E]">
              <AlertCircle
                size={14}
                className="mt-0.5 shrink-0"
              />
              출근 매니저를 한 명 이상 선택해야 일마감을 확정할 수 있습니다.
            </div>
          )}

          {summary.mismatch > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-[13px] border border-[#F0CDD3] bg-[#FFF5F6] px-3.5 py-3 text-[11px] font-bold leading-5 text-[#A50034]">
              <AlertCircle
                size={14}
                className="mt-0.5 shrink-0"
              />
              출근 미선택 상태의 일반실적 또는 무실적 확정이 있습니다. 실제 휴무자의 귀속실적이면 해당 매니저 실적 화면에서 [휴무 귀속실적 입력]으로 전환해주세요.
            </div>
          )}
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
