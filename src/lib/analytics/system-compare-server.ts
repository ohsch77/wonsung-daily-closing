import {
  createClient,
} from "@/lib/supabase/server";

import {
  loadPerformanceAnalysisSnapshot,
  validateAnalysisRange,
} from "@/lib/analytics/server";

import {
  compareStatus,
  differenceValue,
  normalizeEmployeeNo,
  toFiniteNumber,
} from "@/lib/analytics/system-compare";

import type {
  SystemCompareSnapshot,
} from "@/lib/analytics/system-compare";


const PAGE_SIZE = 1000;
const BATCH_CHUNK_SIZE = 200;


type BatchRow = {
  id: string;
  report_date: string;
  dataset_type:
    | "sales"
    | "revenue";
};


async function fetchSystemRows(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  batchIds: string[]
) {
  const rows:
    Record<string, unknown>[] = [];

  for (
    let index = 0;
    index < batchIds.length;
    index +=
      BATCH_CHUNK_SIZE
  ) {
    const batchIdsChunk =
      batchIds.slice(
        index,
        index +
          BATCH_CHUNK_SIZE
      );

    let from = 0;

    while (true) {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            "system_performance_rows"
          )
          .select(
            `
              batch_id,
              source_row_no,
              row_type,
              employee_no,
              employee_name,
              performance_amount,
              is_excluded
            `
          )
          .in(
            "batch_id",
            batchIdsChunk
          )
          .order(
            "batch_id",
            {
              ascending:
                true,
            }
          )
          .order(
            "source_row_no",
            {
              ascending:
                true,
            }
          )
          .range(
            from,
            from +
              PAGE_SIZE -
              1
          );

      if (
        error
      ) {
        throw error;
      }

      const page =
        (data ?? []) as
          Record<
            string,
            unknown
          >[];

      rows.push(
        ...page
      );

      if (
        page.length <
        PAGE_SIZE
      ) {
        break;
      }

      from +=
        PAGE_SIZE;
    }
  }

  return rows;
}


