"use client";

import {
  AlertCircle,
  BarChart3,
  Building2,
  CalendarDays,
  LoaderCircle,
  RefreshCcw,
  TrendingUp,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import AnalyticsLineChart, {
  type AnalyticsLineChartPoint,
} from "@/components/analytics/AnalyticsLineChart";
import {
  createClient,
} from "@/lib/supabase/client";


type StoreMetric = {
  category_id: string;
  category_code: string;
  category_name: string;
  category_order: number;
  metric_id: string;
  metric_code: string;
  metric_name: string;
  unit:
    | "amount"
    | "count"
    | "percent"
    | string;
  effect_sign: number;
  aggregation_type:
    | "sum"
    | "average"
    | "rate"
    | string;
  metric_order: number;
  is_active: boolean;
  components?: {
    name: string;
    effect_sign: number;
  }[];
};


type MetricValueRow = {
  metric_id: string;
  value: number | null;
  value_count: number;
  report_count: number;
};


type MonthlyMetricRow =
  MetricValueRow & {
    month: string;
  };


type DailyMetricRow =
  MetricValueRow & {
    date: string;
  };


type StorePerformanceResponse = {
  period: {
    start_date: string;
    end_date: string;
    effective_end_date:
      | string
      | null;
  };
  metrics: StoreMetric[];
  summary: MetricValueRow[];
  monthly: MonthlyMetricRow[];
  daily: DailyMetricRow[];
};


function pad(value: number) {
  return String(value).padStart(
    2,
    "0"
  );
}


function localDateKey(
  date: Date
) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
}


function todayKey() {
  return localDateKey(
    new Date()
  );
}


function firstDayOfYear() {
  const now = new Date();

  return `${now.getFullYear()}-01-01`;
}


