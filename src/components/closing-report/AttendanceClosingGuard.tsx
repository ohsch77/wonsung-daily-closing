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
  CheckCircle2,
  LoaderCircle,
  Store,
  UserCheck,
} from "lucide-react";

import {
  createClient,
} from "@/lib/supabase/client";


type AttendanceReadiness = {
  report_date: string;
  day_status:
    | "normal"
    | "store_holiday"
    | "holiday_open";
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


type Props = {
  reportDate: string;
  refreshKey?: string | number;
  onReadyChange?: (
    ready: boolean
  ) => void;
};


function getNames(
  value: unknown
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) =>
    String(item)
  );
}


export default function AttendanceClosingGuard({
  reportDate,
  refreshKey = 0,
  onReadyChange,
}: Props) {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [data, setData] =
    useState<AttendanceReadiness | null>(
      null
    );
  const [loading, setLoading] =
    useState(true);
  const [errorMessage, setErrorMessage] =
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
        const result =
          await supabase.rpc(
            "get_daily_attendance_readiness",
            {
              p_report_date:
                reportDate,
            }
          );

        if (result.error) {
          throw result.error;
        }

        const raw =
          (result.data ?? {}) as
            Partial<AttendanceReadiness>;

        setData({
          report_date:
            String(
              raw.report_date ??
                reportDate
            ),
          day_status:
            raw.day_status ===
            "store_holiday"
              ? "store_holiday"
              : raw.day_status ===
                "holiday_open"
                ? "holiday_open"
                : "normal",
          day_status_label:
            String(
              raw.day_status_label ??
                "정상영업"
            ),
          holiday_name:
            raw.holiday_name
              ? String(
                  raw.holiday_name
                )
              : null,
          closing_required:
            raw.closing_required !==
            false,
          ready:
            raw.ready === true,
          attendance_count:
            Number(
              raw.attendance_count ?? 0
            ),
          input_complete_count:
            Number(
              raw.input_complete_count ??
                0
            ),
          no_performance_count:
            Number(
              raw.no_performance_count ??
                0
            ),
          complete_count:
            Number(
              raw.complete_count ?? 0
            ),
          incomplete_count:
            Number(
              raw.incomplete_count ?? 0
            ),
          mismatch_count:
            Number(
              raw.mismatch_count ?? 0
            ),
          holiday_count:
            Number(
              raw.holiday_count ?? 0
            ),
          incomplete_names:
            getNames(
              raw.incomplete_names
            ),
          mismatch_names:
            getNames(
              raw.mismatch_names
            ),
        });
      }
      catch (error) {
        setData(null);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "출근인원 검증상태를 확인하지 못했습니다."
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
  }, [loadData, refreshKey]);

  useEffect(() => {
    const reload = () => {
      void loadData(false);
    };

    const channel = supabase
      .channel(
        `closing-attendance-${reportDate}`
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

  useEffect(() => {
    if (
      loading ||
      errorMessage ||
      !data
    ) {
      onReadyChange?.(false);
      return;
    }

    onReadyChange?.(
      data.ready === true &&
        data.closing_required ===
          true
    );
  }, [
    data,
    errorMessage,
    loading,
    onReadyChange,
  ]);

  if (loading) {
    return (
      <section className="mb-4 flex items-center justify-center rounded-[16px] border border-[#E5E7EA] bg-[#FAFAFB] px-4 py-4">
        <span className="inline-flex items-center gap-2 text-[11px] font-bold text-[#858A92]">
          <LoaderCircle
            size={14}
            className="animate-spin"
          />
          출근인원 검증 중
        </span>
      </section>
    );
  }

  if (errorMessage || !data) {
    return (
      <section className="mb-4 flex items-start gap-2 rounded-[16px] border border-[#F0CDD3] bg-[#FFF5F6] px-4 py-3 text-[11px] font-bold leading-5 text-[#A50034]">
        <AlertCircle
          size={14}
          className="mt-0.5 shrink-0"
        />
        <span>
          {errorMessage ??
            "출근인원 검증상태를 확인하지 못했습니다."}
        </span>
      </section>
    );
  }

  const isStoreHoliday =
    data.day_status ===
    "store_holiday";
  const isHolidayOpen =
    data.day_status ===
    "holiday_open";

  if (isStoreHoliday) {
    return (
      <section className="mb-4 rounded-[16px] border border-[#E1E3E6] bg-[#F6F7F8] px-4 py-4">
        <div className="flex items-start gap-3">
          <Building2
            size={17}
            className="mt-0.5 shrink-0 text-[#6F747C]"
          />

          <div>
            <p className="text-[12px] font-black text-[#454950]">
              지점휴무 · 일마감 불필요
              {data.holiday_name
                ? ` · ${data.holiday_name}`
                : ""}
            </p>
            <p className="mt-1 text-[11px] font-medium leading-5 text-[#7E838B]">
              이 날짜는 지점 전체 휴무일로 등록되어 있습니다. 실제 영업한 경우 일실적 화면에서 휴일영업으로 전환한 뒤 출근인원을 선택하고 정상 마감을 진행해주세요.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const isReady =
    data.ready === true;

  return (
    <section
      className={[
        "mb-4 rounded-[16px] border px-4 py-4",
        isReady
          ? "border-[#D6E9DC] bg-[#F5FBF7]"
          : "border-[#F1DFC0] bg-[#FFF9EF]",
      ].join(" ")}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={[
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white",
              isReady
                ? "text-[#287348]"
                : "text-[#986219]",
            ].join(" ")}
          >
            {isHolidayOpen ? (
              <Store size={15} />
            ) : (
              <UserCheck size={15} />
            )}
          </div>

          <div>
            <p className="text-[11px] font-black text-[#777C85]">
              출근인원 검증
              {isHolidayOpen
                ? " · 휴일영업"
                : ""}
            </p>
            <p className="mt-1 text-[12px] font-bold leading-5 text-[#4E535B]">
              출근 {data.attendance_count}명 · 입력완료 {data.input_complete_count}명 · 무실적 {data.no_performance_count}명 · 미완료 {data.incomplete_count}명
            </p>
          </div>
        </div>

        <span
          className={[
            "inline-flex h-[30px] items-center gap-1 self-start rounded-full px-2.5 text-[10px] font-black",
            isReady
              ? "bg-[#E5F5EA] text-[#287348]"
              : "bg-[#FFF0D8] text-[#986219]",
          ].join(" ")}
        >
          {isReady ? (
            <CheckCircle2 size={12} />
          ) : (
            <AlertCircle size={12} />
          )}
          {isReady
            ? "출근인원 일치"
            : "확인 필요"}
        </span>
      </div>

      {!isReady && (
        <div className="mt-3 space-y-1 rounded-[12px] bg-white/70 px-3 py-2.5 text-[10px] font-bold leading-5 text-[#7B6640]">
          {data.attendance_count ===
            0 && (
            <p>
              · 출근 매니저가 선택되지 않았습니다. 일실적 상단에서 출근자를 먼저 선택해주세요.
            </p>
          )}

          {data.incomplete_names.length >
            0 && (
            <p>
              · 미완료: {data.incomplete_names.join(", ")} — 실적 저장 또는 무실적 확정이 필요합니다.
            </p>
          )}

          {data.mismatch_names.length >
            0 && (
            <p className="text-[#A50034]">
              · 출근선택 필요: {data.mismatch_names.join(", ")} — 실적이 있으나 출근자로 선택되지 않았습니다.
            </p>
          )}

          {data.attendance_count > 0 &&
            data.complete_count !==
              data.attendance_count && (
            <p>
              · 출근인원 {data.attendance_count}명과 입력완료+무실적확정 {data.complete_count}명이 일치해야 합니다.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
