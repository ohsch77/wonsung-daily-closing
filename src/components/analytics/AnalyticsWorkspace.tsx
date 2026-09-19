"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  ReactNode,
} from "react";

import {
  AlertCircle,
  BarChart3,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Database,
  FileSpreadsheet,
  FolderOpen,
  GitCompareArrows,
  LayoutGrid,
  LoaderCircle,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Users,
} from "lucide-react";

import type {
  AnalyticsManager,
  PerformanceAnalysisRow,
  PerformanceAnalysisSnapshot,
} from "@/lib/analytics/types";

import type {
  SystemCompareDataset,
  SystemCompareSnapshot,
  SystemCompareStatus,
} from "@/lib/analytics/system-compare";

import MetricLibraryBuilder from "@/components/analytics/MetricLibraryBuilder";

import {
  buildBuilderCustomAnalysisResult,
} from "@/lib/analytics/custom-analysis";

import type {
  CustomGranularity,
} from "@/lib/analytics/custom-analysis";

import {
  aggregationLabel,
  unitLabel,
} from "@/lib/analytics/metric-library";

import type {
  AnalysisMetricLibraryItem,
  AnalysisMetricLibrarySnapshot,
} from "@/lib/analytics/metric-library";

import type {
  AnalysisReportPreset,
  SaveAnalysisReportPresetPayload,
} from "@/lib/analytics/report-presets";

type AnalysisSection =
  | "performance"
  | "system-compare"
  | "custom";

type PerformanceView =
  | "monthly"
  | "daily";

type MetricGroup =
  | "all"
  | "sales"
  | "subscription"
  | "consultation"
  | "lead"
  | "review";

type Props = {
  initialSnapshot?:
    PerformanceAnalysisSnapshot | null;
  initialError?: string;
};

const analysisSections: Array<{
  id: AnalysisSection;
  label: string;
  description: string;
  icon: typeof BarChart3;
}> = [
  {
    id: "performance",
    label: "실적 분석",
    description:
      "월별·일자별 매니저 실적을 종합 분석합니다.",
    icon: BarChart3,
  },
  {
    id: "system-compare",
    label: "전산 비교",
    description:
      "일실적과 전산실적의 차이를 비교합니다.",
    icon: GitCompareArrows,
  },
  {
    id: "custom",
    label: "조합 분석",
    description:
      "기간·매니저·항목·집계방식을 자유롭게 조합합니다.",
    icon: SlidersHorizontal,
  },
];

const metricGroups: Array<{
  id: MetricGroup;
  label: string;
}> = [
  {
    id: "all",
    label: "전체",
  },
  {
    id: "sales",
    label: "판매",
  },
  {
    id: "subscription",
    label: "구독·교원",
  },
  {
    id: "consultation",
    label: "상담",
  },
  {
    id: "lead",
    label: "가망객",
  },
  {
    id: "review",
    label: "후기",
  },
];

function getKstMonth() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const year =
    parts.find(
      (part) =>
        part.type === "year"
    )?.value ?? "";

  const month =
    parts.find(
      (part) =>
        part.type === "month"
    )?.value ?? "";

  return year && month
    ? `${year}-${month}`
    : "";
}


function parseMonthKey(
  value: string
) {
  const match =
    /^(\d{4})-(\d{2})$/.exec(
      value
    );

  if (!match) {
    return null;
  }

  const year =
    Number(match[1]);
  const month =
    Number(match[2]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  return {
    year,
    month,
  };
}


function toMonthKey(
  year: number,
  month: number
) {
  return `${year}-${String(
    month
  ).padStart(2, "0")}`;
}


function formatMonthPickerValue(
  value: string
) {
  const parsed =
    parseMonthKey(
      value
    );

  if (!parsed) {
    return "월 선택";
  }

  return `${parsed.year}년 ${String(
    parsed.month
  ).padStart(2, "0")}월`;
}


function getKstToday() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "Asia/Seoul",
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
    )?.value ?? "";

  const month =
    parts.find(
      (part) =>
        part.type === "month"
    )?.value ?? "";

  const day =
    parts.find(
      (part) =>
        part.type === "day"
    )?.value ?? "";

  return (
    year &&
    month &&
    day
  )
    ? `${year}-${month}-${day}`
    : "";
}


function getMonthLastDate(
  monthKey: string
) {
  const match =
    monthKey.match(
      /^(\d{4})-(\d{2})$/
    );

  if (!match) {
    return "";
  }

  const year =
    Number(match[1]);
  const month =
    Number(match[2]);

  const lastDay =
    new Date(
      Date.UTC(
        year,
        month,
        0
      )
    ).getUTCDate();

  return `${monthKey}-${String(
    lastDay
  ).padStart(2, "0")}`;
}

function formatMonthLabel(
  value: string
) {
  const [year, month] =
    value.split("-");

  if (!year || !month) {
    return value;
  }

  return `${year}.${month}`;
}

function formatDateLabel(
  value: string
) {
  const [
    year,
    month,
    day,
  ] =
    value.split("-");

  if (
    !year ||
    !month ||
    !day
  ) {
    return value;
  }

  return `${year}.${month}.${day}`;
}


function formatAmount(
  value: number
) {
  return `${Math.round(
    value
  ).toLocaleString(
    "ko-KR"
  )}`;
}

function formatCount(
  value: number
) {
  return Math.round(
    value
  ).toLocaleString(
    "ko-KR"
  );
}

function formatRate(
  value: number | null
) {
  return value === null
    ? "-"
    : `${value.toLocaleString(
        "ko-KR",
        {
          minimumFractionDigits:
            1,
          maximumFractionDigits:
            1,
        }
      )}%`;
}

function calculateRate(
  numerator: number,
  denominator: number
) {
  if (denominator <= 0) {
    return null;
  }

  return (
    Math.round(
      (numerator /
        denominator) *
        1000
    ) / 10
  );
}

function SectionTabButton({
  active,
  label,
  description,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  description: string;
  icon: typeof BarChart3;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group flex min-h-[92px] w-full items-center gap-3 rounded-[18px] border px-4 py-4 text-left transition",
        active
          ? "border-[#D8B9C3] bg-[#FFF7F9] shadow-sm"
          : "border-[#E5E7EA] bg-white hover:border-[#D6D9DE] hover:shadow-sm",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]",
          active
            ? "bg-[#A50034] text-white"
            : "bg-[#F4F5F6] text-[#737881] group-hover:text-[#A50034]",
        ].join(" ")}
      >
        <Icon size={18} />
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={[
            "block text-[14px] font-black tracking-[-0.02em]",
            active
              ? "text-[#A50034]"
              : "text-[#30343A]",
          ].join(" ")}
        >
          {label}
        </span>

        <span className="mt-1 block text-[11px] font-medium leading-5 text-[#8A8F97]">
          {description}
        </span>
      </span>

      <ChevronRight
        size={16}
        className={
          active
            ? "text-[#A50034]"
            : "text-[#B1B5BB]"
        }
      />
    </button>
  );
}

function ReadyPanel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-[20px] border border-[#E5E7EA] bg-white p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#FFF1F4] text-[#A50034]">
          <Sparkles size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black tracking-[0.12em] text-[#A50034]">
            {eyebrow}
          </p>

          <h3 className="mt-1 text-[18px] font-black tracking-[-0.025em] text-[#2A2D32]">
            {title}
          </h3>

          <p className="mt-2 max-w-3xl text-[12px] font-medium leading-6 text-[#7F848C]">
            {description}
          </p>
        </div>
      </div>

      {children}
    </section>
  );
}