function firstDayOfMonth(
  date = new Date()
) {
  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-01`;
}


function lastDayOfMonth(
  date: Date
) {
  return localDateKey(
    new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0
    )
  );
}


function addMonths(
  date: Date,
  amount: number
) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + amount,
    1
  );
}




function formatMetricValue(
  value: number | null,
  metric: StoreMetric | null
) {
  if (
    value === null ||
    !metric
  ) {
    return "-";
  }

  if (metric.unit === "amount") {
    return `${Math.round(value).toLocaleString(
      "ko-KR"
    )}원`;
  }

  if (metric.unit === "percent") {
    return `${value.toLocaleString(
      "ko-KR",
      {
        maximumFractionDigits: 1,
      }
    )}%`;
  }

  const digits =
    metric.aggregation_type ===
    "average"
      ? 1
      : 0;

  return `${value.toLocaleString(
    "ko-KR",
    {
      maximumFractionDigits:
        digits,
    }
  )}건`;
}


function compactMetricValue(
  value: number,
  metric: StoreMetric
) {
  const absolute =
    Math.abs(value);

  if (metric.unit === "amount") {
    if (absolute >= 100000000) {
      return `${(
        value / 100000000
      ).toLocaleString(
        "ko-KR",
        {
          maximumFractionDigits: 1,
        }
      )}억`;
    }

    if (absolute >= 10000) {
      return `${(
        value / 10000
      ).toLocaleString(
        "ko-KR",
        {
          maximumFractionDigits: 0,
        }
      )}만`;
    }

    return Math.round(
      value
    ).toLocaleString(
      "ko-KR"
    );
  }

  if (metric.unit === "percent") {
    return `${value.toLocaleString(
      "ko-KR",
      {
        maximumFractionDigits: 1,
      }
    )}%`;
  }

  return value.toLocaleString(
    "ko-KR",
    {
      maximumFractionDigits:
        metric.aggregation_type ===
        "average"
          ? 1
          : 0,
    }
  );
}


function aggregationLabel(
  type: string
) {
  if (type === "average") {
    return "평균";
  }

  if (type === "rate") {
    return "비율";
  }

  return "합계";
}


function monthLabel(
  month: string
) {
  const [
    year,
    rawMonth,
  ] = month.split("-");

  return `${year}.${Number(
    rawMonth
  )}`;
}


function dayLabel(
  date: string
) {
  const parts =
    date.split("-");

  if (parts.length !== 3) {
    return date;
  }

  return `${Number(
    parts[1]
  )}/${Number(parts[2])}`;
}


function monthsBetween(
  startDate: string,
  endDate: string
) {
  const start =
    new Date(
      `${startDate}T00:00:00`
    );
  const end =
    new Date(
      `${endDate}T00:00:00`
    );

  const rows: string[] = [];

  let cursor =
    new Date(
      start.getFullYear(),
      start.getMonth(),
      1
    );

  const last =
    new Date(
      end.getFullYear(),
      end.getMonth(),
      1
    );

  while (
    cursor <= last &&
    rows.length < 61
  ) {
    rows.push(
      `${cursor.getFullYear()}-${pad(
        cursor.getMonth() + 1
      )}`
    );

    cursor =
      addMonths(
        cursor,
        1
      );
  }

  return rows;
}


function datesInMonthWithinRange(
  month: string,
  rangeStart: string,
  rangeEnd: string
) {
  const [
    yearText,
    monthText,
  ] = month.split("-");

  const year =
    Number(yearText);
  const monthIndex =
    Number(monthText) - 1;

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(monthIndex)
  ) {
    return [];
  }

  const monthStart =
    new Date(
      year,
      monthIndex,
      1
    );

  const monthEnd =
    new Date(
      year,
      monthIndex + 1,
      0
    );

  const start =
    new Date(
      `${rangeStart}T00:00:00`
    );
  const end =
    new Date(
      `${rangeEnd}T00:00:00`
    );

  const actualStart =
    start > monthStart
      ? start
      : monthStart;

  const actualEnd =
    end < monthEnd
      ? end
      : monthEnd;

  const rows: string[] = [];

  for (
    let cursor =
      new Date(actualStart);
    cursor <= actualEnd;
    cursor =
      new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate() + 1
      )
  ) {
    rows.push(
      localDateKey(cursor)
    );
  }

  return rows;
}


function MetricSummaryCard({
  label,
  value,
  caption,
  emphasized = false,
}: {
  label: string;
  value: string;
  caption: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-[17px] border p-4",
        emphasized
          ? "border-[#E4C7D0] bg-[#FFF7F9]"
          : "border-[#E5E7EA] bg-white",
      ].join(" ")}
    >
      <p className="text-[10px] font-black text-[#7E838B]">
        {label}
      </p>

      <p
        className={[
          "mt-2 text-[18px] font-black tracking-[-0.03em] tabular-nums",
          emphasized
            ? "text-[#A50034]"
            : "text-[#292D33]",
        ].join(" ")}
      >
        {value}
      </p>

      <p className="mt-1.5 text-[9px] font-semibold leading-4 text-[#A0A4AA]">
        {caption}
      </p>
    </div>
  );
}


export default function StorePerformanceAnalytics() {
  const supabase =
    useMemo(
      () => createClient(),
      []
    );

  const today =
    useMemo(
      () => todayKey(),
      []
    );

  const initialStart =
    useMemo(
      () => firstDayOfYear(),
      []
    );

  const [
    startDate,
    setStartDate,
  ] = useState(
    initialStart
  );

  const [
    endDate,
    setEndDate,
  ] = useState(
    today
  );

  const [
    data,
    setData,
  ] =
    useState<StorePerformanceResponse | null>(
      null
    );

  const [
    selectedMetricId,
    setSelectedMetricId,
  ] =
    useState("");

  const [
    selectedMonth,
    setSelectedMonth,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const loadAnalytics =
    useCallback(
      async (
        targetStart:
          string,
        targetEnd:
          string
      ) => {
        setLoading(true);
        setErrorMessage(
          ""
        );

        try {
          const {
            data: result,
            error,
          } =
            await supabase.rpc(
              "get_store_performance_analytics",
              {
                p_start_date:
                  targetStart,
                p_end_date:
                  targetEnd,
              }
            );

          if (error) {
            throw error;
          }

          const parsed =
            result as StorePerformanceResponse;

          setData(parsed);

          setSelectedMetricId(
            (
              current
            ) => {
              if (
                parsed.metrics.some(
                  (metric) =>
                    metric.metric_id ===
                    current
                )
              ) {
                return current;
              }

              const preferred =
                parsed.metrics.find(
                  (metric) =>
                    metric.category_code ===
                    "GENERAL_SALES"
                ) ??
                parsed.metrics[0];

              return (
                preferred?.metric_id ??
                ""
              );
            }
          );

          const effectiveEnd =
            parsed.period
              .effective_end_date ??
            targetEnd;

          const months =
            monthsBetween(
              targetStart,
              effectiveEnd
            );

          setSelectedMonth(
            (
              current
            ) => {
              if (
                months.includes(
                  current
                )
              ) {
                return current;
              }

              return (
                months.at(-1) ??
                ""
              );
            }
          );
        }
        catch (error) {
          console.error(
            "지점 실적 분석 조회 오류:",
            error
          );

          setData(null);

          setErrorMessage(
            error instanceof
                Error &&
              error.message
              ? error.message
              : "지점 실적 분석 데이터를 불러오지 못했습니다."
          );
        }
        finally {
          setLoading(
            false
          );
        }
      },
      [supabase]
    );

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          void loadAnalytics(
            initialStart,
            today
          );
        },
        0
      );

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [
    initialStart,
    loadAnalytics,
    today,
  ]);

  const selectedMetric =
    useMemo(
      () =>
        data?.metrics.find(
          (metric) =>
            metric.metric_id ===
            selectedMetricId
        ) ?? null,
      [
        data,
        selectedMetricId,
      ]
    );

  const summaryValue =
    useMemo(
      () =>
        data?.summary.find(
          (row) =>
            row.metric_id ===
            selectedMetricId
        ) ?? null,
      [
        data,
        selectedMetricId,
      ]
    );

  const effectiveEnd =
    data?.period
      .effective_end_date ??
    endDate;

  const monthKeys =
    useMemo(
      () =>
        monthsBetween(
          startDate,
          effectiveEnd
        ),
      [
        effectiveEnd,
        startDate,
      ]
    );

  const monthlyMap =
    useMemo(() => {
      const map =
        new Map<
          string,
          MonthlyMetricRow
        >();

      for (
        const row of
          data?.monthly ?? []
      ) {
        if (
          row.metric_id ===
          selectedMetricId
        ) {
          map.set(
            row.month,
            row
          );
        }
      }

      return map;
    }, [
      data,
      selectedMetricId,
    ]);

  const monthlyPoints:
    AnalyticsLineChartPoint[] =
      useMemo(
        () =>
          monthKeys.map(
            (month) => ({
              key: month,
              label:
                monthLabel(
                  month
                ),
              values: {
                value:
                  monthlyMap.get(
                    month
                  )?.value ??
                  null,
              },
            })
          ),
        [
          monthKeys,
          monthlyMap,
        ]
      );

  const dailyMap =
    useMemo(() => {
      const map =
        new Map<
          string,
          DailyMetricRow
        >();

      for (
        const row of
          data?.daily ?? []
      ) {
        if (
          row.metric_id ===
          selectedMetricId
        ) {
          map.set(
            row.date,
            row
          );
        }
      }

      return map;
    }, [
      data,
      selectedMetricId,
    ]);

  const dailyDates =
    useMemo(
      () =>
        selectedMonth
          ? datesInMonthWithinRange(
              selectedMonth,
              startDate,
              effectiveEnd
            )
          : [],
      [
        effectiveEnd,
        selectedMonth,
        startDate,
      ]
    );

  const dailyPoints:
    AnalyticsLineChartPoint[] =
      useMemo(
        () =>
          dailyDates.map(
            (date) => ({
              key: date,
              label:
                dayLabel(
                  date
                ),
              values: {
                value:
                  dailyMap.get(
                    date
                  )?.value ??
                  null,
              },
            })
          ),
        [
          dailyDates,
          dailyMap,
        ]
      );

  const nonNullMonths =
    monthlyPoints.filter(
      (point) =>
        point.values.value !==
        null
    );

  const latestMonth =
    nonNullMonths.at(-1) ??
    null;

  const previousMonth =
    nonNullMonths.at(-2) ??
    null;

  const monthChange =
    latestMonth &&
    previousMonth &&
    previousMonth.values.value !==
      null &&
    previousMonth.values.value !==
      0 &&
    latestMonth.values.value !==
      null
      ? (
          (latestMonth.values.value -
            previousMonth.values.value) /
          Math.abs(
            previousMonth.values.value
          )
        ) *
        100
      : null;

  const activeDayCount =
    dailyPoints.filter(
      (point) =>
        point.values.value !==
        null
    ).length;

  const applyPreset =
    (
      type:
        | "this-month"
        | "last-month"
        | "3m"
        | "6m"
        | "year"
    ) => {
      const now =
        new Date();
      let nextStart =
        startDate;
      let nextEnd =
        today;

      if (
        type ===
        "this-month"
      ) {
        nextStart =
          firstDayOfMonth(
            now
          );
      }
      else if (
        type ===
        "last-month"
      ) {
        const target =
          addMonths(
            new Date(
              now.getFullYear(),
              now.getMonth(),
              1
            ),
            -1
          );

        nextStart =
          firstDayOfMonth(
            target
          );
        nextEnd =
          lastDayOfMonth(
            target
          );
      }
      else if (
        type === "3m" ||
        type === "6m"
      ) {
        const count =
          type === "3m"
            ? 2
            : 5;

        const target =
          addMonths(
            new Date(
              now.getFullYear(),
              now.getMonth(),
              1
            ),
            -count
          );

        nextStart =
          firstDayOfMonth(
            target
          );
      }
      else {
        nextStart =
          `${now.getFullYear()}-01-01`;
      }

      setStartDate(
        nextStart
      );
      setEndDate(
        nextEnd
      );

      void loadAnalytics(
        nextStart,
        nextEnd
      );
    };

  const handleSearch = () => {
    if (
      !startDate ||
      !endDate
    ) {
      setErrorMessage(
        "조회 시작일과 종료일을 선택해주세요."
      );
      return;
    }

    if (
      endDate < startDate
    ) {
      setErrorMessage(
        "조회 종료일은 시작일보다 빠를 수 없습니다."
      );
      return;
    }

    void loadAnalytics(
      startDate,
      endDate
    );
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[22px] border border-[#E5E7EA] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-[#FFF1F5] text-[#A50034]">
                <Building2
                  size={20}
                />
              </div>

              <div>
                <p className="text-[10px] font-black tracking-[0.12em] text-[#A50034]">
                  STORE PERFORMANCE
                </p>

                <h2 className="mt-1 text-[23px] font-black tracking-[-0.035em] text-[#25282D]">
                  지점 실적
                </h2>
              </div>
            </div>

            <p className="mt-3 text-[12px] font-semibold leading-5 text-[#8B9098]">
              선택기간의 지점 전체 일실적을 항목별로 월별·일자별 차트와 표로 분석합니다.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-[145px_145px_auto]">
            <div>
              <label
                htmlFor="store-analytics-start"
                className="mb-1.5 block text-[10px] font-black text-[#666B73]"
              >
                시작일
              </label>

              <input
                id="store-analytics-start"
                type="date"
                value={
                  startDate
                }
                max={today}
                onChange={(
                  event
                ) =>
                  setStartDate(
                    event.target
                      .value
                  )
                }
                className="h-[42px] w-full rounded-[10px] border border-[#DDE0E5] bg-white px-3 text-[12px] font-bold text-[#33373D] outline-none transition focus:border-[#888D95] focus:ring-4 focus:ring-black/[0.035]"
              />
            </div>

            <div>
              <label
                htmlFor="store-analytics-end"
                className="mb-1.5 block text-[10px] font-black text-[#666B73]"
              >
                종료일
              </label>

              <input
                id="store-analytics-end"
                type="date"
                value={
                  endDate
                }
                max={today}
                onChange={(
                  event
                ) =>
                  setEndDate(
                    event.target
                      .value
                  )
                }
                className="h-[42px] w-full rounded-[10px] border border-[#DDE0E5] bg-white px-3 text-[12px] font-bold text-[#33373D] outline-none transition focus:border-[#888D95] focus:ring-4 focus:ring-black/[0.035]"
              />
            </div>

            <button
              type="button"
              onClick={
                handleSearch
              }
              disabled={
                loading
              }
              className="mt-auto inline-flex h-[42px] items-center justify-center gap-2 rounded-[10px] bg-[#A50034] px-4 text-[11px] font-black text-white transition hover:bg-[#8F002D] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <LoaderCircle
                  size={14}
                  className="animate-spin"
                />
              ) : (
                <RefreshCcw
                  size={14}
                />
              )}
              조회
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            [
              "이번달",
              "this-month",
            ],
            [
              "지난달",
              "last-month",
            ],
            [
              "최근 3개월",
              "3m",
            ],
            [
              "최근 6개월",
              "6m",
            ],
            [
              "올해",
              "year",
            ],
          ].map(
            ([
              label,
              value,
            ]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  applyPreset(
                    value as
                      | "this-month"
                      | "last-month"
                      | "3m"
                      | "6m"
                      | "year"
                  )
                }
                disabled={
                  loading
                }
                className="rounded-full border border-[#E0E2E6] bg-white px-3 py-1.5 text-[10px] font-black text-[#666B73] transition hover:border-[#D2A7B4] hover:bg-[#FFF7F9] hover:text-[#A50034] disabled:opacity-50"
              >
                {label}
              </button>
            )
          )}
        </div>
      </section>

      {errorMessage && (
        <section className="flex items-start gap-3 rounded-[16px] border border-[#F0D4DB] bg-[#FFF5F7] px-4 py-4 text-[12px] font-bold text-[#A50034]">
          <AlertCircle
            size={17}
            className="mt-0.5 shrink-0"
          />
          <span>
            {errorMessage}
          </span>
        </section>
      )}

      {loading ? (
        <section className="flex min-h-[300px] items-center justify-center rounded-[22px] border border-[#E5E7EA] bg-white">
          <div className="text-center">
            <LoaderCircle
              size={26}
              className="mx-auto animate-spin text-[#A50034]"
            />
            <p className="mt-3 text-[12px] font-black text-[#6D727A]">
              지점 실적을 분석하고 있습니다.
            </p>
          </div>
        </section>
      ) : !data ||
        data.metrics.length ===
          0 ? (
        <section className="rounded-[22px] border border-[#E5E7EA] bg-white px-5 py-12 text-center">
          <BarChart3
            size={26}
            className="mx-auto text-[#A6AAB1]"
          />
          <p className="mt-3 text-[12px] font-black text-[#666B73]">
            분석할 분류 결과가 없습니다.
          </p>
        </section>
      ) : (
        <>
          <section className="rounded-[22px] border border-[#E5E7EA] bg-white p-5 sm:p-6">
            <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,2fr)]">
              <div>
                <label
                  htmlFor="store-analytics-metric"
                  className="mb-2 block text-[10px] font-black text-[#666B73]"
                >
                  분석 결과항목
                </label>

                <div className="relative">
                  <select
                    id="store-analytics-metric"
                    value={
                      selectedMetricId
                    }
                    onChange={(
                      event
                    ) =>
                      setSelectedMetricId(
                        event.target
                          .value
                      )
                    }
                    className="h-[46px] w-full rounded-[11px] border border-[#DDE0E5] bg-white pl-3 pr-10 text-[12px] font-black text-[#33373D] outline-none transition focus:border-[#888D95] focus:ring-4 focus:ring-black/[0.035]"
                  >
                    {data.metrics.map(
                      (
                        metric
                      ) => (
                        <option
                          key={
                            metric.metric_id
                          }
                          value={
                            metric.metric_id
                          }
                        >
                          {
                            metric.metric_name
                          }
                          {!metric.is_active
                            ? " · 사용중지"
                            : ""}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {selectedMetric && (
                  <div className="mt-3 rounded-[14px] border border-[#E8EAED] bg-[#FAFAFB] p-3">
                    <p className="text-[9px] font-black tracking-[0.08em] text-[#A50034]">
                      분석기준
                    </p>

                    <p className="mt-1.5 text-[11px] font-black text-[#4A4F56]">
                      {selectedMetric.category_name}
                      {" · "}
                      {aggregationLabel(
                        selectedMetric.aggregation_type
                      )}
                      {" · "}
                      {selectedMetric.unit ===
                      "amount"
                        ? "금액"
                        : selectedMetric.unit ===
                            "percent"
                          ? "비율"
                          : "건수"}
                    </p>

                    <p className="mt-1 text-[9px] font-semibold leading-4 text-[#93979E]">
                      선택한 분류에 포함된 세부 입력항목을 증감방향까지 반영해 하나의 결과값으로 분석합니다.
                    </p>

                    <p className="mt-1.5 text-[9px] font-black leading-4 text-[#666B73]">
                      {selectedMetric.metric_name}
                      {" = "}
                      {
                      selectedMetric.components
                        ?.map(
                          (
                            component,
                            index
                          ) => {
                            const prefix =
                              index === 0
                                ? component.effect_sign < 0
                                  ? "- "
                                  : ""
                                : component.effect_sign < 0
                                  ? " - "
                                  : " + ";

                            return `${prefix}${component.name}`;
                          }
                        )
                        .join("") ||
                        "세부 입력항목 합산"
                    }
                    </p>
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricSummaryCard
                  label="선택기간 실적"
                  value={formatMetricValue(
                    summaryValue?.value ??
                      null,
                    selectedMetric
                  )}
                  caption={`${startDate} ~ ${effectiveEnd}`}
                  emphasized
                />

                <MetricSummaryCard
                  label="최근 실적월"
                  value={
                    latestMonth &&
                    selectedMetric
                      ? formatMetricValue(
                          latestMonth.values.value,
                          selectedMetric
                        )
                      : "-"
                  }
                  caption={
                    latestMonth
                      ? latestMonth.label
                      : "실적 없음"
                  }
                />

                <MetricSummaryCard
                  label="전월대비"
                  value={
                    monthChange ===
                    null
                      ? "-"
                      : `${monthChange >= 0 ? "+" : ""}${monthChange.toLocaleString(
                          "ko-KR",
                          {
                            maximumFractionDigits: 1,
                          }
                        )}%`
                  }
                  caption="최근 실적월 기준"
                />

                <MetricSummaryCard
                  label="선택월 실적일"
                  value={`${activeDayCount.toLocaleString(
                    "ko-KR"
                  )}일`}
                  caption={
                    selectedMonth
                      ? `${monthLabel(
                          selectedMonth
                        )} · 확정 실적 존재일`
                      : "선택월 없음"
                  }
                />
              </div>
            </div>
          </section>

          {selectedMetric && (
            <>
              <section className="rounded-[22px] border border-[#E5E7EA] bg-white p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <TrendingUp
                        size={17}
                        className="text-[#A50034]"
                      />
                      <h3 className="text-[16px] font-black text-[#30343A]">
                        월별 추이
                      </h3>
                    </div>

                    <p className="mt-1 text-[10px] font-semibold text-[#969AA1]">
                      차트의 월을 클릭하면 아래 일자별 분석월도 함께 변경됩니다.
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF3F6] px-3 py-1.5 text-[10px] font-black text-[#A50034]">
                    <BarChart3
                      size={12}
                    />
                    {selectedMetric.metric_name}
                  </div>
                </div>

                <div className="mt-4 rounded-[16px] border border-[#E9EBEE] bg-[#FCFCFD] p-3">
                  <AnalyticsLineChart
                    points={
                      monthlyPoints
                    }
                    series={[
                      {
                        key: "value",
                        label:
                          selectedMetric.metric_name,
                        color:
                          "#A50034",
                      },
                    ]}
                    selectedKey={
                      selectedMonth
                    }
                    onSelectKey={(
                      month
                    ) =>
                      setSelectedMonth(
                        month
                      )
                    }
                    axisFormatter={(
                      value
                    ) =>
                      compactMetricValue(
                        value,
                        selectedMetric
                      )
                    }
                    valueFormatter={(
                      value
                    ) =>
                      formatMetricValue(
                        value,
                        selectedMetric
                      )
                    }
                  />
                </div>

                <div className="mt-4 overflow-x-auto rounded-[14px] border border-[#E7E9EC]">
                  <table className="w-full min-w-[720px] border-collapse">
                    <thead className="bg-[#FAFAFB]">
                      <tr className="text-[10px] font-black text-[#747981]">
                        <th className="px-4 py-3 text-left">
                          월
                        </th>
                        <th className="px-4 py-3 text-right">
                          {selectedMetric.metric_name}
                        </th>
                        <th className="px-4 py-3 text-right">
                          상태
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {monthlyPoints.map(
                        (
                          point
                        ) => (
                          <tr
                            key={
                              point.key
                            }
                            onClick={() =>
                              setSelectedMonth(
                                point.key
                              )
                            }
                            className={[
                              "cursor-pointer border-t border-[#ECEEF1] text-[11px] transition hover:bg-[#FFF9FB]",
                              selectedMonth ===
                              point.key
                                ? "bg-[#FFF7F9]"
                                : "bg-white",
                            ].join(
                              " "
                            )}
                          >
                            <td className="px-4 py-3 font-black text-[#3E434A]">
                              {
                                point.label
                              }
                            </td>
                            <td className="px-4 py-3 text-right font-black tabular-nums text-[#33373D]">
                              {formatMetricValue(
                                point.values.value,
                                selectedMetric
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className={[
                                  "rounded-full px-2 py-1 text-[9px] font-black",
                                  point.values.value ===
                                  null
                                    ? "bg-[#F3F4F5] text-[#969AA1]"
                                    : "bg-[#EDF8F1] text-[#39744F]",
                                ].join(
                                  " "
                                )}
                              >
                                {point.values.value ===
                                null
                                  ? "미입력"
                                  : "실적있음"}
                              </span>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-[22px] border border-[#E5E7EA] bg-white p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CalendarDays
                        size={17}
                        className="text-[#A50034]"
                      />
                      <h3 className="text-[16px] font-black text-[#30343A]">
                        선택월 일자별 추이
                      </h3>
                    </div>

                    <p className="mt-1 text-[10px] font-semibold text-[#969AA1]">
                      미입력 날짜를 0으로 바꾸지 않으며, 선은 앞뒤 실제 실적점을 연결해 전체 흐름을 보여줍니다.
                    </p>
                  </div>

                  <div className="relative min-w-[150px]">
                    <select
                      value={
                        selectedMonth
                      }
                      onChange={(
                        event
                      ) =>
                        setSelectedMonth(
                          event.target
                            .value
                        )
                      }
                      className="h-[40px] w-full rounded-[10px] border border-[#DDE0E5] bg-white pl-3 pr-9 text-[11px] font-black text-[#444950] outline-none"
                    >
                      {monthKeys.map(
                        (
                          month
                        ) => (
                          <option
                            key={
                              month
                            }
                            value={
                              month
                            }
                          >
                            {
                              monthLabel(
                                month
                              )
                            }
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>

                <div className="mt-4 rounded-[16px] border border-[#E9EBEE] bg-[#FCFCFD] p-3">
                  <AnalyticsLineChart
                    points={
                      dailyPoints
                    }
                    series={[
                      {
                        key: "value",
                        label:
                          selectedMetric.metric_name,
                        color:
                          "#A50034",
                      },
                    ]}
                    axisFormatter={(
                      value
                    ) =>
                      compactMetricValue(
                        value,
                        selectedMetric
                      )
                    }
                    valueFormatter={(
                      value
                    ) =>
                      formatMetricValue(
                        value,
                        selectedMetric
                      )
                    }
                  />
                </div>

                <div className="mt-4 overflow-x-auto rounded-[14px] border border-[#E7E9EC]">
                  <table className="w-full min-w-[720px] border-collapse">
                    <thead className="bg-[#FAFAFB]">
                      <tr className="text-[10px] font-black text-[#747981]">
                        <th className="px-4 py-3 text-left">
                          일자
                        </th>
                        <th className="px-4 py-3 text-right">
                          {selectedMetric.metric_name}
                        </th>
                        <th className="px-4 py-3 text-right">
                          구분
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {dailyPoints.map(
                        (
                          point
                        ) => (
                          <tr
                            key={
                              point.key
                            }
                            className="border-t border-[#ECEEF1] bg-white text-[11px]"
                          >
                            <td className="px-4 py-3 font-black text-[#3E434A]">
                              {
                                point.label
                              }
                            </td>
                            <td className="px-4 py-3 text-right font-black tabular-nums text-[#33373D]">
                              {formatMetricValue(
                                point.values.value,
                                selectedMetric
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className={[
                                  "rounded-full px-2 py-1 text-[9px] font-black",
                                  point.values.value ===
                                  null
                                    ? "bg-[#F3F4F5] text-[#969AA1]"
                                    : "bg-[#EDF8F1] text-[#39744F]",
                                ].join(
                                  " "
                                )}
                              >
                                {point.values.value ===
                                null
                                  ? "미입력"
                                  : "확정"}
                              </span>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
