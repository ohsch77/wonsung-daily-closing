export type DailyManager = {
  id: string;
  employeeNo: string;
  name: string;
  role: "manager" | "admin";
  displayOrder: number;
};

export type DailyMetricCategory = {
  id: string;
  code: string;
  name: string;
  displayOrder: number;
};

export type DailyMetricUnit =
  | "amount"
  | "count";

export type DailyMetric = {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  unitType: DailyMetricUnit;
  effectSign: number;
  displayOrder: number;
};

type UnknownRow =
  Record<string, unknown>;


function getString(
  row: UnknownRow,
  keys: string[],
  fallback = ""
) {
  for (const key of keys) {
    const value = row[key];

    if (
      typeof value === "string" &&
      value.trim() !== ""
    ) {
      return value.trim();
    }
  }

  return fallback;
}


function getNumber(
  row: UnknownRow,
  keys: string[],
  fallback = 0
) {
  for (const key of keys) {
    const value = row[key];

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return value;
    }

    if (
      typeof value === "string" &&
      value.trim() !== ""
    ) {
      const numberValue =
        Number(value);

      if (
        Number.isFinite(
          numberValue
        )
      ) {
        return numberValue;
      }
    }
  }

  return fallback;
}


function isActive(
  row: UnknownRow
) {
  return row.is_active !== false;
}


function resolveMetricUnit(
  row: UnknownRow,
  code: string,
  name: string
): DailyMetricUnit {
  const rawUnit =
    getString(
      row,
      [
        "unit_type",
        "value_type",
        "unit",
        "metric_type",
      ]
    ).toLowerCase();

  if (
    rawUnit.includes("amount") ||
    rawUnit.includes("금액") ||
    rawUnit.includes("won")
  ) {
    return "amount";
  }

  if (
    rawUnit.includes("count") ||
    rawUnit.includes("건수") ||
    rawUnit === "건"
  ) {
    return "count";
  }

  const amountCodes =
    new Set([
      "STORE_SALES",
      "OUTSIDE_SALES",
      "SALES_CANCEL",
      "CASH_PAYMENT",
    ]);

  if (
    amountCodes.has(code)
  ) {
    return "amount";
  }

  if (
    name.includes("판매") &&
    !code.includes("SUBSCRIPTION") &&
    !code.includes("KYOWON")
  ) {
    return "amount";
  }

  return "count";
}


export function normalizeCategoryRows(
  rows: unknown[]
): DailyMetricCategory[] {
  return rows
    .map(
      (
        source,
        index
      ): DailyMetricCategory | null => {
        const row =
          source as UnknownRow;

        if (!isActive(row)) {
          return null;
        }

        const id =
          getString(
            row,
            ["id"]
          );

        if (!id) {
          return null;
        }

        return {
          id,

          code:
            getString(
              row,
              [
                "category_code",
                "code",
              ],
              `CATEGORY_${index + 1}`
            ),

          name:
            getString(
              row,
              [
                "category_name",
                "name",
                "label",
              ],
              "기타"
            ),

          displayOrder:
            getNumber(
              row,
              [
                "display_order",
                "sort_order",
                "order_no",
              ],
              index + 1
            ),
        };
      }
    )
    .filter(
      (
        item
      ): item is DailyMetricCategory =>
        item !== null
    )
    .sort(
      (a, b) =>
        a.displayOrder -
        b.displayOrder
    );
}


export function normalizeMetricRows(
  rows: unknown[]
): DailyMetric[] {
  return rows
    .map(
      (
        source,
        index
      ): DailyMetric | null => {
        const row =
          source as UnknownRow;

        if (!isActive(row)) {
          return null;
        }

        const id =
          getString(
            row,
            ["id"]
          );

        const categoryId =
          getString(
            row,
            [
              "category_id",
            ]
          );

        if (
          !id ||
          !categoryId
        ) {
          return null;
        }

        const code =
          getString(
            row,
            [
              "metric_code",
              "code",
            ],
            `METRIC_${index + 1}`
          );

        const name =
          getString(
            row,
            [
              "metric_name",
              "name",
              "label",
            ],
            code
          );

        const effectSign =
          getNumber(
            row,
            [
              "effect_sign",
              "sign",
            ],
            code.includes("CANCEL")
              ? -1
              : 1
          );

        return {
          id,
          categoryId,
          code,
          name,

          unitType:
            resolveMetricUnit(
              row,
              code,
              name
            ),

          effectSign,

          displayOrder:
            getNumber(
              row,
              [
                "display_order",
                "sort_order",
                "order_no",
              ],
              index + 1
            ),
        };
      }
    )
    .filter(
      (
        item
      ): item is DailyMetric =>
        item !== null
    )
    .sort(
      (a, b) =>
        a.displayOrder -
        b.displayOrder
    );
}