"use client";

import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  RotateCcw,
  Umbrella,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createClient,
} from "@/lib/supabase/client";


type WorkContextState = {
  report_date: string;
  manager_id: string;
  report_id: string | null;
  report_status: string | null;
  is_present: boolean;
  work_context:
    | "attendance"
    | "offday_attribution";
  is_offday_attribution: boolean;
  has_actual_performance: boolean;
  can_input: boolean;
  requires_offday_confirmation: boolean;
};


type Props = {
  reportDate: string;
  managerId: string;
  managerName?: string;
  reportId: string | null;
  onStateChange: (
    canInput: boolean
  ) => void;
  onCancelled?: () => void;
};


export default function OffdayAttributionGuard({
  reportDate,
  managerId,
  managerName = "선택 매니저",
  reportId,
  onStateChange,
  onCancelled,
}: Props) {
  const supabase =
    useMemo(
      () => createClient(),
      []
    );

  const [
    state,
    setState,
  ] =
    useState<WorkContextState | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const loadState =
    useCallback(
      async (
        showLoading = true
      ) => {
        if (
          !reportDate ||
          !managerId
        ) {
          onStateChange(
            false
          );
          return;
        }

        if (showLoading) {
          setLoading(
            true
          );
        }

        setErrorMessage(
          ""
        );

        try {
          const {
            data,
            error,
          } =
            await supabase.rpc(
              "get_daily_report_work_context",
              {
                p_report_date:
                  reportDate,
                p_manager_id:
                  managerId,
              }
            );

          if (error) {
            throw error;
          }

          const nextState =
            data as WorkContextState;

          setState(
            nextState
          );

          onStateChange(
            nextState.can_input ===
              true
          );
        }
        catch (error) {
          console.error(
            "휴무 귀속실적 상태 조회 오류:",
            error
          );

          setState(
            null
          );

          onStateChange(
            false
          );

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "출근/귀속실적 상태를 확인하지 못했습니다."
          );
        }
        finally {
          if (
            showLoading
          ) {
            setLoading(
              false
            );
          }
        }
      },
      [
        managerId,
        onStateChange,
        reportDate,
        supabase,
      ]
    );

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          void loadState();
        },
        0
      );

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [loadState]);

  useEffect(() => {
    const reload = () => {
      void loadState(
        false
      );
    };

    const channel =
      supabase
        .channel(
          `offday-attribution-${reportDate}-${managerId}`
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
              "daily_reports",
            filter:
              `report_date=eq.${reportDate}`,
          },
          reload
        )
        .subscribe();

    const handleChanged = (
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
          .reportDate ===
          reportDate
      ) {
        reload();
      }
    };

    window.addEventListener(
      "daily-performance-status-changed",
      handleChanged
    );

    return () => {
      window.removeEventListener(
        "daily-performance-status-changed",
        handleChanged
      );

      void supabase.removeChannel(
        channel
      );
    };
  }, [
    loadState,
    managerId,
    reportDate,
    supabase,
  ]);

  const notifyChanged =
    useCallback(() => {
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
    }, [reportDate]);

  const enableOffdayAttribution =
    useCallback(
      async () => {
        const targetReportId =
          reportId ??
          state?.report_id ??
          null;

        if (
          !targetReportId
        ) {
          setErrorMessage(
            "일실적 Report가 준비되지 않았습니다. 잠시 후 다시 시도해주세요."
          );
          return;
        }

        if (
          !window.confirm(
            `${managerName} 매니저는 ${reportDate} 휴무 상태입니다.\n\n상담·소개 고객 등 실제 휴무 매니저에게 귀속할 실적을 입력하시겠습니까?\n\n실적에는 포함되지만 실제 근무일수에는 포함되지 않습니다.`
          )
        ) {
          return;
        }

        setBusy(
          true
        );
        setErrorMessage(
          ""
        );

        try {
          const {
            error,
          } =
            await supabase.rpc(
              "enable_daily_report_offday_attribution",
              {
                p_report_id:
                  targetReportId,
              }
            );

          if (error) {
            throw error;
          }

          await loadState(
            false
          );

          notifyChanged();
        }
        catch (error) {
          console.error(
            "휴무 귀속실적 전환 오류:",
            error
          );

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "휴무 귀속실적 입력 전환 중 오류가 발생했습니다."
          );
        }
        finally {
          setBusy(
            false
          );
        }
      },
      [
        loadState,
        managerName,
        notifyChanged,
        reportDate,
        reportId,
        state?.report_id,
        supabase,
      ]
    );

  const cancelOffdayAttribution =
    useCallback(
      async () => {
        const targetReportId =
          reportId ??
          state?.report_id ??
          null;

        if (
          !targetReportId
        ) {
          setErrorMessage(
            "일실적 Report가 준비되지 않았습니다."
          );
          return;
        }

        if (
          !window.confirm(
            `${managerName} 매니저의 휴무 귀속실적 입력을 취소할까요?\n\n취소하면 현재 입력된 일실적 값이 모두 초기화되고 다시 '휴무' 상태로 돌아갑니다.\n\n이 작업은 일마감 확정 전까지 가능합니다.`
          )
        ) {
          return;
        }

        setBusy(
          true
        );
        setErrorMessage(
          ""
        );

        try {
          const {
            error,
          } =
            await supabase.rpc(
              "cancel_daily_report_offday_attribution",
              {
                p_report_id:
                  targetReportId,
              }
            );

          if (error) {
            throw error;
          }

          /*
           * DB에서 모든 값이 0으로 초기화됩니다.
           * Workspace에도 즉시 빈칸 상태를 반영해서
           * 새로고침 없이 화면과 DB가 일치하도록 합니다.
           */
          onCancelled?.();

          await loadState(
            false
          );

          notifyChanged();
        }
        catch (error) {
          console.error(
            "휴무 귀속실적 입력 취소 오류:",
            error
          );

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "휴무 귀속실적 입력 취소 중 오류가 발생했습니다."
          );
        }
        finally {
          setBusy(
            false
          );
        }
      },
      [
        loadState,
        managerName,
        notifyChanged,
        onCancelled,
        reportId,
        state?.report_id,
        supabase,
      ]
    );

  if (loading) {
    return (
      <section className="flex min-h-[66px] items-center gap-2 rounded-[15px] border border-[#E5E7EA] bg-white px-4 py-3 text-[11px] font-bold text-[#858A92]">
        <LoaderCircle
          size={14}
          className="animate-spin"
        />
        출근/귀속실적 상태 확인 중
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="rounded-[15px] border border-[#F0CDD3] bg-[#FFF5F6] px-4 py-3">
        <div className="flex items-start gap-2 text-[11px] font-bold leading-5 text-[#A50034]">
          <AlertCircle
            size={14}
            className="mt-0.5 shrink-0"
          />
          <span>
            {errorMessage}
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setErrorMessage(
              ""
            );
            void loadState(
              false
            );
          }}
          className="mt-2 inline-flex h-[30px] items-center justify-center rounded-[9px] border border-[#E2C3CC] bg-white px-3 text-[9px] font-black text-[#A50034]"
          style={{
            whiteSpace: "nowrap",
          }}
        >
          상태 다시 확인
        </button>
      </section>
    );
  }

  if (
    !state ||
    state.is_present
  ) {
    return null;
  }

  if (
    state.is_offday_attribution
  ) {
    return (
      <section className="rounded-[15px] border border-[#E7D9BC] bg-[#FFF9EF] px-4 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-2">
            <Umbrella
              size={16}
              className="mt-0.5 shrink-0 text-[#986219]"
            />

            <div className="min-w-0">
              <p className="text-[12px] font-black text-[#755217]">
                휴무 · 귀속실적 입력모드
              </p>

              <p className="mt-1 text-[10px] font-semibold leading-5 text-[#8B744C]">
                {managerName} 매니저는 휴무이며, 입력한 실적은 해당 매니저에게 귀속됩니다. 실제 근무일수에는 포함되지 않습니다.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span
              className="inline-flex h-[34px] items-center gap-1 rounded-full border border-[#E2D2B2] bg-white px-3 text-[9px] font-black text-[#986219]"
              style={{
                whiteSpace: "nowrap",
              }}
            >
              <CheckCircle2
                size={11}
              />
              입력 가능
            </span>

            <button
              type="button"
              onClick={() =>
                void cancelOffdayAttribution()
              }
              disabled={
                busy
              }
              className="inline-flex h-[36px] items-center justify-center gap-1.5 rounded-[10px] border px-3.5 text-[10px] font-black transition disabled:cursor-not-allowed disabled:opacity-45"
              style={{
                backgroundColor:
                  "#FFFFFF",
                borderColor:
                  "#B8893D",
                color:
                  "#815313",
                minWidth: 132,
                whiteSpace:
                  "nowrap",
                flexShrink: 0,
              }}
              title="입력값을 모두 초기화하고 휴무 상태로 돌아갑니다."
            >
              {busy ? (
                <LoaderCircle
                  size={13}
                  className="animate-spin"
                />
              ) : (
                <RotateCcw
                  size={13}
                />
              )}
              휴무실적 입력 취소
            </button>
          </div>
        </div>

        {state.has_actual_performance && (
          <p className="mt-3 rounded-[10px] bg-white/75 px-3 py-2 text-[9px] font-bold leading-4 text-[#8A6C3C]">
            휴무실적 입력을 취소하면 현재 입력된 모든 일실적 값이 자동으로 초기화됩니다.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-[15px] border border-[#F0D9C2] bg-[#FFF9EF] px-4 py-4">
      <div className="flex items-start gap-3">
        <Umbrella
          size={16}
          className="mt-0.5 shrink-0 text-[#986219]"
        />

        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-black text-[#755217]">
            {managerName} 매니저는 오늘 휴무입니다.
          </p>

          <p className="mt-1 text-[10px] font-semibold leading-5 text-[#8B744C]">
            상담·소개 고객 등 휴무 매니저에게 귀속할 판매실적이 있는 경우에만 아래 버튼을 눌러 입력해주세요.
          </p>

          <button
            type="button"
            onClick={() =>
              void enableOffdayAttribution()
            }
            disabled={
              busy ||
              !reportId
            }
            className="mt-3 inline-flex h-[38px] items-center justify-center gap-1.5 rounded-[10px] px-4 text-[10px] font-black transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor:
                busy ||
                !reportId
                  ? "#BFA980"
                  : "#986219",
              color: "#FFFFFF",
              border:
                "1px solid #986219",
              minWidth: 150,
              whiteSpace:
                "nowrap",
              flexShrink: 0,
              boxShadow:
                "0 1px 2px rgba(0,0,0,0.08)",
            }}
          >
            {busy ? (
              <LoaderCircle
                size={13}
                className="animate-spin"
              />
            ) : (
              <Umbrella
                size={13}
              />
            )}
            휴무 귀속실적 입력
          </button>
        </div>
      </div>
    </section>
  );
}
