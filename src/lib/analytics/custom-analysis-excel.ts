import {
  buildCustomMetricDefinitions,
  getAggregationLabel,
} from "@/lib/analytics/custom-analysis";

import type {
  CustomAnalysisResultRow,
  CustomAnalysisTotal,
  CustomGranularity,
  CustomMetricSelection,
} from "@/lib/analytics/custom-analysis";

import type {
  PerformanceAnalysisSnapshot,
} from "@/lib/analytics/types";


type Args = {
  granularity:
    CustomGranularity;

  snapshot:
    PerformanceAnalysisSnapshot;

  rows:
    CustomAnalysisResultRow[];

  total:
    CustomAnalysisTotal;

  selections:
    CustomMetricSelection[];

  selectedManagerNames:
    string[];
};


function safeFilePart(
  value: string
) {
  return value
    .replace(
      /[\\/:*?"<>|]/g,
      "-"
    )
    .replace(
      /\s+/g,
      "_"
    );
}


export async function downloadCustomAnalysisExcel({
  granularity,
  snapshot,
  rows,
  total,
  selections,
  selectedManagerNames,
}: Args) {
  if (
    typeof window ===
    "undefined"
  ) {
    throw new Error(
      "Excel 다운로드는 브라우저에서만 사용할 수 있습니다."
    );
  }

  if (
    rows.length ===
    0
  ) {
    throw new Error(
      "Excel로 다운로드할 조합 분석 결과가 없습니다."
    );
  }

  if (
    selections.length ===
    0
  ) {
    throw new Error(
      "Excel로 다운로드할 분석항목을 선택해주세요."
    );
  }

  const XLSX =
    await import(
      "@e965/xlsx"
    );

  const definitionMap =
    new Map(
      buildCustomMetricDefinitions(
        snapshot
      ).map(
        (metric) => [
          metric.key,
          metric,
        ]
      )
    );

  const columns =
    selections
      .map(
        (selection) => {
          const metric =
            definitionMap.get(
              selection.key
            );

          return metric
            ? {
                selection,
                metric,
              }
            : null;
        }
      )
      .filter(
        (
          item
        ): item is NonNullable<
          typeof item
        > =>
          item !== null
      );

  const header = [
    granularity ===
    "monthly"
      ? "월"
      : "일자",
    "매니저",
    "사번",

    ...columns.map(
      ({
        metric,
        selection,
      }) =>
        `${metric.label} (${getAggregationLabel(
          selection.aggregation
        )})`
    ),
  ];

  const toExcelValue =
    (
      value:
        number | null,
      kind:
        "amount" |
        "count" |
        "rate"
    ) => {
      if (
        value === null
      ) {
        return null;
      }

      return kind ===
        "rate"
        ? value / 100
        : value;
    };

  const data =
    rows.map(
      (row) => [
        row.periodKey,
        row.managerName,
        row.employeeNo,

        ...columns.map(
          ({
            metric,
            selection,
          }) =>
            toExcelValue(
              row.values[
                selection.key
              ] ?? null,
              metric.kind
            )
        ),
      ]
    );

  const totalRow = [
    "합계",
    `${selectedManagerNames.length}명 선택`,
    "",

    ...columns.map(
      ({
        metric,
        selection,
      }) =>
        toExcelValue(
          total.values[
            selection.key
          ] ?? null,
          metric.kind
        )
    ),
  ];

  const sheet =
    XLSX.utils.aoa_to_sheet(
      [
        header,
        ...data,
        totalRow,
      ]
    );

  sheet["!cols"] = [
    {
      wch:
        granularity ===
        "monthly"
          ? 12
          : 13,
    },
    { wch: 14 },
    { wch: 13 },

    ...columns.map(
      ({
        metric,
      }) => ({
        wch:
          metric.kind ===
          "amount"
            ? 20
            : metric.kind ===
              "rate"
              ? 16
              : 15,
      })
    ),
  ];

  const firstDataRow =
    2;

  const lastDataRow =
    rows.length + 2;

  columns.forEach(
    (
      {
        metric,
        selection,
      },
      metricIndex
    ) => {
      const columnIndex =
        metricIndex + 3;

      const columnLetter =
        XLSX.utils.encode_col(
          columnIndex
        );

      const numberFormat =
        metric.kind ===
        "rate"
          ? "0.0%"
          : selection.aggregation ===
              "average" &&
            metric.kind ===
              "count"
            ? "0.0"
            : "#,##0";

      for (
        let rowIndex =
          firstDataRow;
        rowIndex <=
          lastDataRow;
        rowIndex += 1
      ) {
        const cell =
          sheet[
            `${columnLetter}${rowIndex}`
          ] as
            | {
                z?: string;
              }
            | undefined;

        if (
          cell
        ) {
          cell.z =
            numberFormat;
        }
      }
    }
  );

  const lastColumn =
    XLSX.utils.encode_col(
      header.length - 1
    );

  sheet[
    "!autofilter"
  ] = {
    ref:
      `A1:${lastColumn}${rows.length + 1}`,
  };

  const selectionText =
    columns
      .map(
        ({
          metric,
          selection,
        }) =>
          `${metric.label}(${getAggregationLabel(
            selection.aggregation
          )})`
      )
      .join(
        ", "
      );

  const conditions =
    XLSX.utils.aoa_to_sheet(
      [
        [
          "항목",
          "내용",
        ],
        [
          "분석구분",
          "조합 분석",
        ],
        [
          "집계단위",
          granularity ===
          "monthly"
            ? "월별"
            : "일자별",
        ],
        [
          "조회기간",
          `${snapshot.startDate} ~ ${snapshot.endDate}`,
        ],
        [
          "선택매니저",
          selectedManagerNames.join(
            ", "
          ) || "-",
        ],
        [
          "선택항목/집계",
          selectionText,
        ],
        [
          "표시순서",
          "Excel 열 순서는 화면에서 설정한 분석항목 순서와 동일",
        ],
        [
          "평균 기준",
          "선택기간 내 일실적 확정행 기준 평균",
        ],
        [
          "성공률 기준",
          "성공률 행 평균이 아니라 분자·분모 합산 후 재계산",
        ],
        [
          "총판매금액",
          "매장판매 + 외부판매 - 판매취소",
        ],
        [
          "관리자",
          "분석 대상에서 제외",
        ],
        [
          "생성일시",
          new Intl.DateTimeFormat(
            "ko-KR",
            {
              timeZone:
                "Asia/Seoul",
              year:
                "numeric",
              month:
                "2-digit",
              day:
                "2-digit",
              hour:
                "2-digit",
              minute:
                "2-digit",
              second:
                "2-digit",
              hour12:
                false,
            }
          ).format(
            new Date()
          ),
        ],
      ]
    );

  conditions[
    "!cols"
  ] = [
    { wch: 18 },
    { wch: 72 },
  ];

  const workbook =
    XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    sheet,
    "조합분석"
  );

  XLSX.utils.book_append_sheet(
    workbook,
    conditions,
    "조회조건"
  );

  const output =
    XLSX.write(
      workbook,
      {
        type: "array",
        bookType: "xlsx",
        compression: true,
      }
    ) as ArrayBuffer;

  const blob =
    new Blob(
      [output],
      {
        type:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const anchor =
    document.createElement(
      "a"
    );

  anchor.href =
    url;

  anchor.download =
    safeFilePart(
      `원성점_조합분석_${
        granularity ===
        "monthly"
          ? "월별"
          : "일자별"
      }_${snapshot.startDate.slice(
        0,
        7
      )}_${snapshot.endDate.slice(
        0,
        7
      )}.xlsx`
    );

  document.body.appendChild(
    anchor
  );

  anchor.click();
  anchor.remove();

  window.setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    1000
  );
}


// ============================================================================
// 10-4 V2 — Metric Builder 보고서 Excel 연결
// 기존 downloadCustomAnalysisExcel은 수정하지 않고 별도 export만 추가합니다.
// ============================================================================

import {
  aggregationLabel,
} from "@/lib/analytics/metric-library";

import type {
  AnalysisMetricLibrarySnapshot,
} from "@/lib/analytics/metric-library";


type BuilderExcelArgs = {
  granularity:
    CustomGranularity;

  snapshot:
    PerformanceAnalysisSnapshot;

  rows:
    CustomAnalysisResultRow[];

  total:
    CustomAnalysisTotal;

  librarySnapshot:
    AnalysisMetricLibrarySnapshot;

  reportItemKeys:
    string[];

  selectedManagerNames:
    string[];
};


export async function downloadBuilderCustomAnalysisExcel({
  granularity,
  snapshot,
  rows,
  total,
  librarySnapshot,
  reportItemKeys,
  selectedManagerNames,
}: BuilderExcelArgs) {
  if (
    typeof window ===
    "undefined"
  ) {
    throw new Error(
      "Excel 다운로드는 브라우저에서만 사용할 수 있습니다."
    );
  }

  if (
    rows.length ===
    0
  ) {
    throw new Error(
      "Excel로 다운로드할 조합 분석 결과가 없습니다."
    );
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
    reportItemKeys.flatMap(
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

  if (
    columns.length ===
    0
  ) {
    throw new Error(
      "Excel로 다운로드할 분석항목을 선택해주세요."
    );
  }

  const XLSX =
    await import(
      "@e965/xlsx"
    );

  const header = [
    granularity ===
      "monthly"
      ? "월"
      : "일자",
    "매니저",
    "사번",

    ...columns.map(
      ({
        item,
      }) =>
        `${item.name} (${aggregationLabel(
          item.defaultAggregationType
        )})`
    ),
  ];

  const toExcelValue =
    (
      value:
        number | null,
      unit: string
    ) => {
      if (
        value === null
      ) {
        return null;
      }

      return unit ===
        "percent"
        ? value / 100
        : value;
    };

  const data =
    rows.map(
      (row) => [
        row.periodKey,
        row.managerName,
        row.employeeNo,

        ...columns.map(
          ({
            libraryKey,
            item,
          }) =>
            toExcelValue(
              row.values[
                libraryKey
              ] ?? null,
              item.unit
            )
        ),
      ]
    );

  const totalRow = [
    "합계",
    `${selectedManagerNames.length}명 선택`,
    "",

    ...columns.map(
      ({
        libraryKey,
        item,
      }) =>
        toExcelValue(
          total.values[
            libraryKey
          ] ?? null,
          item.unit
        )
    ),
  ];

  const sheet =
    XLSX.utils.aoa_to_sheet(
      [
        header,
        ...data,
        totalRow,
      ]
    );

  sheet["!cols"] = [
    {
      wch:
        granularity ===
        "monthly"
          ? 12
          : 13,
    },
    { wch: 14 },
    { wch: 13 },

    ...columns.map(
      ({
        item,
      }) => ({
        wch:
          item.unit ===
          "amount"
            ? 20
            : item.unit ===
              "percent"
              ? 16
              : 15,
      })
    ),
  ];

  const firstDataRow =
    2;

  const lastDataRow =
    rows.length + 2;

  columns.forEach(
    (
      {
        item,
      },
      index
    ) => {
      const columnLetter =
        XLSX.utils.encode_col(
          index + 3
        );

      const numberFormat =
        item.unit ===
        "percent"
          ? "0.0%"
          : item.defaultAggregationType ===
              "average" &&
            item.unit ===
              "count"
            ? "0.0"
            : item.unit ===
                "number"
              ? "0.00"
              : "#,##0";

      for (
        let rowIndex =
          firstDataRow;
        rowIndex <=
          lastDataRow;
        rowIndex +=
          1
      ) {
        const cell =
          sheet[
            `${columnLetter}${rowIndex}`
          ] as
            | {
                z?: string;
              }
            | undefined;

        if (cell) {
          cell.z =
            numberFormat;
        }
      }
    }
  );

  const lastColumn =
    XLSX.utils.encode_col(
      header.length -
      1
    );

  sheet["!autofilter"] = {
    ref:
      `A1:${lastColumn}${rows.length + 1}`,
  };

  const conditions =
    XLSX.utils.aoa_to_sheet(
      [
        [
          "항목",
          "내용",
        ],
        [
          "집계단위",
          granularity ===
          "monthly"
            ? "월별"
            : "일자별",
        ],
        [
          "조회기간",
          `${snapshot.startDate} ~ ${snapshot.endDate}`,
        ],
        [
          "선택매니저",
          selectedManagerNames.join(
            ", "
          ),
        ],
        [
          "표시순서",
          columns
            .map(
              (
                column,
                index
              ) =>
                `${index + 1}. ${column.item.name}`
            )
            .join(
              ", "
            ),
        ],
        [
          "데이터 기준",
          "기존 조합분석과 동일: submitted / closed 마감 실적",
        ],
        [
          "관리자",
          "기존 분석엔진 기준 role=admin 제외",
        ],
        [
          "생성일시",
          new Date().toLocaleString(
            "ko-KR"
          ),
        ],
      ]
    );

  conditions["!cols"] = [
    { wch: 18 },
    { wch: 90 },
  ];

  const workbook =
    XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    sheet,
    "조합분석"
  );

  XLSX.utils.book_append_sheet(
    workbook,
    conditions,
    "조회조건"
  );

  const fileName =
    [
      "조합분석",
      granularity ===
        "monthly"
        ? "월별"
        : "일자별",
      safeFilePart(
        snapshot.startDate
      ),
      safeFilePart(
        snapshot.endDate
      ),
    ].join("_") +
    ".xlsx";

  XLSX.writeFile(
    workbook,
    fileName
  );
}
