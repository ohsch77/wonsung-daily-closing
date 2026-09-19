import type {
  AnalyticsManager,
  PerformanceAnalysisRow,
  PerformanceAnalysisSnapshot,
} from "@/lib/analytics/types";


export type CustomGranularity =
  | "monthly"
  | "daily";


export type CustomMetricKind =
  | "amount"
  | "count"
  | "rate";


export type CustomAggregation =
  | "sum"
  | "average"
  | "rate";


export type CustomMetricDefinition = {
  key: string;
  label: string;
  group: string;
  kind:
    CustomMetricKind;
};


export type CustomMetricSelection = {
  key: string;
  aggregation:
    CustomAggregation;
};


export type CustomAnalysisResultRow = {
  periodKey: string;
  reportDate:
    string | null;
  monthKey: string;

  managerId: string;
  managerName: string;
  employeeNo: string;
  managerDisplayOrder: number;

  sourceRowCount: number;

  values:
    Record<
      string,
      number | null
    >;
};


export type CustomAnalysisTotal = {
  sourceRowCount: number;

  values:
    Record<
      string,
      number | null
    >;
};


export type CustomAnalysisResult = {
  rows:
    CustomAnalysisResultRow[];

  total:
    CustomAnalysisTotal;
};


function roundOne(
  value: number
) {
  return (
    Math.round(
      value * 10
    ) / 10
  );
}


function calculateRate(
  numerator: number,
  denominator: number
) {
  if (
    denominator <= 0
  ) {
    return null;
  }

  return roundOne(
    (
      numerator /
      denominator
    ) * 100
  );
}


export function getAggregationLabel(
  aggregation:
    CustomAggregation
) {
  switch (
    aggregation
  ) {
    case "average":
      return "평균";

    case "rate":
      return "성공률";

    default:
      return "합계";
  }
}


export function getDefaultAggregation(
  metric:
    CustomMetricDefinition
): CustomAggregation {
  return metric.kind ===
    "rate"
    ? "rate"
    : "sum";
}


export function getAllowedAggregations(
  metric:
    CustomMetricDefinition
): CustomAggregation[] {
  if (
    metric.kind ===
    "rate"
  ) {
    return [
      "rate",
    ];
  }

  return [
    "sum",
    "average",
  ];
}


export function buildCustomMetricDefinitions(
  snapshot:
    PerformanceAnalysisSnapshot
): CustomMetricDefinition[] {
  const metrics:
    CustomMetricDefinition[] = [
      {
        key:
          "totalSalesAmount",
        label:
          "총판매금액",
        group:
          "판매",
        kind:
          "amount",
      },

      {
        key:
          "subscriptionSalesCount",
        label:
          "구독판매",
        group:
          "구독·교원",
        kind:
          "count",
      },

      {
        key:
          "subscriptionCancelCount",
        label:
          "구독취소",
        group:
          "구독·교원",
        kind:
          "count",
      },

      {
        key:
          "subscriptionNetCount",
        label:
          "구독순판매",
        group:
          "구독·교원",
        kind:
          "count",
      },

      {
        key:
          "kyowonSalesCount",
        label:
          "교원판매",
        group:
          "구독·교원",
        kind:
          "count",
      },

      {
        key:
          "kyowonCancelCount",
        label:
          "교원취소",
        group:
          "구독·교원",
        kind:
          "count",
      },

      {
        key:
          "kyowonNetCount",
        label:
          "교원순판매",
        group:
          "구독·교원",
        kind:
          "count",
      },

      {
        key:
          "consultationCount",
        label:
          "상담건수",
        group:
          "상담",
        kind:
          "count",
      },

      {
        key:
          "consultationSalesCount",
        label:
          "판매건수",
        group:
          "상담",
        kind:
          "count",
      },

      {
        key:
          "consultationSuccessRate",
        label:
          "상담성공률",
        group:
          "상담",
        kind:
          "rate",
      },

      {
        key:
          "leadInCount",
        label:
          "가망객입수",
        group:
          "가망객",
        kind:
          "count",
      },

      {
        key:
          "leadSuccessCount",
        label:
          "가망객성공",
        group:
          "가망객",
        kind:
          "count",
      },

      {
        key:
          "leadSuccessRate",
        label:
          "가망객성공률",
        group:
          "가망객",
        kind:
          "rate",
      },
    ];

  for (
    const reviewMetric of
    snapshot.resolution
      .reviewMetrics
  ) {
    metrics.push({
      key:
        `review:${reviewMetric.metricId}`,
      label:
        reviewMetric.name,
      group:
        "후기",
      kind:
        "count",
    });
  }

  metrics.push({
    key:
      "reviewTotal",
    label:
      "후기합계",
    group:
      "후기",
    kind:
      "count",
  });

  return metrics;
}