function DataConnectionPanel({
  snapshot,
  errorMessage,
}: {
  snapshot:
    PerformanceAnalysisSnapshot | null;
  errorMessage: string;
}) {
  if (errorMessage) {
    return (
      <div className="mt-5 flex items-start gap-3 rounded-[16px] border border-[#F0D4DB] bg-[#FFF5F7] px-4 py-4">
        <AlertCircle
          size={18}
          className="mt-0.5 shrink-0 text-[#A50034]"
        />
        <div>
          <p className="text-[12px] font-black text-[#A50034]">
            분석 데이터 연결을 확인해주세요.
          </p>
          <p className="mt-1 text-[11px] font-medium leading-5 text-[#8A606B]">
            {errorMessage}
          </p>
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="mt-5 rounded-[16px] border border-[#E4E6E9] bg-[#FAFAFB] px-4 py-4 text-[11px] font-bold text-[#7D828A]">
        분석 데이터 연결 정보를 준비하고 있습니다.
      </div>
    );
  }

  const missing =
    snapshot.resolution
      .missingLabels;

  const reviewCount =
    snapshot.resolution
      .reviewMetrics.length;

  return (
    <div className="mt-5 space-y-3">
      <div
        className={[
          "flex flex-col gap-3 rounded-[16px] border px-4 py-4 sm:flex-row sm:items-center sm:justify-between",
          missing.length === 0
            ? "border-[#D6E9DC] bg-[#F5FBF7]"
            : "border-[#F1DFC0] bg-[#FFF9EF]",
        ].join(" ")}
      >
        <div className="flex items-start gap-3">
          {missing.length === 0 ? (
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0 text-[#287348]"
            />
          ) : (
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0 text-[#9A6D20]"
            />
          )}

          <div>
            <p
              className={[
                "text-[12px] font-black",
                missing.length === 0
                  ? "text-[#287348]"
                  : "text-[#87621E]",
              ].join(" ")}
            >
              {missing.length === 0
                ? "실적 분석 데이터 연결 완료"
                : "일부 분석항목 연결 확인 필요"}
            </p>

            <p className="mt-1 text-[11px] font-medium leading-5 text-[#7D828A]">
              {snapshot.startDate}
              {" ~ "}
              {snapshot.endDate}
              {" · "}
              확정 실적{" "}
              {snapshot.completedReportCount.toLocaleString(
                "ko-KR"
              )}
              건
              {" · "}
              원본 값{" "}
              {snapshot.metricValueCount.toLocaleString(
                "ko-KR"
              )}
              건
            </p>
          </div>
        </div>

        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-[#60656C] shadow-sm ring-1 ring-[#E4E6E9]">
          <Database size={13} />
          읽기 전용 연결
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-[15px] border border-[#E6E8EB] bg-[#FAFAFB] px-4 py-4">
          <p className="text-[10px] font-bold text-[#92969D]">
            매니저
          </p>
          <p className="mt-1 text-[18px] font-black tabular-nums text-[#3E4248]">
            {snapshot.managers.length}
            <span className="ml-1 text-[11px] font-bold text-[#858A92]">
              명
            </span>
          </p>
          <p className="mt-1 text-[9px] font-medium text-[#A0A4AA]">
            관리자 제외
          </p>
        </div>

        <div className="rounded-[15px] border border-[#E6E8EB] bg-[#FAFAFB] px-4 py-4">
          <p className="text-[10px] font-bold text-[#92969D]">
            월별 집계행
          </p>
          <p className="mt-1 text-[18px] font-black tabular-nums text-[#3E4248]">
            {snapshot.monthlyRows.length}
            <span className="ml-1 text-[11px] font-bold text-[#858A92]">
              행
            </span>
          </p>
        </div>

        <div className="rounded-[15px] border border-[#E6E8EB] bg-[#FAFAFB] px-4 py-4">
          <p className="text-[10px] font-bold text-[#92969D]">
            일자별 집계행
          </p>
          <p className="mt-1 text-[18px] font-black tabular-nums text-[#3E4248]">
            {snapshot.dailyRows.length}
            <span className="ml-1 text-[11px] font-bold text-[#858A92]">
              행
            </span>
          </p>
        </div>

        <div className="rounded-[15px] border border-[#E6E8EB] bg-[#FAFAFB] px-4 py-4">
          <p className="text-[10px] font-bold text-[#92969D]">
            후기 항목
          </p>
          <p className="mt-1 text-[18px] font-black tabular-nums text-[#3E4248]">
            {reviewCount}
            <span className="ml-1 text-[11px] font-bold text-[#858A92]">
              개
            </span>
          </p>
        </div>
      </div>

      {missing.length > 0 && (
        <div className="rounded-[14px] border border-[#F1DFC0] bg-[#FFF9EF] px-4 py-3">
          <p className="text-[10px] font-black text-[#87621E]">
            연결되지 않은 항목
          </p>
          <p className="mt-1 text-[11px] font-bold leading-5 text-[#87621E]">
            {missing.join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}


function MonthPicker({
  label,
  value,
  onChange,
  maxMonth = getKstMonth(),
  minMonth,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (
    nextValue: string
  ) => void;
  maxMonth?: string;
  minMonth?: string;
  className?: string;
}) {
  const rootRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const [
    isOpen,
    setIsOpen,
  ] =
    useState(false);

  const selected =
    parseMonthKey(
      value
    );

  const currentMax =
    parseMonthKey(
      maxMonth
    );

  const [
    viewYear,
    setViewYear,
  ] =
    useState(
      selected?.year ??
        currentMax?.year ??
        new Date().getFullYear()
    );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown =
      (
        event:
          MouseEvent |
          TouchEvent
      ) => {
        const target =
          event.target as Node;

        if (
          rootRef.current &&
          !rootRef.current.contains(
            target
          )
        ) {
          setIsOpen(false);
        }
      };

    const handleKeyDown =
      (
        event:
          KeyboardEvent
      ) => {
        if (
          event.key ===
          "Escape"
        ) {
          setIsOpen(false);
        }
      };

    document.addEventListener(
      "mousedown",
      handlePointerDown
    );

    document.addEventListener(
      "touchstart",
      handlePointerDown,
      {
        passive: true,
      }
    );

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown
      );

      document.removeEventListener(
        "touchstart",
        handlePointerDown
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [isOpen]);


  const isMonthDisabled =
    (
      year: number,
      month: number
    ) => {
      const monthKey =
        toMonthKey(
          year,
          month
        );

      if (
        maxMonth &&
        monthKey > maxMonth
      ) {
        return true;
      }

      if (
        minMonth &&
        monthKey < minMonth
      ) {
        return true;
      }

      return false;
    };

  const canMoveForward =
    !currentMax ||
    viewYear <
      currentMax.year;

  const moveYear =
    (
      amount: number
    ) => {
      const nextYear =
        viewYear + amount;

      if (
        currentMax &&
        nextYear >
          currentMax.year
      ) {
        setViewYear(
          currentMax.year
        );
        return;
      }

      setViewYear(
        nextYear
      );
    };

  const handleSelectMonth =
    (
      month: number
    ) => {
      const nextValue =
        toMonthKey(
          viewYear,
          month
        );

      if (
        isMonthDisabled(
          viewYear,
          month
        )
      ) {
        return;
      }

      onChange(
        nextValue
      );
      setIsOpen(false);
    };

  const handleThisMonth =
    () => {
      if (!maxMonth) {
        return;
      }

      onChange(
        maxMonth
      );

      const parsed =
        parseMonthKey(
          maxMonth
        );

      if (parsed) {
        setViewYear(
          parsed.year
        );
      }

      setIsOpen(false);
    };

  return (
    <div
      ref={rootRef}
      className={[
        "relative",
        className,
      ].join(" ")}
    >
      <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black text-[#777C84]">
        <CalendarDays
          size={12}
          className="text-[#8C9198]"
        />
        {label}
      </span>

      <button
        type="button"
        onClick={() => {
          if (!isOpen) {
            setViewYear(
              selected?.year ??
                currentMax?.year ??
                new Date().getFullYear()
            );
          }

          setIsOpen(
            (open) =>
              !open
          );
        }}
        aria-expanded={
          isOpen
        }
        className={[
          "flex h-11 w-full min-w-[180px] items-center justify-between rounded-[12px] border bg-white px-3.5 text-left transition",
          isOpen
            ? "border-[#D6004B] shadow-[0_0_0_3px_rgba(214,0,75,0.08)]"
            : "border-[#DDE0E4] hover:border-[#C9CDD2]",
        ].join(" ")}
      >
        <span className="text-[12px] font-black tracking-[-0.02em] text-[#34383E]">
          {formatMonthPickerValue(
            value
          )}
        </span>

        <ChevronDown
          size={15}
          className={[
            "text-[#9A9EA5] transition-transform",
            isOpen
              ? "rotate-180"
              : "",
          ].join(" ")}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 z-[70] mt-2 w-[360px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[22px] border border-[#E3E5E8] bg-white shadow-[0_22px_70px_rgba(32,36,42,0.18)]">
          <div className="flex items-center justify-between border-b border-[#ECEEF1] px-5 py-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  moveYear(-5)
                }
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E6E8EB] bg-white text-[#A2A6AC] transition hover:bg-[#F8F9FA] hover:text-[#5A5F66]"
                aria-label="5년 이전"
              >
                <ChevronsLeft
                  size={16}
                />
              </button>

              <button
                type="button"
                onClick={() =>
                  moveYear(-1)
                }
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E6E8EB] bg-white text-[#8D9299] transition hover:bg-[#F8F9FA] hover:text-[#5A5F66]"
                aria-label="이전 연도"
              >
                <ChevronLeft
                  size={16}
                />
              </button>
            </div>

            <div className="text-center">
              <p className="text-[21px] font-black tracking-[-0.035em] text-[#262A30]">
                {viewYear}년
              </p>
              <p className="mt-1 text-[8px] font-black tracking-[0.24em] text-[#A50034]">
                LG PREMIUM MONTH
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  moveYear(1)
                }
                disabled={
                  !canMoveForward
                }
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E6E8EB] bg-white text-[#8D9299] transition hover:bg-[#F8F9FA] hover:text-[#5A5F66] disabled:cursor-not-allowed disabled:opacity-25"
                aria-label="다음 연도"
              >
                <ChevronRight
                  size={16}
                />
              </button>

              <button
                type="button"
                onClick={() =>
                  moveYear(5)
                }
                disabled={
                  !canMoveForward
                }
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E6E8EB] bg-white text-[#A2A6AC] transition hover:bg-[#F8F9FA] hover:text-[#5A5F66] disabled:cursor-not-allowed disabled:opacity-25"
                aria-label="5년 이후"
              >
                <ChevronsRight
                  size={16}
                />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 px-5 py-5">
            {Array.from(
              {
                length: 12,
              },
              (_, index) =>
                index + 1
            ).map(
              (month) => {
                const monthKey =
                  toMonthKey(
                    viewYear,
                    month
                  );

                const selectedMonth =
                  monthKey ===
                  value;

                const disabled =
                  isMonthDisabled(
                    viewYear,
                    month
                  );

                return (
                  <button
                    type="button"
                    key={
                      monthKey
                    }
                    onClick={() =>
                      handleSelectMonth(
                        month
                      )
                    }
                    disabled={
                      disabled
                    }
                    className={[
                      "h-12 rounded-[13px] text-[12px] font-black transition",
                      selectedMonth
                        ? "bg-[#D6004B] text-white shadow-[0_8px_18px_rgba(214,0,75,0.20)]"
                        : disabled
                          ? "cursor-not-allowed bg-[#FAFAFB] text-[#D3D6DA]"
                          : "bg-white text-[#3E434A] hover:bg-[#FFF2F6] hover:text-[#A50034]",
                    ].join(" ")}
                  >
                    {month}월
                  </button>
                );
              }
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[#ECEEF1] px-5 py-4">
            <button
              type="button"
              onClick={() =>
                setIsOpen(false)
              }
              className="h-10 rounded-[11px] border border-[#DDE0E4] bg-white px-4 text-[11px] font-black text-[#5F646B] transition hover:bg-[#F7F8F9]"
            >
              닫기
            </button>

            <p className="text-center text-[9px] font-bold text-[#B0B4BA]">
              미래 월은 선택할 수 없습니다
            </p>

            <button
              type="button"
              onClick={
                handleThisMonth
              }
              className="h-10 rounded-[11px] bg-[#D6004B] px-4 text-[11px] font-black text-white transition hover:bg-[#BE0042]"
            >
              이번 달
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


function ManagerSelector({
  managers,
  selectedIds,
  onChange,
}: {
  managers: AnalyticsManager[];
  selectedIds: string[];
  onChange: (
    nextIds: string[]
  ) => void;
}) {
  const detailsRef =
    useRef<HTMLDetailsElement | null>(
      null
    );

  useEffect(() => {
    const handleOutside =
      (
        event:
          MouseEvent |
          TouchEvent
      ) => {
        const details =
          detailsRef.current;

        if (
          !details ||
          !details.open
        ) {
          return;
        }

        const target =
          event.target as Node;

        if (
          details.contains(
            target
          )
        ) {
          return;
        }

        details.open =
          false;
      };

    const handleKeyDown =
      (
        event:
          KeyboardEvent
      ) => {
        if (
          event.key !==
          "Escape"
        ) {
          return;
        }

        const details =
          detailsRef.current;

        if (
          details?.open
        ) {
          details.open =
            false;
        }
      };

    document.addEventListener(
      "mousedown",
      handleOutside
    );

    document.addEventListener(
      "touchstart",
      handleOutside,
      {
        passive: true,
      }
    );

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutside
      );

      document.removeEventListener(
        "touchstart",
        handleOutside
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, []);

  const selectedSet =
    useMemo(
      () =>
        new Set(
          selectedIds
        ),
      [selectedIds]
    );

  const allSelected =
    managers.length > 0 &&
    managers.every(
      (manager) =>
        selectedSet.has(
          manager.id
        )
    );

  const label =
    selectedIds.length ===
    managers.length
      ? `전체 ${managers.length}명`
      : `${selectedIds.length}명 선택`;

  const toggleAll = () => {
    onChange(
      allSelected
        ? []
        : managers.map(
            (manager) =>
              manager.id
          )
    );
  };

  const toggleManager = (
    managerId: string
  ) => {
    const next =
      new Set(selectedSet);

    if (
      next.has(managerId)
    ) {
      next.delete(managerId);
    } else {
      next.add(managerId);
    }

    onChange(
      managers
        .filter((manager) =>
          next.has(
            manager.id
          )
        )
        .map((manager) =>
          manager.id
        )
    );
  };

  return (
    <details
      ref={detailsRef}
      className="relative"
    >
      <summary className="flex h-10 min-w-[180px] cursor-pointer list-none items-center justify-between gap-3 rounded-[11px] border border-[#DDE0E4] bg-white px-3 text-[11px] font-black text-[#4D5259] transition hover:border-[#C8CCD2] [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <Users
            size={14}
            className="text-[#8A8F97]"
          />
          {label}
        </span>
        <ChevronDown
          size={14}
          className="text-[#9A9EA5]"
        />
      </summary>

      <div className="absolute right-0 z-30 mt-2 w-[260px] overflow-hidden rounded-[14px] border border-[#DDE0E4] bg-white shadow-xl">
        <button
          type="button"
          onClick={toggleAll}
          className="flex w-full items-center gap-2 border-b border-[#ECEEF1] bg-[#FAFAFB] px-4 py-3 text-left text-[11px] font-black text-[#4B5057] hover:bg-[#F6F7F8]"
        >
          <span
            className={[
              "flex h-4 w-4 items-center justify-center rounded border text-[10px]",
              allSelected
                ? "border-[#A50034] bg-[#A50034] text-white"
                : "border-[#C9CDD2] bg-white text-transparent",
            ].join(" ")}
          >
            ✓
          </span>
          전체 선택
        </button>

        <div className="max-h-[280px] overflow-auto p-2">
          {managers.map(
            (manager) => {
              const checked =
                selectedSet.has(
                  manager.id
                );

              return (
                <button
                  type="button"
                  key={manager.id}
                  onClick={() =>
                    toggleManager(
                      manager.id
                    )
                  }
                  className="flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-left hover:bg-[#F7F8F9]"
                >
                  <span
                    className={[
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]",
                      checked
                        ? "border-[#A50034] bg-[#A50034] text-white"
                        : "border-[#C9CDD2] bg-white text-transparent",
                    ].join(" ")}
                  >
                    ✓
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-black text-[#474C53]">
                      {manager.name}
                    </span>
                    <span className="mt-0.5 block text-[9px] font-medium text-[#9A9EA5]">
                      {manager.employeeNo}
                      {!manager.isActive &&
                        " · 비활성"}
                    </span>
                  </span>
                </button>
              );
            }
          )}
        </div>
      </div>
    </details>
  );
}

function buildTotalRow(
  rows: PerformanceAnalysisRow[],
  snapshot: PerformanceAnalysisSnapshot
) {
  const reviewValues:
    Record<string, number> = {};

  for (
    const reviewMetric of
    snapshot.resolution
      .reviewMetrics
  ) {
    reviewValues[
      reviewMetric.metricId
    ] = 0;
  }

  const total = {
    totalSalesAmount: 0,
    subscriptionNetCount: 0,
    kyowonNetCount: 0,
    consultationCount: 0,
    consultationSalesCount: 0,
    leadInCount: 0,
    leadSuccessCount: 0,
    reviewValues,
    reviewTotal: 0,
  };

  for (const row of rows) {
    total.totalSalesAmount +=
      row.totalSalesAmount;
    total.subscriptionNetCount +=
      row.subscriptionNetCount;
    total.kyowonNetCount +=
      row.kyowonNetCount;
    total.consultationCount +=
      row.consultationCount;
    total.consultationSalesCount +=
      row.consultationSalesCount;
    total.leadInCount +=
      row.leadInCount;
    total.leadSuccessCount +=
      row.leadSuccessCount;
    total.reviewTotal +=
      row.reviewTotal;

    for (
      const [
        metricId,
        value,
      ] of Object.entries(
        row.reviewValues
      )
    ) {
      total.reviewValues[
        metricId
      ] =
        (total.reviewValues[
          metricId
        ] ?? 0) + value;
    }
  }

  return {
    ...total,
    consultationSuccessRate:
      calculateRate(
        total.consultationSalesCount,
        total.consultationCount
      ),
    leadSuccessRate:
      calculateRate(
        total.leadSuccessCount,
        total.leadInCount
      ),
  };
}

function MonthlyPerformanceTable({
  snapshot,
  rows,
  selectedManagerCount,
  metricGroup,
}: {
  snapshot: PerformanceAnalysisSnapshot;
  rows: PerformanceAnalysisRow[];
  selectedManagerCount: number;
  metricGroup: MetricGroup;
}) {
  const total =
    useMemo(
      () =>
        buildTotalRow(
          rows,
          snapshot
        ),
      [rows, snapshot]
    );

  const showSales =
    metricGroup === "all" ||
    metricGroup === "sales";

  const showSubscription =
    metricGroup === "all" ||
    metricGroup ===
      "subscription";

  const showConsultation =
    metricGroup === "all" ||
    metricGroup ===
      "consultation";

  const showLead =
    metricGroup === "all" ||
    metricGroup === "lead";

  const showReview =
    metricGroup === "all" ||
    metricGroup === "review";

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-[16px] border border-dashed border-[#D9DCE1] bg-[#FAFAFB] px-5 text-center">
        <div>
          <Search
            size={22}
            className="mx-auto text-[#A4A8AE]"
          />
          <p className="mt-3 text-[12px] font-black text-[#5D6269]">
            선택한 조건에 해당하는 월별 실적이 없습니다.
          </p>
          <p className="mt-1 text-[10px] leading-5 text-[#969AA1]">
            조회기간 또는 매니저 선택을 확인해주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[16px] border border-[#E2E4E7] bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-max border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-[#DDE0E4] bg-[#F7F8F9] text-[#5A5F66]">
              <th className="sticky left-0 z-20 w-[86px] min-w-[86px] border-r border-[#E2E4E7] bg-[#F7F8F9] px-3 py-3 text-center font-black">
                월
              </th>
              <th className="sticky left-[86px] z-20 w-[116px] min-w-[116px] border-r border-[#E2E4E7] bg-[#F7F8F9] px-3 py-3 text-left font-black">
                매니저
              </th>

              {showSales && (
                <th className="min-w-[138px] border-r border-[#E2E4E7] px-3 py-3 text-right font-black">
                  총판매금액
                </th>
              )}

              {showSubscription && (
                <>
                  <th className="min-w-[108px] border-r border-[#E2E4E7] px-3 py-3 text-right font-black">
                    구독판매
                  </th>
                  <th className="min-w-[108px] border-r border-[#E2E4E7] px-3 py-3 text-right font-black">
                    구독교원
                  </th>
                </>
              )}

              {showConsultation && (
                <>
                  <th className="min-w-[92px] border-r border-[#E2E4E7] px-3 py-3 text-right font-black">
                    상담건수
                  </th>
                  <th className="min-w-[92px] border-r border-[#E2E4E7] px-3 py-3 text-right font-black">
                    판매건수
                  </th>
                  <th className="min-w-[92px] border-r border-[#E2E4E7] px-3 py-3 text-right font-black">
                    성공률
                  </th>
                </>
              )}

              {showLead && (
                <>
                  <th className="min-w-[100px] border-r border-[#E2E4E7] px-3 py-3 text-right font-black">
                    가망객입수
                  </th>
                  <th className="min-w-[100px] border-r border-[#E2E4E7] px-3 py-3 text-right font-black">
                    성공건수
                  </th>
                  <th className="min-w-[92px] border-r border-[#E2E4E7] px-3 py-3 text-right font-black">
                    성공률
                  </th>
                </>
              )}

              {showReview &&
                snapshot.resolution
                  .reviewMetrics.map(
                    (metric) => (
                      <th
                        key={
                          metric.metricId
                        }
                        className="min-w-[106px] border-r border-[#E2E4E7] px-3 py-3 text-right font-black"
                      >
                        {metric.name}
                      </th>
                    )
                  )}

              {showReview && (
                <th className="min-w-[100px] px-3 py-3 text-right font-black">
                  후기합계
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={row.periodKey}
                className="border-b border-[#ECEEF1] text-[#4A4F56] hover:bg-[#FCFCFD]"
              >
                <td className="sticky left-0 z-10 border-r border-[#ECEEF1] bg-white px-3 py-3 text-center font-black text-[#565B62]">
                  {formatMonthLabel(
                    row.monthKey
                  )}
                </td>
                <td className="sticky left-[86px] z-10 border-r border-[#ECEEF1] bg-white px-3 py-3">
                  <p className="font-black text-[#3F444B]">
                    {row.managerName}
                  </p>
                  <p className="mt-0.5 text-[9px] font-medium text-[#9A9EA5]">
                    {row.employeeNo}
                  </p>
                </td>

                {showSales && (
                  <td className="border-r border-[#ECEEF1] px-3 py-3 text-right font-black tabular-nums text-[#353A40]">
                    {formatAmount(
                      row.totalSalesAmount
                    )}
                  </td>
                )}

                {showSubscription && (
                  <>
                    <td className="border-r border-[#ECEEF1] px-3 py-3 text-right font-bold tabular-nums">
                      {formatCount(
                        row.subscriptionNetCount
                      )}
                    </td>
                    <td className="border-r border-[#ECEEF1] px-3 py-3 text-right font-bold tabular-nums">
                      {formatCount(
                        row.kyowonNetCount
                      )}
                    </td>
                  </>
                )}

                {showConsultation && (
                  <>
                    <td className="border-r border-[#ECEEF1] px-3 py-3 text-right font-bold tabular-nums">
                      {formatCount(
                        row.consultationCount
                      )}
                    </td>
                    <td className="border-r border-[#ECEEF1] px-3 py-3 text-right font-bold tabular-nums">
                      {formatCount(
                        row.consultationSalesCount
                      )}
                    </td>
                    <td className="border-r border-[#ECEEF1] px-3 py-3 text-right font-black tabular-nums text-[#7B3B4F]">
                      {formatRate(
                        row.consultationSuccessRate
                      )}
                    </td>
                  </>
                )}

                {showLead && (
                  <>
                    <td className="border-r border-[#ECEEF1] px-3 py-3 text-right font-bold tabular-nums">
                      {formatCount(
                        row.leadInCount
                      )}
                    </td>
                    <td className="border-r border-[#ECEEF1] px-3 py-3 text-right font-bold tabular-nums">
                      {formatCount(
                        row.leadSuccessCount
                      )}
                    </td>
                    <td className="border-r border-[#ECEEF1] px-3 py-3 text-right font-black tabular-nums text-[#7B3B4F]">
                      {formatRate(
                        row.leadSuccessRate
                      )}
                    </td>
                  </>
                )}

                {showReview &&
                  snapshot.resolution
                    .reviewMetrics.map(
                      (metric) => (
                        <td
                          key={
                            metric.metricId
                          }
                          className="border-r border-[#ECEEF1] px-3 py-3 text-right font-bold tabular-nums"
                        >
                          {formatCount(
                            row.reviewValues[
                              metric.metricId
                            ] ?? 0
                          )}
                        </td>
                      )
                    )}

                {showReview && (
                  <td className="px-3 py-3 text-right font-black tabular-nums text-[#3E434A]">
                    {formatCount(
                      row.reviewTotal
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-[#D8B9C3] bg-[#FFF7F9] text-[#4A3D42]">
              <td className="sticky left-0 z-10 border-r border-[#E7D9DE] bg-[#FFF7F9] px-3 py-3 text-center font-black text-[#A50034]">
                합계
              </td>
              <td className="sticky left-[86px] z-10 border-r border-[#E7D9DE] bg-[#FFF7F9] px-3 py-3 font-black text-[#A50034]">
                {selectedManagerCount}
                명 선택
              </td>

              {showSales && (
                <td className="border-r border-[#E7D9DE] px-3 py-3 text-right font-black tabular-nums">
                  {formatAmount(
                    total.totalSalesAmount
                  )}
                </td>
              )}

              {showSubscription && (
                <>
                  <td className="border-r border-[#E7D9DE] px-3 py-3 text-right font-black tabular-nums">
                    {formatCount(
                      total.subscriptionNetCount
                    )}
                  </td>
                  <td className="border-r border-[#E7D9DE] px-3 py-3 text-right font-black tabular-nums">
                    {formatCount(
                      total.kyowonNetCount
                    )}
                  </td>
                </>
              )}

              {showConsultation && (
                <>
                  <td className="border-r border-[#E7D9DE] px-3 py-3 text-right font-black tabular-nums">
                    {formatCount(
                      total.consultationCount
                    )}
                  </td>
                  <td className="border-r border-[#E7D9DE] px-3 py-3 text-right font-black tabular-nums">
                    {formatCount(
                      total.consultationSalesCount
                    )}
                  </td>
                  <td className="border-r border-[#E7D9DE] px-3 py-3 text-right font-black tabular-nums text-[#A50034]">
                    {formatRate(
                      total.consultationSuccessRate
                    )}
                  </td>
                </>
              )}

              {showLead && (
                <>
                  <td className="border-r border-[#E7D9DE] px-3 py-3 text-right font-black tabular-nums">
                    {formatCount(
                      total.leadInCount
                    )}
                  </td>
                  <td className="border-r border-[#E7D9DE] px-3 py-3 text-right font-black tabular-nums">
                    {formatCount(
                      total.leadSuccessCount
                    )}
                  </td>
                  <td className="border-r border-[#E7D9DE] px-3 py-3 text-right font-black tabular-nums text-[#A50034]">
                    {formatRate(
                      total.leadSuccessRate
                    )}
                  </td>
                </>
              )}

              {showReview &&
                snapshot.resolution
                  .reviewMetrics.map(
                    (metric) => (
                      <td
                        key={
                          metric.metricId
                        }
                        className="border-r border-[#E7D9DE] px-3 py-3 text-right font-black tabular-nums"
                      >
                        {formatCount(
                          total.reviewValues[
                            metric.metricId
                          ] ?? 0
                        )}
                      </td>
                    )
                  )}

              {showReview && (
                <td className="px-3 py-3 text-right font-black tabular-nums">
                  {formatCount(
                    total.reviewTotal
                  )}
                </td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}


function DailyPerformanceTable({
  snapshot,
  rows,
  selectedManagerCount,
  metricGroup,
}: {
  snapshot: PerformanceAnalysisSnapshot;
  rows: PerformanceAnalysisRow[];
  selectedManagerCount: number;
  metricGroup: MetricGroup;
}) {
  const total =
    useMemo(
      () =>
        buildTotalRow(
          rows,
          snapshot
        ),
      [rows, snapshot]
    );

  const showSales =
    metricGroup === "all" ||
    metricGroup === "sales";

  const showSubscription =
    metricGroup === "all" ||
    metricGroup ===
      "subscription";

  const showConsultation =
    metricGroup === "all" ||
    metricGroup ===
      "consultation";

  const showLead =
    metricGroup === "all" ||
    metricGroup === "lead";

  const showReview =
    metricGroup === "all" ||
    metricGroup === "review";

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-[16px] border border-dashed border-[#D9DCE1] bg-[#FAFAFB] px-5 text-center">
        <div>
          <Search
            size={22}
            className="mx-auto text-[#A4A8AE]"
          />
          <p className="mt-3 text-[12px] font-black text-[#5D6269]">
            선택한 조건에 해당하는 일자별 실적이 없습니다.
          </p>
          <p className="mt-1 text-[10px] leading-5 text-[#969AA1]">
            기준월 또는 매니저 선택을 확인해주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[16px] border border-[#E2E4E7] bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-max border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-[#DDE0E4] bg-[#F7F8F9] text-[#5A5F66]">
              <th className="sticky left-0 z-20 w-[108px] min-w-[108px] border-r border-[#E2E4E7] bg-[#F7F8F9] px-3 py-3 text-center font-black">
                일자
              </th>
              <th className="sticky left-[108px] z-20 w-[116px] min-w-[116px] border-r border-[#E2E4E7] bg-[#F7F8F9] px-3 py-3 text-left font-black">
                매니저
              </th>

              {showSales && (
                <th className="min-w-[138px] border-r border-[#E2E4E7] px-3 py-3 text-right font-black">
                  총판매금액
                </th>
              )}

              {showSubscription && (
                <>
                  <th className="min-w-[108px] border-r border-[#E2E4E7] px-3 py-3 text-right font-black">
                    구독판매
                  </th>
                  <th className="min-w-[108px] border-r border-[#E2E4E7] px-3 py-3 text-right font-black">
                    구독교원
                  </th>
                </>
              )}

              {showConsultation && (
                <>
                  <th className="min-w-[92px] border-r border-[#E2E4E7] px-3 py-3 text-right font-black">
                    상담건수
                  </th>
                  <th className="min-w-[92px] border-r border-[#E2E4E7] px-3 py-3 text-right font-black">
                    판매건수
                  </th>
                  <th className="min-w-[92px] border-r border-[#E2E4E7] px-3 py-3 text-right font-black">
                    성공률
                  </th>
                </>
              )}

              {showLead && (
                <>
                  <th className="min-w-[100px] border-r border-[#E2E4E7] px-3 py-3 text-right font-black">
                    가망객입수
                  </th>
                  <th className="min-w-[100px] border-r border-[#E2E4E7] px-3 py-3 text-right font-black">
                    성공건수
                  </th>
                  <th className="min-w-[92px] border-r border-[#E2E4E7] px-3 py-3 text-right font-black">
                    성공률
                  </th>
                </>
              )}

              {showReview &&
                snapshot.resolution
                  .reviewMetrics.map(
                    (metric) => (
                      <th
                        key={
                          metric.metricId
                        }
                        className="min-w-[106px] border-r border-[#E2E4E7] px-3 py-3 text-right font-black"
                      >
                        {metric.name}
                      </th>
                    )
                  )}

              {showReview && (
                <th className="min-w-[100px] px-3 py-3 text-right font-black">
                  후기합계
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={row.periodKey}
                className="border-b border-[#ECEEF1] text-[#4A4F56] hover:bg-[#FCFCFD]"
              >
                <td className="sticky left-0 z-10 border-r border-[#ECEEF1] bg-white px-3 py-3 text-center font-black text-[#565B62]">
                  {formatDateLabel(
                    row.reportDate ?? ""
                  )}
                </td>
                <td className="sticky left-[108px] z-10 border-r border-[#ECEEF1] bg-white px-3 py-3">
                  <p className="font-black text-[#3F444B]">
                    {row.managerName}
                  </p>
                  <p className="mt-0.5 text-[9px] font-medium text-[#9A9EA5]">
                    {row.employeeNo}
                  </p>
                </td>

                {showSales && (
                  <td className="border-r border-[#ECEEF1] px-3 py-3 text-right font-black tabular-nums text-[#353A40]">
                    {formatAmount(
                      row.totalSalesAmount
                    )}
                  </td>
                )}

                {showSubscription && (
                  <>
                    <td className="border-r border-[#ECEEF1] px-3 py-3 text-right font-bold tabular-nums">
                      {formatCount(
                        row.subscriptionNetCount
                      )}
                    </td>
                    <td className="border-r border-[#ECEEF1] px-3 py-3 text-right font-bold tabular-nums">
                      {formatCount(
                        row.kyowonNetCount
                      )}
                    </td>
                  </>
                )}

                {showConsultation && (
                  <>
                    <td className="border-r border-[#ECEEF1] px-3 py-3 text-right font-bold tabular-nums">
                      {formatCount(
                        row.consultationCount
                      )}
                    </td>
                    <td className="border-r border-[#ECEEF1] px-3 py-3 text-right font-bold tabular-nums">
                      {formatCount(
                        row.consultationSalesCount
                      )}
                    </td>
                    <td className="border-r border-[#ECEEF1] px-3 py-3 text-right font-black tabular-nums text-[#7B3B4F]">
                      {formatRate(
                        row.consultationSuccessRate
                      )}
                    </td>
                  </>
                )}

                {showLead && (
                  <>
                    <td className="border-r border-[#ECEEF1] px-3 py-3 text-right font-bold tabular-nums">
                      {formatCount(
                        row.leadInCount
                      )}
                    </td>
                    <td className="border-r border-[#ECEEF1] px-3 py-3 text-right font-bold tabular-nums">
                      {formatCount(
                        row.leadSuccessCount
                      )}
                    </td>
                    <td className="border-r border-[#ECEEF1] px-3 py-3 text-right font-black tabular-nums text-[#7B3B4F]">
                      {formatRate(
                        row.leadSuccessRate
                      )}
                    </td>
                  </>
                )}

                {showReview &&
                  snapshot.resolution
                    .reviewMetrics.map(
                      (metric) => (
                        <td
                          key={
                            metric.metricId
                          }
                          className="border-r border-[#ECEEF1] px-3 py-3 text-right font-bold tabular-nums"
                        >
                          {formatCount(
                            row.reviewValues[
                              metric.metricId
                            ] ?? 0
                          )}
                        </td>
                      )
                    )}

                {showReview && (
                  <td className="px-3 py-3 text-right font-black tabular-nums text-[#3E434A]">
                    {formatCount(
                      row.reviewTotal
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-[#D8B9C3] bg-[#FFF7F9] text-[#4A3D42]">
              <td className="sticky left-0 z-10 border-r border-[#E7D9DE] bg-[#FFF7F9] px-3 py-3 text-center font-black text-[#A50034]">
                합계
              </td>
              <td className="sticky left-[108px] z-10 border-r border-[#E7D9DE] bg-[#FFF7F9] px-3 py-3 font-black text-[#A50034]">
                {selectedManagerCount}
                명 선택
              </td>

              {showSales && (
                <td className="border-r border-[#E7D9DE] px-3 py-3 text-right font-black tabular-nums">
                  {formatAmount(
                    total.totalSalesAmount
                  )}
                </td>
              )}

              {showSubscription && (
                <>
                  <td className="border-r border-[#E7D9DE] px-3 py-3 text-right font-black tabular-nums">
                    {formatCount(
                      total.subscriptionNetCount
                    )}
                  </td>
                  <td className="border-r border-[#E7D9DE] px-3 py-3 text-right font-black tabular-nums">
                    {formatCount(
                      total.kyowonNetCount
                    )}
                  </td>
                </>
              )}

              {showConsultation && (
                <>
                  <td className="border-r border-[#E7D9DE] px-3 py-3 text-right font-black tabular-nums">
                    {formatCount(
                      total.consultationCount
                    )}
                  </td>
                  <td className="border-r border-[#E7D9DE] px-3 py-3 text-right font-black tabular-nums">
                    {formatCount(
                      total.consultationSalesCount
                    )}
                  </td>
                  <td className="border-r border-[#E7D9DE] px-3 py-3 text-right font-black tabular-nums text-[#A50034]">
                    {formatRate(
                      total.consultationSuccessRate
                    )}
                  </td>
                </>
              )}

              {showLead && (
                <>
                  <td className="border-r border-[#E7D9DE] px-3 py-3 text-right font-black tabular-nums">
                    {formatCount(
                      total.leadInCount
                    )}
                  </td>
                  <td className="border-r border-[#E7D9DE] px-3 py-3 text-right font-black tabular-nums">
                    {formatCount(
                      total.leadSuccessCount
                    )}
                  </td>
                  <td className="border-r border-[#E7D9DE] px-3 py-3 text-right font-black tabular-nums text-[#A50034]">
                    {formatRate(
                      total.leadSuccessRate
                    )}
                  </td>
                </>
              )}

              {showReview &&
                snapshot.resolution
                  .reviewMetrics.map(
                    (metric) => (
                      <td
                        key={
                          metric.metricId
                        }
                        className="border-r border-[#E7D9DE] px-3 py-3 text-right font-black tabular-nums"
                      >
                        {formatCount(
                          total.reviewValues[
                            metric.metricId
                          ] ?? 0
                        )}
                      </td>
                    )
                  )}

              {showReview && (
                <td className="px-3 py-3 text-right font-black tabular-nums">
                  {formatCount(
                    total.reviewTotal
                  )}
                </td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}


function PerformanceAnalysis({
  initialSnapshot,
  initialError,
}: {
  initialSnapshot:
    PerformanceAnalysisSnapshot | null;
  initialError: string;
}) {
  const [
    view,
    setView,
  ] =
    useState<PerformanceView>(
      "monthly"
    );

  const currentMonth =
    getKstMonth();

  const currentToday =
    getKstToday();

  const [
    monthlySnapshot,
    setMonthlySnapshot,
  ] =
    useState<PerformanceAnalysisSnapshot | null>(
      initialSnapshot
    );

  const [
    dailySnapshot,
    setDailySnapshot,
  ] =
    useState<PerformanceAnalysisSnapshot | null>(
      initialSnapshot
    );

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState(
      initialError
    );

  const [
    loadingTarget,
    setLoadingTarget,
  ] =
    useState<
      "monthly" |
      "daily" |
      null
    >(null);

  const isLoading =
    loadingTarget !== null;

  const [
    exportingView,
    setExportingView,
  ] =
    useState<
      PerformanceView | null
    >(null);

  const [
    startMonth,
    setStartMonth,
  ] =
    useState(
      initialSnapshot?.startDate.slice(
        0,
        7
      ) ?? currentMonth
    );

  const [
    endMonth,
    setEndMonth,
  ] =
    useState(
      initialSnapshot?.endDate.slice(
        0,
        7
      ) ?? currentMonth
    );

  const [
    dailyMonth,
    setDailyMonth,
  ] =
    useState(
      initialSnapshot?.endDate.slice(
        0,
        7
      ) ?? currentMonth
    );

  const [
    selectedManagerIds,
    setSelectedManagerIds,
  ] =
    useState<string[]>(
      () =>
        initialSnapshot?.managers
          .filter(
            (manager) =>
              manager.isActive
          )
          .map(
            (manager) =>
              manager.id
          ) ?? []
    );

  const [
    metricGroup,
    setMetricGroup,
  ] =
    useState<MetricGroup>(
      "all"
    );

  const activeSnapshot =
    view === "monthly"
      ? monthlySnapshot
      : dailySnapshot;

  const activeRows =
    useMemo(
      () =>
        view === "monthly"
          ? monthlySnapshot?.monthlyRows ?? []
          : dailySnapshot?.dailyRows ?? [],
      [
        view,
        monthlySnapshot,
        dailySnapshot,
      ]
    );

  const relevantManagerIds =
    useMemo(() => {
      const result =
        new Set<string>();

      for (
        const row of
        activeRows
      ) {
        result.add(
          row.managerId
        );
      }

      return result;
    }, [activeRows]);

  const availableManagers =
    useMemo(
      () =>
        (activeSnapshot?.managers ??
          []).filter(
          (manager) =>
            manager.isActive ||
            relevantManagerIds.has(
              manager.id
            )
        ),
      [
        activeSnapshot,
        relevantManagerIds,
      ]
    );

  const managerOrder =
    useMemo(
      () =>
        new Map(
          availableManagers.map(
            (manager, index) => [
              manager.id,
              manager.displayOrder ??
                index,
            ]
          )
        ),
      [availableManagers]
    );

  const filteredMonthlyRows =
    useMemo(() => {
      if (!monthlySnapshot) {
        return [];
      }

      const selected =
        new Set(
          selectedManagerIds
        );

      return monthlySnapshot.monthlyRows
        .filter(
          (row) =>
            selected.has(
              row.managerId
            )
        )
        .sort(
          (a, b) =>
            a.monthKey.localeCompare(
              b.monthKey
            ) ||
            (managerOrder.get(
              a.managerId
            ) ?? 9999) -
              (managerOrder.get(
                b.managerId
              ) ?? 9999) ||
            a.managerName.localeCompare(
              b.managerName,
              "ko"
            )
        );
    }, [
      monthlySnapshot,
      selectedManagerIds,
      managerOrder,
    ]);

  const filteredDailyRows =
    useMemo(() => {
      if (!dailySnapshot) {
        return [];
      }

      const selected =
        new Set(
          selectedManagerIds
        );

      return dailySnapshot.dailyRows
        .filter(
          (row) =>
            selected.has(
              row.managerId
            )
        )
        .sort(
          (a, b) =>
            (a.reportDate ??
              "").localeCompare(
              b.reportDate ?? ""
            ) ||
            (managerOrder.get(
              a.managerId
            ) ?? 9999) -
              (managerOrder.get(
                b.managerId
              ) ?? 9999) ||
            a.managerName.localeCompare(
              b.managerName,
              "ko"
            )
        );
    }, [
      dailySnapshot,
      selectedManagerIds,
      managerOrder,
    ]);

  const monthlySummary =
    useMemo(() => {
      if (!monthlySnapshot) {
        return null;
      }

      return buildTotalRow(
        filteredMonthlyRows,
        monthlySnapshot
      );
    }, [
      filteredMonthlyRows,
      monthlySnapshot,
    ]);

  const dailySummary =
    useMemo(() => {
      if (!dailySnapshot) {
        return null;
      }

      return buildTotalRow(
        filteredDailyRows,
        dailySnapshot
      );
    }, [
      filteredDailyRows,
      dailySnapshot,
    ]);

  const setManagersFromSnapshot = (
    nextSnapshot: PerformanceAnalysisSnapshot,
    rowType:
      | "monthly"
      | "daily",
    preserveSelection: boolean
  ) => {
    const sourceRows =
      rowType === "monthly"
        ? nextSnapshot.monthlyRows
        : nextSnapshot.dailyRows;

    const nextManagers =
      nextSnapshot.managers.filter(
        (manager) =>
          manager.isActive ||
          sourceRows.some(
            (row) =>
              row.managerId ===
              manager.id
          )
      );

    if (preserveSelection) {
      const validIds =
        new Set(
          nextManagers.map(
            (manager) =>
              manager.id
          )
        );

      const preserved =
        selectedManagerIds.filter(
          (id) =>
            validIds.has(id)
        );

      setSelectedManagerIds(
        preserved.length > 0
          ? preserved
          : nextManagers.map(
              (manager) =>
                manager.id
            )
      );
    } else {
      setSelectedManagerIds(
        nextManagers.map(
          (manager) =>
            manager.id
        )
      );
    }
  };

  const fetchSnapshot =
    async (
      startDate: string,
      endDate: string
    ) => {
      const response =
        await fetch(
          `/api/analytics/performance?start=${encodeURIComponent(
            startDate
          )}&end=${encodeURIComponent(
            endDate
          )}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

      const payload =
        (await response.json()) as
          | PerformanceAnalysisSnapshot
          | {
              error?: string;
            };

      if (!response.ok) {
        throw new Error(
          "error" in payload &&
          payload.error
            ? payload.error
            : "실적 분석 데이터를 불러오지 못했습니다."
        );
      }

      return payload as
        PerformanceAnalysisSnapshot;
    };

  const getQueryEndDate = (
    monthKey: string
  ) => {
    if (
      monthKey ===
        currentMonth &&
      currentToday
    ) {
      return currentToday;
    }

    return getMonthLastDate(
      monthKey
    );
  };

  const loadMonthlySnapshot =
    async (
      targetStartMonth: string,
      targetEndMonth: string,
      preserveSelection = true
    ) => {
      if (
        !targetStartMonth ||
        !targetEndMonth
      ) {
        setErrorMessage(
          "조회 시작월과 종료월을 선택해주세요."
        );
        return;
      }

      if (
        targetStartMonth >
        targetEndMonth
      ) {
        setErrorMessage(
          "조회 시작월은 종료월보다 늦을 수 없습니다."
        );
        return;
      }

      const startDate =
        `${targetStartMonth}-01`;

      const endDate =
        getQueryEndDate(
          targetEndMonth
        );

      if (!endDate) {
        setErrorMessage(
          "조회기간을 확인해주세요."
        );
        return;
      }

      setLoadingTarget(
        "monthly"
      );
      setErrorMessage("");

      try {
        const nextSnapshot =
          await fetchSnapshot(
            startDate,
            endDate
          );

        setMonthlySnapshot(
          nextSnapshot
        );

        setManagersFromSnapshot(
          nextSnapshot,
          "monthly",
          preserveSelection
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "실적 분석 데이터를 불러오지 못했습니다."
        );
      } finally {
        setLoadingTarget(null);
      }
    };

  const loadDailySnapshot =
    async (
      targetMonth: string,
      preserveSelection = true
    ) => {
      if (!targetMonth) {
        setErrorMessage(
          "조회할 기준월을 선택해주세요."
        );
        return;
      }

      const startDate =
        `${targetMonth}-01`;

      const endDate =
        getQueryEndDate(
          targetMonth
        );

      if (!endDate) {
        setErrorMessage(
          "기준월을 확인해주세요."
        );
        return;
      }

      setLoadingTarget(
        "daily"
      );
      setErrorMessage("");

      try {
        const nextSnapshot =
          await fetchSnapshot(
            startDate,
            endDate
          );

        setDailySnapshot(
          nextSnapshot
        );

        setManagersFromSnapshot(
          nextSnapshot,
          "daily",
          preserveSelection
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "일자별 실적 데이터를 불러오지 못했습니다."
        );
      } finally {
        setLoadingTarget(null);
      }
    };

  const handleMonthlySearch =
    () => {
      void loadMonthlySnapshot(
        startMonth,
        endMonth,
        true
      );
    };

  const handleMonthlyReset =
    () => {
      setStartMonth(
        currentMonth
      );
      setEndMonth(
        currentMonth
      );
      setMetricGroup(
        "all"
      );

      void loadMonthlySnapshot(
        currentMonth,
        currentMonth,
        false
      );
    };

  const handleDailySearch =
    () => {
      void loadDailySnapshot(
        dailyMonth,
        true
      );
    };

  const handleDailyReset =
    () => {
      setDailyMonth(
        currentMonth
      );
      setMetricGroup(
        "all"
      );

      void loadDailySnapshot(
        currentMonth,
        false
      );
    };

  const handleExcelDownload =
    async () => {
      const targetView =
        view;

      const targetSnapshot =
        targetView ===
        "monthly"
          ? monthlySnapshot
          : dailySnapshot;

      const targetRows =
        targetView ===
        "monthly"
          ? filteredMonthlyRows
          : filteredDailyRows;

      const targetSummary =
        targetView ===
        "monthly"
          ? monthlySummary
          : dailySummary;

      if (
        !targetSnapshot ||
        !targetSummary ||
        targetRows.length === 0
      ) {
        setErrorMessage(
          "Excel로 다운로드할 실적이 없습니다. 조회조건을 확인해주세요."
        );
        return;
      }

      const selectedIdSet =
        new Set(
          selectedManagerIds
        );

      const selectedManagerNames =
        availableManagers
          .filter(
            (manager) =>
              selectedIdSet.has(
                manager.id
              )
          )
          .map(
            (manager) =>
              manager.name
          );

      setExportingView(
        targetView
      );
      setErrorMessage("");

      try {
        const {
          downloadPerformanceAnalysisExcel,
        } =
          await import(
            "@/lib/analytics/excel"
          );

        await downloadPerformanceAnalysisExcel({
          view:
            targetView,
          snapshot:
            targetSnapshot,
          rows:
            targetRows,
          summary:
            targetSummary,
          metricGroup,
          selectedManagerNames,
        });
      }
      catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Excel 파일을 생성하지 못했습니다."
        );
      }
      finally {
        setExportingView(
          null
        );
      }
    };


  const summary =
    view === "monthly"
      ? monthlySummary
      : dailySummary;

  const currentRows =
    view === "monthly"
      ? filteredMonthlyRows
      : filteredDailyRows;

  return (
    <div className="space-y-4">
      <section className="rounded-[20px] border border-[#E5E7EA] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-black text-[#3B3F45]">
              조회 단위
            </p>
            <p className="mt-1 text-[11px] leading-5 text-[#92969D]">
              월별 누적 또는 선택월의 일자별 실적을 조회합니다.
            </p>
          </div>

          <div className="inline-flex w-full rounded-[12px] border border-[#E1E3E6] bg-[#F7F8F9] p-1 sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setView(
                  "monthly"
                );
                setErrorMessage("");
              }}
              className={[
                "flex flex-1 items-center justify-center gap-1.5 rounded-[9px] px-4 py-2 text-[12px] font-black transition sm:flex-none",
                view ===
                "monthly"
                  ? "bg-white text-[#A50034] shadow-sm"
                  : "text-[#777C84] hover:text-[#41454B]",
              ].join(" ")}
            >
              <LayoutGrid
                size={14}
              />
              월별내역
            </button>

            <button
              type="button"
              onClick={() => {
                setView(
                  "daily"
                );
                setErrorMessage("");
              }}
              className={[
                "flex flex-1 items-center justify-center gap-1.5 rounded-[9px] px-4 py-2 text-[12px] font-black transition sm:flex-none",
                view ===
                "daily"
                  ? "bg-white text-[#A50034] shadow-sm"
                  : "text-[#777C84] hover:text-[#41454B]",
              ].join(" ")}
            >
              <CalendarDays
                size={14}
              />
              일자별내역
            </button>
          </div>
        </div>
      </section>

      <ReadyPanel
        eyebrow={
          view ===
          "monthly"
            ? "MONTHLY PERFORMANCE"
            : "DAILY PERFORMANCE"
        }
        title={
          view ===
          "monthly"
            ? "월별 실적 분석"
            : "일자별 실적 분석"
        }
        description={
          view ===
          "monthly"
            ? "선택기간의 매니저별 총판매·구독·구독교원·상담·가망객·후기 실적을 월 단위로 집계합니다."
            : "선택월의 매니저별 총판매·구독·구독교원·상담·가망객·후기 실적을 일자 단위로 집계합니다."
        }
      >
        <DataConnectionPanel
          snapshot={
            activeSnapshot
          }
          errorMessage={
            errorMessage
          }
        />

        <div className="mt-5 space-y-4">
          {view === "monthly" ? (
            <section className="rounded-[16px] border border-[#E2E4E7] bg-[#FAFAFB] p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <MonthPicker
                    label="시작월"
                    value={
                      startMonth
                    }
                    onChange={
                      setStartMonth
                    }
                    maxMonth={
                      currentMonth
                    }
                  />

                  <MonthPicker
                    label="종료월"
                    value={
                      endMonth
                    }
                    onChange={
                      setEndMonth
                    }
                    maxMonth={
                      currentMonth
                    }
                  />

                  <div>
                    <span className="mb-1.5 block text-[10px] font-black text-[#777C84]">
                      매니저
                    </span>
                    <ManagerSelector
                      managers={
                        availableManagers
                      }
                      selectedIds={
                        selectedManagerIds
                      }
                      onChange={
                        setSelectedManagerIds
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={
                      handleMonthlyReset
                    }
                    disabled={
                      isLoading
                    }
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[11px] border border-[#DDE0E4] bg-white px-4 text-[11px] font-black text-[#686D74] transition hover:bg-[#F7F8F9] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RotateCcw
                      size={14}
                    />
                    초기화
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleMonthlySearch
                    }
                    disabled={
                      isLoading
                    }
                    className="inline-flex h-10 min-w-[92px] items-center justify-center gap-1.5 rounded-[11px] bg-[#A50034] px-4 text-[11px] font-black text-white transition hover:bg-[#8F002D] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingTarget ===
                    "monthly" ? (
                      <LoaderCircle
                        size={14}
                        className="animate-spin"
                      />
                    ) : (
                      <Search
                        size={14}
                      />
                    )}
                    조회
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void handleExcelDownload();
                    }}
                    disabled={
                      isLoading ||
                      exportingView !==
                        null ||
                      filteredMonthlyRows.length ===
                        0
                    }
                    className="inline-flex h-10 min-w-[132px] items-center justify-center gap-1.5 rounded-[11px] border border-[#F0D4DB] bg-[#FFF7F9] px-4 text-[11px] font-black text-[#A50034] transition hover:bg-[#FFF0F4] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {exportingView ===
                    "monthly" ? (
                      <LoaderCircle
                        size={14}
                        className="animate-spin"
                      />
                    ) : (
                      <FileSpreadsheet
                        size={14}
                      />
                    )}
                    {exportingView ===
                    "monthly"
                      ? "Excel 생성중"
                      : "Excel 다운로드"}
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <section className="rounded-[16px] border border-[#E2E4E7] bg-[#FAFAFB] p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div className="grid gap-3 sm:grid-cols-2">
                  <MonthPicker
                    label="조회 월"
                    value={
                      dailyMonth
                    }
                    onChange={
                      setDailyMonth
                    }
                    maxMonth={
                      currentMonth
                    }
                  />

                  <div>
                    <span className="mb-1.5 block text-[10px] font-black text-[#777C84]">
                      매니저
                    </span>
                    <ManagerSelector
                      managers={
                        availableManagers
                      }
                      selectedIds={
                        selectedManagerIds
                      }
                      onChange={
                        setSelectedManagerIds
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={
                      handleDailyReset
                    }
                    disabled={
                      isLoading
                    }
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[11px] border border-[#DDE0E4] bg-white px-4 text-[11px] font-black text-[#686D74] transition hover:bg-[#F7F8F9] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RotateCcw
                      size={14}
                    />
                    초기화
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleDailySearch
                    }
                    disabled={
                      isLoading
                    }
                    className="inline-flex h-10 min-w-[92px] items-center justify-center gap-1.5 rounded-[11px] bg-[#A50034] px-4 text-[11px] font-black text-white transition hover:bg-[#8F002D] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingTarget ===
                    "daily" ? (
                      <LoaderCircle
                        size={14}
                        className="animate-spin"
                      />
                    ) : (
                      <Search
                        size={14}
                      />
                    )}
                    조회
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void handleExcelDownload();
                    }}
                    disabled={
                      isLoading ||
                      exportingView !==
                        null ||
                      filteredDailyRows.length ===
                        0
                    }
                    className="inline-flex h-10 min-w-[132px] items-center justify-center gap-1.5 rounded-[11px] border border-[#F0D4DB] bg-[#FFF7F9] px-4 text-[11px] font-black text-[#A50034] transition hover:bg-[#FFF0F4] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {exportingView ===
                    "daily" ? (
                      <LoaderCircle
                        size={14}
                        className="animate-spin"
                      />
                    ) : (
                      <FileSpreadsheet
                        size={14}
                      />
                    )}
                    {exportingView ===
                    "daily"
                      ? "Excel 생성중"
                      : "Excel 다운로드"}
                  </button>
                </div>
              </div>
            </section>
          )}

          <section className="flex flex-col gap-3 rounded-[16px] border border-[#E2E4E7] bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-black text-[#777C84]">
                표시 항목
              </p>
              <p className="mt-1 text-[10px] text-[#9A9EA5]">
                항목 그룹을 선택하면 필요한 컬럼만 볼 수 있습니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {metricGroups.map(
                (group) => (
                  <button
                    type="button"
                    key={group.id}
                    onClick={() =>
                      setMetricGroup(
                        group.id
                      )
                    }
                    className={[
                      "rounded-[9px] border px-3 py-2 text-[10px] font-black transition",
                      metricGroup ===
                      group.id
                        ? "border-[#D8B9C3] bg-[#FFF1F4] text-[#A50034]"
                        : "border-[#E1E3E6] bg-white text-[#72777E] hover:bg-[#F8F9FA]",
                    ].join(" ")}
                  >
                    {group.label}
                  </button>
                )
              )}
            </div>
          </section>

          {activeSnapshot &&
            summary && (
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[15px] border border-[#E6E8EB] bg-[#FAFAFB] px-4 py-4">
                  <p className="text-[10px] font-bold text-[#92969D]">
                    선택 매니저
                  </p>
                  <p className="mt-1 text-[18px] font-black text-[#3E4248]">
                    {selectedManagerIds.length}
                    <span className="ml-1 text-[11px] font-bold text-[#858A92]">
                      명
                    </span>
                  </p>
                </div>

                <div className="rounded-[15px] border border-[#E6E8EB] bg-[#FAFAFB] px-4 py-4">
                  <p className="text-[10px] font-bold text-[#92969D]">
                    총판매 합계
                  </p>
                  <p className="mt-1 text-[18px] font-black tabular-nums text-[#3E4248]">
                    {formatAmount(
                      summary.totalSalesAmount
                    )}
                    <span className="ml-1 text-[10px] font-bold text-[#858A92]">
                      원
                    </span>
                  </p>
                </div>

                <div className="rounded-[15px] border border-[#E6E8EB] bg-[#FAFAFB] px-4 py-4">
                  <p className="text-[10px] font-bold text-[#92969D]">
                    구독 판매
                  </p>
                  <p className="mt-1 text-[18px] font-black tabular-nums text-[#3E4248]">
                    {formatCount(
                      summary.subscriptionNetCount
                    )}
                    <span className="ml-1 text-[11px] font-bold text-[#858A92]">
                      건
                    </span>
                  </p>
                </div>

                <div className="rounded-[15px] border border-[#E6E8EB] bg-[#FAFAFB] px-4 py-4">
                  <p className="text-[10px] font-bold text-[#92969D]">
                    상담 성공률
                  </p>
                  <p className="mt-1 text-[18px] font-black tabular-nums text-[#3E4248]">
                    {formatRate(
                      summary.consultationSuccessRate
                    )}
                  </p>
                </div>
              </section>
            )}

          {isLoading ? (
            <div className="flex min-h-[240px] items-center justify-center rounded-[16px] border border-[#E2E4E7] bg-white">
              <div className="text-center">
                <LoaderCircle
                  size={24}
                  className="mx-auto animate-spin text-[#8A8F97]"
                />
                <p className="mt-3 text-[11px] font-bold text-[#777C84]">
                  {loadingTarget ===
                  "daily"
                    ? "일자별 실적을 집계하는 중입니다."
                    : "월별 실적을 집계하는 중입니다."}
                </p>
              </div>
            </div>
          ) : view === "monthly" &&
            monthlySnapshot ? (
            <MonthlyPerformanceTable
              snapshot={
                monthlySnapshot
              }
              rows={
                filteredMonthlyRows
              }
              selectedManagerCount={
                selectedManagerIds.length
              }
              metricGroup={
                metricGroup
              }
            />
          ) : view === "daily" &&
            dailySnapshot ? (
            <DailyPerformanceTable
              snapshot={
                dailySnapshot
              }
              rows={
                filteredDailyRows
              }
              selectedManagerCount={
                selectedManagerIds.length
              }
              metricGroup={
                metricGroup
              }
            />
          ) : null}

          <div className="rounded-[14px] border border-[#ECEEF1] bg-[#FAFAFB] px-4 py-3 text-[10px] leading-5 text-[#8D9299]">
            {view === "monthly"
              ? "성공률 합계는 월별 성공률의 평균이 아니라, 선택기간 전체의 성공건수와 기준건수를 합산한 뒤 다시 계산합니다."
              : "일자별 성공률 합계도 일별 성공률의 평균이 아니라, 선택월 전체의 성공건수와 기준건수를 합산한 뒤 다시 계산합니다."}
            {" "}
            관리자 계정의 실적은 매니저 분석에서 제외됩니다.
            {" "}
            현재 표시행 {currentRows.length.toLocaleString("ko-KR")}건입니다.
          </div>
        </div>
      </ReadyPanel>
    </div>
  );
}

function SystemCompareAnalysis() {
  const currentMonth =
    getKstMonth();

  const currentToday =
    getKstToday();

  const [
    queryMonth,
    setQueryMonth,
  ] =
    useState(
      currentMonth
    );

  const [
    snapshot,
    setSnapshot,
  ] =
    useState<SystemCompareSnapshot | null>(
      null
    );

  const [
    dataset,
    setDataset,
  ] =
    useState<SystemCompareDataset>(
      "sales"
    );

  const [
    selectedManagerIds,
    setSelectedManagerIds,
  ] =
    useState<string[]>(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    exporting,
    setExporting,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const getMonthEnd =
    (
      monthKey: string
    ) => {
      if (
        monthKey ===
          currentMonth &&
        currentToday
      ) {
        return currentToday;
      }

      return getMonthLastDate(
        monthKey
      );
    };

  const loadComparison =
    async (
      monthKey: string,
      preserveSelection = true
    ) => {
      const startDate =
        `${monthKey}-01`;

      const endDate =
        getMonthEnd(
          monthKey
        );

      if (
        !endDate
      ) {
        setErrorMessage(
          "조회 월을 확인해주세요."
        );
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const response =
          await fetch(
            `/api/analytics/system-compare?start=${encodeURIComponent(
              startDate
            )}&end=${encodeURIComponent(
              endDate
            )}`,
            {
              method: "GET",
              cache: "no-store",
            }
          );

        const payload =
          await response.json() as
            | SystemCompareSnapshot
            | {
                error?: string;
              };

        if (
          !response.ok
        ) {
          throw new Error(
            "error" in payload &&
            payload.error
              ? payload.error
              : "전산 비교 데이터를 불러오지 못했습니다."
          );
        }

        const nextSnapshot =
          payload as
            SystemCompareSnapshot;

        setSnapshot(
          nextSnapshot
        );

        const validManagerIds =
          new Set(
            nextSnapshot.managers.map(
              (manager) =>
                manager.id
            )
          );

        if (
          preserveSelection
        ) {
          const preserved =
            selectedManagerIds.filter(
              (id) =>
                validManagerIds.has(
                  id
                )
            );

          setSelectedManagerIds(
            preserved.length >
              0
              ? preserved
              : nextSnapshot.managers.map(
                  (manager) =>
                    manager.id
                )
          );
        }
        else {
          setSelectedManagerIds(
            nextSnapshot.managers.map(
              (manager) =>
                manager.id
            )
          );
        }
      }
      catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "전산 비교 데이터를 불러오지 못했습니다."
        );
      }
      finally {
        setLoading(false);
      }
    };

  const getRowStatus =
    useCallback(
      (
        row:
          SystemCompareSnapshot["rows"][number]
      ) =>
        dataset ===
        "sales"
          ? row.salesStatus
          : row.revenueStatus,
      [dataset]
    );

  const getSystemAmount =
    useCallback(
      (
        row:
          SystemCompareSnapshot["rows"][number]
      ) =>
        dataset ===
        "sales"
          ? row.systemSalesAmount
          : row.systemRevenueAmount,
      [dataset]
    );

  const getDifference =
    useCallback(
      (
        row:
          SystemCompareSnapshot["rows"][number]
      ) =>
        dataset ===
        "sales"
          ? row.salesDifference
          : row.revenueDifference,
      [dataset]
    );

  const filteredRows =
    useMemo(() => {
      if (!snapshot) {
        return [];
      }

      const selected =
        new Set(
          selectedManagerIds
        );

      return snapshot.rows
        .filter(
          (row) =>
            selected.has(
              row.managerId
            )
        )
        .sort(
          (a, b) =>
            a.reportDate.localeCompare(
              b.reportDate
            ) ||
            a.managerDisplayOrder -
              b.managerDisplayOrder ||
            a.managerName.localeCompare(
              b.managerName,
              "ko"
            )
        );
    }, [
      snapshot,
      selectedManagerIds,
    ]);

  const summary =
    useMemo(() => {
      let match = 0;
      let mismatch = 0;
      let missing = 0;
      let dailyTotal = 0;
      let systemTotal = 0;
      let differenceTotal = 0;

      for (
        const row of
        filteredRows
      ) {
        const status =
          getRowStatus(
            row
          );

        if (
          status === "match"
        ) {
          match += 1;
        }
        else if (
          status ===
          "mismatch"
        ) {
          mismatch += 1;
        }
        else {
          missing += 1;
        }

        if (
          row.dailyTotalSalesAmount !==
          null
        ) {
          dailyTotal +=
            row.dailyTotalSalesAmount;
        }

        const systemAmount =
          getSystemAmount(
            row
          );

        if (
          systemAmount !==
          null
        ) {
          systemTotal +=
            systemAmount;
        }

        const difference =
          getDifference(
            row
          );

        if (
          difference !==
          null
        ) {
          differenceTotal +=
            difference;
        }
      }

      return {
        match,
        mismatch,
        missing,
        dailyTotal,
        systemTotal,
        differenceTotal,
      };
    }, [
      filteredRows,
      getRowStatus,
      getSystemAmount,
      getDifference,
    ]);

  const statusText =
    (
      status:
        SystemCompareStatus
    ) => {
      switch (status) {
        case "match":
          return "일치";
        case "mismatch":
          return "불일치";
        case "missing-daily":
          return "일실적 없음";
        case "missing-system":
          return "전산실적 없음";
        default:
          return "자료 없음";
      }
    };

  const statusClass =
    (
      status:
        SystemCompareStatus
    ) => {
      switch (status) {
        case "match":
          return "border-[#D6E9DC] bg-[#F2FAF5] text-[#287348]";
        case "mismatch":
          return "border-[#F0CDD3] bg-[#FFF5F7] text-[#A50034]";
        default:
          return "border-[#E2E4E7] bg-[#F7F8F9] text-[#777C84]";
      }
    };

  const formatNullableAmount =
    (
      value:
        number | null
    ) =>
      value === null
        ? "-"
        : formatAmount(
            value
          );

  const formatDifference =
    (
      value:
        number | null
    ) => {
      if (
        value === null
      ) {
        return "-";
      }

      if (
        value === 0
      ) {
        return "0";
      }

      return `${value > 0
        ? "+"
        : ""}${formatAmount(
        value
      )}`;
    };

  const handleReset =
    () => {
      setQueryMonth(
        currentMonth
      );
      setDataset(
        "sales"
      );
      void loadComparison(
        currentMonth,
        false
      );
    };

  const handleExcelDownload =
    async () => {
      if (
        !snapshot ||
        filteredRows.length ===
          0
      ) {
        setErrorMessage(
          "Excel로 다운로드할 비교 결과가 없습니다."
        );
        return;
      }

      setExporting(true);
      setErrorMessage("");

      try {
        const {
          downloadSystemCompareExcel,
        } =
          await import(
            "@/lib/analytics/system-compare-excel"
          );

        const selectedSet =
          new Set(
            selectedManagerIds
          );

        await downloadSystemCompareExcel({
          dataset,
          snapshot,
          rows:
            filteredRows,
          selectedManagerNames:
            snapshot.managers
              .filter(
                (manager) =>
                  selectedSet.has(
                    manager.id
                  )
              )
              .map(
                (manager) =>
                  manager.name
              ),
        });
      }
      catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "전산 비교 Excel 파일을 생성하지 못했습니다."
        );
      }
      finally {
        setExporting(false);
      }
    };

  return (
    <ReadyPanel
      eyebrow="SYSTEM COMPARISON"
      title="전산 비교"
      description="일실적 총판매와 전산실적의 사원별 당일실적을 일자·매니저 단위로 비교합니다. 비교 기준은 사원별 판매 또는 사원별 매출 중 선택할 수 있습니다."
    >
      <div className="mt-5 space-y-4">
        <section className="rounded-[16px] border border-[#E2E4E7] bg-[#FAFAFB] p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MonthPicker
                label="조회 월"
                value={
                  queryMonth
                }
                onChange={
                  setQueryMonth
                }
                maxMonth={
                  currentMonth
                }
              />

              <div>
                <span className="mb-1.5 block text-[10px] font-black text-[#777C84]">
                  매니저
                </span>
                <ManagerSelector
                  managers={
                    snapshot?.managers ??
                    []
                  }
                  selectedIds={
                    selectedManagerIds
                  }
                  onChange={
                    setSelectedManagerIds
                  }
                />
              </div>

              <div>
                <span className="mb-1.5 block text-[10px] font-black text-[#777C84]">
                  전산 비교기준
                </span>
                <div className="inline-flex h-10 w-full min-w-[210px] rounded-[11px] border border-[#DDE0E4] bg-white p-1">
                  <button
                    type="button"
                    onClick={() =>
                      setDataset(
                        "sales"
                      )
                    }
                    className={[
                      "flex-1 rounded-[8px] px-3 text-[10px] font-black transition",
                      dataset ===
                      "sales"
                        ? "bg-[#A50034] text-white"
                        : "text-[#70757C] hover:bg-[#F6F7F8]",
                    ].join(" ")}
                  >
                    사원별 판매
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDataset(
                        "revenue"
                      )
                    }
                    className={[
                      "flex-1 rounded-[8px] px-3 text-[10px] font-black transition",
                      dataset ===
                      "revenue"
                        ? "bg-[#A50034] text-white"
                        : "text-[#70757C] hover:bg-[#F6F7F8]",
                    ].join(" ")}
                  >
                    사원별 매출
                  </button>
                </div>
              </div>

            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={
                  handleReset
                }
                disabled={
                  loading
                }
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[11px] border border-[#DDE0E4] bg-white px-4 text-[11px] font-black text-[#686D74] transition hover:bg-[#F7F8F9] disabled:opacity-50"
              >
                <RotateCcw
                  size={14}
                />
                초기화
              </button>

              <button
                type="button"
                onClick={() =>
                  void loadComparison(
                    queryMonth,
                    true
                  )
                }
                disabled={
                  loading
                }
                className="inline-flex h-10 min-w-[92px] items-center justify-center gap-1.5 rounded-[11px] bg-[#A50034] px-4 text-[11px] font-black text-white transition hover:bg-[#8F002D] disabled:opacity-50"
              >
                {loading ? (
                  <LoaderCircle
                    size={14}
                    className="animate-spin"
                  />
                ) : (
                  <Search
                    size={14}
                  />
                )}
                조회
              </button>

              <button
                type="button"
                onClick={() =>
                  void handleExcelDownload()
                }
                disabled={
                  loading ||
                  exporting ||
                  filteredRows.length ===
                    0
                }
                className="inline-flex h-10 min-w-[132px] items-center justify-center gap-1.5 rounded-[11px] border border-[#F0D4DB] bg-[#FFF7F9] px-4 text-[11px] font-black text-[#A50034] transition hover:bg-[#FFF0F4] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {exporting ? (
                  <LoaderCircle
                    size={14}
                    className="animate-spin"
                  />
                ) : (
                  <FileSpreadsheet
                    size={14}
                  />
                )}
                {exporting
                  ? "Excel 생성중"
                  : "Excel 다운로드"}
              </button>
            </div>
          </div>
        </section>

        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-[14px] border border-[#F0CDD3] bg-[#FFF5F7] px-4 py-3 text-[11px] font-bold leading-5 text-[#A50034]">
            <AlertCircle
              size={16}
              className="mt-0.5 shrink-0"
            />
            {errorMessage}
          </div>
        )}

        {snapshot ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-[15px] border border-[#E6E8EB] bg-[#FAFAFB] px-4 py-4">
                <p className="text-[10px] font-bold text-[#92969D]">
                  비교행
                </p>
                <p className="mt-1 text-[18px] font-black tabular-nums text-[#3E4248]">
                  {filteredRows.length.toLocaleString(
                    "ko-KR"
                  )}
                  <span className="ml-1 text-[10px] font-bold text-[#858A92]">
                    행
                  </span>
                </p>
              </div>

              <div className="rounded-[15px] border border-[#D6E9DC] bg-[#F5FBF7] px-4 py-4">
                <p className="text-[10px] font-bold text-[#6E927A]">
                  일치
                </p>
                <p className="mt-1 text-[18px] font-black tabular-nums text-[#287348]">
                  {summary.match.toLocaleString(
                    "ko-KR"
                  )}
                </p>
              </div>

              <div className="rounded-[15px] border border-[#F0CDD3] bg-[#FFF5F7] px-4 py-4">
                <p className="text-[10px] font-bold text-[#A77684]">
                  불일치
                </p>
                <p className="mt-1 text-[18px] font-black tabular-nums text-[#A50034]">
                  {summary.mismatch.toLocaleString(
                    "ko-KR"
                  )}
                </p>
              </div>

              <div className="rounded-[15px] border border-[#E3E5E8] bg-[#F8F9FA] px-4 py-4">
                <p className="text-[10px] font-bold text-[#92969D]">
                  자료없음
                </p>
                <p className="mt-1 text-[18px] font-black tabular-nums text-[#5D6269]">
                  {summary.missing.toLocaleString(
                    "ko-KR"
                  )}
                </p>
              </div>

              <div className="rounded-[15px] border border-[#E6E8EB] bg-[#FAFAFB] px-4 py-4">
                <p className="text-[10px] font-bold text-[#92969D]">
                  차이 합계
                </p>
                <p
                  className={[
                    "mt-1 text-[18px] font-black tabular-nums",
                    summary.differenceTotal ===
                    0
                      ? "text-[#287348]"
                      : "text-[#A50034]",
                  ].join(" ")}
                >
                  {formatDifference(
                    summary.differenceTotal
                  )}
                </p>
              </div>
            </section>

            <section className="overflow-hidden rounded-[16px] border border-[#E2E4E7] bg-white">
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-[#DDE0E4] bg-[#F7F8F9] text-[#5A5F66]">
                      <th className="min-w-[110px] px-3 py-3 text-center font-black">
                        일자
                      </th>
                      <th className="min-w-[120px] px-3 py-3 text-left font-black">
                        매니저
                      </th>
                      <th className="min-w-[150px] px-3 py-3 text-right font-black">
                        일실적 총판매
                      </th>
                      <th className="min-w-[160px] px-3 py-3 text-right font-black">
                        {dataset ===
                        "sales"
                          ? "전산 사원별판매"
                          : "전산 사원별매출"}
                      </th>
                      <th className="min-w-[135px] px-3 py-3 text-right font-black">
                        차이
                      </th>
                      <th className="min-w-[110px] px-3 py-3 text-center font-black">
                        판정
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRows.length >
                    0 ? (
                      filteredRows.map(
                        (row) => {
                          const systemAmount =
                            getSystemAmount(
                              row
                            );

                          const difference =
                            getDifference(
                              row
                            );

                          const status =
                            getRowStatus(
                              row
                            );

                          return (
                            <tr
                              key={`${row.reportDate}-${row.managerId}`}
                              className={[
                                "border-b border-[#ECEEF1]",
                                status ===
                                "mismatch"
                                  ? "bg-[#FFFBFC]"
                                  : "hover:bg-[#FCFCFD]",
                              ].join(" ")}
                            >
                              <td className="px-3 py-3 text-center font-bold tabular-nums text-[#555A62]">
                                {formatDateLabel(
                                  row.reportDate
                                )}
                              </td>

                              <td className="px-3 py-3">
                                <p className="font-black text-[#3F444B]">
                                  {row.managerName}
                                </p>
                                <p className="mt-0.5 text-[9px] font-medium text-[#9A9EA5]">
                                  {row.employeeNo}
                                </p>
                              </td>

                              <td className="px-3 py-3 text-right font-black tabular-nums text-[#3F444B]">
                                {formatNullableAmount(
                                  row.dailyTotalSalesAmount
                                )}
                              </td>

                              <td className="px-3 py-3 text-right font-black tabular-nums text-[#3F444B]">
                                {formatNullableAmount(
                                  systemAmount
                                )}
                              </td>

                              <td
                                className={[
                                  "px-3 py-3 text-right font-black tabular-nums",
                                  difference ===
                                  0
                                    ? "text-[#287348]"
                                    : difference ===
                                      null
                                      ? "text-[#A0A4AA]"
                                      : "text-[#A50034]",
                                ].join(" ")}
                              >
                                {formatDifference(
                                  difference
                                )}
                              </td>

                              <td className="px-3 py-3 text-center">
                                <span
                                  className={[
                                    "inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black",
                                    statusClass(
                                      status
                                    ),
                                  ].join(" ")}
                                >
                                  {statusText(
                                    status
                                  )}
                                </span>
                              </td>
                            </tr>
                          );
                        }
                      )
                    ) : (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-5 py-14 text-center text-[11px] font-bold text-[#969AA1]"
                        >
                          선택한 조건에 해당하는 비교 결과가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="rounded-[14px] border border-[#ECEEF1] bg-[#FAFAFB] px-4 py-3 text-[10px] leading-5 text-[#8D9299]">
              차이는 <strong className="text-[#666B72]">일실적 총판매 - 전산실적 당일실적</strong> 기준입니다.
              {" "}
              전산실적은 최종 적용된 <strong className="text-[#666B72]">current(당일실적)</strong> 자료만 사용하며 Draft는 비교하지 않습니다.
              {" "}
              관리자 계정은 매니저 비교 대상에서 제외됩니다.
              {snapshot.unmatchedSystemEmployeeCount >
              0 && (
                <>
                  {" "}
                  전산 원본에서 현재 매니저 사번과 매칭되지 않은 사원행은{" "}
                  <strong className="text-[#A50034]">
                    {snapshot.unmatchedSystemEmployeeCount}건
                  </strong>
                  입니다.
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex min-h-[230px] items-center justify-center rounded-[16px] border border-dashed border-[#D9DCE1] bg-[#FAFAFB] px-5 text-center">
            <div>
              <GitCompareArrows
                size={24}
                className="mx-auto text-[#A4A8AE]"
              />
              <p className="mt-3 text-[12px] font-black text-[#555A62]">
                조회 월을 선택한 뒤 [조회]를 눌러주세요.
              </p>
              <p className="mt-1 text-[10px] leading-5 text-[#969AA1]">
                일실적과 최종 적용된 전산실적을 읽기 전용으로 비교합니다.
              </p>
            </div>
          </div>
        )}
      </div>
    </ReadyPanel>
  );
}

function BuilderCustomAnalysisTable({
  rows,
  total,
  granularity,
  columns,
}: {
  rows:
    ReturnType<
      typeof buildBuilderCustomAnalysisResult
    >["rows"];

  total:
    ReturnType<
      typeof buildBuilderCustomAnalysisResult
    >["total"];

  granularity:
    CustomGranularity;

  columns:
    Array<{
      libraryKey: string;
      item: AnalysisMetricLibraryItem;
    }>;
}) {
  const formatValue =
    (
      value:
        number | null,
      item:
        AnalysisMetricLibraryItem
    ) => {
      if (
        value === null
      ) {
        return "-";
      }

      if (
        item.unit ===
        "amount"
      ) {
        return formatAmount(
          value
        );
      }

      if (
        item.unit ===
        "percent"
      ) {
        return formatRate(
          value
        );
      }

      if (
        item.defaultAggregationType ===
          "average"
      ) {
        return value.toLocaleString(
          "ko-KR",
          {
            minimumFractionDigits:
              Number.isInteger(
                value
              )
                ? 0
                : 1,
            maximumFractionDigits:
              item.unit ===
                "number"
                ? 2
                : 1,
          }
        );
      }

      return value.toLocaleString(
        "ko-KR",
        {
          maximumFractionDigits:
            item.unit ===
            "number"
              ? 2
              : 0,
        }
      );
    };

  if (
    columns.length ===
    0
  ) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-[16px] border border-dashed border-[#D9DCE1] bg-[#FAFAFB] px-5 text-center">
        <div>
          <LayoutGrid
            size={24}
            className="mx-auto text-[#A4A8AE]"
          />
          <p className="mt-3 text-[12px] font-black text-[#555A62]">
            보고서 구성에 분석항목을 1개 이상 추가해주세요.
          </p>
          <p className="mt-1 text-[10px] leading-5 text-[#969AA1]">
            위 분석항목 카드를 클릭하거나 드래그하면 결과표에 연결됩니다.
          </p>
        </div>
      </div>
    );
  }

  const managerCount =
    new Set(
      rows.map(
        (row) =>
          row.managerId
      )
    ).size;

  return (
    <section className="overflow-hidden rounded-[16px] border border-[#E2E4E7] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ECEEF1] bg-[#FAFAFB] px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center gap-2 text-[8px] font-bold text-[#8B9097]">
          <span className="rounded-full bg-white px-2 py-1 font-black text-[#666B72]">
            {rows.length.toLocaleString(
              "ko-KR"
            )}행
          </span>
          <span className="rounded-full bg-white px-2 py-1 font-black text-[#666B72]">
            {columns.length.toLocaleString(
              "ko-KR"
            )}개 항목
          </span>
          <span className="rounded-full bg-white px-2 py-1 font-black text-[#666B72]">
            {managerCount.toLocaleString(
              "ko-KR"
            )}명
          </span>
        </div>

        <p className="hidden text-[8px] font-bold text-[#A0A4AA] sm:block">
          좌우 스크롤로 모든 분석항목을 확인할 수 있습니다.
        </p>
      </div>

      <div className="space-y-2 p-3 sm:hidden">
        {rows.length >
        0 ? (
          <>
            {rows.map(
              (row) => (
                <article
                  key={`${row.periodKey}-${row.managerId}`}
                  className="rounded-[13px] border border-[#E3E5E8] bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-3 border-b border-[#EEF0F2] pb-2.5">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-[#3F444B]">
                        {row.managerName}
                      </p>
                      <p className="mt-0.5 text-[8px] font-bold text-[#9A9EA5]">
                        {row.employeeNo}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full bg-[#FFF1F4] px-2 py-1 text-[8px] font-black tabular-nums text-[#A50034]">
                      {granularity ===
                      "monthly"
                        ? formatMonthLabel(
                            row.monthKey
                          )
                        : formatDateLabel(
                            row.reportDate ??
                              ""
                          )}
                    </span>
                  </div>

                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    {columns.map(
                      ({
                        libraryKey,
                        item,
                      }) => (
                        <div
                          key={
                            libraryKey
                          }
                          className="min-w-0 rounded-[10px] bg-[#FAFAFB] px-2.5 py-2"
                          title={
                            item.name
                          }
                        >
                          <p className="line-clamp-2 min-h-[28px] text-[8px] font-bold leading-3.5 text-[#858A92]">
                            {item.name}
                          </p>
                          <p className="mt-1 text-right text-[11px] font-black tabular-nums text-[#3F444B]">
                            {formatValue(
                              row.values[
                                libraryKey
                              ] ?? null,
                              item
                            )}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </article>
              )
            )}

            <article className="rounded-[13px] border border-[#E2C7D0] bg-[#FFF7F9] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-black text-[#A50034]">
                  합계
                </p>
                <span className="text-[8px] font-black text-[#8B6D77]">
                  {managerCount}명
                </span>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2">
                {columns.map(
                  ({
                    libraryKey,
                    item,
                  }) => (
                    <div
                      key={
                        libraryKey
                      }
                      className="min-w-0 rounded-[10px] bg-white px-2.5 py-2"
                      title={
                        item.name
                      }
                    >
                      <p className="line-clamp-2 min-h-[28px] text-[8px] font-bold leading-3.5 text-[#9A7A85]">
                        {item.name}
                      </p>
                      <p className="mt-1 text-right text-[11px] font-black tabular-nums text-[#A50034]">
                        {formatValue(
                          total.values[
                            libraryKey
                          ] ?? null,
                          item
                        )}
                      </p>
                    </div>
                  )
                )}
              </div>
            </article>
          </>
        ) : (
          <div className="px-4 py-12 text-center text-[10px] font-bold text-[#969AA1]">
            선택한 조건에 해당하는 실적이 없습니다.
          </div>
        )}
      </div>

      <div className="hidden max-h-[72vh] overflow-auto sm:block">
        <table className="min-w-max w-full border-collapse text-[11px]">
          <thead className="sticky top-0 z-30">
            <tr className="border-b border-[#DDE0E4] bg-[#F7F8F9] text-[#5A5F66]">
              <th className="sticky left-0 top-0 z-40 min-w-[110px] border-r border-[#E5E7EA] bg-[#F7F8F9] px-3 py-3 text-center font-black">
                {granularity ===
                "monthly"
                  ? "월"
                  : "일자"}
              </th>

              <th className="sticky left-[110px] top-0 z-40 min-w-[130px] border-r border-[#E5E7EA] bg-[#F7F8F9] px-3 py-3 text-left font-black shadow-[4px_0_8px_-8px_rgba(0,0,0,0.35)]">
                매니저
              </th>

              {columns.map(
                ({
                  libraryKey,
                  item,
                }) => (
                  <th
                    key={
                      libraryKey
                    }
                    className="min-w-[128px] max-w-[170px] border-r border-[#ECEEF1] px-3 py-2.5 text-right font-black last:border-r-0"
                    title={
                      item.name
                    }
                  >
                    <span className="block truncate">
                      {item.name}
                    </span>
                    <span className="mt-0.5 block text-[8px] font-bold text-[#A0A4AA]">
                      {unitLabel(
                        item.unit
                      )}
                      {" · "}
                      {aggregationLabel(
                        item.defaultAggregationType
                      )}
                    </span>
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody>
            {rows.length >
            0 ? (
              rows.map(
                (row) => (
                  <tr
                    key={`${row.periodKey}-${row.managerId}`}
                    className="group border-b border-[#ECEEF1] hover:bg-[#FCFCFD]"
                  >
                    <td className="sticky left-0 z-10 border-r border-[#ECEEF1] bg-white px-3 py-3 text-center font-bold tabular-nums text-[#555A62] group-hover:bg-[#FCFCFD]">
                      {granularity ===
                      "monthly"
                        ? formatMonthLabel(
                            row.monthKey
                          )
                        : formatDateLabel(
                            row.reportDate ??
                              ""
                          )}
                    </td>

                    <td className="sticky left-[110px] z-10 border-r border-[#ECEEF1] bg-white px-3 py-3 shadow-[4px_0_8px_-8px_rgba(0,0,0,0.35)] group-hover:bg-[#FCFCFD]">
                      <p
                        className="max-w-[150px] truncate font-black text-[#3F444B]"
                        title={
                          row.managerName
                        }
                      >
                        {row.managerName}
                      </p>
                      <p className="mt-0.5 text-[9px] font-medium text-[#9A9EA5]">
                        {row.employeeNo}
                      </p>
                    </td>

                    {columns.map(
                      ({
                        libraryKey,
                        item,
                      }) => (
                        <td
                          key={
                            libraryKey
                          }
                          className="border-r border-[#F0F1F3] px-3 py-3 text-right font-black tabular-nums text-[#3F444B] last:border-r-0"
                        >
                          {formatValue(
                            row.values[
                              libraryKey
                            ] ?? null,
                            item
                          )}
                        </td>
                      )
                    )}
                  </tr>
                )
              )
            ) : (
              <tr>
                <td
                  colSpan={
                    columns.length +
                    2
                  }
                  className="px-5 py-14 text-center text-[11px] font-bold text-[#969AA1]"
                >
                  선택한 조건에 해당하는 실적이 없습니다.
                </td>
              </tr>
            )}
          </tbody>

          {rows.length >
            0 && (
            <tfoot className="sticky bottom-0 z-20">
              <tr className="border-t-2 border-[#D9DCE1] bg-[#FAFAFB]">
                <td className="sticky left-0 z-30 border-r border-[#E5E7EA] bg-[#FAFAFB] px-3 py-3 text-center text-[10px] font-black text-[#4E535A]">
                  합계
                </td>

                <td className="sticky left-[110px] z-30 border-r border-[#E5E7EA] bg-[#FAFAFB] px-3 py-3 text-[10px] font-black text-[#6B7077] shadow-[4px_0_8px_-8px_rgba(0,0,0,0.35)]">
                  {managerCount}
                  명
                </td>

                {columns.map(
                  ({
                    libraryKey,
                    item,
                  }) => (
                    <td
                      key={
                        libraryKey
                      }
                      className="border-r border-[#E8EAED] bg-[#FAFAFB] px-3 py-3 text-right text-[10px] font-black tabular-nums text-[#3F444B] last:border-r-0"
                    >
                      {formatValue(
                        total.values[
                          libraryKey
                        ] ?? null,
                        item
                      )}
                    </td>
                  )
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

type ReportPresetAction =
  | {
      action: "save";
      payload:
        SaveAnalysisReportPresetPayload;
    }
  | {
      action: "delete";
      presetId: string;
    }
  | {
      action: "set-default";
      presetId: string;
    };


async function fetchAnalysisReportPresetsClient() {
  const response =
    await fetch(
      "/api/analytics/report-presets",
      {
        method: "GET",
        cache: "no-store",
      }
    );

  const data =
    await response.json() as
      | {
          presets:
            AnalysisReportPreset[];
        }
      | {
          error?: string;
        };

  if (
    !response.ok ||
    !("presets" in data)
  ) {
    throw new Error(
      "error" in data &&
      data.error
        ? data.error
        : "저장된 보고서를 불러오지 못했습니다."
    );
  }

  return data.presets;
}


async function postAnalysisReportPresetAction(
  body:
    ReportPresetAction
) {
  const response =
    await fetch(
      "/api/analytics/report-presets",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        cache: "no-store",
        body:
          JSON.stringify(
            body
          ),
      }
    );

  const data =
    await response.json() as
      | {
          presets:
            AnalysisReportPreset[];
          preset?:
            AnalysisReportPreset;
        }
      | {
          error?: string;
        };

  if (
    !response.ok ||
    !("presets" in data)
  ) {
    throw new Error(
      "error" in data &&
      data.error
        ? data.error
        : "저장 보고서를 처리하지 못했습니다."
    );
  }

  return data;
}


function CustomAnalysis({
  initialSnapshot,
}: {
  initialSnapshot:
    PerformanceAnalysisSnapshot | null;
}) {
  const currentMonth =
    getKstMonth();

  const currentToday =
    getKstToday();

  const initialMonth =
    initialSnapshot
      ?.endDate
      .slice(
        0,
        7
      ) ||
    currentMonth;

  const [
    startMonth,
    setStartMonth,
  ] =
    useState(
      initialMonth
    );

  const [
    endMonth,
    setEndMonth,
  ] =
    useState(
      initialMonth
    );

  const [
    granularity,
    setGranularity,
  ] =
    useState<CustomGranularity>(
      "monthly"
    );

  const [
    snapshot,
    setSnapshot,
  ] =
    useState<
      PerformanceAnalysisSnapshot | null
    >(
      initialSnapshot
    );

  const [
    selectedManagerIds,
    setSelectedManagerIds,
  ] =
    useState<string[]>(
      () =>
        initialSnapshot
          ? initialSnapshot
              .managers
              .filter(
                (manager) =>
                  manager.isActive
              )
              .map(
                (manager) =>
                  manager.id
              )
          : []
    );

  const [
    reportItemKeys,
    setReportItemKeys,
  ] =
    useState<string[]>(
      []
    );

  const [
    librarySnapshot,
    setLibrarySnapshot,
  ] =
    useState<AnalysisMetricLibrarySnapshot | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    exporting,
    setExporting,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    reportPresets,
    setReportPresets,
  ] =
    useState<AnalysisReportPreset[]>(
      []
    );

  const [
    reportPresetLoading,
    setReportPresetLoading,
  ] =
    useState(true);

  const [
    reportPresetBusy,
    setReportPresetBusy,
  ] =
    useState<
      | "save-new"
      | "overwrite"
      | "load"
      | "default"
      | "delete"
      | null
    >(null);

  const [
    selectedReportPresetId,
    setSelectedReportPresetId,
  ] =
    useState("");

  const [
    reportPresetName,
    setReportPresetName,
  ] =
    useState("");

  const [
    restoreReportComposition,
    setRestoreReportComposition,
  ] =
    useState<{
      key: string;
      libraryKeys: string[];
    } | null>(null);

  const reportPresetRestoreSequenceRef =
    useRef(0);

  const defaultReportPresetAppliedRef =
    useRef(false);

  const availableManagers =
    useMemo(() => {
      if (
        !snapshot
      ) {
        return [];
      }

      const managerIdsWithData =
        new Set(
          snapshot.dailyRows.map(
            (row) =>
              row.managerId
          )
        );

      return snapshot.managers.filter(
        (manager) =>
          manager.isActive ||
          managerIdsWithData.has(
            manager.id
          )
      );
    }, [snapshot]);

  const handleReportCompositionChange =
    useCallback(
      (
        libraryKeys:
          string[],
        nextLibrarySnapshot:
          AnalysisMetricLibrarySnapshot | null
      ) => {
        setReportItemKeys(
          libraryKeys
        );
        setLibrarySnapshot(
          nextLibrarySnapshot
        );
      },
      []
    );

  const applyReportPreset =
    useCallback(
      (
        preset:
          AnalysisReportPreset
      ) => {
        setStartMonth(
          preset.startMonth
        );
        setEndMonth(
          preset.endMonth
        );
        setGranularity(
          preset.granularity
        );
        setSelectedManagerIds(
          preset.managerIds
        );
        setReportItemKeys(
          preset.reportItemKeys
        );
        setSelectedReportPresetId(
          preset.id
        );
        setReportPresetName(
          preset.name
        );
        setErrorMessage(
          ""
        );

        reportPresetRestoreSequenceRef.current +=
          1;

        setRestoreReportComposition({
          key:
            `${preset.id}:${preset.updatedAt}:${reportPresetRestoreSequenceRef.current}`,
          libraryKeys:
            preset.reportItemKeys,
        });
      },
      []
    );

  useEffect(() => {
    let cancelled =
      false;

    void fetchAnalysisReportPresetsClient()
      .then(
        (presets) => {
          if (
            cancelled
          ) {
            return;
          }

          setReportPresets(
            presets
          );

          const defaultPreset =
            presets.find(
              (preset) =>
                preset.isDefault
            );

          if (
            defaultPreset &&
            !defaultReportPresetAppliedRef.current
          ) {
            defaultReportPresetAppliedRef.current =
              true;

            applyReportPreset(
              defaultPreset
            );
          }
        }
      )
      .catch(
        (error) => {
          if (
            cancelled
          ) {
            return;
          }

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "저장된 보고서를 불러오지 못했습니다."
          );
        }
      )
      .finally(
        () => {
          if (
            cancelled
          ) {
            return;
          }

          setReportPresetLoading(
            false
          );
        }
      );

    return () => {
      cancelled =
        true;
    };
  }, [
    applyReportPreset,
  ]);

  const analysisResult =
    useMemo(
      () =>
        snapshot
          ? buildBuilderCustomAnalysisResult({
              snapshot,
              librarySnapshot,
              reportItemKeys,
              selectedManagerIds,
              granularity,
            })
          : {
              rows: [],
              total: {
                sourceRowCount:
                  0,
                values: {},
              },
              columns: [],
            },
      [
        snapshot,
        librarySnapshot,
        reportItemKeys,
        selectedManagerIds,
        granularity,
      ]
    );

  const getQueryEndDate =
    (
      monthKey: string
    ) => {
      if (
        monthKey ===
          currentMonth &&
        currentToday
      ) {
        return currentToday;
      }

      return getMonthLastDate(
        monthKey
      );
    };

  const loadCustomAnalysis =
    async (
      targetStartMonth:
        string,
      targetEndMonth:
        string,
      preserveSelection:
        boolean
    ) => {
      if (
        !targetStartMonth ||
        !targetEndMonth
      ) {
        setErrorMessage(
          "조회 시작월과 종료월을 선택해주세요."
        );
        return;
      }

      if (
        targetStartMonth >
        targetEndMonth
      ) {
        setErrorMessage(
          "조회 시작월은 종료월보다 늦을 수 없습니다."
        );
        return;
      }

      const startDate =
        `${targetStartMonth}-01`;

      const endDate =
        getQueryEndDate(
          targetEndMonth
        );

      if (!endDate) {
        setErrorMessage(
          "조회 기간을 확인해주세요."
        );
        return;
      }

      setLoading(
        true
      );
      setErrorMessage(
        ""
      );

      try {
        const response =
          await fetch(
            `/api/analytics/performance?start=${encodeURIComponent(
              startDate
            )}&end=${encodeURIComponent(
              endDate
            )}`,
            {
              method:
                "GET",
              cache:
                "no-store",
            }
          );

        const payload =
          await response.json() as
            | PerformanceAnalysisSnapshot
            | {
                error?: string;
              };

        if (
          !response.ok
        ) {
          throw new Error(
            "error" in payload &&
            payload.error
              ? payload.error
              : "조합 분석 데이터를 불러오지 못했습니다."
          );
        }

        const nextSnapshot =
          payload as
            PerformanceAnalysisSnapshot;

        setSnapshot(
          nextSnapshot
        );

        const managerIdsWithData =
          new Set(
            nextSnapshot.dailyRows.map(
              (row) =>
                row.managerId
            )
          );

        const nextManagers =
          nextSnapshot.managers.filter(
            (manager) =>
              manager.isActive ||
              managerIdsWithData.has(
                manager.id
              )
          );

        const validManagerIdSet =
          new Set(
            nextManagers.map(
              (manager) =>
                manager.id
            )
          );

        if (
          preserveSelection
        ) {
          const preservedManagers =
            selectedManagerIds.filter(
              (id) =>
                validManagerIdSet.has(
                  id
                )
            );

          setSelectedManagerIds(
            preservedManagers.length >
              0
              ? preservedManagers
              : nextManagers.map(
                  (manager) =>
                    manager.id
                )
          );
        }
        else {
          setSelectedManagerIds(
            nextManagers.map(
              (manager) =>
                manager.id
            )
          );
        }
      }
      catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "조합 분석 데이터를 불러오지 못했습니다."
        );
      }
      finally {
        setLoading(
          false
        );
      }
    };

  const selectedReportPreset =
    useMemo(
      () =>
        reportPresets.find(
          (preset) =>
            preset.id ===
            selectedReportPresetId
        ) ?? null,
      [
        reportPresets,
        selectedReportPresetId,
      ]
    );

  const saveReportPreset =
    async (
      mode:
        | "save-new"
        | "overwrite"
    ) => {
      if (
        reportPresetName.trim() ===
        ""
      ) {
        setErrorMessage(
          "저장할 보고서 이름을 입력해주세요."
        );
        return;
      }

      if (
        selectedManagerIds.length ===
        0
      ) {
        setErrorMessage(
          "저장할 매니저를 1명 이상 선택해주세요."
        );
        return;
      }

      if (
        reportItemKeys.length ===
        0
      ) {
        setErrorMessage(
          "보고서 구성에 분석항목을 1개 이상 추가해주세요."
        );
        return;
      }

      if (
        mode ===
          "overwrite" &&
        !selectedReportPresetId
      ) {
        setErrorMessage(
          "덮어쓸 저장 보고서를 먼저 선택해주세요."
        );
        return;
      }

      setReportPresetBusy(
        mode
      );
      setErrorMessage(
        ""
      );

      try {
        const result =
          await postAnalysisReportPresetAction({
            action:
              "save",
            payload: {
              presetId:
                mode ===
                "overwrite"
                  ? selectedReportPresetId
                  : null,
              name:
                reportPresetName,
              granularity,
              startMonth,
              endMonth,
              managerIds:
                selectedManagerIds,
              reportItemKeys,
            },
          });

        setReportPresets(
          result.presets
        );

        if (
          result.preset
        ) {
          setSelectedReportPresetId(
            result.preset.id
          );
          setReportPresetName(
            result.preset.name
          );
        }
      }
      catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "저장 보고서를 저장하지 못했습니다."
        );
      }
      finally {
        setReportPresetBusy(
          null
        );
      }
    };

  const loadSelectedReportPreset =
    () => {
      if (
        !selectedReportPreset
      ) {
        setErrorMessage(
          "불러올 저장 보고서를 먼저 선택해주세요."
        );
        return;
      }

      setReportPresetBusy(
        "load"
      );

      applyReportPreset(
        selectedReportPreset
      );

      setReportPresetBusy(
        null
      );
    };

  const setSelectedReportPresetAsDefault =
    async () => {
      if (
        !selectedReportPreset
      ) {
        setErrorMessage(
          "기본으로 지정할 저장 보고서를 먼저 선택해주세요."
        );
        return;
      }

      setReportPresetBusy(
        "default"
      );
      setErrorMessage(
        ""
      );

      try {
        const result =
          await postAnalysisReportPresetAction({
            action:
              "set-default",
            presetId:
              selectedReportPreset.id,
          });

        setReportPresets(
          result.presets
        );
      }
      catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "기본 보고서를 지정하지 못했습니다."
        );
      }
      finally {
        setReportPresetBusy(
          null
        );
      }
    };

  const deleteSelectedReportPreset =
    async () => {
      if (
        !selectedReportPreset
      ) {
        setErrorMessage(
          "삭제할 저장 보고서를 먼저 선택해주세요."
        );
        return;
      }

      const confirmed =
        window.confirm(
          `저장 보고서 '${selectedReportPreset.name}'을 삭제할까요?`
        );

      if (!confirmed) {
        return;
      }

      setReportPresetBusy(
        "delete"
      );
      setErrorMessage(
        ""
      );

      try {
        const result =
          await postAnalysisReportPresetAction({
            action:
              "delete",
            presetId:
              selectedReportPreset.id,
          });

        setReportPresets(
          result.presets
        );
        setSelectedReportPresetId(
          ""
        );
        setReportPresetName(
          ""
        );
      }
      catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "저장 보고서를 삭제하지 못했습니다."
        );
      }
      finally {
        setReportPresetBusy(
          null
        );
      }
    };

  const handleReset =
    () => {
      setStartMonth(
        currentMonth
      );
      setEndMonth(
        currentMonth
      );
      setGranularity(
        "monthly"
      );

      void loadCustomAnalysis(
        currentMonth,
        currentMonth,
        false
      );
    };

  const handleExcelDownload =
    async () => {
      if (
        !snapshot ||
        !librarySnapshot ||
        analysisResult.rows.length ===
          0
      ) {
        setErrorMessage(
          "Excel로 다운로드할 조합 분석 결과가 없습니다."
        );
        return;
      }

      if (
        analysisResult.columns.length ===
        0
      ) {
        setErrorMessage(
          "Excel로 다운로드할 분석항목을 1개 이상 선택해주세요."
        );
        return;
      }

      setExporting(
        true
      );
      setErrorMessage(
        ""
      );

      try {
        const {
          downloadBuilderCustomAnalysisExcel,
        } =
          await import(
            "@/lib/analytics/custom-analysis-excel"
          );

        const selectedManagerIdSet =
          new Set(
            selectedManagerIds
          );

        await downloadBuilderCustomAnalysisExcel({
          granularity,
          snapshot,
          rows:
            analysisResult.rows,
          total:
            analysisResult.total,
          librarySnapshot,
          reportItemKeys,
          selectedManagerNames:
            availableManagers
              .filter(
                (manager) =>
                  selectedManagerIdSet.has(
                    manager.id
                  )
              )
              .map(
                (manager) =>
                  manager.name
              ),
        });
      }
      catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "조합 분석 Excel 파일을 생성하지 못했습니다."
        );
      }
      finally {
        setExporting(
          false
        );
      }
    };

  return (
    <ReadyPanel
      eyebrow="CUSTOM ANALYSIS BUILDER"
      title="조합 분석"
      description="기존 조합 분석의 조회·매니저·월별/일자별·Excel 흐름은 그대로 사용하고, 분석항목만 Metric Builder의 보고서 구성과 연결합니다."
    >
      <div className="mt-5 space-y-4">
        <section className="rounded-[16px] border border-[#E2E4E7] bg-[#FAFAFB] p-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MonthPicker
              label="시작월"
              value={
                startMonth
              }
              onChange={
                setStartMonth
              }
              maxMonth={
                currentMonth
              }
            />

            <MonthPicker
              label="종료월"
              value={
                endMonth
              }
              onChange={
                setEndMonth
              }
              maxMonth={
                currentMonth
              }
              minMonth={
                startMonth
              }
            />

            <div>
              <span className="mb-1.5 block text-[10px] font-black text-[#777C84]">
                매니저
              </span>

              <ManagerSelector
                managers={
                  availableManagers
                }
                selectedIds={
                  selectedManagerIds
                }
                onChange={
                  setSelectedManagerIds
                }
              />
            </div>

            <div>
              <span className="mb-1.5 block text-[10px] font-black text-[#777C84]">
                집계단위
              </span>

              <div className="inline-flex h-10 w-full min-w-[180px] rounded-[11px] border border-[#DDE0E4] bg-white p-1">
                <button
                  type="button"
                  onClick={() =>
                    setGranularity(
                      "monthly"
                    )
                  }
                  className={[
                    "flex-1 rounded-[8px] px-3 text-[10px] font-black transition",
                    granularity ===
                    "monthly"
                      ? "bg-[#A50034] text-white"
                      : "text-[#70757C] hover:bg-[#F6F7F8]",
                  ].join(" ")}
                >
                  월별
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setGranularity(
                      "daily"
                    )
                  }
                  className={[
                    "flex-1 rounded-[8px] px-3 text-[10px] font-black transition",
                    granularity ===
                    "daily"
                      ? "bg-[#A50034] text-white"
                      : "text-[#70757C] hover:bg-[#F6F7F8]",
                  ].join(" ")}
                >
                  일자별
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[16px] border border-[#E2E4E7] bg-white p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[#FFF1F4] text-[#A50034]">
                  <Bookmark
                    size={14}
                  />
                </div>

                <div className="min-w-0">
                  <p className="text-[11px] font-black text-[#3F444B]">
                    내 보고서
                  </p>
                  <p className="mt-0.5 text-[9px] font-medium leading-4 text-[#969AA1]">
                    현재 조회조건과 보고서 구성 순서를 저장하고 다시 불러옵니다.
                  </p>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(190px,1fr)_minmax(190px,1fr)]">
                <label className="block">
                  <span className="mb-1.5 block text-[9px] font-black text-[#777C84]">
                    저장 보고서
                  </span>

                  <select
                    value={
                      selectedReportPresetId
                    }
                    onChange={(event) => {
                      const nextId =
                        event.target.value;

                      setSelectedReportPresetId(
                        nextId
                      );

                      const nextPreset =
                        reportPresets.find(
                          (preset) =>
                            preset.id ===
                            nextId
                        );

                      setReportPresetName(
                        nextPreset?.name ??
                          ""
                      );
                    }}
                    disabled={
                      reportPresetLoading ||
                      reportPresetBusy !==
                        null
                    }
                    className="h-11 w-full rounded-[10px] border border-[#DDE0E4] bg-white px-3 text-[10px] font-black text-[#555A62] outline-none disabled:bg-[#F5F6F7] sm:h-10"
                  >
                    <option value="">
                      {reportPresetLoading
                        ? "불러오는 중..."
                        : reportPresets.length ===
                            0
                          ? "저장된 보고서 없음"
                          : "저장 보고서 선택"}
                    </option>

                    {reportPresets.map(
                      (preset) => (
                        <option
                          key={
                            preset.id
                          }
                          value={
                            preset.id
                          }
                        >
                          {preset.isDefault
                            ? "★ "
                            : ""}
                          {preset.name}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[9px] font-black text-[#777C84]">
                    보고서 이름
                  </span>

                  <input
                    type="text"
                    value={
                      reportPresetName
                    }
                    maxLength={60}
                    onChange={(event) =>
                      setReportPresetName(
                        event.target.value
                      )
                    }
                    placeholder="예: 월마감 종합보고"
                    disabled={
                      reportPresetBusy !==
                      null
                    }
                    className="h-11 w-full rounded-[10px] border border-[#DDE0E4] bg-white px-3 text-[10px] font-bold text-[#555A62] outline-none placeholder:text-[#B2B5BA] focus:border-[#A50034] disabled:bg-[#F5F6F7] sm:h-10"
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={
                  loadSelectedReportPreset
                }
                disabled={
                  !selectedReportPreset ||
                  reportPresetBusy !==
                    null
                }
                className="inline-flex h-10 w-full touch-manipulation items-center justify-center gap-1.5 rounded-[10px] border border-[#DDE0E4] bg-white px-3 text-[9px] font-black text-[#666B72] disabled:opacity-40 sm:w-auto"
              >
                <FolderOpen
                  size={13}
                />
                불러오기
              </button>

              <button
                type="button"
                onClick={() =>
                  void saveReportPreset(
                    "save-new"
                  )
                }
                disabled={
                  reportPresetBusy !==
                  null
                }
                className="inline-flex h-10 w-full touch-manipulation items-center justify-center gap-1.5 rounded-[10px] bg-[#A50034] px-3 text-[9px] font-black text-white disabled:opacity-40 sm:w-auto"
              >
                {reportPresetBusy ===
                "save-new" ? (
                  <LoaderCircle
                    size={13}
                    className="animate-spin"
                  />
                ) : (
                  <Save
                    size={13}
                  />
                )}
                새로 저장
              </button>

              <button
                type="button"
                onClick={() =>
                  void saveReportPreset(
                    "overwrite"
                  )
                }
                disabled={
                  !selectedReportPreset ||
                  reportPresetBusy !==
                    null
                }
                className="inline-flex h-10 w-full touch-manipulation items-center justify-center gap-1.5 rounded-[10px] border border-[#F0D4DB] bg-[#FFF7F9] px-3 text-[9px] font-black text-[#A50034] disabled:opacity-40 sm:w-auto"
              >
                {reportPresetBusy ===
                "overwrite" ? (
                  <LoaderCircle
                    size={13}
                    className="animate-spin"
                  />
                ) : (
                  <Save
                    size={13}
                  />
                )}
                덮어쓰기
              </button>

              <button
                type="button"
                onClick={() =>
                  void setSelectedReportPresetAsDefault()
                }
                disabled={
                  !selectedReportPreset ||
                  reportPresetBusy !==
                    null ||
                  selectedReportPreset?.isDefault ===
                    true
                }
                className="inline-flex h-10 w-full touch-manipulation items-center justify-center gap-1.5 rounded-[10px] border border-[#E5E7EA] bg-white px-3 text-[9px] font-black text-[#777C84] disabled:opacity-40 sm:w-auto"
              >
                <Star
                  size={13}
                />
                기본 지정
              </button>

              <button
                type="button"
                onClick={() =>
                  void deleteSelectedReportPreset()
                }
                disabled={
                  !selectedReportPreset ||
                  reportPresetBusy !==
                    null
                }
                className="inline-flex h-10 w-full touch-manipulation items-center justify-center gap-1.5 rounded-[10px] border border-[#E5E7EA] bg-white px-3 text-[9px] font-black text-[#8A8F97] hover:border-[#E6C8D1] hover:text-[#A50034] disabled:opacity-40 sm:w-auto"
              >
                <Trash2
                  size={13}
                />
                삭제
              </button>
            </div>
          </div>

          <div className="mt-3 rounded-[10px] bg-[#FAFAFB] px-3 py-2 text-[8px] font-bold leading-4 text-[#91969D]">
            기본 보고서는 조합 분석을 열 때 조건과 보고서 구성을 자동으로 불러옵니다. 저장된 조건을 실제 데이터에 반영하려면 기존 [조회] 버튼을 사용합니다.
          </div>
        </section>

        <MetricLibraryBuilder
          onReportCompositionChange={
            handleReportCompositionChange
          }
          restoreReportComposition={
            restoreReportComposition
          }
        />

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#E2E4E7] bg-[#FAFAFB] px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] font-bold text-[#8F949B]">
            <span>
              기존 조회 엔진
              <strong className="ml-1 text-[#666B72]">
                /api/analytics/performance
              </strong>
            </span>
            <span>
              보고서 구성 순서 = 결과표·Excel 열 순서
            </span>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={
                handleReset
              }
              disabled={
                loading
              }
              className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-[11px] border border-[#DDE0E4] bg-white px-4 text-[11px] font-black text-[#686D74] transition hover:bg-[#F7F8F9] disabled:opacity-50 sm:h-10 sm:w-auto"
            >
              <RotateCcw
                size={14}
              />
              초기화
            </button>

            <button
              type="button"
              onClick={() =>
                void loadCustomAnalysis(
                  startMonth,
                  endMonth,
                  true
                )
              }
              disabled={
                loading
              }
              className="inline-flex h-11 w-full min-w-[92px] items-center justify-center gap-1.5 rounded-[11px] bg-[#A50034] px-4 text-[11px] font-black text-white transition hover:bg-[#8F002D] disabled:opacity-50 sm:h-10 sm:w-auto"
            >
              {loading ? (
                <LoaderCircle
                  size={14}
                  className="animate-spin"
                />
              ) : (
                <Search
                  size={14}
                />
              )}
              조회
            </button>

            <button
              type="button"
              onClick={() =>
                void handleExcelDownload()
              }
              disabled={
                loading ||
                exporting ||
                analysisResult.rows.length ===
                  0 ||
                analysisResult.columns.length ===
                  0
              }
              className="col-span-2 inline-flex h-11 w-full min-w-[132px] items-center justify-center gap-1.5 rounded-[11px] border border-[#F0D4DB] bg-[#FFF7F9] px-4 text-[11px] font-black text-[#A50034] transition hover:bg-[#FFF0F4] disabled:cursor-not-allowed disabled:opacity-45 sm:col-span-1 sm:h-10 sm:w-auto"
            >
              {exporting ? (
                <LoaderCircle
                  size={14}
                  className="animate-spin"
                />
              ) : (
                <FileSpreadsheet
                  size={14}
                />
              )}
              {exporting
                ? "Excel 생성중"
                : "Excel 다운로드"}
            </button>
          </div>
        </section>

        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-[14px] border border-[#F0CDD3] bg-[#FFF5F7] px-4 py-3 text-[11px] font-bold leading-5 text-[#A50034]">
            <AlertCircle
              size={16}
              className="mt-0.5 shrink-0"
            />
            {errorMessage}
          </div>
        )}

        {snapshot && (
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[15px] border border-[#E6E8EB] bg-[#FAFAFB] px-4 py-4">
              <p className="text-[10px] font-bold text-[#92969D]">
                조회행
              </p>
              <p className="mt-1 text-[18px] font-black tabular-nums text-[#3E4248]">
                {analysisResult.rows.length.toLocaleString(
                  "ko-KR"
                )}
                <span className="ml-1 text-[10px] font-bold text-[#858A92]">
                  행
                </span>
              </p>
            </div>

            <div className="rounded-[15px] border border-[#E6E8EB] bg-[#FAFAFB] px-4 py-4">
              <p className="text-[10px] font-bold text-[#92969D]">
                선택 매니저
              </p>
              <p className="mt-1 text-[18px] font-black tabular-nums text-[#3E4248]">
                {selectedManagerIds.length.toLocaleString(
                  "ko-KR"
                )}
                <span className="ml-1 text-[10px] font-bold text-[#858A92]">
                  명
                </span>
              </p>
            </div>

            <div className="rounded-[15px] border border-[#E6E8EB] bg-[#FAFAFB] px-4 py-4">
              <p className="text-[10px] font-bold text-[#92969D]">
                보고서 항목
              </p>
              <p className="mt-1 text-[18px] font-black tabular-nums text-[#3E4248]">
                {analysisResult.columns.length.toLocaleString(
                  "ko-KR"
                )}
                <span className="ml-1 text-[10px] font-bold text-[#858A92]">
                  개
                </span>
              </p>
            </div>

            <div className="rounded-[15px] border border-[#E6E8EB] bg-[#FAFAFB] px-4 py-4">
              <p className="text-[10px] font-bold text-[#92969D]">
                집계단위
              </p>
              <p className="mt-1 text-[18px] font-black text-[#3E4248]">
                {granularity ===
                "monthly"
                  ? "월별"
                  : "일자별"}
              </p>
            </div>
          </section>
        )}

        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center rounded-[16px] border border-[#E2E4E7] bg-white">
            <div className="text-center">
              <LoaderCircle
                size={24}
                className="mx-auto animate-spin text-[#8A8F97]"
              />
              <p className="mt-3 text-[11px] font-bold text-[#777C84]">
                기존 조합 분석 데이터를 불러오는 중입니다.
              </p>
            </div>
          </div>
        ) : snapshot ? (
          <BuilderCustomAnalysisTable
            rows={
              analysisResult.rows
            }
            total={
              analysisResult.total
            }
            granularity={
              granularity
            }
            columns={
              analysisResult.columns
            }
          />
        ) : (
          <div className="flex min-h-[230px] items-center justify-center rounded-[16px] border border-dashed border-[#D9DCE1] bg-[#FAFAFB] px-5 text-center">
            <div>
              <SlidersHorizontal
                size={24}
                className="mx-auto text-[#A4A8AE]"
              />
              <p className="mt-3 text-[12px] font-black text-[#555A62]">
                기간과 분석조건을 선택한 뒤 [조회]를 눌러주세요.
              </p>
            </div>
          </div>
        )}

        <div className="rounded-[14px] border border-[#ECEEF1] bg-[#FAFAFB] px-4 py-3 text-[10px] leading-5 text-[#8D9299]">
          기존 조합 분석과 동일하게 관리자 계정은 분석 대상에서 제외되고,
          마감된 submitted / closed 실적만 사용합니다.
          {" "}
          비율은 일별 퍼센트 평균이 아니라 분자·분모를 합산한 뒤 다시 계산합니다.
        </div>
      </div>
    </ReadyPanel>
  );
}

export default function AnalyticsWorkspace({
  initialSnapshot = null,
  initialError = "",
}: Props = {}) {
  const [
    activeSection,
    setActiveSection,
  ] =
    useState<AnalysisSection>(
      "performance"
    );

  return (
    <div className="space-y-5">
      <section className="rounded-[22px] border border-[#E5E7EA] bg-white p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[#FFF1F4] text-[#A50034]">
            <BarChart3
              size={20}
            />
          </div>

          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.12em] text-[#A50034]">
              ANALYTICS
            </p>

            <h1 className="mt-1 text-[26px] font-black tracking-[-0.03em] text-[#22252A]">
              분석
            </h1>

            <p className="mt-2 max-w-3xl text-[12px] font-medium leading-5 text-[#777C84]">
              입력·마감된 데이터를 변경하지 않고 조회하여 매니저 실적, 전산 차이, 사용자 지정 조합을 분석합니다.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        {analysisSections.map(
          (section) => (
            <SectionTabButton
              key={section.id}
              active={
                activeSection ===
                section.id
              }
              label={
                section.label
              }
              description={
                section.description
              }
              icon={
                section.icon
              }
              onClick={() =>
                setActiveSection(
                  section.id
                )
              }
            />
          )
        )}
      </section>

      {activeSection ===
        "performance" && (
        <PerformanceAnalysis
          initialSnapshot={
            initialSnapshot
          }
          initialError={
            initialError
          }
        />
      )}

      {activeSection ===
        "system-compare" && (
        <SystemCompareAnalysis />
      )}

      {activeSection ===
        "custom" && (
        <CustomAnalysis
          initialSnapshot={
            initialSnapshot
          }
        />
      )}
    </div>
  );
}
