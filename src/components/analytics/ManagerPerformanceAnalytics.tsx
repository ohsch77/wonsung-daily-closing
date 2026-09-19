"use client";

import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  LoaderCircle,
  RefreshCcw,
  TrendingUp,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import AnalyticsBarChart from "@/components/analytics/AnalyticsBarChart";
import AnalyticsLineChart, {
  type AnalyticsLineChartPoint,
} from "@/components/analytics/AnalyticsLineChart";
import { scheduleAnalyticsScroll } from "@/lib/analytics-scroll";
import { createClient } from "@/lib/supabase/client";


type ManagerMetric = {
  category_id: string;
  category_code: string;
  category_name: string;
  category_order: number;
  metric_id: string;
  metric_code: string;
  metric_name: string;
  unit: "amount" | "count" | "percent" | string;
  effect_sign: number;
  aggregation_type: "sum" | "average" | "rate" | string;
  metric_order: number;
  is_active: boolean;
  components?: {
    name: string;
    effect_sign: number;
  }[];
};

type ManagerRow = {
  manager_id: string;
  employee_no: string;
  manager_name: string;
  display_order: number;
  is_active: boolean;
  workdays: number;
  no_performance_days: number;
  daily_general_sales: number;
  workday_average: number | null;
};

type ComparisonRow = {
  manager_id: string;
  manager_name: string;
  is_active: boolean;
  selected_metric_value: number | null;
  workdays: number;
  no_performance_days: number;
  daily_general_sales: number;
  workday_average: number | null;
};

type MonthlyRow = {
  month: string;
  selected_metric_value: number | null;
  workdays: number;
  no_performance_days: number;
  daily_general_sales: number;
  workday_average: number | null;
};

type DailyRow = {
  date: string;
  selected_metric_value: number | null;
  is_present: boolean;
  no_performance_confirmed: boolean;
  daily_general_sales: number | null;
  day_status: "normal" | "store_holiday" | "holiday_open" | string;
};