export function buildDefaultCustomMetricSelections(
  snapshot:
    PerformanceAnalysisSnapshot
): CustomMetricSelection[] {
  return buildCustomMetricDefinitions(
    snapshot
  ).map(
    (metric) => ({
      key:
        metric.key,

      aggregation:
        getDefaultAggregation(
          metric
        ),
    })
  );
}


export function getCustomMetricValue(
  row:
    PerformanceAnalysisRow,
  metricKey: string
): number | null {
  switch (
    metricKey
  ) {
    case "totalSalesAmount":
      return row.totalSalesAmount;

    case "subscriptionSalesCount":
      return row.subscriptionSalesCount;

    case "subscriptionCancelCount":
      return row.subscriptionCancelCount;

    case "subscriptionNetCount":
      return row.subscriptionNetCount;

    case "kyowonSalesCount":
      return row.kyowonSalesCount;

    case "kyowonCancelCount":
      return row.kyowonCancelCount;

    case "kyowonNetCount":
      return row.kyowonNetCount;

    case "consultationCount":
      return row.consultationCount;

    case "consultationSalesCount":
      return row.consultationSalesCount;

    case "consultationSuccessRate":
      return row.consultationSuccessRate;

    case "leadInCount":
      return row.leadInCount;

    case "leadSuccessCount":
      return row.leadSuccessCount;

    case "leadSuccessRate":
      return row.leadSuccessRate;

    case "reviewTotal":
      return row.reviewTotal;

    default:
      break;
  }

  if (
    metricKey.startsWith(
      "review:"
    )
  ) {
    const metricId =
      metricKey.slice(
        "review:".length
      );

    return (
      row.reviewValues[
        metricId
      ] ?? 0
    );
  }

  return null;
}


function calculateRateMetric(
  rows:
    PerformanceAnalysisRow[],
  metricKey: string
) {
  if (
    metricKey ===
    "consultationSuccessRate"
  ) {
    const numerator =
      rows.reduce(
        (
          sum,
          row
        ) =>
          sum +
          row.consultationSalesCount,
        0
      );

    const denominator =
      rows.reduce(
        (
          sum,
          row
        ) =>
          sum +
          row.consultationCount,
        0
      );

    return calculateRate(
      numerator,
      denominator
    );
  }

  if (
    metricKey ===
    "leadSuccessRate"
  ) {
    const numerator =
      rows.reduce(
        (
          sum,
          row
        ) =>
          sum +
          row.leadSuccessCount,
        0
      );

    const denominator =
      rows.reduce(
        (
          sum,
          row
        ) =>
          sum +
          row.leadInCount,
        0
      );

    return calculateRate(
      numerator,
      denominator
    );
  }

  return null;
}


function aggregateMetric(
  rows:
    PerformanceAnalysisRow[],
  metric:
    CustomMetricDefinition,
  selection:
    CustomMetricSelection
) {
  if (
    metric.kind ===
      "rate" ||
    selection.aggregation ===
      "rate"
  ) {
    return calculateRateMetric(
      rows,
      metric.key
    );
  }

  const values =
    rows
      .map(
        (row) =>
          getCustomMetricValue(
            row,
            metric.key
          )
      )
      .filter(
        (
          value
        ): value is number =>
          value !== null &&
          Number.isFinite(
            value
          )
      );

  if (
    values.length ===
    0
  ) {
    return null;
  }

  const sum =
    values.reduce(
      (
        total,
        value
      ) =>
        total + value,
      0
    );

  if (
    selection.aggregation ===
    "average"
  ) {
    const average =
      sum /
      values.length;

    return metric.kind ===
      "amount"
      ? Math.round(
          average
        )
      : roundOne(
          average
        );
  }

  return sum;
}


function buildSelectionMetricMap(
  snapshot:
    PerformanceAnalysisSnapshot
) {
  return new Map(
    buildCustomMetricDefinitions(
      snapshot
    ).map(
      (metric) => [
        metric.key,
        metric,
      ]
    )
  );
}


function managerOrderValue(
  manager:
    AnalyticsManager
) {
  return Number.isFinite(
    manager.displayOrder
  )
    ? manager.displayOrder
    : 9999;
}


