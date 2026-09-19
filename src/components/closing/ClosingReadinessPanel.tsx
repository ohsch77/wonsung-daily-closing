"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CheckCircle2,
  CircleAlert,
  CreditCard,
  Database,
  LoaderCircle,
  UsersRound,
  WalletCards,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";


export type ClosingReadiness = {
  report_date: string;
  can_close: boolean;
  daily: {
    ready: boolean;
    total: number;
    input_complete: number;
    no_performance: number;
    holiday: number;
  };
  system: {
    ready: boolean;
    required: number;
    applied: number;
    draft_count: number;
    missing: string[];
  };
  card: {
    ready: boolean;
    required: number;
    applied: number;
    draft_count: number;
    missing: string[];
  };
};


type AttendanceReadiness = {
  report_date: string;
  day_status:
    | "normal"
    | "store_holiday"
    | "holiday_open"
    | string;
  day_status_label: string;
  holiday_name: string | null;
  closing_required: boolean;
  ready: boolean;
  attendance_count: number;
  input_complete_count: number;
  no_performance_count: number;
  complete_count: number;
  incomplete_count: number;
  mismatch_count: number;
  holiday_count: number;
  incomplete_names: string[];
  mismatch_names: string[];
};


type ClosingReadinessView =
  ClosingReadiness & {
    attendance:
      AttendanceReadiness;
    cash: {
      ready: boolean;
      status: string | null;
      confirmed_at: string | null;
    };
  };


type Props = {
  reportDate: string;
  className?: string;
  refreshKey?: string | number;
  onCanCloseChange?: (
    canClose: boolean
  ) => void;
};


