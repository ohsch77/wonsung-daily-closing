/**
 * 지점 마감보고 카드의 분류/항목 배치를 설정과 동기화합니다.
 * 기존 get_closing_report_payload가 계산하던 행은 그 결과를 그대로 재사용합니다.
 * 기존 보고서에 없는 신규 항목만 daily_metric_values에서 읽어 추가합니다.
 * 기존 일실적/마감 보고서의 DB 행을 변경하지 않습니다.
 */
import { createClient } from "@/lib/supabase/client";

type DbClient = ReturnType<typeof createClient>;

type Pair = { daily: number; mtd: number };

export type ConfiguredCardRow = {
  label: string;
  path: string;
  unit: "amount" | "count" | "percent";
  emphasize?: boolean;
  emphasizeKind?: "total" | "rate";
  dividerBefore?: boolean;
};

export type ConfiguredCardSection = {
  section: string;
  rows: ConfiguredCardRow[];
};

type CategoryRow = {
  id: string;
  name: string;
  code?: string | null;
  display_order?: number | null;
  is_active?: boolean | null;
};

type MetricRow = {
  id: string;
  category_id: string;
  name: string;
  code?: string | null;
  display_order?: number | null;
  is_active?: boolean | null;
  aggregation_type?: string | null;
  numerator_metric_id?: string | null;
  denominator_metric_id?: string | null;
  unit?: string | null;
};

type ReportRow = {
  id: string;
  manager_id: string;
  report_date: string;
  status: string;
};

type ValueRow = {
  report_id: string;
  metric_id: string;
  value: number | null;
};

type PayloadShape = {
  report_date: string;
  month_start: string;
  managers: Array<{ manager_id: string }>;
  totals: object;
};

function keyOf(text: string): string {
  return text.replace(/[\s\-_()\[\]\/]/g, "").toLowerCase();
}

function categoryAliases(section: string): string[] {
  const key = keyOf(section);
  const synonyms: Record<string, string[]> = {
    판매: ["총판금액"],
    구독실적: ["구독총판"],
    교원실적: ["구독교원"],
    추적관리: ["가망객관리"],
    후기관리: ["후기관리"],
    newbestvat별도: ["newbest"],
  };
  // '결제금액'은 독립적인 지점 결제내역이므로 총판금액과 병합하지 않습니다.
  if (key === "결제금액") return [key];
  return [key, ...(synonyms[key] ?? [])].map(keyOf);
}

function metricAliases(label: string): string[] {
  const key = keyOf(label);
  const synonyms: Record<string, string[]> = {
    매장: ["매장판매"],
    외부: ["외부판매"],
    취소: ["판매취소"],
    구독판매: ["구독판매"],
    구독취소: ["구독취소"],
    교원판매: ["교원판매"],
    교원취소: ["교원취소"],
    입수건수: ["입수건수"],
    성공건수: ["성공건수"],
    웨딩카페: ["웨딩카페"],
    블로그: ["블로그"],
    입주카페: ["입주카페"],
    단톡방: ["단톡방"],
    네이버리뷰: ["네이버리뷰"],
  };
  return [key, ...(synonyms[key] ?? [])].map(keyOf);
}

function sortByConfiguredOrder<T extends { display_order?: number | null; name: string }>(
  a: T,
  b: T
): number {
  return (
    Number(a.display_order ?? 999999) - Number(b.display_order ?? 999999)
  ) || a.name.localeCompare(b.name, "ko-KR");
}

async function readPages<T>(
  request: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>
): Promise<T[]> {
  const all: T[] = [];
  const pageSize = 1000;
  for (let start = 0; start < 100000; start += pageSize) {
    const result = await request(start, start + pageSize - 1);
    if (result.error) throw new Error(result.error.message);
    const rows = result.data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) return all;
  }
  throw new Error("마감보고 데이터의 안전 조회 한도를 초과했습니다.");
}

