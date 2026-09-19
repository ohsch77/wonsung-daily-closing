"use client";

import {
  Fragment,
  useMemo,
  useState,
} from "react";

import {
  ClipboardList,
  ChevronDown,
  ChevronUp,
  CirclePlus,
  Eye,
  EyeOff,
  LoaderCircle,
  Plus,
  Percent,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import {
  createClient,
} from "@/lib/supabase/client";


export type DailyMetricAggregationType =
  | "sum"
  | "average"
  | "rate";


export type DailyMetricCategorySettingsRow = {
  id: string;
  code: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  isCustom: boolean;
  canDelete: boolean;
};


export type DailyMetricSettingsRow = {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  unit:
    | "amount"
    | "count"
    | "percent";
  effectSign:
    | -1
    | 1;
  aggregationType:
    DailyMetricAggregationType;
  numeratorMetricId:
    | string
    | null;
  denominatorMetricId:
    | string
    | null;
  displayOrder: number;
  isActive: boolean;
  isCustom: boolean;
  hasHistory: boolean;
  isFormulaSource: boolean;
  canDelete: boolean;
};


type Props = {
  initialCategories:
    DailyMetricCategorySettingsRow[];
  initialMetrics:
    DailyMetricSettingsRow[];
};


type Message = {
  type:
    | "success"
    | "error";
  text: string;
};


type NewCategoryDraft = {
  name: string;
  displayOrder: string;
};


type NewMetricDraft = {
  name: string;
  unit:
    | "amount"
    | "count"
    | "percent";
  effectSign:
    | -1
    | 1;
  aggregationType:
    DailyMetricAggregationType;
  numeratorMetricId:
    | string
    | null;
  denominatorMetricId:
    | string
    | null;
  displayOrder: string;
};


type NewCalculatedMetricDraft = {
  categoryId: string;
  name: string;
  numeratorMetricId:
    | string
    | null;
  denominatorMetricId:
    | string
    | null;
  displayOrder: string;
};


function sortCategories(
  rows:
    DailyMetricCategorySettingsRow[]
) {
  return [
    ...rows,
  ].sort(
    (a, b) =>
      a.displayOrder -
        b.displayOrder ||
      a.name.localeCompare(
        b.name,
        "ko"
      )
  );
}


function sortMetrics(
  rows:
    DailyMetricSettingsRow[],
  categories:
    DailyMetricCategorySettingsRow[]
) {
  const categoryOrder =
    new Map(
      categories.map(
        (category) => [
          category.id,
          category.displayOrder,
        ]
      )
    );

  return [
    ...rows,
  ].sort(
    (a, b) =>
      (
        categoryOrder.get(
          a.categoryId
        ) ??
        999999
      ) -
        (
          categoryOrder.get(
            b.categoryId
          ) ??
          999999
        ) ||
      a.displayOrder -
        b.displayOrder ||
      a.name.localeCompare(
        b.name,
        "ko"
      )
  );
}


function sameCategory(
  a:
    DailyMetricCategorySettingsRow,
  b:
    | DailyMetricCategorySettingsRow
    | undefined
) {
  return Boolean(
    b &&
    a.name === b.name &&
    a.displayOrder ===
      b.displayOrder &&
    a.isActive ===
      b.isActive
  );
}


function sameMetric(
  a:
    DailyMetricSettingsRow,
  b:
    | DailyMetricSettingsRow
    | undefined
) {
  return Boolean(
    b &&
    a.categoryId ===
      b.categoryId &&
    a.name === b.name &&
    a.unit === b.unit &&
    a.effectSign ===
      b.effectSign &&
    a.aggregationType ===
      b.aggregationType &&
    a.numeratorMetricId ===
      b.numeratorMetricId &&
    a.denominatorMetricId ===
      b.denominatorMetricId &&
    a.displayOrder ===
      b.displayOrder &&
    a.isActive ===
      b.isActive
  );
}


function errorText(
  error: unknown,
  fallback: string
) {
  if (
    error &&
    typeof error ===
      "object" &&
    "message" in error
  ) {
    const message =
      String(
        (
          error as {
            message?: unknown;
          }
        ).message ??
          ""
      ).trim();

    if (message) {
      return message;
    }
  }

  return fallback;
}


function asRecord(
  value: unknown
) {
  return (
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(value)
  )
    ? value as Record<
        string,
        unknown
      >
    : {};
}


function nullableString(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  return String(value);
}


function normalizeCategory(
  value: unknown,
  fallback:
    DailyMetricCategorySettingsRow
) {
  const row =
    asRecord(value);

  const order =
    Number(
      row.display_order
    );

  return {
    id:
      String(
        row.id ??
          fallback.id
      ),
    code:
      String(
        row.code ??
          fallback.code
      ),
    name:
      String(
        row.name ??
          fallback.name
      ),
    displayOrder:
      Number.isInteger(
        order
      ) &&
      order >= 1
        ? order
        : fallback.displayOrder,
    isActive:
      row.is_active !==
      false,
    isCustom:
      typeof row.is_custom ===
      "boolean"
        ? row.is_custom
        : fallback.isCustom,
    canDelete:
      typeof row.can_delete ===
      "boolean"
        ? row.can_delete
        : fallback.canDelete,
  } satisfies
    DailyMetricCategorySettingsRow;
}


function normalizeMetric(
  value: unknown,
  fallback:
    DailyMetricSettingsRow
) {
  const row =
    asRecord(value);

  const order =
    Number(
      row.display_order
    );

  const effect =
    Number(
      row.effect_sign
    );

  const aggregationType =
    row.aggregation_type ===
    "average"
      ? "average"
      : row.aggregation_type ===
        "rate"
        ? "rate"
        : "sum";

  const unit =
    row.unit === "amount"
      ? "amount"
      : row.unit ===
        "percent"
        ? "percent"
        : "count";

  return {
    id:
      String(
        row.id ??
          fallback.id
      ),
    categoryId:
      String(
        row.category_id ??
          fallback.categoryId
      ),
    code:
      String(
        row.code ??
          fallback.code
      ),
    name:
      String(
        row.name ??
          fallback.name
      ),
    unit,
    effectSign:
      effect < 0
        ? -1
        : 1,
    aggregationType,
    numeratorMetricId:
      nullableString(
        row.numerator_metric_id
      ) ??
      fallback.numeratorMetricId,
    denominatorMetricId:
      nullableString(
        row.denominator_metric_id
      ) ??
      fallback.denominatorMetricId,
    displayOrder:
      Number.isInteger(
        order
      ) &&
      order >= 1
        ? order
        : fallback.displayOrder,
    isActive:
      row.is_active !==
      false,
    isCustom:
      typeof row.is_custom ===
      "boolean"
        ? row.is_custom
        : fallback.isCustom,
    hasHistory:
      typeof row.has_history ===
      "boolean"
        ? row.has_history
        : fallback.hasHistory,
    isFormulaSource:
      typeof row.is_formula_source ===
      "boolean"
        ? row.is_formula_source
        : fallback.isFormulaSource,
    canDelete:
      typeof row.can_delete ===
      "boolean"
        ? row.can_delete
        : fallback.canDelete,
  } satisfies
    DailyMetricSettingsRow;
}


function aggregationLabel(
  type:
    DailyMetricAggregationType
) {
  if (type === "average") {
    return "평균";
  }

  if (type === "rate") {
    return "성공률";
  }

  return "합계";
}


export default function DailyMetricSettingsPanel({
  initialCategories,
  initialMetrics,
}: Props) {
  const supabase =
    useMemo(
      () => createClient(),
      []
    );

  const initialCategoryRows =
    useMemo(
      () =>
        sortCategories(
          initialCategories
        ),
      [initialCategories]
    );

  const initialMetricRows =
    useMemo(
      () =>
        sortMetrics(
          initialMetrics,
          initialCategoryRows
        ),
      [
        initialMetrics,
        initialCategoryRows,
      ]
    );

  const [
    categories,
    setCategories,
  ] =
    useState(
      initialCategoryRows
    );

  const [
    savedCategories,
    setSavedCategories,
  ] =
    useState(
      initialCategoryRows
    );

  const [
    metrics,
    setMetrics,
  ] =
    useState(
      initialMetricRows
    );

  const [
    savedMetrics,
    setSavedMetrics,
  ] =
    useState(
      initialMetricRows
    );

  const [
    showAll,
    setShowAll,
  ] =
    useState(false);

  const [
    expandedCategories,
    setExpandedCategories,
  ] =
    useState<
      Record<
        string,
        boolean
      >
    >(
      Object.fromEntries(
        initialCategoryRows.map(
          (category) => [
            category.id,
            true,
          ]
        )
      )
    );

  const [
    categoryMessages,
    setCategoryMessages,
  ] =
    useState<
      Record<
        string,
        Message
      >
    >({});

  const [
    metricMessages,
    setMetricMessages,
  ] =
    useState<
      Record<
        string,
        Message
      >
    >({});

  const [
    categorySavingId,
    setCategorySavingId,
  ] =
    useState<string | null>(
      null
    );

  const [
    metricSavingId,
    setMetricSavingId,
  ] =
    useState<string | null>(
      null
    );

  const [
    deletingId,
    setDeletingId,
  ] =
    useState<string | null>(
      null
    );

  const [
    newCategory,
    setNewCategory,
  ] =
    useState<
      NewCategoryDraft | null
    >(null);

  const [
    creatingCategory,
    setCreatingCategory,
  ] =
    useState(false);

  const [
    createCategoryMessage,
    setCreateCategoryMessage,
  ] =
    useState<Message | null>(
      null
    );

  const [
    newMetricDrafts,
    setNewMetricDrafts,
  ] =
    useState<
      Record<
        string,
        NewMetricDraft | undefined
      >
    >({});

  const [
    creatingMetricCategoryId,
    setCreatingMetricCategoryId,
  ] =
    useState<string | null>(
      null
    );

  const [
    newCalculatedMetric,
    setNewCalculatedMetric,
  ] =
    useState<
      NewCalculatedMetricDraft | null
    >(null);

  const [
    creatingCalculatedMetric,
    setCreatingCalculatedMetric,
  ] =
    useState(false);

  const [
    calculatedCreateMessage,
    setCalculatedCreateMessage,
  ] =
    useState<Message | null>(
      null
    );

  const categorySavedMap =
    useMemo(
      () =>
        new Map(
          savedCategories.map(
            (row) => [
              row.id,
              row,
            ]
          )
        ),
      [savedCategories]
    );

  const metricSavedMap =
    useMemo(
      () =>
        new Map(
          savedMetrics.map(
            (row) => [
              row.id,
              row,
            ]
          )
        ),
      [savedMetrics]
    );

  const visibleCategories =
    useMemo(
      () =>
        categories.filter(
          (category) =>
            showAll ||
            category.isActive
        ),
      [
        categories,
        showAll,
      ]
    );

  const inputMetrics =
    useMemo(
      () =>
        metrics.filter(
          (metric) =>
            metric.aggregationType !==
            "rate"
        ),
      [metrics]
    );

  const calculatedMetrics =
    useMemo(
      () =>
        metrics.filter(
          (metric) =>
            metric.aggregationType ===
            "rate"
        ),
      [metrics]
    );

  const visibleCalculatedMetrics =
    useMemo(
      () =>
        calculatedMetrics.filter(
          (metric) =>
            showAll ||
            metric.isActive
        ),
      [
        calculatedMetrics,
        showAll,
      ]
    );

  const activeInputMetricCount =
    inputMetrics.filter(
      (metric) =>
        metric.isActive
    ).length;

  const activeCalculatedMetricCount =
    calculatedMetrics.filter(
      (metric) =>
        metric.isActive
    ).length;

  const nextCategoryOrder =
    useMemo(
      () =>
        Math.max(
          0,
          ...categories.map(
            (row) =>
              Number(
                row.displayOrder
              ) || 0
          )
        ) + 10,
      [categories]
    );


  function getNextMetricOrder(
    categoryId: string
  ) {
    return (
      Math.max(
        0,
        ...metrics
          .filter(
            (metric) =>
              metric.categoryId ===
              categoryId
          )
          .map(
            (metric) =>
              Number(
                metric.displayOrder
              ) || 0
          )
      ) + 10
    );
  }


  function getRateSourceOptions(
    currentMetricId:
      | string
      | null,
    selectedIds:
      Array<
        string | null
      > = []
  ) {
    const selectedSet =
      new Set(
        selectedIds.filter(
          Boolean
        ) as string[]
      );

    return metrics.filter(
      (metric) =>
        metric.id !==
          currentMetricId &&
        metric.aggregationType !==
          "rate" &&
        metric.unit ===
          "count" &&
        metric.effectSign ===
          1 &&
        (
          metric.isActive ||
          selectedSet.has(
            metric.id
          )
        )
    );
  }


  function categoryName(
    categoryId: string
  ) {
    return (
      categories.find(
        (category) =>
          category.id ===
          categoryId
      )?.name ??
      "미분류"
    );
  }


  function sourceMetricLabel(
    metric:
      DailyMetricSettingsRow
  ) {
    return `${categoryName(
      metric.categoryId
    )} · ${metric.name}`;
  }


  function openNewCalculatedMetricRow() {
    const category =
      categories.find(
        (row) =>
          row.isActive
      );

    if (!category) {
      setCalculatedCreateMessage({
        type: "error",
        text:
          "사용중인 분류가 없어 자동 계산지표를 추가할 수 없습니다.",
      });
      return;
    }

    setNewCalculatedMetric({
      categoryId:
        category.id,
      name: "",
      numeratorMetricId:
        null,
      denominatorMetricId:
        null,
      displayOrder:
        String(
          getNextMetricOrder(
            category.id
          )
        ),
    });

    setCalculatedCreateMessage(
      null
    );
  }


  function cancelNewCalculatedMetricRow() {
    if (creatingCalculatedMetric) {
      return;
    }

    setNewCalculatedMetric(
      null
    );
    setCalculatedCreateMessage(
      null
    );
  }


  function updateNewCalculatedMetric(
    patch:
      Partial<
        NewCalculatedMetricDraft
      >
  ) {
    setNewCalculatedMetric(
      (current) =>
        current
          ? {
              ...current,
              ...patch,
            }
          : current
    );

    setCalculatedCreateMessage(
      null
    );
  }


  function openNewCategoryRow() {
    setNewCategory({
      name: "",
      displayOrder:
        String(
          nextCategoryOrder
        ),
    });

    setCreateCategoryMessage(
      null
    );
  }


  function cancelNewCategoryRow() {
    if (creatingCategory) {
      return;
    }

    setNewCategory(
      null
    );

    setCreateCategoryMessage(
      null
    );
  }


  function openNewMetricRow(
    categoryId: string
  ) {
    setNewMetricDrafts(
      (current) => ({
        ...current,
        [categoryId]: {
          name: "",
          unit: "count",
          effectSign: 1,
          aggregationType:
            "sum",
          numeratorMetricId:
            null,
          denominatorMetricId:
            null,
          displayOrder:
            String(
              getNextMetricOrder(
                categoryId
              )
            ),
        },
      })
    );

    setExpandedCategories(
      (current) => ({
        ...current,
        [categoryId]:
          true,
      })
    );
  }


  function cancelNewMetricRow(
    categoryId: string
  ) {
    if (
      creatingMetricCategoryId ===
      categoryId
    ) {
      return;
    }

    setNewMetricDrafts(
      (current) => {
        const next = {
          ...current,
        };

        delete next[
          categoryId
        ];

        return next;
      }
    );

    setMetricMessages(
      (current) => {
        const next = {
          ...current,
        };

        delete next[
          `new-${categoryId}`
        ];

        return next;
      }
    );
  }


  function updateCategory(
    id: string,
    patch:
      Partial<
        DailyMetricCategorySettingsRow
      >
  ) {
    setCategories(
      (current) =>
        current.map(
          (row) =>
            row.id === id
              ? {
                  ...row,
                  ...patch,
                }
              : row
        )
    );

    setCategoryMessages(
      (current) => {
        const next = {
          ...current,
        };

        delete next[id];

        return next;
      }
    );
  }


  function updateMetric(
    id: string,
    patch:
      Partial<
        DailyMetricSettingsRow
      >
  ) {
    setMetrics(
      (current) =>
        current.map(
          (row) =>
            row.id === id
              ? {
                  ...row,
                  ...patch,
                }
              : row
        )
    );

    setMetricMessages(
      (current) => {
        const next = {
          ...current,
        };

        delete next[id];

        return next;
      }
    );
  }


  function updateMetricAggregation(
    id: string,
    aggregationType:
      DailyMetricAggregationType
  ) {
    const currentMetric =
      metrics.find(
        (metric) =>
          metric.id === id
      );

    updateMetric(
      id,
      aggregationType ===
        "rate"
        ? {
            aggregationType,
            unit: "percent",
            effectSign: 1,
            numeratorMetricId:
              null,
            denominatorMetricId:
              null,
          }
        : {
            aggregationType,
            unit:
              currentMetric?.unit ===
              "percent"
                ? "count"
                : currentMetric?.unit ??
                  "count",
            numeratorMetricId:
              null,
            denominatorMetricId:
              null,
          }
    );
  }


  function updateNewMetricDraft(
    categoryId: string,
    patch:
      Partial<
        NewMetricDraft
      >
  ) {
    setNewMetricDrafts(
      (current) => {
        const currentDraft =
          current[
            categoryId
          ];

        if (!currentDraft) {
          return current;
        }

        return {
          ...current,
          [categoryId]: {
            ...currentDraft,
            ...patch,
          },
        };
      }
    );
  }


  function updateNewMetricAggregation(
    categoryId: string,
    aggregationType:
      DailyMetricAggregationType
  ) {
    updateNewMetricDraft(
      categoryId,
      aggregationType ===
        "rate"
        ? {
            aggregationType,
            unit: "percent",
            effectSign: 1,
            numeratorMetricId:
              null,
            denominatorMetricId:
              null,
          }
        : {
            aggregationType,
            unit: "count",
            effectSign: 1,
            numeratorMetricId:
              null,
            denominatorMetricId:
              null,
          }
    );
  }


  function resetCategory(
    id: string
  ) {
    const saved =
      categorySavedMap.get(
        id
      );

    if (!saved) {
      return;
    }

    setCategories(
      (current) =>
        sortCategories(
          current.map(
            (row) =>
              row.id === id
                ? {
                    ...saved,
                  }
                : row
          )
        )
    );
  }


  function resetMetric(
    id: string
  ) {
    const saved =
      metricSavedMap.get(
        id
      );

    if (!saved) {
      return;
    }

    setMetrics(
      (current) =>
        sortMetrics(
          current.map(
            (row) =>
              row.id === id
                ? {
                    ...saved,
                  }
                : row
          ),
          categories
        )
    );
  }


  async function createCategory() {
    if (!newCategory) {
      return;
    }

    const name =
      newCategory.name.trim();

    const displayOrder =
      Number(
        newCategory.displayOrder
      );

    if (!name) {
      setCreateCategoryMessage({
        type: "error",
        text:
          "분류명을 입력해주세요.",
      });

      return;
    }

    if (
      !Number.isInteger(
        displayOrder
      ) ||
      displayOrder < 1
    ) {
      setCreateCategoryMessage({
        type: "error",
        text:
          "표시순서는 1 이상의 정수로 입력해주세요.",
      });

      return;
    }

    setCreatingCategory(
      true
    );

    setCreateCategoryMessage(
      null
    );

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "admin_create_metric_category",
          {
            p_name: name,
            p_display_order:
              displayOrder,
          }
        );

      if (error) {
        throw error;
      }

      const created =
        normalizeCategory(
          data,
          {
            id:
              `temp-${Date.now()}`,
            code: "",
            name,
            displayOrder,
            isActive: true,
            isCustom: true,
            canDelete: true,
          }
        );

      setCategories(
        (current) =>
          sortCategories([
            ...current,
            created,
          ])
      );

      setSavedCategories(
        (current) =>
          sortCategories([
            ...current,
            created,
          ])
      );

      setExpandedCategories(
        (current) => ({
          ...current,
          [created.id]:
            true,
        })
      );

      setNewCategory(
        null
      );

      setCreateCategoryMessage({
        type: "success",
        text:
          "분류가 추가되었습니다.",
      });
    } catch (
      error
    ) {
      setCreateCategoryMessage({
        type: "error",
        text:
          errorText(
            error,
            "분류 추가 중 오류가 발생했습니다."
          ),
      });
    } finally {
      setCreatingCategory(
        false
      );
    }
  }


  async function saveCategory(
    row:
      DailyMetricCategorySettingsRow
  ) {
    const name =
      row.name.trim();

    if (!name) {
      setCategoryMessages(
        (current) => ({
          ...current,
          [row.id]: {
            type: "error",
            text:
              "분류명을 입력해주세요.",
          },
        })
      );

      return;
    }

    if (
      !Number.isInteger(
        row.displayOrder
      ) ||
      row.displayOrder < 1
    ) {
      setCategoryMessages(
        (current) => ({
          ...current,
          [row.id]: {
            type: "error",
            text:
              "표시순서는 1 이상의 정수로 입력해주세요.",
          },
        })
      );

      return;
    }

    setCategorySavingId(
      row.id
    );

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "admin_update_metric_category",
          {
            p_category_id:
              row.id,
            p_name: name,
            p_display_order:
              row.displayOrder,
            p_is_active:
              row.isActive,
          }
        );

      if (error) {
        throw error;
      }

      const updated =
        normalizeCategory(
          data,
          {
            ...row,
            name,
          }
        );

      setCategories(
        (current) =>
          sortCategories(
            current.map(
              (item) =>
                item.id ===
                row.id
                  ? updated
                  : item
            )
          )
      );

      setSavedCategories(
        (current) =>
          sortCategories(
            current.map(
              (item) =>
                item.id ===
                row.id
                  ? updated
                  : item
            )
          )
      );

      if (!updated.isActive) {
        setMetrics(
          (current) =>
            current.map(
              (metric) =>
                metric.categoryId ===
                row.id
                  ? {
                      ...metric,
                      isActive:
                        false,
                    }
                  : metric
            )
        );

        setSavedMetrics(
          (current) =>
            current.map(
              (metric) =>
                metric.categoryId ===
                row.id
                  ? {
                      ...metric,
                      isActive:
                        false,
                    }
                  : metric
            )
        );

        cancelNewMetricRow(
          row.id
        );
      }

      setCategoryMessages(
        (current) => ({
          ...current,
          [row.id]: {
            type: "success",
            text:
              "저장되었습니다.",
          },
        })
      );
    } catch (
      error
    ) {
      setCategoryMessages(
        (current) => ({
          ...current,
          [row.id]: {
            type: "error",
            text:
              errorText(
                error,
                "분류 저장 중 오류가 발생했습니다."
              ),
          },
        })
      );
    } finally {
      setCategorySavingId(
        null
      );
    }
  }


  async function deleteCategory(
    row:
      DailyMetricCategorySettingsRow
  ) {
    if (!row.canDelete) {
      return;
    }

    const confirmed =
      window.confirm(
        `'${row.name}' 분류를 삭제하시겠습니까?\n\n사용 이력이 없는 사용자 추가 분류만 삭제됩니다.`
      );

    if (!confirmed) {
      return;
    }

    setDeletingId(
      `category-${row.id}`
    );

    try {
      const {
        error,
      } =
        await supabase.rpc(
          "admin_delete_metric_category",
          {
            p_category_id:
              row.id,
          }
        );

      if (error) {
        throw error;
      }

      setCategories(
        (current) =>
          current.filter(
            (item) =>
              item.id !== row.id
          )
      );

      setSavedCategories(
        (current) =>
          current.filter(
            (item) =>
              item.id !== row.id
          )
      );

      setMetrics(
        (current) =>
          current.filter(
            (item) =>
              item.categoryId !==
              row.id
          )
      );

      setSavedMetrics(
        (current) =>
          current.filter(
            (item) =>
              item.categoryId !==
              row.id
          )
      );
    } catch (
      error
    ) {
      setCategoryMessages(
        (current) => ({
          ...current,
          [row.id]: {
            type: "error",
            text:
              errorText(
                error,
                "분류를 삭제하지 못했습니다."
              ),
          },
        })
      );
    } finally {
      setDeletingId(
        null
      );
    }
  }


  async function saveMetric(
    row:
      DailyMetricSettingsRow
  ) {
    const name =
      row.name.trim();

    if (!name) {
      setMetricMessages(
        (current) => ({
          ...current,
          [row.id]: {
            type: "error",
            text:
              "항목명을 입력해주세요.",
          },
        })
      );

      return;
    }

    if (
      !Number.isInteger(
        row.displayOrder
      ) ||
      row.displayOrder < 1
    ) {
      setMetricMessages(
        (current) => ({
          ...current,
          [row.id]: {
            type: "error",
            text:
              "표시순서는 1 이상의 정수로 입력해주세요.",
          },
        })
      );

      return;
    }

    if (
      row.aggregationType ===
        "rate" &&
      (
        !row.numeratorMetricId ||
        !row.denominatorMetricId
      )
    ) {
      setMetricMessages(
        (current) => ({
          ...current,
          [row.id]: {
            type: "error",
            text:
              "성공률의 성공항목과 기준항목을 선택해주세요.",
          },
        })
      );

      return;
    }

    const savedRow =
      metricSavedMap.get(
        row.id
      );

    const changesHistoricalMeaning =
      row.hasHistory &&
      savedRow &&
      (
        savedRow.unit !==
          row.unit ||
        savedRow.effectSign !==
          row.effectSign ||
        savedRow.aggregationType !==
          row.aggregationType
      );

    if (
      changesHistoricalMeaning &&
      !window.confirm(
        "이미 실적이 연결된 항목입니다. 단위·집계방식·증감방향 변경은 과거 분석 결과에도 같은 기준으로 반영됩니다. 계속 수정하시겠습니까?"
      )
    ) {
      return;
    }

    setMetricSavingId(
      row.id
    );

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "admin_update_metric_v2",
          {
            p_metric_id:
              row.id,
            p_category_id:
              row.categoryId,
            p_name: name,
            p_unit:
              row.unit,
            p_effect_sign:
              row.effectSign,
            p_aggregation_type:
              row.aggregationType,
            p_numerator_metric_id:
              row.numeratorMetricId,
            p_denominator_metric_id:
              row.denominatorMetricId,
            p_display_order:
              row.displayOrder,
            p_is_active:
              row.isActive,
          }
        );

      if (error) {
        throw error;
      }

      const updated =
        normalizeMetric(
          data,
          {
            ...row,
            name,
          }
        );

      setMetrics(
        (current) =>
          sortMetrics(
            current.map(
              (item) =>
                item.id ===
                row.id
                  ? updated
                  : item
            ),
            categories
          )
      );

      setSavedMetrics(
        (current) =>
          sortMetrics(
            current.map(
              (item) =>
                item.id ===
                row.id
                  ? updated
                  : item
            ),
            categories
          )
      );

      setMetricMessages(
        (current) => ({
          ...current,
          [row.id]: {
            type: "success",
            text:
              "저장되었습니다.",
          },
        })
      );
    } catch (
      error
    ) {
      setMetricMessages(
        (current) => ({
          ...current,
          [row.id]: {
            type: "error",
            text:
              errorText(
                error,
                "항목 저장 중 오류가 발생했습니다."
              ),
          },
        })
      );
    } finally {
      setMetricSavingId(
        null
      );
    }
  }


  async function deleteMetric(
    row:
      DailyMetricSettingsRow
  ) {
    if (!row.canDelete) {
      return;
    }

    const confirmed =
      window.confirm(
        `'${row.name}' 항목을 삭제하시겠습니까?\n\n실적 이력이 생긴 항목은 삭제할 수 없고 사용중지만 가능합니다.`
      );

    if (!confirmed) {
      return;
    }

    setDeletingId(
      `metric-${row.id}`
    );

    try {
      const {
        error,
      } =
        await supabase.rpc(
          "admin_delete_metric",
          {
            p_metric_id:
              row.id,
          }
        );

      if (error) {
        throw error;
      }

      setMetrics(
        (current) =>
          current.filter(
            (item) =>
              item.id !== row.id
          )
      );

      setSavedMetrics(
        (current) =>
          current.filter(
            (item) =>
              item.id !== row.id
          )
      );
    } catch (
      error
    ) {
      setMetricMessages(
        (current) => ({
          ...current,
          [row.id]: {
            type: "error",
            text:
              errorText(
                error,
                "항목을 삭제하지 못했습니다."
              ),
          },
        })
      );
    } finally {
      setDeletingId(
        null
      );
    }
  }


  async function createMetric(
    category:
      DailyMetricCategorySettingsRow
  ) {
    const draft =
      newMetricDrafts[
        category.id
      ];

    if (!draft) {
      return;
    }

    const name =
      draft.name.trim();

    const displayOrder =
      Number(
        draft.displayOrder
      );

    if (!name) {
      setMetricMessages(
        (current) => ({
          ...current,
          [
            `new-${category.id}`
          ]: {
            type: "error",
            text:
              "항목명을 입력해주세요.",
          },
        })
      );

      return;
    }

    if (
      !Number.isInteger(
        displayOrder
      ) ||
      displayOrder < 1
    ) {
      setMetricMessages(
        (current) => ({
          ...current,
          [
            `new-${category.id}`
          ]: {
            type: "error",
            text:
              "표시순서는 1 이상의 정수로 입력해주세요.",
          },
        })
      );

      return;
    }

    if (
      draft.aggregationType ===
        "rate" &&
      (
        !draft.numeratorMetricId ||
        !draft.denominatorMetricId
      )
    ) {
      setMetricMessages(
        (current) => ({
          ...current,
          [
            `new-${category.id}`
          ]: {
            type: "error",
            text:
              "성공률의 성공항목과 기준항목을 선택해주세요.",
          },
        })
      );

      return;
    }

    setCreatingMetricCategoryId(
      category.id
    );

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "admin_create_metric_v2",
          {
            p_category_id:
              category.id,
            p_name: name,
            p_unit:
              draft.unit,
            p_effect_sign:
              draft.effectSign,
            p_aggregation_type:
              draft.aggregationType,
            p_numerator_metric_id:
              draft.numeratorMetricId,
            p_denominator_metric_id:
              draft.denominatorMetricId,
            p_display_order:
              displayOrder,
          }
        );

      if (error) {
        throw error;
      }

      const created =
        normalizeMetric(
          data,
          {
            id:
              `temp-${Date.now()}`,
            categoryId:
              category.id,
            code: "",
            name,
            unit:
              draft.unit,
            effectSign:
              draft.effectSign,
            aggregationType:
              draft.aggregationType,
            numeratorMetricId:
              draft.numeratorMetricId,
            denominatorMetricId:
              draft.denominatorMetricId,
            displayOrder,
            isActive: true,
            isCustom: true,
            hasHistory: false,
            isFormulaSource: false,
            canDelete: true,
          }
        );

      setMetrics(
        (current) =>
          sortMetrics(
            [
              ...current,
              created,
            ],
            categories
          )
      );

      setSavedMetrics(
        (current) =>
          sortMetrics(
            [
              ...current,
              created,
            ],
            categories
          )
      );

      setNewMetricDrafts(
        (current) => {
          const next = {
            ...current,
          };

          delete next[
            category.id
          ];

          return next;
        }
      );

      setMetricMessages(
        (current) => ({
          ...current,
          [
            `new-${category.id}`
          ]: {
            type: "success",
            text:
              "항목이 추가되었습니다.",
          },
        })
      );
    } catch (
      error
    ) {
      setMetricMessages(
        (current) => ({
          ...current,
          [
            `new-${category.id}`
          ]: {
            type: "error",
            text:
              errorText(
                error,
                "항목 추가 중 오류가 발생했습니다."
              ),
          },
        })
      );
    } finally {
      setCreatingMetricCategoryId(
        null
      );
    }
  }


  async function createCalculatedMetric() {
    const draft =
      newCalculatedMetric;

    if (!draft) {
      return;
    }

    const name =
      draft.name.trim();
    const displayOrder =
      Number(
        draft.displayOrder
      );

    if (!name) {
      setCalculatedCreateMessage({
        type: "error",
        text:
          "계산지표명을 입력해주세요.",
      });
      return;
    }

    if (
      !draft.categoryId
    ) {
      setCalculatedCreateMessage({
        type: "error",
        text:
          "표시할 분류를 선택해주세요.",
      });
      return;
    }

    if (
      !Number.isInteger(
        displayOrder
      ) ||
      displayOrder < 1
    ) {
      setCalculatedCreateMessage({
        type: "error",
        text:
          "표시순서는 1 이상의 정수로 입력해주세요.",
      });
      return;
    }

    if (
      !draft.numeratorMetricId ||
      !draft.denominatorMetricId
    ) {
      setCalculatedCreateMessage({
        type: "error",
        text:
          "분자 항목과 분모 항목을 모두 선택해주세요.",
      });
      return;
    }

    if (
      draft.numeratorMetricId ===
      draft.denominatorMetricId
    ) {
      setCalculatedCreateMessage({
        type: "error",
        text:
          "분자 항목과 분모 항목은 서로 달라야 합니다.",
      });
      return;
    }

    setCreatingCalculatedMetric(
      true
    );

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "admin_create_metric_v2",
          {
            p_category_id:
              draft.categoryId,
            p_name: name,
            p_unit:
              "percent",
            p_effect_sign:
              1,
            p_aggregation_type:
              "rate",
            p_numerator_metric_id:
              draft.numeratorMetricId,
            p_denominator_metric_id:
              draft.denominatorMetricId,
            p_display_order:
              displayOrder,
          }
        );

      if (error) {
        throw error;
      }

      const created =
        normalizeMetric(
          data,
          {
            id:
              `temp-rate-${Date.now()}`,
            categoryId:
              draft.categoryId,
            code: "",
            name,
            unit:
              "percent",
            effectSign: 1,
            aggregationType:
              "rate",
            numeratorMetricId:
              draft.numeratorMetricId,
            denominatorMetricId:
              draft.denominatorMetricId,
            displayOrder,
            isActive: true,
            isCustom: true,
            hasHistory: false,
            isFormulaSource: false,
            canDelete: true,
          }
        );

      setMetrics(
        (current) =>
          sortMetrics(
            [
              ...current,
              created,
            ],
            categories
          )
      );

      setSavedMetrics(
        (current) =>
          sortMetrics(
            [
              ...current,
              created,
            ],
            categories
          )
      );

      setNewCalculatedMetric(
        null
      );
      setCalculatedCreateMessage({
        type: "success",
        text:
          "자동 계산지표가 추가되었습니다.",
      });
    } catch (error) {
      setCalculatedCreateMessage({
        type: "error",
        text:
          errorText(
            error,
            "자동 계산지표 추가 중 오류가 발생했습니다."
          ),
      });
    } finally {
      setCreatingCalculatedMetric(
        false
      );
    }
  }


  return (
    <section className="overflow-hidden rounded-[22px] border border-[#E5E7EA] bg-white">
      <div className="border-b border-[#ECEEF1] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[#FFF1F4] text-[#A50034]">
              <ClipboardList
                size={15}
              />
            </div>

            <div>
              <h3 className="text-[16px] font-black text-[#292C31]">
                일실적 항목 설정
              </h3>

              <p className="mt-2 text-[11px] font-medium leading-5 text-[#7D828A]">
                실제 입력항목과 분석용 자동 계산지표를 분리해 관리합니다.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#EDF8F1] px-3 py-1.5 text-[10px] font-black text-[#287348]">
              입력항목 {activeInputMetricCount}개
            </span>

            <span className="rounded-full bg-[#F5F6F7] px-3 py-1.5 text-[10px] font-black text-[#70757D]">
              계산지표 {activeCalculatedMetricCount}개
            </span>

            <button
              type="button"
              onClick={() =>
                setShowAll(
                  (current) =>
                    !current
                )
              }
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] border border-[#DDE0E5] bg-white px-3 text-[10px] font-black text-[#666B73]"
            >
              {showAll ? (
                <EyeOff
                  size={13}
                />
              ) : (
                <Eye
                  size={13}
                />
              )}

              {showAll
                ? "사용중만 보기"
                : "전체 항목 보기"}
            </button>

            <button
              type="button"
              onClick={
                openNewCategoryRow
              }
              disabled={
                newCategory !== null
              }
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] bg-[#A50034] px-3 text-[10px] font-black text-white disabled:bg-[#D7D9DC]"
            >
              <Plus
                size={13}
              />
              분류 추가
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-[14px] border border-[#E7E9EC] bg-[#FAFAFB] px-4 py-3">
          <div className="flex items-start gap-2">
            <ShieldCheck
              size={15}
              className="mt-0.5 shrink-0 text-[#777C84]"
            />

            <p className="text-[10px] font-bold leading-5 text-[#777C84]">
              입력항목은 일실적에서 직접 저장됩니다. 성공률·전환율처럼 분자 ÷ 분모 × 100으로 계산하는 값은 아래 자동 계산지표에서 별도로 연결합니다.
            </p>
          </div>
        </div>
      </div>

      {newCategory && (
        <div className="border-b border-[#E8D8DD] bg-[#FFF9FB] px-5 py-4 sm:px-6">
          <div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_120px_90px_90px]">
            <label className="block">
              <span className="mb-1 block text-[9px] font-black text-[#8B9098]">
                새 분류명
              </span>

              <input
                autoFocus
                type="text"
                value={
                  newCategory.name
                }
                onChange={(
                  event
                ) =>
                  setNewCategory(
                    (current) =>
                      current
                        ? {
                            ...current,
                            name:
                              event.target.value,
                          }
                        : current
                  )
                }
                placeholder="분류명 입력"
                className="h-10 w-full rounded-[10px] border border-[#D7B9C2] bg-white px-3 text-[12px] font-bold text-[#2D3035] outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[9px] font-black text-[#8B9098]">
                표시순서
              </span>

              <input
                type="number"
                min={1}
                step={1}
                value={
                  newCategory.displayOrder
                }
                onChange={(
                  event
                ) =>
                  setNewCategory(
                    (current) =>
                      current
                        ? {
                            ...current,
                            displayOrder:
                              event.target.value,
                          }
                        : current
                  )
                }
                className="h-10 w-full rounded-[10px] border border-[#D7B9C2] bg-white px-3 text-center text-[12px] font-black text-[#2D3035] outline-none"
              />
            </label>

            <button
              type="button"
              onClick={
                cancelNewCategoryRow
              }
              disabled={
                creatingCategory
              }
              className="inline-flex h-10 items-center justify-center gap-1 rounded-[10px] border border-[#DDE0E5] bg-white text-[10px] font-black text-[#777C84]"
            >
              <X
                size={13}
              />
              취소
            </button>

            <button
              type="button"
              onClick={
                createCategory
              }
              disabled={
                creatingCategory
              }
              className="inline-flex h-10 items-center justify-center gap-1 rounded-[10px] bg-[#A50034] text-[10px] font-black text-white disabled:bg-[#D7D9DC]"
            >
              {creatingCategory ? (
                <LoaderCircle
                  size={13}
                  className="animate-spin"
                />
              ) : (
                <Save
                  size={13}
                />
              )}
              저장
            </button>
          </div>

          {createCategoryMessage && (
            <p
              className={[
                "mt-2 text-[10px] font-bold",
                createCategoryMessage.type ===
                "success"
                  ? "text-[#287348]"
                  : "text-[#A50034]",
              ].join(
                " "
              )}
            >
              {createCategoryMessage.text}
            </p>
          )}
        </div>
      )}

      <div className="space-y-5 bg-[#F4F5F7] p-4 sm:p-5">
        {visibleCategories.map(
          (category) => {
            const savedCategory =
              categorySavedMap.get(
                category.id
              );

            const categoryDirty =
              !sameCategory(
                category,
                savedCategory
              );

            const categorySaving =
              categorySavingId ===
              category.id;

            const categoryMessage =
              categoryMessages[
                category.id
              ];

            const expanded =
              expandedCategories[
                category.id
              ] !== false;

            const allCategoryMetrics =
              metrics.filter(
                (metric) =>
                  metric.categoryId ===
                  category.id &&
                  metric.aggregationType !==
                    "rate"
              );

            const categoryMetrics =
              allCategoryMetrics.filter(
                (metric) =>
                  showAll ||
                  metric.isActive
              );

            const newMetric =
              newMetricDrafts[
                category.id
              ];

            const createMessage =
              metricMessages[
                `new-${category.id}`
              ];

            return (
              <div
                key={
                  category.id
                }
                className={[
                  "overflow-hidden rounded-[18px] border shadow-sm",
                  category.isActive
                    ? "border-[#D7DBE0] bg-white"
                    : "border-[#E1E3E7] bg-[#FAFAFB] opacity-80",
                ].join(" ")}
              >
                <div className="border-b border-[#E7E9EC] bg-[#FCFCFD] px-5 py-4 sm:px-6">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex rounded-full bg-[#A50034] px-2.5 py-1 text-[9px] font-black text-white">분류</span>
                      <span className="text-[10px] font-bold text-[#8B9098]">아래 항목들을 묶는 상위 구분입니다.</span>
                    </div>
                    <span className="text-[10px] font-black text-[#777C84]">항목 {allCategoryMetrics.length}개</span>
                  </div>

                  <div className="grid items-end gap-2 xl:grid-cols-[44px_minmax(170px,1fr)_95px_120px_minmax(90px,1fr)_100px_92px_92px_42px]">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCategories(
                          (current) => ({
                            ...current,
                            [category.id]:
                              !expanded,
                          })
                        )
                      }
                      className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#DDE0E5] bg-white text-[#777C84]"
                    >
                      {expanded ? (
                        <ChevronUp
                          size={15}
                        />
                      ) : (
                        <ChevronDown
                          size={15}
                        />
                      )}
                    </button>

                    <label className="block">
                      <span className="mb-1 block text-[9px] font-black text-[#8B9098]">
                        분류명
                      </span>

                      <input
                        type="text"
                        value={
                          category.name
                        }
                        onChange={(
                          event
                        ) =>
                          updateCategory(
                            category.id,
                            {
                              name:
                                event.target.value,
                            }
                          )
                        }
                        disabled={
                          categorySaving
                        }
                        className="h-10 w-full rounded-[10px] border border-[#DDE0E5] bg-white px-3 text-[12px] font-bold text-[#2D3035] outline-none"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-[9px] font-black text-[#8B9098]">
                        순서
                      </span>

                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={
                          category.displayOrder
                        }
                        onChange={(
                          event
                        ) =>
                          updateCategory(
                            category.id,
                            {
                              displayOrder:
                                Number(
                                  event.target.value
                                ),
                            }
                          )
                        }
                        disabled={
                          categorySaving
                        }
                        className="h-10 w-full rounded-[10px] border border-[#DDE0E5] bg-white px-3 text-center text-[12px] font-black text-[#2D3035] outline-none"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-[9px] font-black text-[#8B9098]">
                        사용여부
                      </span>

                      <select
                        value={
                          category.isActive
                            ? "active"
                            : "inactive"
                        }
                        onChange={(
                          event
                        ) =>
                          updateCategory(
                            category.id,
                            {
                              isActive:
                                event.target.value ===
                                "active",
                            }
                          )
                        }
                        disabled={
                          categorySaving
                        }
                        className="h-10 w-full rounded-[10px] border border-[#DDE0E5] bg-white px-3 text-[12px] font-black text-[#2D3035] outline-none"
                      >
                        <option value="active">
                          사용중
                        </option>

                        <option value="inactive">
                          사용중지
                        </option>
                      </select>
                    </label>

                    <div className="min-w-0 pb-2">
                      {categoryMessage ? (
                        <p
                          className={[
                            "truncate text-[10px] font-bold",
                            categoryMessage.type ===
                            "success"
                              ? "text-[#287348]"
                              : "text-[#A50034]",
                          ].join(
                            " "
                          )}
                        >
                          {categoryMessage.text}
                        </p>
                      ) : categoryDirty ? (
                        <p className="text-[10px] font-black text-[#986219]">
                          변경됨
                        </p>
                      ) : (
                        <p className="text-[10px] font-bold text-[#A0A4AA]">
                          사용중 {allCategoryMetrics.filter((m) => m.isActive).length} / 전체 {allCategoryMetrics.length}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        openNewMetricRow(
                          category.id
                        )
                      }
                      disabled={
                        !category.isActive ||
                        Boolean(
                          newMetric
                        )
                      }
                      className="inline-flex h-10 items-center justify-center gap-1 rounded-[10px] border border-[#D3AEB9] bg-[#FFF7F9] px-2 text-[10px] font-black text-[#A50034] disabled:opacity-35"
                    >
                      <CirclePlus
                        size={13}
                      />
                      항목 추가
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        resetCategory(
                          category.id
                        )
                      }
                      disabled={
                        categorySaving ||
                        !categoryDirty
                      }
                      className="inline-flex h-10 items-center justify-center gap-1 rounded-[10px] border border-[#DDE0E5] bg-white px-2 text-[10px] font-black text-[#777C84] disabled:opacity-35"
                    >
                      <RotateCcw
                        size={13}
                      />
                      취소
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        saveCategory(
                          category
                        )
                      }
                      disabled={
                        categorySaving ||
                        !categoryDirty
                      }
                      className="inline-flex h-10 items-center justify-center gap-1 rounded-[10px] bg-[#A50034] px-2 text-[10px] font-black text-white disabled:bg-[#D7D9DC]"
                    >
                      {categorySaving ? (
                        <LoaderCircle
                          size={13}
                          className="animate-spin"
                        />
                      ) : (
                        <Save
                          size={13}
                        />
                      )}
                      저장
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        deleteCategory(
                          category
                        )
                      }
                      disabled={
                        !category.isCustom ||
                        !category.canDelete ||
                        deletingId ===
                          `category-${category.id}`
                      }
                      title={
                        !category.isCustom
                          ? "기본 분류는 삭제할 수 없습니다."
                          : !category.canDelete
                            ? "실적 또는 연결 항목이 있어 삭제할 수 없습니다."
                            : "분류 삭제"
                      }
                      className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#F0CDD4] bg-white text-[#A50034] disabled:cursor-not-allowed disabled:opacity-25"
                    >
                      {deletingId ===
                      `category-${category.id}` ? (
                        <LoaderCircle
                          size={13}
                          className="animate-spin"
                        />
                      ) : (
                        <Trash2
                          size={13}
                        />
                      )}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="bg-white px-5 py-4 sm:px-6">
                    <div className="mb-3 flex items-center justify-between rounded-[12px] border border-[#E5E7EA] bg-[#F7F8FA] px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex rounded-full border border-[#D8DBE0] bg-white px-2.5 py-1 text-[9px] font-black text-[#555A62]">항목 목록</span>
                        <span className="text-[10px] font-bold text-[#8B9098]">이 분류에 포함된 실제 일실적 입력항목입니다.</span>
                      </div>
                      <span className="text-[10px] font-black text-[#777C84]">표시 {categoryMetrics.length}개</span>
                    </div>

                    <div className="overflow-x-auto rounded-[12px] border border-[#E5E7EA]">
                      <table className="w-full min-w-[1120px] table-fixed bg-white">
                        <thead className="bg-[#FAFAFB]">
                          <tr className="text-left text-[9px] font-black text-[#8B9098]">
                            <th className="w-[185px] px-2 py-2">
                              항목명
                            </th>
                            <th className="w-[115px] px-2 py-2">
                              집계방식
                            </th>
                            <th className="w-[100px] px-2 py-2">
                              단위
                            </th>
                            <th className="w-[125px] px-2 py-2">
                              증감방향
                            </th>
                            <th className="w-[85px] px-2 py-2">
                              순서
                            </th>
                            <th className="w-[110px] px-2 py-2">
                              사용여부
                            </th>
                            <th className="px-2 py-2">
                              상태
                            </th>
                            <th className="w-[165px] px-2 py-2 text-right">
                              관리
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {categoryMetrics.map(
                            (metric) => {
                              const saved =
                                metricSavedMap.get(
                                  metric.id
                                );

                              const dirty =
                                !sameMetric(
                                  metric,
                                  saved
                                );

                              const saving =
                                metricSavingId ===
                                metric.id;

                              const message =
                                metricMessages[
                                  metric.id
                                ];

                              const sourceOptions =
                                getRateSourceOptions(
                                  metric.id,
                                  [
                                    metric.numeratorMetricId,
                                    metric.denominatorMetricId,
                                  ]
                                );

                              return (
                                <Fragment
                                  key={
                                    metric.id
                                  }
                                >
                                  <tr
                                    className={[
                                      "border-t border-[#ECEEF1]",
                                      metric.isActive
                                        ? ""
                                        : "bg-[#F7F8F9]",
                                    ].join(
                                      " "
                                    )}
                                  >
                                    <td className="px-2 py-2">
                                      <input
                                        type="text"
                                        value={
                                          metric.name
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          updateMetric(
                                            metric.id,
                                            {
                                              name:
                                                event.target.value,
                                            }
                                          )
                                        }
                                        disabled={
                                          saving
                                        }
                                        className="h-9 w-full rounded-[9px] border border-[#DDE0E5] bg-white px-3 text-[11px] font-bold text-[#2D3035] outline-none"
                                      />
                                    </td>

                                    <td className="px-2 py-2">
                                      <select
                                        value={
                                          metric.aggregationType
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          updateMetricAggregation(
                                            metric.id,
                                            event.target.value ===
                                            "average"
                                              ? "average"
                                              : "sum"
                                          )
                                        }
                                        disabled={
                                          saving
                                        }
                                        className="h-9 w-full rounded-[9px] border border-[#DDE0E5] bg-white px-2 text-[11px] font-bold text-[#2D3035] outline-none disabled:bg-[#F5F6F7]"
                                      >
                                        <option value="sum">
                                          합계
                                        </option>
                                        <option value="average">
                                          평균
                                        </option>
                                      </select>
                                    </td>

                                    <td className="px-2 py-2">
                                      <select
                                        value={
                                          metric.unit
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          updateMetric(
                                            metric.id,
                                            {
                                              unit:
                                                event.target.value ===
                                                "amount"
                                                  ? "amount"
                                                  : "count",
                                            }
                                          )
                                        }
                                        disabled={
                                          saving ||
                                          metric.aggregationType ===
                                            "rate"
                                        }
                                        className="h-9 w-full rounded-[9px] border border-[#DDE0E5] bg-white px-2 text-[11px] font-bold text-[#2D3035] outline-none disabled:bg-[#F5F6F7]"
                                      >
                                        {metric.aggregationType ===
                                        "rate" ? (
                                          <option value="percent">
                                            %
                                          </option>
                                        ) : (
                                          <>
                                            <option value="count">
                                              건수
                                            </option>
                                            <option value="amount">
                                              금액
                                            </option>
                                          </>
                                        )}
                                      </select>
                                    </td>

                                    <td className="px-2 py-2">
                                      <select
                                        value={
                                          metric.aggregationType ===
                                          "rate"
                                            ? "auto"
                                            : String(
                                                metric.effectSign
                                              )
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          updateMetric(
                                            metric.id,
                                            {
                                              effectSign:
                                                event.target.value ===
                                                "-1"
                                                  ? -1
                                                  : 1,
                                            }
                                          )
                                        }
                                        disabled={
                                          saving ||
                                          metric.aggregationType ===
                                            "rate"
                                        }
                                        className="h-9 w-full rounded-[9px] border border-[#DDE0E5] bg-white px-2 text-[11px] font-bold text-[#2D3035] outline-none disabled:bg-[#F5F6F7]"
                                      >
                                        {metric.aggregationType ===
                                        "rate" ? (
                                          <option value="auto">
                                            자동계산
                                          </option>
                                        ) : (
                                          <>
                                            <option value="1">
                                              일반 (+)
                                            </option>
                                            <option value="-1">
                                              취소/차감 (-)
                                            </option>
                                          </>
                                        )}
                                      </select>
                                    </td>

                                    <td className="px-2 py-2">
                                      <input
                                        type="number"
                                        min={1}
                                        step={1}
                                        value={
                                          metric.displayOrder
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          updateMetric(
                                            metric.id,
                                            {
                                              displayOrder:
                                                Number(
                                                  event.target.value
                                                ),
                                            }
                                          )
                                        }
                                        disabled={
                                          saving
                                        }
                                        className="h-9 w-full rounded-[9px] border border-[#DDE0E5] bg-white px-2 text-center text-[11px] font-black text-[#2D3035] outline-none"
                                      />
                                    </td>

                                    <td className="px-2 py-2">
                                      <select
                                        value={
                                          metric.isActive
                                            ? "active"
                                            : "inactive"
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          updateMetric(
                                            metric.id,
                                            {
                                              isActive:
                                                event.target.value ===
                                                "active",
                                            }
                                          )
                                        }
                                        disabled={
                                          saving ||
                                          !category.isActive
                                        }
                                        className="h-9 w-full rounded-[9px] border border-[#DDE0E5] bg-white px-2 text-[11px] font-black text-[#2D3035] outline-none disabled:bg-[#F5F6F7]"
                                      >
                                        <option value="active">
                                          사용중
                                        </option>
                                        <option value="inactive">
                                          사용중지
                                        </option>
                                      </select>
                                    </td>

                                    <td className="px-2 py-2">
                                      {message ? (
                                        <p
                                          className={[
                                            "text-[9px] font-bold",
                                            message.type ===
                                            "success"
                                              ? "text-[#287348]"
                                              : "text-[#A50034]",
                                          ].join(
                                            " "
                                          )}
                                        >
                                          {message.text}
                                        </p>
                                      ) : dirty ? (
                                        <span className="text-[9px] font-black text-[#986219]">
                                          변경됨
                                        </span>
                                      ) : (
                                        <div className="flex flex-wrap gap-1">
                                          <span className="text-[9px] font-bold text-[#A0A4AA]">
                                            {aggregationLabel(
                                              metric.aggregationType
                                            )}
                                          </span>

                                          {metric.hasHistory && (
                                            <span className="rounded-full bg-[#F1F2F4] px-1.5 py-0.5 text-[8px] font-black text-[#737880]">
                                              실적연결
                                            </span>
                                          )}

                                          {metric.isFormulaSource && (
                                            <span className="rounded-full bg-[#FFF4E8] px-1.5 py-0.5 text-[8px] font-black text-[#A46819]">
                                              성공률기준
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </td>

                                    <td className="px-2 py-2">
                                      <div className="flex justify-end gap-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            resetMetric(
                                              metric.id
                                            )
                                          }
                                          disabled={
                                            saving ||
                                            !dirty
                                          }
                                          title="변경 취소"
                                          className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#DDE0E5] bg-white text-[#777C84] disabled:opacity-35"
                                        >
                                          <RotateCcw
                                            size={12}
                                          />
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            saveMetric(
                                              metric
                                            )
                                          }
                                          disabled={
                                            saving ||
                                            !dirty
                                          }
                                          className="inline-flex h-8 min-w-[70px] items-center justify-center gap-1 rounded-[8px] bg-[#A50034] px-2 text-[9px] font-black text-white disabled:bg-[#D7D9DC]"
                                        >
                                          {saving ? (
                                            <LoaderCircle
                                              size={12}
                                              className="animate-spin"
                                            />
                                          ) : (
                                            <Save
                                              size={12}
                                            />
                                          )}
                                          저장
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            deleteMetric(
                                              metric
                                            )
                                          }
                                          disabled={
                                            !metric.isCustom ||
                                            !metric.canDelete ||
                                            deletingId ===
                                              `metric-${metric.id}`
                                          }
                                          title={
                                            !metric.isCustom
                                              ? "기본 항목은 삭제할 수 없습니다."
                                              : !metric.canDelete
                                                ? "실적 또는 성공률 계산 연결이 있어 삭제할 수 없습니다."
                                                : "항목 삭제"
                                          }
                                          className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#F0CDD4] bg-white text-[#A50034] disabled:cursor-not-allowed disabled:opacity-25"
                                        >
                                          {deletingId ===
                                          `metric-${metric.id}` ? (
                                            <LoaderCircle
                                              size={12}
                                              className="animate-spin"
                                            />
                                          ) : (
                                            <Trash2
                                              size={12}
                                            />
                                          )}
                                        </button>
                                      </div>
                                    </td>
                                  </tr>

                                  {metric.aggregationType ===
                                    "rate" && (
                                    <tr className="border-t border-[#F0E4E7] bg-[#FFF9FB]">
                                      <td
                                        colSpan={8}
                                        className="px-4 py-3"
                                      >
                                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)_minmax(220px,1fr)] lg:items-end">
                                          <label>
                                            <span className="mb-1 block text-[9px] font-black text-[#8B9098]">
                                              성공항목 · 분자
                                            </span>

                                            <select
                                              value={
                                                metric.numeratorMetricId ??
                                                ""
                                              }
                                              onChange={(
                                                event
                                              ) =>
                                                updateMetric(
                                                  metric.id,
                                                  {
                                                    numeratorMetricId:
                                                      event.target.value ||
                                                      null,
                                                  }
                                                )
                                              }
                                              disabled={
                                                saving
                                              }
                                              className="h-9 w-full rounded-[9px] border border-[#D7B9C2] bg-white px-2 text-[10px] font-bold text-[#2D3035] outline-none disabled:bg-[#F5F6F7]"
                                            >
                                              <option value="">
                                                선택
                                              </option>

                                              {sourceOptions.map(
                                                (
                                                  source
                                                ) => (
                                                  <option
                                                    key={
                                                      source.id
                                                    }
                                                    value={
                                                      source.id
                                                    }
                                                  >
                                                    {source.name}
                                                  </option>
                                                )
                                              )}
                                            </select>
                                          </label>

                                          <div className="pb-2 text-center text-[12px] font-black text-[#8B9098]">
                                            ÷
                                          </div>

                                          <label>
                                            <span className="mb-1 block text-[9px] font-black text-[#8B9098]">
                                              기준항목 · 분모
                                            </span>

                                            <select
                                              value={
                                                metric.denominatorMetricId ??
                                                ""
                                              }
                                              onChange={(
                                                event
                                              ) =>
                                                updateMetric(
                                                  metric.id,
                                                  {
                                                    denominatorMetricId:
                                                      event.target.value ||
                                                      null,
                                                  }
                                                )
                                              }
                                              disabled={
                                                saving
                                              }
                                              className="h-9 w-full rounded-[9px] border border-[#D7B9C2] bg-white px-2 text-[10px] font-bold text-[#2D3035] outline-none disabled:bg-[#F5F6F7]"
                                            >
                                              <option value="">
                                                선택
                                              </option>

                                              {sourceOptions.map(
                                                (
                                                  source
                                                ) => (
                                                  <option
                                                    key={
                                                      source.id
                                                    }
                                                    value={
                                                      source.id
                                                    }
                                                  >
                                                    {source.name}
                                                  </option>
                                                )
                                              )}
                                            </select>
                                          </label>

                                          <p className="pb-2 text-[9px] font-bold leading-4 text-[#8B9098]">
                                            분석에서 (성공항목 합계 ÷ 기준항목 합계) × 100으로 계산합니다.
                                          </p>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              );
                            }
                          )}

                          {newMetric && (
                            <Fragment>
                              <tr className="border-t border-[#DDBBC5] bg-[#FFF9FB]">
                                <td className="px-2 py-3">
                                  <input
                                    autoFocus
                                    type="text"
                                    value={
                                      newMetric.name
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      updateNewMetricDraft(
                                        category.id,
                                        {
                                          name:
                                            event.target.value,
                                        }
                                      )
                                    }
                                    placeholder="새 항목명"
                                    className="h-9 w-full rounded-[9px] border border-[#D7B9C2] bg-white px-3 text-[11px] font-bold text-[#2D3035] outline-none"
                                  />
                                </td>

                                <td className="px-2 py-3">
                                  <select
                                    value={
                                      newMetric.aggregationType
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      updateNewMetricAggregation(
                                        category.id,
                                        event.target.value ===
                                        "average"
                                          ? "average"
                                          : "sum"
                                      )
                                    }
                                    className="h-9 w-full rounded-[9px] border border-[#D7B9C2] bg-white px-2 text-[11px] font-bold text-[#2D3035] outline-none"
                                  >
                                    <option value="sum">
                                      합계
                                    </option>
                                    <option value="average">
                                      평균
                                    </option>
                                  </select>
                                </td>

                                <td className="px-2 py-3">
                                  <select
                                    value={
                                      newMetric.unit
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      updateNewMetricDraft(
                                        category.id,
                                        {
                                          unit:
                                            event.target.value ===
                                            "amount"
                                              ? "amount"
                                              : "count",
                                        }
                                      )
                                    }
                                    disabled={
                                      newMetric.aggregationType ===
                                      "rate"
                                    }
                                    className="h-9 w-full rounded-[9px] border border-[#D7B9C2] bg-white px-2 text-[11px] font-bold text-[#2D3035] outline-none disabled:bg-[#F5F6F7]"
                                  >
                                    {newMetric.aggregationType ===
                                    "rate" ? (
                                      <option value="percent">
                                        %
                                      </option>
                                    ) : (
                                      <>
                                        <option value="count">
                                          건수
                                        </option>
                                        <option value="amount">
                                          금액
                                        </option>
                                      </>
                                    )}
                                  </select>
                                </td>

                                <td className="px-2 py-3">
                                  <select
                                    value={
                                      newMetric.aggregationType ===
                                      "rate"
                                        ? "auto"
                                        : String(
                                            newMetric.effectSign
                                          )
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      updateNewMetricDraft(
                                        category.id,
                                        {
                                          effectSign:
                                            event.target.value ===
                                            "-1"
                                              ? -1
                                              : 1,
                                        }
                                      )
                                    }
                                    disabled={
                                      newMetric.aggregationType ===
                                      "rate"
                                    }
                                    className="h-9 w-full rounded-[9px] border border-[#D7B9C2] bg-white px-2 text-[11px] font-bold text-[#2D3035] outline-none disabled:bg-[#F5F6F7]"
                                  >
                                    {newMetric.aggregationType ===
                                    "rate" ? (
                                      <option value="auto">
                                        자동계산
                                      </option>
                                    ) : (
                                      <>
                                        <option value="1">
                                          일반 (+)
                                        </option>
                                        <option value="-1">
                                          취소/차감 (-)
                                        </option>
                                      </>
                                    )}
                                  </select>
                                </td>

                                <td className="px-2 py-3">
                                  <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={
                                      newMetric.displayOrder
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      updateNewMetricDraft(
                                        category.id,
                                        {
                                          displayOrder:
                                            event.target.value,
                                        }
                                      )
                                    }
                                    className="h-9 w-full rounded-[9px] border border-[#D7B9C2] bg-white px-2 text-center text-[11px] font-black text-[#2D3035] outline-none"
                                  />
                                </td>

                                <td className="px-2 py-3">
                                  <span className="inline-flex h-8 items-center rounded-full bg-[#EDF8F1] px-3 text-[9px] font-black text-[#287348]">
                                    신규 · 사용중
                                  </span>
                                </td>

                                <td className="px-2 py-3">
                                  {createMessage ? (
                                    <p
                                      className={[
                                        "text-[9px] font-bold",
                                        createMessage.type ===
                                        "success"
                                          ? "text-[#287348]"
                                          : "text-[#A50034]",
                                      ].join(
                                        " "
                                      )}
                                    >
                                      {createMessage.text}
                                    </p>
                                  ) : (
                                    <span className="text-[9px] font-black text-[#A50034]">
                                      신규 입력
                                    </span>
                                  )}
                                </td>

                                <td className="px-2 py-3">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        cancelNewMetricRow(
                                          category.id
                                        )
                                      }
                                      disabled={
                                        creatingMetricCategoryId ===
                                        category.id
                                      }
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#DDE0E5] bg-white text-[#777C84]"
                                    >
                                      <X
                                        size={12}
                                      />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        createMetric(
                                          category
                                        )
                                      }
                                      disabled={
                                        creatingMetricCategoryId ===
                                        category.id
                                      }
                                      className="inline-flex h-8 min-w-[78px] items-center justify-center gap-1 rounded-[8px] bg-[#A50034] px-2 text-[9px] font-black text-white disabled:bg-[#D7D9DC]"
                                    >
                                      {creatingMetricCategoryId ===
                                      category.id ? (
                                        <LoaderCircle
                                          size={12}
                                          className="animate-spin"
                                        />
                                      ) : (
                                        <Save
                                          size={12}
                                        />
                                      )}
                                      저장
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {newMetric.aggregationType ===
                                "rate" && (
                                <tr className="border-t border-[#F0E4E7] bg-[#FFF9FB]">
                                  <td
                                    colSpan={8}
                                    className="px-4 py-3"
                                  >
                                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)_minmax(220px,1fr)] lg:items-end">
                                      <label>
                                        <span className="mb-1 block text-[9px] font-black text-[#8B9098]">
                                          성공항목 · 분자
                                        </span>

                                        <select
                                          value={
                                            newMetric.numeratorMetricId ??
                                            ""
                                          }
                                          onChange={(
                                            event
                                          ) =>
                                            updateNewMetricDraft(
                                              category.id,
                                              {
                                                numeratorMetricId:
                                                  event.target.value ||
                                                  null,
                                              }
                                            )
                                          }
                                          className="h-9 w-full rounded-[9px] border border-[#D7B9C2] bg-white px-2 text-[10px] font-bold text-[#2D3035] outline-none"
                                        >
                                          <option value="">
                                            선택
                                          </option>

                                          {getRateSourceOptions(
                                            null
                                          ).map(
                                            (
                                              source
                                            ) => (
                                              <option
                                                key={
                                                  source.id
                                                }
                                                value={
                                                  source.id
                                                }
                                              >
                                                {source.name}
                                              </option>
                                            )
                                          )}
                                        </select>
                                      </label>

                                      <div className="pb-2 text-center text-[12px] font-black text-[#8B9098]">
                                        ÷
                                      </div>

                                      <label>
                                        <span className="mb-1 block text-[9px] font-black text-[#8B9098]">
                                          기준항목 · 분모
                                        </span>

                                        <select
                                          value={
                                            newMetric.denominatorMetricId ??
                                            ""
                                          }
                                          onChange={(
                                            event
                                          ) =>
                                            updateNewMetricDraft(
                                              category.id,
                                              {
                                                denominatorMetricId:
                                                  event.target.value ||
                                                  null,
                                              }
                                            )
                                          }
                                          className="h-9 w-full rounded-[9px] border border-[#D7B9C2] bg-white px-2 text-[10px] font-bold text-[#2D3035] outline-none"
                                        >
                                          <option value="">
                                            선택
                                          </option>

                                          {getRateSourceOptions(
                                            null
                                          ).map(
                                            (
                                              source
                                            ) => (
                                              <option
                                                key={
                                                  source.id
                                                }
                                                value={
                                                  source.id
                                                }
                                              >
                                                {source.name}
                                              </option>
                                            )
                                          )}
                                        </select>
                                      </label>

                                      <p className="pb-2 text-[9px] font-bold leading-4 text-[#8B9098]">
                                        성공률은 직접 입력하지 않고 분석에서 자동 계산됩니다.
                                      </p>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {categoryMetrics.length ===
                      0 &&
                      !newMetric && (
                      <div className="py-7 text-center">
                        <p className="text-[10px] font-bold text-[#9A9EA5]">
                          {showAll
                            ? "등록된 항목이 없습니다."
                            : "현재 사용중인 항목이 없습니다. 전체 항목 보기 또는 항목 추가를 이용하세요."}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          }
        )}
      </div>

      <div className="border-t border-[#E5E7EA] bg-white px-5 py-5 sm:px-6">
        <div className="rounded-[18px] border border-[#E3D5DA] bg-[#FFF9FB] p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-[#A50034] shadow-sm">
                <Percent size={16} />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-[14px] font-black text-[#292C31]">
                    자동 계산지표
                  </h4>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-[#A50034]">
                    분석 전용
                  </span>
                </div>
                <p className="mt-1.5 text-[10px] font-bold leading-5 text-[#7D828A]">
                  실제 입력값을 저장하지 않고, 선택한 두 건수 항목의 월 누계를 기준으로 분자 ÷ 분모 × 100을 자동 계산합니다.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={
                openNewCalculatedMetricRow
              }
              disabled={
                newCalculatedMetric !==
                null
              }
              className="inline-flex h-9 items-center justify-center gap-1.5 self-start rounded-[9px] bg-[#A50034] px-3 text-[10px] font-black text-white disabled:bg-[#D7D9DC]"
            >
              <CirclePlus size={13} />
              계산지표 추가
            </button>
          </div>

          {calculatedCreateMessage &&
            !newCalculatedMetric && (
            <p
              className={[
                "mt-3 text-[10px] font-bold",
                calculatedCreateMessage.type ===
                "success"
                  ? "text-[#287348]"
                  : "text-[#A50034]",
              ].join(" ")}
            >
              {calculatedCreateMessage.text}
            </p>
          )}

          {newCalculatedMetric && (
            <div className="mt-4 rounded-[14px] border border-[#D9BAC3] bg-white p-3.5">
              <div className="grid gap-3 xl:grid-cols-[minmax(140px,1.1fr)_minmax(130px,0.9fr)_minmax(150px,1fr)_28px_minmax(150px,1fr)_85px_82px_82px] xl:items-end">
                <label>
                  <span className="mb-1 block text-[9px] font-black text-[#8B9098]">
                    계산지표명
                  </span>
                  <input
                    autoFocus
                    type="text"
                    value={
                      newCalculatedMetric.name
                    }
                    onChange={(event) =>
                      updateNewCalculatedMetric({
                        name:
                          event.target.value,
                      })
                    }
                    placeholder="예: 상담 성공률"
                    className="h-9 w-full rounded-[9px] border border-[#DDE0E5] bg-white px-3 text-[10px] font-bold text-[#2D3035] outline-none"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-[9px] font-black text-[#8B9098]">
                    표시 분류
                  </span>
                  <select
                    value={
                      newCalculatedMetric.categoryId
                    }
                    onChange={(event) => {
                      const categoryId =
                        event.target.value;
                      updateNewCalculatedMetric({
                        categoryId,
                        displayOrder:
                          String(
                            getNextMetricOrder(
                              categoryId
                            )
                          ),
                      });
                    }}
                    className="h-9 w-full rounded-[9px] border border-[#DDE0E5] bg-white px-2 text-[10px] font-bold text-[#2D3035] outline-none"
                  >
                    {categories
                      .filter(
                        (category) =>
                          category.isActive
                      )
                      .map(
                        (category) => (
                          <option
                            key={category.id}
                            value={category.id}
                          >
                            {category.name}
                          </option>
                        )
                      )}
                  </select>
                </label>

                <label>
                  <span className="mb-1 block text-[9px] font-black text-[#8B9098]">
                    분자 항목
                  </span>
                  <select
                    value={
                      newCalculatedMetric.numeratorMetricId ??
                      ""
                    }
                    onChange={(event) =>
                      updateNewCalculatedMetric({
                        numeratorMetricId:
                          event.target.value ||
                          null,
                      })
                    }
                    className="h-9 w-full rounded-[9px] border border-[#DDE0E5] bg-white px-2 text-[10px] font-bold text-[#2D3035] outline-none"
                  >
                    <option value="">
                      선택
                    </option>
                    {getRateSourceOptions(
                      null,
                      [
                        newCalculatedMetric.numeratorMetricId,
                        newCalculatedMetric.denominatorMetricId,
                      ]
                    ).map(
                      (source) => (
                        <option
                          key={source.id}
                          value={source.id}
                        >
                          {sourceMetricLabel(
                            source
                          )}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <div className="pb-2 text-center text-[12px] font-black text-[#8B9098]">
                  ÷
                </div>

                <label>
                  <span className="mb-1 block text-[9px] font-black text-[#8B9098]">
                    분모 항목
                  </span>
                  <select
                    value={
                      newCalculatedMetric.denominatorMetricId ??
                      ""
                    }
                    onChange={(event) =>
                      updateNewCalculatedMetric({
                        denominatorMetricId:
                          event.target.value ||
                          null,
                      })
                    }
                    className="h-9 w-full rounded-[9px] border border-[#DDE0E5] bg-white px-2 text-[10px] font-bold text-[#2D3035] outline-none"
                  >
                    <option value="">
                      선택
                    </option>
                    {getRateSourceOptions(
                      null,
                      [
                        newCalculatedMetric.numeratorMetricId,
                        newCalculatedMetric.denominatorMetricId,
                      ]
                    ).map(
                      (source) => (
                        <option
                          key={source.id}
                          value={source.id}
                        >
                          {sourceMetricLabel(
                            source
                          )}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  <span className="mb-1 block text-[9px] font-black text-[#8B9098]">
                    순서
                  </span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={
                      newCalculatedMetric.displayOrder
                    }
                    onChange={(event) =>
                      updateNewCalculatedMetric({
                        displayOrder:
                          event.target.value,
                      })
                    }
                    className="h-9 w-full rounded-[9px] border border-[#DDE0E5] bg-white px-2 text-center text-[10px] font-black text-[#2D3035] outline-none"
                  />
                </label>

                <button
                  type="button"
                  onClick={
                    cancelNewCalculatedMetricRow
                  }
                  disabled={
                    creatingCalculatedMetric
                  }
                  className="inline-flex h-9 items-center justify-center gap-1 rounded-[9px] border border-[#DDE0E5] bg-white px-2 text-[9px] font-black text-[#777C84]"
                >
                  <X size={12} />
                  취소
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void createCalculatedMetric()
                  }
                  disabled={
                    creatingCalculatedMetric
                  }
                  className="inline-flex h-9 items-center justify-center gap-1 rounded-[9px] bg-[#A50034] px-2 text-[9px] font-black text-white disabled:bg-[#D7D9DC]"
                >
                  {creatingCalculatedMetric ? (
                    <LoaderCircle
                      size={12}
                      className="animate-spin"
                    />
                  ) : (
                    <Save size={12} />
                  )}
                  저장
                </button>
              </div>

              {calculatedCreateMessage && (
                <p className="mt-2 text-[9px] font-bold text-[#A50034]">
                  {calculatedCreateMessage.text}
                </p>
              )}
            </div>
          )}

          <div className="mt-4 overflow-x-auto rounded-[12px] border border-[#E5E7EA] bg-white">
            <table className="w-full min-w-[1120px] table-fixed">
              <thead className="bg-[#FAFAFB]">
                <tr className="text-left text-[9px] font-black text-[#8B9098]">
                  <th className="w-[160px] px-2 py-2">지표명</th>
                  <th className="w-[135px] px-2 py-2">표시 분류</th>
                  <th className="w-[220px] px-2 py-2">분자</th>
                  <th className="w-[220px] px-2 py-2">분모</th>
                  <th className="w-[85px] px-2 py-2">순서</th>
                  <th className="w-[105px] px-2 py-2">사용여부</th>
                  <th className="px-2 py-2">계산방식</th>
                  <th className="w-[165px] px-2 py-2 text-right">관리</th>
                </tr>
              </thead>

              <tbody>
                {visibleCalculatedMetrics.map(
                  (metric) => {
                    const saved =
                      metricSavedMap.get(
                        metric.id
                      );
                    const dirty =
                      !sameMetric(
                        metric,
                        saved
                      );
                    const saving =
                      metricSavingId ===
                      metric.id;
                    const message =
                      metricMessages[
                        metric.id
                      ];
                    const sourceOptions =
                      getRateSourceOptions(
                        metric.id,
                        [
                          metric.numeratorMetricId,
                          metric.denominatorMetricId,
                        ]
                      );

                    return (
                      <tr
                        key={metric.id}
                        className={[
                          "border-t border-[#ECEEF1]",
                          metric.isActive
                            ? ""
                            : "bg-[#F7F8F9]",
                        ].join(" ")}
                      >
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={metric.name}
                            onChange={(event) =>
                              updateMetric(
                                metric.id,
                                {
                                  name:
                                    event.target.value,
                                }
                              )
                            }
                            disabled={saving}
                            className="h-9 w-full rounded-[9px] border border-[#DDE0E5] bg-white px-3 text-[10px] font-bold text-[#2D3035] outline-none"
                          />
                        </td>

                        <td className="px-2 py-2">
                          <select
                            value={
                              metric.categoryId
                            }
                            onChange={(event) =>
                              updateMetric(
                                metric.id,
                                {
                                  categoryId:
                                    event.target.value,
                                }
                              )
                            }
                            disabled={saving}
                            className="h-9 w-full rounded-[9px] border border-[#DDE0E5] bg-white px-2 text-[10px] font-bold text-[#2D3035] outline-none"
                          >
                            {categories
                              .filter(
                                (category) =>
                                  category.isActive ||
                                  category.id ===
                                    metric.categoryId
                              )
                              .map(
                                (category) => (
                                  <option
                                    key={category.id}
                                    value={category.id}
                                  >
                                    {category.name}
                                  </option>
                                )
                              )}
                          </select>
                        </td>

                        <td className="px-2 py-2">
                          <select
                            value={
                              metric.numeratorMetricId ??
                              ""
                            }
                            onChange={(event) =>
                              updateMetric(
                                metric.id,
                                {
                                  numeratorMetricId:
                                    event.target.value ||
                                    null,
                                }
                              )
                            }
                            disabled={saving}
                            className="h-9 w-full rounded-[9px] border border-[#DDE0E5] bg-white px-2 text-[10px] font-bold text-[#2D3035] outline-none"
                          >
                            <option value="">선택</option>
                            {sourceOptions.map(
                              (source) => (
                                <option
                                  key={source.id}
                                  value={source.id}
                                >
                                  {sourceMetricLabel(
                                    source
                                  )}
                                </option>
                              )
                            )}
                          </select>
                        </td>

                        <td className="px-2 py-2">
                          <select
                            value={
                              metric.denominatorMetricId ??
                              ""
                            }
                            onChange={(event) =>
                              updateMetric(
                                metric.id,
                                {
                                  denominatorMetricId:
                                    event.target.value ||
                                    null,
                                }
                              )
                            }
                            disabled={saving}
                            className="h-9 w-full rounded-[9px] border border-[#DDE0E5] bg-white px-2 text-[10px] font-bold text-[#2D3035] outline-none"
                          >
                            <option value="">선택</option>
                            {sourceOptions.map(
                              (source) => (
                                <option
                                  key={source.id}
                                  value={source.id}
                                >
                                  {sourceMetricLabel(
                                    source
                                  )}
                                </option>
                              )
                            )}
                          </select>
                        </td>

                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={
                              metric.displayOrder
                            }
                            onChange={(event) =>
                              updateMetric(
                                metric.id,
                                {
                                  displayOrder:
                                    Number(
                                      event.target.value
                                    ),
                                }
                              )
                            }
                            disabled={saving}
                            className="h-9 w-full rounded-[9px] border border-[#DDE0E5] bg-white px-2 text-center text-[10px] font-black text-[#2D3035] outline-none"
                          />
                        </td>

                        <td className="px-2 py-2">
                          <select
                            value={
                              metric.isActive
                                ? "active"
                                : "inactive"
                            }
                            onChange={(event) =>
                              updateMetric(
                                metric.id,
                                {
                                  isActive:
                                    event.target.value ===
                                    "active",
                                }
                              )
                            }
                            disabled={saving}
                            className="h-9 w-full rounded-[9px] border border-[#DDE0E5] bg-white px-2 text-[10px] font-bold text-[#2D3035] outline-none"
                          >
                            <option value="active">사용중</option>
                            <option value="inactive">사용중지</option>
                          </select>
                        </td>

                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-[#FFF1F4] px-2.5 py-1 text-[9px] font-black text-[#A50034]">
                              자동 %
                            </span>
                            <span className="text-[9px] font-bold text-[#8B9098]">
                              분자 ÷ 분모 × 100
                            </span>
                          </div>
                          {message && (
                            <p
                              className={[
                                "mt-1 text-[9px] font-bold",
                                message.type ===
                                "success"
                                  ? "text-[#287348]"
                                  : "text-[#A50034]",
                              ].join(" ")}
                            >
                              {message.text}
                            </p>
                          )}
                        </td>

                        <td className="px-2 py-2">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                resetMetric(
                                  metric.id
                                )
                              }
                              disabled={
                                saving ||
                                !dirty
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#DDE0E5] bg-white text-[#777C84] disabled:opacity-30"
                              title="변경 취소"
                            >
                              <RotateCcw size={12} />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void saveMetric(
                                  metric
                                )
                              }
                              disabled={
                                saving ||
                                !dirty
                              }
                              className="inline-flex h-8 min-w-[58px] items-center justify-center gap-1 rounded-[8px] bg-[#A50034] px-2 text-[9px] font-black text-white disabled:bg-[#D7D9DC]"
                            >
                              {saving ? (
                                <LoaderCircle
                                  size={12}
                                  className="animate-spin"
                                />
                              ) : (
                                <Save size={12} />
                              )}
                              저장
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void deleteMetric(
                                  metric
                                )
                              }
                              disabled={
                                !metric.isCustom ||
                                !metric.canDelete ||
                                deletingId ===
                                  `metric-${metric.id}`
                              }
                              title={
                                !metric.isCustom
                                  ? "기본 계산지표는 삭제할 수 없습니다."
                                  : !metric.canDelete
                                    ? "연결 상태를 확인해주세요."
                                    : "계산지표 삭제"
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#F0CDD4] bg-white text-[#A50034] disabled:cursor-not-allowed disabled:opacity-25"
                            >
                              {deletingId ===
                              `metric-${metric.id}` ? (
                                <LoaderCircle
                                  size={12}
                                  className="animate-spin"
                                />
                              ) : (
                                <Trash2 size={12} />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>

            {visibleCalculatedMetrics.length ===
              0 &&
              !newCalculatedMetric && (
              <div className="px-5 py-8 text-center">
                <p className="text-[10px] font-bold text-[#9A9EA5]">
                  등록된 자동 계산지표가 없습니다. 필요할 때 추가하면 분석 화면에서 자동 계산됩니다.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-[#ECEEF1] bg-[#FCFCFD] px-5 py-4 sm:px-6">
        <p className="text-[10px] font-bold leading-5 text-[#8B9098]">
          ※ 실제 입력항목은 실적 이력이 생기면 삭제하지 않고 사용중지합니다. 자동 계산지표는 입력값을 저장하지 않으며 분석 시 연결된 분자·분모의 누계로 계산합니다.
        </p>
      </div>
    </section>
  );
}