function StatusCard({
  title,
  caption,
  ready,
  Icon,
}: {
  title: string;
  caption: string;
  ready: boolean;
  Icon: typeof UsersRound;
}) {
  return (
    <div
      className={[
        "rounded-[16px] border p-4",
        ready
          ? "border-[#D6E9DC] bg-[#F5FBF7]"
          : "border-[#F0D9C2] bg-[#FFF9EF]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black text-[#777C85]">
            {title}
          </p>

          <p className="mt-2 text-[12px] font-bold leading-5 text-[#4E535B]">
            {caption}
          </p>
        </div>

        <div
          className={[
            "rounded-full bg-white p-2",
            ready
              ? "text-[#287348]"
              : "text-[#9A6513]",
          ].join(" ")}
        >
          <Icon
            size={16}
          />
        </div>
      </div>

      <div
        className={[
          "mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black",
          ready
            ? "bg-[#E5F5EA] text-[#287348]"
            : "bg-[#FFF0D8] text-[#9A6513]",
        ].join(" ")}
      >
        {ready ? (
          <CheckCircle2
            size={12}
          />
        ) : (
          <CircleAlert
            size={12}
          />
        )}

        {ready
          ? "완료"
          : "확인 필요"}
      </div>
    </div>
  );
}


function normalizeStringArray(
  value: unknown
) {
  return Array.isArray(value)
    ? value.map(
        (item) =>
          String(item)
      )
    : [];
}


function normalizeAttendanceReadiness(
  value: unknown
): AttendanceReadiness {
  const row =
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(value)
      ? value as
          Record<
            string,
            unknown
          >
      : {};

  const numberValue =
    (
      key: string
    ) => {
      const parsed =
        Number(
          row[key] ??
          0
        );

      return Number.isFinite(
        parsed
      )
        ? Math.max(
            0,
            Math.trunc(
              parsed
            )
          )
        : 0;
    };

  return {
    report_date:
      String(
        row.report_date ??
        ""
      ),
    day_status:
      String(
        row.day_status ??
        "normal"
      ),
    day_status_label:
      String(
        row.day_status_label ??
        "정상영업"
      ),
    holiday_name:
      row.holiday_name ===
        null ||
      row.holiday_name ===
        undefined ||
      row.holiday_name ===
        ""
        ? null
        : String(
            row.holiday_name
          ),
    closing_required:
      row.closing_required !==
      false,
    ready:
      row.ready ===
      true,
    attendance_count:
      numberValue(
        "attendance_count"
      ),
    input_complete_count:
      numberValue(
        "input_complete_count"
      ),
    no_performance_count:
      numberValue(
        "no_performance_count"
      ),
    complete_count:
      numberValue(
        "complete_count"
      ),
    incomplete_count:
      numberValue(
        "incomplete_count"
      ),
    mismatch_count:
      numberValue(
        "mismatch_count"
      ),
    holiday_count:
      numberValue(
        "holiday_count"
      ),
    incomplete_names:
      normalizeStringArray(
        row.incomplete_names
      ),
    mismatch_names:
      normalizeStringArray(
        row.mismatch_names
      ),
  };
}


function getErrorMessage(
  error: unknown,
  fallback: string
) {
  if (
    error &&
    typeof error ===
      "object"
  ) {
    const row =
      error as
        Record<
          string,
          unknown
        >;

    const message =
      String(
        row.message ??
        ""
      ).trim();

    const details =
      String(
        row.details ??
        ""
      ).trim();

    const hint =
      String(
        row.hint ??
        ""
      ).trim();

    const parts =
      [
        message,
        details,
        hint,
      ].filter(
        Boolean
      );

    if (
      parts.length >
      0
    ) {
      return parts.join(
        " · "
      );
    }
  }

  if (
    error instanceof
    Error
  ) {
    return error.message;
  }

  return fallback;
}


export default function ClosingReadinessPanel({
  reportDate,
  className = "",
  refreshKey = 0,
  onCanCloseChange,
}: Props) {
  const supabase =
    useMemo(
      () =>
        createClient(),
      []
    );

  const [
    data,
    setData,
  ] =
    useState<
      ClosingReadinessView | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<
      string | null
    >(null);


  const loadData =
    useCallback(
      async () => {
        setLoading(true);
        setErrorMessage(
          null
        );

        try {
          const [
            readinessResult,
            attendanceResult,
            cashResult,
          ] =
            await Promise.all([
              supabase.rpc(
                "get_closing_readiness",
                {
                  p_report_date:
                    reportDate,
                }
              ),
              supabase.rpc(
                "get_daily_attendance_readiness",
                {
                  p_report_date:
                    reportDate,
                }
              ),
              supabase
                .from(
                  "sales_cash_daily"
                )
                .select(
                  "status,confirmed_at"
                )
                .eq(
                  "business_date",
                  reportDate
                )
                .maybeSingle(),
            ]);

          if (
            readinessResult.error
          ) {
            throw readinessResult.error;
          }

          if (
            attendanceResult.error
          ) {
            throw attendanceResult.error;
          }

          if (
            cashResult.error
          ) {
            throw cashResult.error;
          }

          const base =
            readinessResult.data as
              ClosingReadiness;

          const attendance =
            normalizeAttendanceReadiness(
              attendanceResult.data
            );

          const closingRequired =
            attendance.closing_required ===
            true;

          const dailyReady =
            closingRequired &&
            attendance.ready ===
              true;

          const cashRow =
            cashResult.data as {
              status?: string | null;
              confirmed_at?: string | null;
            } | null;

          const cashStatus =
            cashRow?.status ??
            null;

          const cashReady =
            cashStatus ===
            "confirmed";

          const effectiveCanClose =
            closingRequired &&
            base.can_close ===
              true &&
            base.system.ready ===
              true &&
            base.card.ready ===
              true &&
            dailyReady &&
            cashReady;

          setData({
            ...base,
            can_close:
              effectiveCanClose,
            daily: {
              ...base.daily,
              ready:
                dailyReady,
              input_complete:
                attendance
                  .input_complete_count,
              no_performance:
                attendance
                  .no_performance_count,
              holiday:
                attendance
                  .holiday_count,
            },
            attendance,
            cash: {
              ready:
                cashReady,
              status:
                cashStatus,
              confirmed_at:
                cashRow?.confirmed_at ??
                null,
            },
          });
        }
        catch (error) {
          setData(
            null
          );

          setErrorMessage(
            getErrorMessage(
              error,
              "마감 준비상태를 확인하지 못했습니다."
            )
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
    const loadTimer =
      window.setTimeout(
        () => {
          void loadData();
        },
        0
      );

    return () => {
      window.clearTimeout(
        loadTimer
      );
    };
  }, [
    loadData,
    refreshKey,
  ]);


  useEffect(() => {
    if (
      loading ||
      errorMessage ||
      !data
    ) {
      onCanCloseChange?.(
        false
      );
      return;
    }

    onCanCloseChange?.(
      data.can_close ===
      true
    );
  }, [
    data,
    errorMessage,
    loading,
    onCanCloseChange,
  ]);


  if (loading) {
    return (
      <section
        className={`flex items-center justify-center rounded-[20px] border border-[#E5E7EA] bg-white px-5 py-8 ${className}`}
      >
        <span className="inline-flex items-center gap-2 text-[12px] font-bold text-[#8B9098]">
          <LoaderCircle
            size={15}
            className="animate-spin"
          />
          마감 준비상태 확인 중
        </span>
      </section>
    );
  }


  if (
    errorMessage ||
    !data
  ) {
    return (
      <section
        className={`rounded-[20px] border border-[#F0CDD3] bg-[#FFF5F6] px-5 py-4 text-[12px] font-bold text-[#A50034] ${className}`}
      >
        {errorMessage ??
          "마감 준비상태를 확인하지 못했습니다."}
      </section>
    );
  }


  const attendance =
    data.attendance;

  const closingRequired =
    attendance.closing_required ===
    true;

  const systemMissing =
    data.system.missing ??
    [];

  const cardMissing =
    data.card.missing ??
    [];

  const cashReady =
    data.cash.ready ===
    true;

  const cashCaption =
    cashReady
      ? "확정완료"
      : data.cash.status ===
          "editing"
        ? "수정중 · 재확정 필요"
        : "미확정";

  const dailyCaption =
    [
      attendance
        .day_status_label,
      `출근 ${attendance.attendance_count}명`,
      `입력 ${attendance.input_complete_count}명`,
      `무실적 ${attendance.no_performance_count}명`,
      attendance.incomplete_count >
        0
        ? `미완료 ${attendance.incomplete_count}명`
        : "",
      attendance.mismatch_count >
        0
        ? `출근불일치 ${attendance.mismatch_count}명`
        : "",
      `휴무 ${attendance.holiday_count}명 / 총 ${data.daily.total}명`,
    ]
      .filter(
        Boolean
      )
      .join(
        " · "
      );


  const topStatus =
    !closingRequired
      ? {
          ready: false,
          label:
            "마감 대상 아님",
          className:
            "bg-[#F2F3F5] text-[#6F747C]",
        }
      : data.can_close
        ? {
            ready: true,
            label:
              "마감 가능",
            className:
              "bg-[#EDF8F1] text-[#287348]",
          }
        : {
            ready: false,
            label:
              "마감 전 확인 필요",
            className:
              "bg-[#FFF2E2] text-[#986219]",
          };


  return (
    <section
      className={`rounded-[22px] border border-[#E5E7EA] bg-white p-5 shadow-sm sm:p-6 ${className}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-black tracking-[0.12em] text-[#A50034]">
            CLOSING CHECK
          </p>

          <h3 className="mt-1 text-[20px] font-black tracking-[-0.035em] text-[#25282D]">
            마감 준비상태
          </h3>

          <p className="mt-1 text-[12px] leading-5 text-[#8A8F97]">
            일실적·전산실적·카드실적·판매시재의 처리 상태를 한 번에 확인합니다.
          </p>
        </div>

        <span
          className={[
            "inline-flex h-[34px] items-center gap-1.5 self-start rounded-full px-3 text-[11px] font-black",
            topStatus.className,
          ].join(" ")}
        >
          {topStatus.ready ? (
            <CheckCircle2
              size={14}
            />
          ) : (
            <CircleAlert
              size={14}
            />
          )}

          {topStatus.label}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          title="일실적"
          ready={
            data.daily.ready
          }
          Icon={UsersRound}
          caption={
            dailyCaption
          }
        />

        <StatusCard
          title="전산실적"
          ready={
            data.system.ready
          }
          Icon={Database}
          caption={`완료 ${data.system.applied}/${data.system.required}${data.system.draft_count > 0 ? ` · 작성중 ${data.system.draft_count}` : ""}`}
        />

        <StatusCard
          title="카드실적"
          ready={
            data.card.ready
          }
          Icon={CreditCard}
          caption={`완료 ${data.card.applied}/${data.card.required}${data.card.draft_count > 0 ? ` · 작성중 ${data.card.draft_count}` : ""}`}
        />

        <StatusCard
          title="판매시재"
          ready={
            cashReady
          }
          Icon={WalletCards}
          caption={
            cashCaption
          }
        />
      </div>

      {!data.can_close && (
        <div className="mt-4 rounded-[14px] border border-[#F1DFC0] bg-[#FFF9EF] px-4 py-3">
          <p className="text-[11px] font-black text-[#87621E]">
            마감 전에 확인할 항목
          </p>

          <div className="mt-2 space-y-1 text-[11px] font-bold leading-5 text-[#7B6640]">
            {!closingRequired && (
              <p>
                · 일실적: 지점휴무일은 일마감 확정 대상이 아닙니다. 실제 영업한 경우 지점 운영일에서 휴일영업으로 전환해주세요.
              </p>
            )}

            {closingRequired &&
              !attendance.ready &&
              attendance.attendance_count ===
                0 && (
                <p>
                  · 일실적: 출근 매니저가 선택되지 않았습니다. 일실적 상단에서 오늘 출근 매니저를 먼저 선택해주세요.
                </p>
              )}

            {closingRequired &&
              attendance.mismatch_names.length >
                0 && (
                <p>
                  · 일실적: 출근 미선택 상태로 실적 또는 무실적 확정된 매니저가 있습니다: {attendance.mismatch_names.join(", ")}
                </p>
              )}

            {closingRequired &&
              attendance.incomplete_names.length >
                0 && (
                <p>
                  · 일실적: 출근 매니저 중 입력완료 또는 무실적확정이 되지 않은 매니저가 있습니다: {attendance.incomplete_names.join(", ")}
                </p>
              )}

            {!data.system.ready && (
              <p>
                · 전산실적: {systemMissing.length > 0
                  ? systemMissing.join(", ")
                  : "작성중 자료를 최종 적용해주세요."}
                {data.system.draft_count >
                0
                  ? ` · 작성중 ${data.system.draft_count}건`
                  : ""}
              </p>
            )}

            {!data.card.ready && (
              <p>
                · 카드실적: {cardMissing.length > 0
                  ? cardMissing.join(", ")
                  : "작성중 자료를 최종 적용해주세요."}
                {data.card.draft_count >
                0
                  ? ` · 작성중 ${data.card.draft_count}건`
                  : ""}
              </p>
            )}

            {!cashReady && (
              <p>
                · 판매시재: 당일 판매시재를 확정해주세요.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