type ManagerAnalyticsResponse = {
  period: {
    start_date: string;
    end_date: string;
    effective_end_date: string | null;
  };
  selected_manager_id: string | null;
  selected_metric_id: string | null;
  managers: ManagerRow[];
  metrics: ManagerMetric[];
  comparison: ComparisonRow[];
  selected_summary: ComparisonRow | null;
  monthly: MonthlyRow[];
  daily: DailyRow[];
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function todayKey() {
  return localDateKey(new Date());
}

function firstDayOfYear() {
  return `${new Date().getFullYear()}-01-01`;
}

function firstDayOfMonth(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`;
}

function lastDayOfMonth(date: Date) {
  return localDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function formatMetricValue(value: number | null, metric: ManagerMetric | null) {
  if (value === null || !metric) return "-";

  if (metric.unit === "amount") {
    return `${Math.round(value).toLocaleString("ko-KR")}원`;
  }

  if (metric.unit === "percent") {
    return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
  }

  return `${value.toLocaleString("ko-KR", {
    maximumFractionDigits: metric.aggregation_type === "average" ? 1 : 0,
  })}건`;
}

function compactMetricValue(value: number, metric: ManagerMetric) {
  const absolute = Math.abs(value);

  if (metric.unit === "amount") {
    if (absolute >= 100000000) {
      return `${(value / 100000000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억`;
    }
    if (absolute >= 10000) {
      return `${(value / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}만`;
    }
    return Math.round(value).toLocaleString("ko-KR");
  }

  if (metric.unit === "percent") {
    return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
  }

  return value.toLocaleString("ko-KR", {
    maximumFractionDigits: metric.aggregation_type === "average" ? 1 : 0,
  });
}

function won(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function monthLabel(month: string) {
  const [year, rawMonth] = month.split("-");
  return `${year}.${Number(rawMonth)}`;
}

function dayLabel(date: string) {
  const parts = date.split("-");
  if (parts.length !== 3) return date;
  return `${Number(parts[1])}/${Number(parts[2])}`;
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
    <div className={[
      "rounded-[17px] border p-4",
      emphasized ? "border-[#E4C7D0] bg-[#FFF7F9]" : "border-[#E5E7EA] bg-white",
    ].join(" ")}>
      <p className="text-[10px] font-black text-[#7E838B]">{label}</p>
      <p className={[
        "mt-2 text-[18px] font-black tracking-[-0.03em] tabular-nums",
        emphasized ? "text-[#A50034]" : "text-[#292D33]",
      ].join(" ")}>
        {value}
      </p>
      <p className="mt-1.5 text-[9px] font-semibold leading-4 text-[#A0A4AA]">{caption}</p>
    </div>
  );
}

export default function ManagerPerformanceAnalytics() {
  const supabase = useMemo(() => createClient(), []);
  const today = useMemo(() => todayKey(), []);
  const initialStart = useMemo(() => firstDayOfYear(), []);

  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(today);
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [selectedMetricId, setSelectedMetricId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [data, setData] = useState<ManagerAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadAnalytics = useCallback(async (
    targetStart: string,
    targetEnd: string,
    managerId?: string,
    metricId?: string,
  ) => {
    setLoading(true);
    setErrorMessage("");

    try {
      const { data: result, error } = await supabase.rpc(
        "get_manager_performance_analytics",
        {
          p_start_date: targetStart,
          p_end_date: targetEnd,
          p_manager_id: managerId || null,
          p_metric_id: metricId || null,
        }
      );

      if (error) throw error;

      const parsed = result as ManagerAnalyticsResponse;
      setData(parsed);
      setSelectedManagerId(parsed.selected_manager_id ?? "");
      setSelectedMetricId(parsed.selected_metric_id ?? "");

      const months = parsed.monthly.map((row) => row.month);
      setSelectedMonth((current) =>
        months.includes(current) ? current : (months.at(-1) ?? "")
      );
    }
    catch (error) {
      console.error("매니저 실적 분석 조회 오류:", error);
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : "매니저 실적 분석 데이터를 불러오지 못했습니다."
      );
    }
    finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAnalytics(initialStart, today);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initialStart, loadAnalytics, today]);

  const selectedMetric = useMemo(
    () => data?.metrics.find((metric) => metric.metric_id === selectedMetricId) ?? null,
    [data, selectedMetricId]
  );

  const selectedManager = useMemo(
    () => data?.managers.find((manager) => manager.manager_id === selectedManagerId) ?? null,
    [data, selectedManagerId]
  );

  const comparisonItems = useMemo(
    () => (data?.comparison ?? []).map((row) => ({
      key: row.manager_id,
      label: row.manager_name,
      value: row.selected_metric_value,
      subLabel: `${row.workdays}일 근무`,
    })),
    [data]
  );

  const monthlyPoints: AnalyticsLineChartPoint[] = useMemo(
    () => (data?.monthly ?? []).map((row) => ({
      key: row.month,
      label: monthLabel(row.month),
      values: { value: row.selected_metric_value },
    })),
    [data]
  );

  const dailyPoints: AnalyticsLineChartPoint[] = useMemo(
    () => (data?.daily ?? [])
      .filter((row) => !selectedMonth || row.date.startsWith(`${selectedMonth}-`))
      .map((row) => ({
        key: row.date,
        label: dayLabel(row.date),
        values: { value: row.selected_metric_value },
      })),
    [data, selectedMonth]
  );

  const selectedMonthRows = useMemo(
    () => (data?.daily ?? []).filter(
      (row) => !selectedMonth || row.date.startsWith(`${selectedMonth}-`)
    ),
    [data, selectedMonth]
  );

  const handleSearch = () => {
    if (!startDate || !endDate) {
      setErrorMessage("조회 시작일과 종료일을 선택해주세요.");
      return;
    }
    if (endDate < startDate) {
      setErrorMessage("조회 종료일은 시작일보다 빠를 수 없습니다.");
      return;
    }
    void loadAnalytics(startDate, endDate, selectedManagerId, selectedMetricId);
  };

  const applyPreset = (type: "this-month" | "last-month" | "3m" | "6m" | "year") => {
    const now = new Date();
    let nextStart = startDate;
    let nextEnd = today;

    if (type === "this-month") {
      nextStart = firstDayOfMonth(now);
    }
    else if (type === "last-month") {
      const target = addMonths(new Date(now.getFullYear(), now.getMonth(), 1), -1);
      nextStart = firstDayOfMonth(target);
      nextEnd = lastDayOfMonth(target);
    }
    else if (type === "3m" || type === "6m") {
      const count = type === "3m" ? 2 : 5;
      nextStart = firstDayOfMonth(
        addMonths(new Date(now.getFullYear(), now.getMonth(), 1), -count)
      );
    }
    else {
      nextStart = `${now.getFullYear()}-01-01`;
    }

    setStartDate(nextStart);
    setEndDate(nextEnd);
    void loadAnalytics(nextStart, nextEnd, selectedManagerId, selectedMetricId);
  };

  const changeMetric = (metricId: string) => {
    setSelectedMetricId(metricId);
    void loadAnalytics(startDate, endDate, selectedManagerId, metricId);
  };

  const changeManager = (managerId: string, scroll = false) => {
    setSelectedManagerId(managerId);
    void loadAnalytics(startDate, endDate, managerId, selectedMetricId);
    if (scroll) scheduleAnalyticsScroll("manager-detail-title");
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[22px] border border-[#E5E7EA] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-[#FFF1F5] text-[#A50034]">
                <UsersRound size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black tracking-[0.12em] text-[#A50034]">MANAGER PERFORMANCE</p>
                <h2 className="mt-1 text-[23px] font-black tracking-[-0.035em] text-[#25282D]">매니저 실적</h2>
              </div>
            </div>
            <p className="mt-3 text-[12px] font-semibold leading-5 text-[#8B9098]">
              전체 매니저의 항목별 실적을 비교하고, 개별 매니저의 월별·일자별 변화 추이를 선으로 확인합니다.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-[145px_145px_auto]">
            <div>
              <label htmlFor="manager-analytics-start" className="mb-1.5 block text-[10px] font-black text-[#666B73]">시작일</label>
              <input
                id="manager-analytics-start"
                type="date"
                value={startDate}
                max={today}
                onChange={(event) => setStartDate(event.target.value)}
                className="h-[42px] w-full rounded-[10px] border border-[#DDE0E5] bg-white px-3 text-[12px] font-bold text-[#33373D] outline-none"
              />
            </div>
            <div>
              <label htmlFor="manager-analytics-end" className="mb-1.5 block text-[10px] font-black text-[#666B73]">종료일</label>
              <input
                id="manager-analytics-end"
                type="date"
                value={endDate}
                max={today}
                onChange={(event) => setEndDate(event.target.value)}
                className="h-[42px] w-full rounded-[10px] border border-[#DDE0E5] bg-white px-3 text-[12px] font-bold text-[#33373D] outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading}
              className="mt-auto inline-flex h-[42px] items-center justify-center gap-2 rounded-[10px] bg-[#A50034] px-4 text-[11px] font-black text-white disabled:opacity-50"
            >
              {loading ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
              조회
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            ["이번달", "this-month"],
            ["지난달", "last-month"],
            ["최근 3개월", "3m"],
            ["최근 6개월", "6m"],
            ["올해", "year"],
          ].map(([label, value]) => (
            <button
              key={value}
              type="button"
              onClick={() => applyPreset(value as "this-month" | "last-month" | "3m" | "6m" | "year")}
              disabled={loading}
              className="rounded-full border border-[#E0E2E6] bg-white px-3 py-1.5 text-[10px] font-black text-[#666B73] transition hover:border-[#D2A7B4] hover:bg-[#FFF7F9] hover:text-[#A50034] disabled:opacity-50"
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => scheduleAnalyticsScroll("manager-comparison-title")}
          className="rounded-[18px] border border-[#E5E7EA] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#D4AEB9] hover:shadow-md"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#F5F6F7] text-[#777C84]">
            <BarChart3 size={17} />
          </div>
          <h3 className="mt-4 text-[16px] font-black text-[#292C31]">전체 매니저 비교</h3>
          <p className="mt-2 text-[10px] font-semibold leading-5 text-[#92969D]">선택한 일실적 항목을 매니저별로 비교하고 개별 상세로 바로 이동합니다.</p>
        </button>

        <button
          type="button"
          onClick={() => scheduleAnalyticsScroll("manager-detail-title")}
          className="rounded-[18px] border border-[#E5E7EA] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#D4AEB9] hover:shadow-md"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#F5F6F7] text-[#777C84]">
            <TrendingUp size={17} />
          </div>
          <h3 className="mt-4 text-[16px] font-black text-[#292C31]">개별 매니저 추이</h3>
          <p className="mt-2 text-[10px] font-semibold leading-5 text-[#92969D]">월별·일자별 항목 실적을 연결 선차트로 보고 실제 근무일 지표를 함께 확인합니다.</p>
        </button>
      </section>

      {errorMessage && (
        <section className="flex items-start gap-3 rounded-[16px] border border-[#F0D4DB] bg-[#FFF5F7] px-4 py-4 text-[12px] font-bold text-[#A50034]">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </section>
      )}

      {loading ? (
        <section className="flex min-h-[300px] items-center justify-center rounded-[22px] border border-[#E5E7EA] bg-white">
          <div className="text-center">
            <LoaderCircle size={26} className="mx-auto animate-spin text-[#A50034]" />
            <p className="mt-3 text-[12px] font-black text-[#6D727A]">매니저 실적을 분석하고 있습니다.</p>
          </div>
        </section>
      ) : !data || !selectedMetric ? (
        <section className="rounded-[22px] border border-[#E5E7EA] bg-white px-5 py-12 text-center">
          <UsersRound size={26} className="mx-auto text-[#A6AAB1]" />
          <p className="mt-3 text-[12px] font-black text-[#666B73]">분석할 매니저 또는 분류 결과가 없습니다.</p>
        </section>
      ) : (
        <>
          <section id="manager-comparison-title" className="rounded-[22px] border border-[#E5E7EA] bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 size={18} className="text-[#A50034]" />
                  <h3 className="text-[17px] font-black text-[#30343A]">전체 매니저 분류결과 비교</h3>
                </div>
                <p className="mt-1 text-[10px] font-semibold text-[#969AA1]">비교 막대를 클릭하면 해당 매니저의 개별 추이로 바로 이동합니다.</p>
              </div>

              <div className="relative min-w-[250px]">
                <select
                  id="manager-comparison-metric"
                  value={selectedMetricId}
                  onChange={(event) => changeMetric(event.target.value)}
                  className="h-[42px] w-full rounded-[10px] border border-[#DDE0E5] bg-white pl-3 pr-9 text-[11px] font-black text-[#444950] outline-none"
                >
                  {data.metrics.map((metric) => (
                    <option
                      key={metric.metric_id}
                      value={metric.metric_id}
                    >
                      {metric.metric_name}
                      {!metric.is_active
                        ? " · 사용중지"
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 rounded-[13px] border border-[#E8EAED] bg-[#FAFAFB] px-3 py-2.5 text-[9px] font-semibold leading-4 text-[#8A8F97]">
              <span className="font-black text-[#555A62]">
                {selectedMetric.metric_name}
              </span>
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
            </div>

            <div className="mt-5 rounded-[16px] border border-[#E9EBEE] bg-[#FCFCFD] p-4">
              <AnalyticsBarChart
                items={comparisonItems}
                selectedKey={selectedManagerId}
                valueFormatter={(value) => formatMetricValue(value, selectedMetric)}
                onSelectKey={(managerId) => changeManager(managerId, true)}
              />
            </div>

            <div className="mt-4 overflow-x-auto rounded-[14px] border border-[#E7E9EC]">
              <table className="w-full min-w-[900px] border-collapse">
                <thead className="bg-[#FAFAFB]">
                  <tr className="text-[10px] font-black text-[#747981]">
                    <th className="px-4 py-3 text-left">매니저</th>
                    <th className="px-4 py-3 text-right">{selectedMetric.metric_name}</th>
                    <th className="px-4 py-3 text-right">총판 실적</th>
                    <th className="px-4 py-3 text-right">근무일수</th>
                    <th className="px-4 py-3 text-right">근무일 평균</th>
                    <th className="px-4 py-3 text-right">무실적일</th>
                  </tr>
                </thead>
                <tbody>
                  {data.comparison.map((row) => (
                    <tr
                      key={row.manager_id}
                      onClick={() => changeManager(row.manager_id, true)}
                      className={[
                        "cursor-pointer border-t border-[#ECEEF1] text-[11px] transition hover:bg-[#FFF9FB]",
                        row.manager_id === selectedManagerId ? "bg-[#FFF7F9]" : "bg-white",
                      ].join(" ")}
                    >
                      <td className="px-4 py-3 font-black text-[#3E434A]">
                        {row.manager_name}{!row.is_active ? " · 사용중지" : ""}
                      </td>
                      <td className="px-4 py-3 text-right font-black tabular-nums text-[#33373D]">{formatMetricValue(row.selected_metric_value, selectedMetric)}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-[#4B5057]">{won(row.daily_general_sales)}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-[#4B5057]">{row.workdays.toLocaleString("ko-KR")}일</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-[#4B5057]">{won(row.workday_average)}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-[#4B5057]">{row.no_performance_days.toLocaleString("ko-KR")}일</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="manager-detail-title" className="rounded-[22px] border border-[#E5E7EA] bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <UserRound size={18} className="text-[#A50034]" />
                  <h3 className="text-[17px] font-black text-[#30343A]">개별 매니저 상세</h3>
                </div>
                <p className="mt-1 text-[10px] font-semibold text-[#969AA1]">실제 출근일수를 기준으로 근무일 평균을 계산하고 항목별 추이를 확인합니다.</p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="relative min-w-[170px]">
                  <select
                    id="manager-detail-manager"
                    value={selectedManagerId}
                    onChange={(event) => changeManager(event.target.value)}
                    className="h-[42px] w-full rounded-[10px] border border-[#DDE0E5] bg-white pl-3 pr-9 text-[11px] font-black text-[#444950] outline-none"
                  >
                    {data.managers.map((manager) => (
                      <option key={manager.manager_id} value={manager.manager_id}>
                        {manager.manager_name}{!manager.is_active ? " · 사용중지" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative min-w-[220px]">
                  <select
                    id="manager-detail-metric"
                    value={selectedMetricId}
                    onChange={(event) => changeMetric(event.target.value)}
                    className="h-[42px] w-full rounded-[10px] border border-[#DDE0E5] bg-white pl-3 pr-9 text-[11px] font-black text-[#444950] outline-none"
                  >
                    {data.metrics.map((metric) => (
                      <option
                        key={metric.metric_id}
                        value={metric.metric_id}
                      >
                        {metric.metric_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-[13px] border border-[#E8EAED] bg-[#FAFAFB] px-3 py-2.5 text-[9px] font-semibold leading-4 text-[#8A8F97]">
              <span className="font-black text-[#555A62]">
                {selectedMetric.metric_name}
              </span>
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
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricSummaryCard
                label="선택 분류결과"
                value={formatMetricValue(data.selected_summary?.selected_metric_value ?? null, selectedMetric)}
                caption={`${startDate} ~ ${data.period.effective_end_date ?? endDate}`}
                emphasized
              />
              <MetricSummaryCard
                label="총판 실적"
                value={won(data.selected_summary?.daily_general_sales)}
                caption="GENERAL_SALES 금액 기준"
              />
              <MetricSummaryCard
                label="근무일수"
                value={`${(data.selected_summary?.workdays ?? 0).toLocaleString("ko-KR")}일`}
                caption="실제 출근 선택 기준"
              />
              <MetricSummaryCard
                label="근무일 평균"
                value={won(data.selected_summary?.workday_average)}
                caption="총판 실적 ÷ 실제 근무일수"
              />
              <MetricSummaryCard
                label="무실적 근무일"
                value={`${(data.selected_summary?.no_performance_days ?? 0).toLocaleString("ko-KR")}일`}
                caption="출근 + 무실적확정"
              />
            </div>

            {selectedManager && (
              <p className="mt-3 text-[9px] font-semibold text-[#9A9EA5]">
                {selectedManager.manager_name} · {selectedManager.employee_no} · 지점휴무 제외 / 휴일영업 출근 포함
              </p>
            )}
          </section>

          <section className="rounded-[22px] border border-[#E5E7EA] bg-white p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <TrendingUp size={17} className="text-[#A50034]" />
              <h3 className="text-[16px] font-black text-[#30343A]">월별 분류결과 추이</h3>
            </div>
            <p className="mt-1 text-[10px] font-semibold text-[#969AA1]">월별 실적점은 모두 선으로 연결해 상승·하락 흐름을 바로 확인할 수 있습니다.</p>

            <div className="mt-4 rounded-[16px] border border-[#E9EBEE] bg-[#FCFCFD] p-3">
              <AnalyticsLineChart
                points={monthlyPoints}
                series={[{ key: "value", label: selectedMetric.metric_name, color: "#A50034" }]}
                selectedKey={selectedMonth}
                onSelectKey={setSelectedMonth}
                axisFormatter={(value) => compactMetricValue(value, selectedMetric)}
                valueFormatter={(value) => formatMetricValue(value, selectedMetric)}
              />
            </div>

            <div className="mt-4 overflow-x-auto rounded-[14px] border border-[#E7E9EC]">
              <table className="w-full min-w-[900px] border-collapse">
                <thead className="bg-[#FAFAFB]">
                  <tr className="text-[10px] font-black text-[#747981]">
                    <th className="px-4 py-3 text-left">월</th>
                    <th className="px-4 py-3 text-right">{selectedMetric.metric_name}</th>
                    <th className="px-4 py-3 text-right">총판 실적</th>
                    <th className="px-4 py-3 text-right">근무일</th>
                    <th className="px-4 py-3 text-right">근무일 평균</th>
                    <th className="px-4 py-3 text-right">무실적일</th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthly.map((row) => (
                    <tr
                      key={row.month}
                      onClick={() => setSelectedMonth(row.month)}
                      className={[
                        "cursor-pointer border-t border-[#ECEEF1] text-[11px] hover:bg-[#FFF9FB]",
                        row.month === selectedMonth ? "bg-[#FFF7F9]" : "bg-white",
                      ].join(" ")}
                    >
                      <td className="px-4 py-3 font-black text-[#3E434A]">{monthLabel(row.month)}</td>
                      <td className="px-4 py-3 text-right font-black tabular-nums text-[#33373D]">{formatMetricValue(row.selected_metric_value, selectedMetric)}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-[#4B5057]">{won(row.daily_general_sales)}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-[#4B5057]">{row.workdays}일</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-[#4B5057]">{won(row.workday_average)}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-[#4B5057]">{row.no_performance_days}일</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-[22px] border border-[#E5E7EA] bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CalendarDays size={17} className="text-[#A50034]" />
                  <h3 className="text-[16px] font-black text-[#30343A]">선택월 일자별 분류결과 추이</h3>
                </div>
                <p className="mt-1 text-[10px] font-semibold text-[#969AA1]">미입력 날짜를 0으로 바꾸지 않고 실제 실적점 사이를 연결해 변화 흐름을 보여줍니다.</p>
              </div>

              <div className="relative min-w-[150px]">
                <select
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  className="h-[40px] w-full rounded-[10px] border border-[#DDE0E5] bg-white pl-3 pr-9 text-[11px] font-black text-[#444950] outline-none"
                >
                  {data.monthly.map((row) => (
                    <option key={row.month} value={row.month}>{monthLabel(row.month)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 rounded-[16px] border border-[#E9EBEE] bg-[#FCFCFD] p-3">
              <AnalyticsLineChart
                points={dailyPoints}
                series={[{ key: "value", label: selectedMetric.metric_name, color: "#A50034" }]}
                axisFormatter={(value) => compactMetricValue(value, selectedMetric)}
                valueFormatter={(value) => formatMetricValue(value, selectedMetric)}
              />
            </div>

            <div className="mt-4 overflow-x-auto rounded-[14px] border border-[#E7E9EC]">
              <table className="w-full min-w-[900px] border-collapse">
                <thead className="bg-[#FAFAFB]">
                  <tr className="text-[10px] font-black text-[#747981]">
                    <th className="px-4 py-3 text-left">일자</th>
                    <th className="px-4 py-3 text-right">{selectedMetric.metric_name}</th>
                    <th className="px-4 py-3 text-right">총판 실적</th>
                    <th className="px-4 py-3 text-right">근무상태</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedMonthRows.map((row) => {
                    let status = "개인휴무";
                    if (row.day_status === "store_holiday") status = "지점휴무";
                    else if (row.is_present && row.no_performance_confirmed) status = "출근 · 무실적";
                    else if (row.is_present) status = row.day_status === "holiday_open" ? "휴일영업 · 출근" : "출근";

                    return (
                      <tr key={row.date} className="border-t border-[#ECEEF1] bg-white text-[11px]">
                        <td className="px-4 py-3 font-black text-[#3E434A]">{dayLabel(row.date)}</td>
                        <td className="px-4 py-3 text-right font-black tabular-nums text-[#33373D]">{formatMetricValue(row.selected_metric_value, selectedMetric)}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-[#4B5057]">{won(row.daily_general_sales)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="rounded-full bg-[#F3F4F5] px-2 py-1 text-[9px] font-black text-[#777C84]">{status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