export async function loadSystemCompareSnapshot(
  startDate: string,
  endDate: string
): Promise<SystemCompareSnapshot> {
  validateAnalysisRange(
    startDate,
    endDate
  );

  /*
   * 일실적 쪽은 기존 9-2/9-3 공통 집계 엔진을 그대로 사용합니다.
   * 여기서 새 계산식을 만들지 않아 실적분석과 전산비교의 일실적 기준이 갈라지지 않습니다.
   */
  const performanceSnapshot =
    await loadPerformanceAnalysisSnapshot(
      startDate,
      endDate
    );

  const supabase =
    await createClient();

  /*
   * 전산 비교에는 최종 적용(applied) + 현재본(is_current) +
   * 당일실적(current) 자료만 사용합니다.
   * 전일누적(previous)과 Draft는 비교 대상에서 제외합니다.
   */
  const {
    data: batchData,
    error: batchError,
  } =
    await supabase
      .from(
        "system_performance_batches"
      )
      .select(
        `
          id,
          report_date,
          dataset_type,
          snapshot_type,
          status,
          is_current
        `
      )
      .gte(
        "report_date",
        startDate
      )
      .lte(
        "report_date",
        endDate
      )
      .eq(
        "snapshot_type",
        "current"
      )
      .eq(
        "status",
        "applied"
      )
      .eq(
        "is_current",
        true
      )
      .in(
        "dataset_type",
        [
          "sales",
          "revenue",
        ]
      )
      .order(
        "report_date",
        {
          ascending:
            true,
        }
      );

  if (
    batchError
  ) {
    throw batchError;
  }

  const batches =
    (batchData ?? [])
      .map(
        (
          row:
            Record<
              string,
              unknown
            >
        ): BatchRow | null => {
          const id =
            String(
              row.id ?? ""
            );

          const reportDate =
            String(
              row.report_date ??
                ""
            );

          const datasetType =
            row.dataset_type ===
            "sales"
              ? "sales"
              : row.dataset_type ===
                "revenue"
                ? "revenue"
                : null;

          if (
            !id ||
            !reportDate ||
            !datasetType
          ) {
            return null;
          }

          return {
            id,
            report_date:
              reportDate,
            dataset_type:
              datasetType,
          };
        }
      )
      .filter(
        (
          row
        ): row is BatchRow =>
          row !== null
      );

  const batchById =
    new Map(
      batches.map(
        (batch) => [
          batch.id,
          batch,
        ]
      )
    );

  const systemRows =
    batches.length ===
    0
      ? []
      : await fetchSystemRows(
          supabase,
          batches.map(
            (batch) =>
              batch.id
          )
        );

  const managerByEmployeeNo =
    new Map(
      performanceSnapshot.managers.map(
        (manager) => [
          normalizeEmployeeNo(
            manager.employeeNo
          ),
          manager,
        ]
      )
    );

  /*
   * key = reportDate|managerId
   * dataset별 performance_amount를 저장합니다.
   * 같은 사번행이 여러 개면 원본 행을 합산합니다.
   */
  const systemValueMap =
    new Map<
      string,
      {
        sales:
          number | null;
        revenue:
          number | null;
      }
    >();

  let systemEmployeeRowCount =
    0;

  const unmatchedKeys =
    new Set<string>();

  for (
    const rawRow of
    systemRows
  ) {
    if (
      rawRow.row_type !==
      "employee" ||
      rawRow.is_excluded ===
      true
    ) {
      continue;
    }

    systemEmployeeRowCount +=
      1;

    const batch =
      batchById.get(
        String(
          rawRow.batch_id ??
            ""
        )
      );

    if (
      !batch
    ) {
      continue;
    }

    const employeeNo =
      normalizeEmployeeNo(
        rawRow.employee_no
      );

    if (
      !employeeNo
    ) {
      unmatchedKeys.add(
        `${batch.report_date}|NO_EMPLOYEE_NO|${String(
          rawRow.employee_name ??
            ""
        )}`
      );
      continue;
    }

    const manager =
      managerByEmployeeNo.get(
        employeeNo
      );

    if (
      !manager
    ) {
      unmatchedKeys.add(
        `${batch.report_date}|${employeeNo}|${batch.dataset_type}`
      );
      continue;
    }

    const key =
      `${batch.report_date}|${manager.id}`;

    const current =
      systemValueMap.get(
        key
      ) ?? {
        sales: null,
        revenue: null,
      };

    const amount =
      toFiniteNumber(
        rawRow.performance_amount
      );

    const previous =
      current[
        batch.dataset_type
      ];

    current[
      batch.dataset_type
    ] =
      (previous ?? 0) +
      amount;

    systemValueMap.set(
      key,
      current
    );
  }

  const dailyMap =
    new Map(
      performanceSnapshot.dailyRows.map(
        (row) => [
          `${row.reportDate ?? ""}|${row.managerId}`,
          row,
        ]
      )
    );

  const allKeys =
    new Set<string>([
      ...dailyMap.keys(),
      ...systemValueMap.keys(),
    ]);

  const rows =
    Array.from(
      allKeys
    )
      .map(
        (key) => {
          const [
            reportDate,
            managerId,
          ] =
            key.split("|");

          const manager =
            performanceSnapshot.managers.find(
              (item) =>
                item.id ===
                managerId
            );

          if (
            !manager ||
            !reportDate
          ) {
            return null;
          }

          const daily =
            dailyMap.get(
              key
            );

          const system =
            systemValueMap.get(
              key
            );

          const dailyAmount =
            daily
              ? daily.totalSalesAmount
              : null;

          const salesAmount =
            system?.sales ??
            null;

          const revenueAmount =
            system?.revenue ??
            null;

          return {
            reportDate,
            managerId,
            managerName:
              manager.name,
            managerDisplayOrder:
              manager.displayOrder,
            employeeNo:
              manager.employeeNo,

            dailyTotalSalesAmount:
              dailyAmount,

            systemSalesAmount:
              salesAmount,

            systemRevenueAmount:
              revenueAmount,

            salesDifference:
              differenceValue(
                dailyAmount,
                salesAmount
              ),

            revenueDifference:
              differenceValue(
                dailyAmount,
                revenueAmount
              ),

            salesStatus:
              compareStatus(
                dailyAmount,
                salesAmount
              ),

            revenueStatus:
              compareStatus(
                dailyAmount,
                revenueAmount
              ),
          };
        }
      )
      .filter(
        (
          row
        ): row is NonNullable<
          typeof row
        > =>
          row !== null
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

  return {
    startDate,
    endDate,
    managers:
      performanceSnapshot.managers,
    rows,

    dailyRowCount:
      performanceSnapshot.dailyRows.length,

    appliedBatchCount:
      batches.length,

    systemEmployeeRowCount,

    unmatchedSystemEmployeeCount:
      unmatchedKeys.size,

    generatedAt:
      new Date().toISOString(),
  };
}