export function buildCustomAnalysisResult({
  snapshot,
  selectedManagerIds,
  granularity,
  selections,
}: {
  snapshot:
    PerformanceAnalysisSnapshot;
  selectedManagerIds:
    string[];
  granularity:
    CustomGranularity;
  selections:
    CustomMetricSelection[];
}): CustomAnalysisResult {
  const selectedManagerSet =
    new Set(
      selectedManagerIds
    );

  const managerMap =
    new Map(
      snapshot.managers.map(
        (manager) => [
          manager.id,
          manager,
        ]
      )
    );

  const metricMap =
    buildSelectionMetricMap(
      snapshot
    );

  const validSelections =
    selections.filter(
      (selection) =>
        metricMap.has(
          selection.key
        )
    );

  const sourceRows =
    snapshot.dailyRows.filter(
      (row) =>
        selectedManagerSet.has(
          row.managerId
        )
    );

  const grouped =
    new Map<
      string,
      PerformanceAnalysisRow[]
    >();

  for (
    const row of
    sourceRows
  ) {
    const periodKey =
      granularity ===
      "monthly"
        ? row.monthKey
        : row.reportDate ??
          "";

    if (
      !periodKey
    ) {
      continue;
    }

    const key =
      `${periodKey}|${row.managerId}`;

    const rows =
      grouped.get(
        key
      ) ?? [];

    rows.push(
      row
    );

    grouped.set(
      key,
      rows
    );
  }

  const resultRows:
    CustomAnalysisResultRow[] =
    [];

  for (
    const [
      key,
      rows,
    ] of grouped.entries()
  ) {
    if (
      rows.length ===
      0
    ) {
      continue;
    }

    const [
      periodKey,
      managerId,
    ] =
      key.split("|");

    const manager =
      managerMap.get(
        managerId
      );

    if (
      !manager
    ) {
      continue;
    }

    const values:
      Record<
        string,
        number | null
      > = {};

    for (
      const selection of
      validSelections
    ) {
      const metric =
        metricMap.get(
          selection.key
        );

      if (
        !metric
      ) {
        continue;
      }

      values[
        selection.key
      ] =
        aggregateMetric(
          rows,
          metric,
          selection
        );
    }

    resultRows.push({
      periodKey,

      reportDate:
        granularity ===
        "daily"
          ? periodKey
          : null,

      monthKey:
        granularity ===
        "monthly"
          ? periodKey
          : periodKey.slice(
              0,
              7
            ),

      managerId:
        manager.id,

      managerName:
        manager.name,

      employeeNo:
        manager.employeeNo,

      managerDisplayOrder:
        managerOrderValue(
          manager
        ),

      sourceRowCount:
        rows.length,

      values,
    });
  }

  resultRows.sort(
    (a, b) =>
      a.periodKey.localeCompare(
        b.periodKey
      ) ||
      a.managerDisplayOrder -
        b.managerDisplayOrder ||
      a.managerName.localeCompare(
        b.managerName,
        "ko"
      )
  );

  const totalValues:
    Record<
      string,
      number | null
    > = {};

  for (
    const selection of
    validSelections
  ) {
    const metric =
      metricMap.get(
        selection.key
      );

    if (
      !metric
    ) {
      continue;
    }

    totalValues[
      selection.key
    ] =
      aggregateMetric(
        sourceRows,
        metric,
        selection
      );
  }

  return {
    rows:
      resultRows,

    total: {
      sourceRowCount:
        sourceRows.length,

      values:
        totalValues,
    },
  };
}


// ============================================================================
// 10-4 V2 — Metric Builder 연결부
// 기존 CustomAnalysis 함수/집계는 위 코드를 그대로 보존하고,
// 새 보고서 구성(libraryKey)만 기존 PerformanceAnalysisSnapshot에 연결합니다.
// ============================================================================

import {
  toBuilderTokens,
} from "@/lib/analytics/metric-library";

import {
  createFormulaEngine,
} from "@/lib/analytics/formula-engine";

import type {
  AnalysisMetricLibraryItem,
  AnalysisMetricLibrarySnapshot,
} from "@/lib/analytics/metric-library";

import type {
  FormulaEngineReport,
} from "@/lib/analytics/formula-engine";


export type BuilderCustomAnalysisColumn = {
  libraryKey: string;
  item: AnalysisMetricLibraryItem;
};


export type BuilderCustomAnalysisResult = {
  rows:
    CustomAnalysisResultRow[];

  total:
    CustomAnalysisTotal;

  columns:
    BuilderCustomAnalysisColumn[];
};