function pairFromCounts(
  records: ReadonlyArray<{ date: string; value: number }>,
  metric: MetricRow,
  reportDate: string
): Pair {
  const dailyValues = records.filter((r) => r.date === reportDate);
  const aggregate = (entries: typeof records) => {
    const sum = entries.reduce((s, r) => s + r.value, 0);
    return metric.aggregation_type === "average" && entries.length > 0
      ? sum / entries.length
      : sum;
  };
  return { daily: aggregate(dailyValues), mtd: aggregate(records) };
}

/**
 * 잠금/마감 여부, 기본 집계식, PNG 렌더링은 기존 컴포넌트가 담당합니다.
 */
export async function configureClosingCard<P extends PayloadShape>(
  supabase: DbClient,
  payload: P,
  legacySections: ConfiguredCardSection[]
): Promise<{ payload: P; sections: ConfiguredCardSection[] }> {
  const [categoriesResult, metricsResult] = await Promise.all([
    supabase.from("metric_categories").select("*").order("display_order"),
    supabase.from("metrics").select("*").order("display_order"),
  ]);
  if (categoriesResult.error) throw categoriesResult.error;
  if (metricsResult.error) throw metricsResult.error;

  const allCategories = (categoriesResult.data ?? []) as CategoryRow[];
  const allMetrics = (metricsResult.data ?? []) as MetricRow[];
  const activeCategories = allCategories
    .filter((category) => category.is_active !== false)
    .sort(sortByConfiguredOrder);
  const activeCategoryIds = new Set(activeCategories.map((category) => category.id));
  const activeMetrics = allMetrics
    .filter((metric) => metric.is_active !== false && activeCategoryIds.has(metric.category_id))
    .sort(sortByConfiguredOrder);

  if (!activeCategories.length || !activeMetrics.length) {
    throw new Error("설정에 사용중인 일실적 분류 또는 항목이 없습니다.");
  }

  const sections: ConfiguredCardSection[] = [];
  const usedLegacySections = new Set<ConfiguredCardSection>();
  const customMetricIds = new Set<string>();

  for (const category of activeCategories) {
    const matchingLegacy = legacySections.find(
      (section) => categoryAliases(section.section).includes(keyOf(category.name)) &&
        !usedLegacySections.has(section)
    );
    if (matchingLegacy) usedLegacySections.add(matchingLegacy);

    const categoryMetrics = activeMetrics.filter((metric) => metric.category_id === category.id);
    if (categoryMetrics.length === 0) continue;
    const rows: ConfiguredCardRow[] = [];
    const usedLegacyRows = new Set<ConfiguredCardRow>();

    for (const metric of categoryMetrics) {
      const legacyRow = matchingLegacy?.rows.find(
        (row) => !usedLegacyRows.has(row) && metricAliases(row.label).includes(keyOf(metric.name))
      );
      if (legacyRow) {
        rows.push({ ...legacyRow, label: metric.name });
        usedLegacyRows.add(legacyRow);
      } else {
        customMetricIds.add(metric.id);
        rows.push({
          label: metric.name,
          path: `configured.${metric.id}`,
          unit: metric.unit === "amount" ? "amount" : metric.unit === "percent" ? "percent" : "count",
          emphasize: metric.aggregation_type === "rate",
          emphasizeKind: metric.aggregation_type === "rate" ? "rate" : undefined,
        });
      }
    }

    // 현재 설정에 없는 기존 '계산 전용' 보조 행만 유지합니다.
    // 이미 설정에 등록되어 사용중지된 항목은 어떤 경우에도 복원하지 않습니다.
    // 설정에 없는 일반 입력행까지 남기면 사용중지 항목이 카드에 재등장할 수 있습니다.
    if (matchingLegacy) {
      const retainedCalculatedLabels = new Set([
        "합계", "구독합계", "교원합계", "결제합계", "성공률",
      ]);
      for (const row of matchingLegacy.rows) {
        if (usedLegacyRows.has(row)) continue;
        if (!retainedCalculatedLabels.has(keyOf(row.label))) continue;
        const explicitlyConfigured = allMetrics.some((metric) =>
          metric.category_id === category.id &&
          metricAliases(row.label).includes(keyOf(metric.name))
        );
        if (!explicitlyConfigured) rows.push(row);
      }
    }

    if (rows.length) sections.push({ section: category.name, rows });
  }

  // 설정 대상 분류가 사용중지됐을 때 기존 고정 목록에서 재등장하지 않도록
  // 설정과 별개로 카드가 관리해온 두 독립 섹션만 예외적으로 보존합니다.
  // 카테고리 RLS가 사용중지 행을 반환하지 않더라도 이전 실적분류가 복원되지 않습니다.
  const independentLegacyKeys = new Set(["결제금액", "newbestvat별도"]);
  legacySections.forEach((section, index) => {
    if (usedLegacySections.has(section)) return;
    if (!independentLegacyKeys.has(keyOf(section.section))) return;
    const relatedCategory = allCategories.find(
      (category) => categoryAliases(section.section).includes(keyOf(category.name))
    );
    if (relatedCategory) return;
    // 독립 섹션은 기존 카드의 근접한 위치를 유지하되,
    // 설정에 지정된 분류끼리의 상대 순서를 바꾸지 않습니다.
    const nextExistingSection = legacySections.slice(index + 1).find(
      (candidate) => usedLegacySections.has(candidate) &&
        sections.some((configured) =>
          categoryAliases(candidate.section).includes(keyOf(configured.section))
        )
    );
    const insertIndex = nextExistingSection
      ? sections.findIndex((configured) =>
          categoryAliases(nextExistingSection.section).includes(keyOf(configured.section))
        )
      : -1;
    if (insertIndex >= 0) sections.splice(insertIndex, 0, section);
    else sections.push(section);
  });

  if (!customMetricIds.size) {
    return { payload, sections };
  }

  const monthReports = await readPages<ReportRow>((start, end) =>
    supabase.from("daily_reports")
      .select("id,manager_id,report_date,status")
      .gte("report_date", payload.month_start)
      .lte("report_date", payload.report_date)
      .order("id")
      .range(start, end)
  );
  const includedManagerIds = new Set(payload.managers.map((manager) => manager.manager_id));
  const eligible = monthReports.filter((report) =>
    includedManagerIds.has(report.manager_id) &&
    (report.status === "submitted" || report.status === "closed")
  );
  const reportById = new Map(eligible.map((report) => [report.id, report]));
  const metricValueRows: ValueRow[] = [];

  // PostgREST .in 길이 제한을 피하기 위해 80개 report씩 조회합니다.
  for (let index = 0; index < eligible.length; index += 80) {
    const reportIds = eligible.slice(index, index + 80).map((report) => report.id);
    if (!reportIds.length) continue;
    const values = await readPages<ValueRow>((start, end) =>
      supabase.from("daily_metric_values")
        .select("report_id,metric_id,value")
        .in("report_id", reportIds)
        .in("metric_id", Array.from(customMetricIds))
        .order("report_id")
        .order("metric_id")
        .range(start, end)
    );
    metricValueRows.push(...values);
  }

  const byManager = new Map<string, Map<string, Array<{ date: string; value: number }>>>();
  for (const valueRow of metricValueRows) {
    const report = reportById.get(valueRow.report_id);
    if (!report) continue;
    let byMetric = byManager.get(report.manager_id);
    if (!byMetric) {
      byMetric = new Map();
      byManager.set(report.manager_id, byMetric);
    }
    let records = byMetric.get(valueRow.metric_id);
    if (!records) {
      records = [];
      byMetric.set(valueRow.metric_id, records);
    }
    records.push({ date: report.report_date, value: Number(valueRow.value ?? 0) });
  }

  const allCustom = activeMetrics.filter((metric) => customMetricIds.has(metric.id));
  const lookupMetric = new Map(allMetrics.map((metric) => [metric.id, metric]));

  const getPair = (
    metric: MetricRow,
    managerId: string | null,
    visited: ReadonlySet<string> = new Set()
  ): Pair => {
    if (visited.has(metric.id)) {
      throw new Error(`순환 참조된 계산 지표입니다: ${metric.name}`);
    }
    if (metric.aggregation_type === "rate" && metric.numerator_metric_id && metric.denominator_metric_id) {
      const numerator = lookupMetric.get(metric.numerator_metric_id);
      const denominator = lookupMetric.get(metric.denominator_metric_id);
      if (numerator && denominator) {
        const nextVisited = new Set([...visited, metric.id]);
        const top = getPair(numerator, managerId, nextVisited);
        const bottom = getPair(denominator, managerId, nextVisited);
        return {
          daily: bottom.daily !== 0 ? top.daily / bottom.daily * 100 : 0,
          mtd: bottom.mtd !== 0 ? top.mtd / bottom.mtd * 100 : 0,
        };
      }
    }
    const records: Array<{ date: string; value: number }> = [];
    for (const [id, metricMap] of byManager) {
      if (managerId !== null && id !== managerId) continue;
      records.push(...(metricMap.get(metric.id) ?? []));
    }
    return pairFromCounts(records, metric, payload.report_date);
  };

  // 비율 계산의 분자/분모까지 값 조회 대상에 포함하지 않았다면 오류가 납니다.
  // 따라서 계산비율에 사용되는 원본 지표의 값을 추가로 조회하여 정확히 계산합니다.
  const sources = new Set<string>();
  const collectSources = (metric: MetricRow, seen: ReadonlySet<string>) => {
    if (seen.has(metric.id)) {
      throw new Error(`순환 참조된 계산 지표입니다: ${metric.name}`);
    }
    if (metric.aggregation_type !== "rate") return;
    if (!metric.numerator_metric_id || !metric.denominator_metric_id) {
      throw new Error(`계산 지표의 분자/분모가 없습니다: ${metric.name}`);
    }
    const path = new Set([...seen, metric.id]);
    for (const id of [metric.numerator_metric_id, metric.denominator_metric_id]) {
      const sourceMetric = lookupMetric.get(id);
      if (!sourceMetric) throw new Error(`계산 원본 지표를 찾을 수 없습니다: ${metric.name}`);
      sources.add(id);
      collectSources(sourceMetric, path);
    }
  };
  for (const metric of allCustom) collectSources(metric, new Set());
  const missingSources = [...sources].filter((id) => !customMetricIds.has(id));
  if (missingSources.length) {
    for (let index = 0; index < eligible.length; index += 80) {
      const ids = eligible.slice(index, index + 80).map((report) => report.id);
      const values = await readPages<ValueRow>((start, end) =>
        supabase.from("daily_metric_values")
          .select("report_id,metric_id,value")
          .in("report_id", ids)
          .in("metric_id", missingSources)
          .order("report_id")
          .order("metric_id")
          .range(start, end)
      );
      for (const valueRow of values) {
        const report = reportById.get(valueRow.report_id);
        if (!report) continue;
        let byMetric = byManager.get(report.manager_id);
        if (!byMetric) { byMetric = new Map(); byManager.set(report.manager_id, byMetric); }
        let records = byMetric.get(valueRow.metric_id);
        if (!records) { records = []; byMetric.set(valueRow.metric_id, records); }
        records.push({ date: report.report_date, value: Number(valueRow.value ?? 0) });
      }
    }
  }

  const managers = payload.managers.map((manager) => ({
    ...manager,
    configured: Object.fromEntries(allCustom.map((metric) => [metric.id, getPair(metric, manager.manager_id)])),
  }));
  const totals = {
    ...payload.totals,
    configured: Object.fromEntries(allCustom.map((metric) => [metric.id, getPair(metric, null)])),
  };
  return {
    payload: { ...payload, managers, totals } as P,
    sections,
  };
}