function getBuilderRawMetricValue(
  snapshot:
    PerformanceAnalysisSnapshot,
  row:
    PerformanceAnalysisRow,
  metricId:
    string
) {
  return (
    snapshot
      .rawMetricValuesByPeriodKey?.[
        row.periodKey
      ]?.[
        metricId
      ] ??
    0
  );
}


function builderRawRate(
  rows:
    PerformanceAnalysisRow[],
  metricId: string,
  snapshot:
    PerformanceAnalysisSnapshot
) {
  const metric =
    snapshot.metrics.find(
      (row) =>
        row.id ===
        metricId
    );

  if (!metric) {
    return null;
  }

  const numeratorId =
    metric.numeratorMetricId;

  const denominatorId =
    metric.denominatorMetricId;

  if (
    numeratorId &&
    denominatorId
  ) {
    const numerator =
      rows.reduce(
        (
          sum,
          row
        ) =>
          sum +
          (
            getBuilderRawMetricValue(
              snapshot,
              row,
              numeratorId
            )
          ),
        0
      );

    const denominator =
      rows.reduce(
        (
          sum,
          row
        ) =>
          sum +
          (
            getBuilderRawMetricValue(
              snapshot,
              row,
              denominatorId
            )
          ),
        0
      );

    return calculateRate(
      numerator,
      denominator
    );
  }

  const values =
    rows.map(
      (row) =>
        getBuilderRawMetricValue(
          snapshot,
          row,
          metricId
        )
    );

  if (
    values.length ===
    0
  ) {
    return null;
  }

  return roundOne(
    values.reduce(
      (
        sum,
        value
      ) =>
        sum +
        value,
      0
    ) /
    values.length
  );
}


function aggregateBuilderRawMetric(
  rows:
    PerformanceAnalysisRow[],
  item:
    AnalysisMetricLibraryItem,
  snapshot:
    PerformanceAnalysisSnapshot
) {
  if (
    item.defaultAggregationType ===
    "rate"
  ) {
    return builderRawRate(
      rows,
      item.sourceId,
      snapshot
    );
  }

  const values =
    rows.map(
      (row) =>
        getBuilderRawMetricValue(
          snapshot,
          row,
          item.sourceId
        )
    );

  if (
    values.length ===
    0
  ) {
    return null;
  }

  const sum =
    values.reduce(
      (
        total,
        value
      ) =>
        total +
        value,
      0
    );

  if (
    item.defaultAggregationType ===
    "average"
  ) {
    const average =
      sum /
      values.length;

    return item.unit ===
      "amount"
      ? Math.round(
          average
        )
      : roundOne(
          average
        );
  }

  return sum;
}


function toFormulaEngineReports(
  rows:
    PerformanceAnalysisRow[],
  snapshot:
    PerformanceAnalysisSnapshot
): FormulaEngineReport[] {
  return rows
    .filter(
      (row) =>
        Boolean(
          row.reportDate
        )
    )
    .map(
      (row) => ({
        reportId:
          row.periodKey,
        reportDate:
          row.reportDate ??
          "",
        managerId:
          row.managerId,
        values:
          new Map(
            Object.entries(
              snapshot
                .rawMetricValuesByPeriodKey?.[
                  row.periodKey
                ] ??
                {}
            )
          ),
      })
    );
}


export function buildBuilderCustomAnalysisResult({
  snapshot,
  librarySnapshot,
  reportItemKeys,
  selectedManagerIds,
  granularity,
}: {
  snapshot:
    PerformanceAnalysisSnapshot;

  librarySnapshot:
    AnalysisMetricLibrarySnapshot | null;

  reportItemKeys:
    string[];

  selectedManagerIds:
    string[];

  granularity:
    CustomGranularity;
}): BuilderCustomAnalysisResult {
  if (
    !librarySnapshot
  ) {
    return {
      rows: [],
      total: {
        sourceRowCount: 0,
        values: {},
      },
      columns: [],
    };
  }

  const itemMap =
    new Map(
      librarySnapshot.items.map(
        (item) => [
          item.libraryKey,
          item,
        ]
      )
    );

  const columns =
    reportItemKeys
      .flatMap(
        (libraryKey) => {
          const item =
            itemMap.get(
              libraryKey
            );

          return item &&
            item.isActive
            ? [{
                libraryKey,
                item,
              }]
            : [];
        }
      );

  const formulaTokensByMetricId =
    new Map<
      string,
      typeof librarySnapshot.formulaTokens
    >();

  for (
    const token of
    librarySnapshot
      .formulaTokens
  ) {
    const current =
      formulaTokensByMetricId.get(
        token.analysisMetricId
      ) ?? [];

    current.push(
      token
    );

    formulaTokensByMetricId.set(
      token.analysisMetricId,
      current
    );
  }

  const formulaDefinitions =
    librarySnapshot
      .formulaDefinitions
      .map(
        (definition) => ({
          id:
            definition.id,
          aggregationType:
            definition.defaultAggregationType,
          tokens:
            toBuilderTokens(
              formulaTokensByMetricId.get(
                definition.id
              ) ?? []
            ),
        })
      );

  const engine =
    createFormulaEngine(
      formulaDefinitions
    );

  const formulaColumnIds =
    Array.from(
      new Set(
        columns
          .filter(
            (column) =>
              column.item.sourceType ===
              "formula"
          )
          .map(
            (column) =>
              column.item.sourceId
          )
      )
    );

  const selectedManagerSet =
    new Set(
      selectedManagerIds
    );

  const managerMap =
    new Map(
      snapshot.managers.map(
        (manager) => [
          manager.id,
          manager,
        ]
      )
    );

  const sourceRows =
    snapshot.dailyRows.filter(
      (row) =>
        selectedManagerSet.has(
          row.managerId
        )
    );

  const formulaReportByPeriodKey =
    new Map(
      toFormulaEngineReports(
        sourceRows,
        snapshot
      ).map(
        (report) => [
          report.reportId,
          report,
        ]
      )
    );

  const grouped =
    new Map<
      string,
      PerformanceAnalysisRow[]
    >();

  for (
    const row of
    sourceRows
  ) {
    const periodKey =
      granularity ===
      "monthly"
        ? row.monthKey
        : row.reportDate ??
          "";

    if (!periodKey) {
      continue;
    }

    const key =
      `${periodKey}|${row.managerId}`;

    const current =
      grouped.get(
        key
      ) ?? [];

    current.push(
      row
    );

    grouped.set(
      key,
      current
    );
  }

  const calculateValues =
    (
      rows:
        PerformanceAnalysisRow[]
    ) => {
      const values:
        Record<
          string,
          number | null
        > = {};

      const formulaReports =
        rows.flatMap(
          (row) => {
            const report =
              formulaReportByPeriodKey.get(
                row.periodKey
              );

            return report
              ? [report]
              : [];
          }
        );

      const formulaValues =
        engine.evaluatePeriodValues(
          formulaColumnIds,
          formulaReports
        );

      for (
        const column of
        columns
      ) {
        const item =
          column.item;

        if (
          item.sourceType ===
          "raw"
        ) {
          values[
            column.libraryKey
          ] =
            aggregateBuilderRawMetric(
              rows,
              item,
              snapshot
            );

          continue;
        }

        values[
          column.libraryKey
        ] =
          formulaValues.get(
            item.sourceId
          ) ??
          null;
      }

      return values;
    };

  const resultRows:
    CustomAnalysisResultRow[] =
    [];

  for (
    const [
      key,
      rows,
    ] of grouped.entries()
  ) {
    if (
      rows.length ===
      0
    ) {
      continue;
    }

    const [
      periodKey,
      managerId,
    ] =
      key.split("|");

    const manager =
      managerMap.get(
        managerId
      );

    if (!manager) {
      continue;
    }

    resultRows.push({
      periodKey,

      reportDate:
        granularity ===
        "daily"
          ? periodKey
          : null,

      monthKey:
        granularity ===
        "monthly"
          ? periodKey
          : periodKey.slice(
              0,
              7
            ),

      managerId:
        manager.id,

      managerName:
        manager.name,

      employeeNo:
        manager.employeeNo,

      managerDisplayOrder:
        managerOrderValue(
          manager
        ),

      sourceRowCount:
        rows.length,

      values:
        calculateValues(
          rows
        ),
    });
  }

  resultRows.sort(
    (a, b) =>
      a.periodKey.localeCompare(
        b.periodKey
      ) ||
      a.managerDisplayOrder -
        b.managerDisplayOrder ||
      a.managerName.localeCompare(
        b.managerName,
        "ko"
      )
  );

  return {
    rows:
      resultRows,

    total: {
      sourceRowCount:
        sourceRows.length,

      values:
        calculateValues(
          sourceRows
        ),
    },

    columns,
  };
}
