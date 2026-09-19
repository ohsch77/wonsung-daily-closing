"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";

import {
  createClient,
} from "@/lib/supabase/client";


export type ExpenseCategorySettingsRow = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  hasHistory: boolean;
  canDelete: boolean;
};


type Props = {
  initialCategories:
    ExpenseCategorySettingsRow[];
};


type Message = {
  type:
    | "success"
    | "error";
  text: string;
};


type NewCategoryDraft = {
  name: string;
  sortOrder: string;
};


function sortRows(
  rows:
    ExpenseCategorySettingsRow[]
) {
  return [
    ...rows,
  ].sort(
    (a, b) =>
      a.sortOrder -
        b.sortOrder ||
      a.name.localeCompare(
        b.name,
        "ko"
      )
  );
}


function sameRow(
  a:
    ExpenseCategorySettingsRow,
  b:
    | ExpenseCategorySettingsRow
    | undefined
) {
  return Boolean(
    b &&
    a.name === b.name &&
    a.sortOrder ===
      b.sortOrder &&
    a.isActive ===
      b.isActive
  );
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


function normalizeRow(
  value: unknown,
  fallback:
    ExpenseCategorySettingsRow
): ExpenseCategorySettingsRow {
  const row =
    asRecord(value);

  const rawOrder =
    Number(
      row.sort_order
    );

  return {
    id:
      String(
        row.id ??
          fallback.id
      ),

    name:
      String(
        row.name ??
          fallback.name
      ),

    sortOrder:
      Number.isInteger(
        rawOrder
      ) &&
      rawOrder >= 1
        ? rawOrder
        : fallback.sortOrder,

    isActive:
      row.is_active !==
      false,

    hasHistory:
      typeof row.has_history ===
      "boolean"
        ? row.has_history
        : fallback.hasHistory,

    canDelete:
      typeof row.can_delete ===
      "boolean"
        ? row.can_delete
        : fallback.canDelete,
  };
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


export default function ExpenseCategorySettingsPanel({
  initialCategories,
}: Props) {
  const supabase =
    useMemo(
      () => createClient(),
      []
    );

  const initialRows =
    useMemo(
      () =>
        sortRows(
          initialCategories
        ),
      [initialCategories]
    );

  const [
    rows,
    setRows,
  ] =
    useState(
      initialRows
    );

  const [
    savedRows,
    setSavedRows,
  ] =
    useState(
      initialRows
    );

  const [
    showAll,
    setShowAll,
  ] =
    useState(false);

  const [
    newCategory,
    setNewCategory,
  ] =
    useState<
      NewCategoryDraft | null
    >(null);

  const [
    creating,
    setCreating,
  ] =
    useState(false);

  const [
    savingId,
    setSavingId,
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
    messages,
    setMessages,
  ] =
    useState<
      Record<
        string,
        Message
      >
    >({});

  const [
    createMessage,
    setCreateMessage,
  ] =
    useState<Message | null>(
      null
    );


  const savedMap =
    useMemo(
      () =>
        new Map(
          savedRows.map(
            (row) => [
              row.id,
              row,
            ]
          )
        ),
      [savedRows]
    );


  const visibleRows =
    useMemo(
      () =>
        rows.filter(
          (row) =>
            showAll ||
            row.isActive
        ),
      [
        rows,
        showAll,
      ]
    );


  const activeCount =
    rows.filter(
      (row) =>
        row.isActive
    ).length;


  const nextSortOrder =
    useMemo(
      () =>
        Math.max(
          0,
          ...rows.map(
            (row) =>
              Number(
                row.sortOrder
              ) || 0
          )
        ) + 10,
      [rows]
    );


  function openNewRow() {
    setNewCategory({
      name: "",
      sortOrder:
        String(
          nextSortOrder
        ),
    });

    setCreateMessage(
      null
    );
  }


  function cancelNewRow() {
    if (creating) {
      return;
    }

    setNewCategory(
      null
    );

    setCreateMessage(
      null
    );
  }


  function updateRow(
    id: string,
    patch:
      Partial<
        ExpenseCategorySettingsRow
      >
  ) {
    setRows(
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

    setMessages(
      (current) => {
        if (!current[id]) {
          return current;
        }

        const next = {
          ...current,
        };

        delete next[id];

        return next;
      }
    );
  }


  function resetRow(
    id: string
  ) {
    const saved =
      savedMap.get(id);

    if (!saved) {
      return;
    }

    setRows(
      (current) =>
        sortRows(
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

    setMessages(
      (current) => {
        const next = {
          ...current,
        };

        delete next[id];

        return next;
      }
    );
  }


  async function createCategory() {
    if (!newCategory) {
      return;
    }

    const name =
      newCategory.name.trim();

    const sortOrder =
      Number(
        newCategory.sortOrder
      );

    if (!name) {
      setCreateMessage({
        type: "error",
        text:
          "경비분류명을 입력해주세요.",
      });

      return;
    }

    if (
      !Number.isInteger(
        sortOrder
      ) ||
      sortOrder < 1
    ) {
      setCreateMessage({
        type: "error",
        text:
          "표시순서는 1 이상의 정수로 입력해주세요.",
      });

      return;
    }

    setCreating(true);
    setCreateMessage(null);

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "admin_create_sales_cash_expense_category",
          {
            p_name: name,
            p_sort_order:
              sortOrder,
          }
        );

      if (error) {
        throw error;
      }

      const created =
        normalizeRow(
          data,
          {
            id:
              `temp-${Date.now()}`,
            name,
            sortOrder,
            isActive: true,
            hasHistory:
              false,
            canDelete:
              true,
          }
        );

      setRows(
        (current) =>
          sortRows([
            ...current,
            created,
          ])
      );

      setSavedRows(
        (current) =>
          sortRows([
            ...current,
            created,
          ])
      );

      setNewCategory(
        null
      );

      setCreateMessage({
        type: "success",
        text:
          "경비분류가 추가되었습니다.",
      });
    } catch (
      error
    ) {
      setCreateMessage({
        type: "error",
        text:
          errorText(
            error,
            "경비분류 추가 중 오류가 발생했습니다."
          ),
      });
    } finally {
      setCreating(false);
    }
  }


  async function saveRow(
    row:
      ExpenseCategorySettingsRow
  ) {
    const name =
      row.name.trim();

    if (!name) {
      setMessages(
        (current) => ({
          ...current,
          [row.id]: {
            type:
              "error",
            text:
              "경비분류명을 입력해주세요.",
          },
        })
      );

      return;
    }

    if (
      !Number.isInteger(
        row.sortOrder
      ) ||
      row.sortOrder < 1
    ) {
      setMessages(
        (current) => ({
          ...current,
          [row.id]: {
            type:
              "error",
            text:
              "표시순서는 1 이상의 정수로 입력해주세요.",
          },
        })
      );

      return;
    }

    setSavingId(
      row.id
    );

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "admin_update_sales_cash_expense_category",
          {
            p_category_id:
              row.id,
            p_name:
              name,
            p_sort_order:
              row.sortOrder,
            p_is_active:
              row.isActive,
          }
        );

      if (error) {
        throw error;
      }

      const updated =
        normalizeRow(
          data,
          {
            ...row,
            name,
          }
        );

      setRows(
        (current) =>
          sortRows(
            current.map(
              (item) =>
                item.id ===
                row.id
                  ? updated
                  : item
            )
          )
      );

      setSavedRows(
        (current) =>
          sortRows(
            current.map(
              (item) =>
                item.id ===
                row.id
                  ? updated
                  : item
            )
          )
      );

      setMessages(
        (current) => ({
          ...current,
          [row.id]: {
            type:
              "success",
            text:
              "저장되었습니다.",
          },
        })
      );
    } catch (
      error
    ) {
      setMessages(
        (current) => ({
          ...current,
          [row.id]: {
            type:
              "error",
            text:
              errorText(
                error,
                "경비분류 저장 중 오류가 발생했습니다."
              ),
          },
        })
      );
    } finally {
      setSavingId(
        null
      );
    }
  }


  async function deleteRow(
    row:
      ExpenseCategorySettingsRow
  ) {
    if (!row.canDelete) {
      return;
    }

    const confirmed =
      window.confirm(
        `'${row.name}' 경비분류를 삭제하시겠습니까?\n\n아직 매장 경비에 한 번도 사용되지 않은 분류만 삭제됩니다.`
      );

    if (!confirmed) {
      return;
    }

    setDeletingId(
      row.id
    );

    try {
      const {
        error,
      } =
        await supabase.rpc(
          "admin_delete_sales_cash_expense_category",
          {
            p_category_id:
              row.id,
          }
        );

      if (error) {
        throw error;
      }

      setRows(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              row.id
          )
      );

      setSavedRows(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              row.id
          )
      );
    } catch (
      error
    ) {
      setMessages(
        (current) => ({
          ...current,
          [row.id]: {
            type:
              "error",
            text:
              errorText(
                error,
                "경비분류를 삭제하지 못했습니다."
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


  return (
    <section className="overflow-hidden rounded-[22px] border border-[#E5E7EA] bg-white">
      <div className="border-b border-[#ECEEF1] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[#FFF1F4] text-[#A50034]">
              <WalletCards
                size={15}
              />
            </div>

            <div>
              <h3 className="text-[16px] font-black text-[#292C31]">
                매장 경비분류 설정
              </h3>

              <p className="mt-2 text-[11px] font-medium leading-5 text-[#7D828A]">
                판매시재의 매장 경비 입력에서 사용할 분류명, 표시순서와 사용여부를 관리합니다.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#EDF8F1] px-3 py-1.5 text-[10px] font-black text-[#287348]">
              사용중 {activeCount}개
            </span>

            <span className="rounded-full bg-[#F5F6F7] px-3 py-1.5 text-[10px] font-black text-[#70757D]">
              전체 {rows.length}개
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
                : "전체 분류 보기"}
            </button>

            <button
              type="button"
              onClick={
                openNewRow
              }
              disabled={
                newCategory !==
                null
              }
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] bg-[#A50034] px-3 text-[10px] font-black text-white disabled:bg-[#D7D9DC]"
            >
              <Plus
                size={13}
              />
              경비분류 추가
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
              이미 매장 경비에 사용된 분류는 과거 기록 보존을 위해 삭제하지 않고 사용중지로 관리합니다. 아직 사용되지 않은 잘못 등록한 분류만 삭제할 수 있습니다.
            </p>
          </div>
        </div>

        {createMessage &&
          !newCategory && (
          <p
            className={[
              "mt-3 text-[10px] font-bold",
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
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] table-fixed">
          <thead>
            <tr className="bg-[#FAFAFB] text-left text-[10px] font-black text-[#7B8088]">
              <th className="w-[260px] border-b border-[#ECEEF1] px-5 py-3 sm:px-6">
                경비분류명
              </th>

              <th className="w-[130px] border-b border-[#ECEEF1] px-4 py-3">
                표시순서
              </th>

              <th className="w-[140px] border-b border-[#ECEEF1] px-4 py-3">
                사용여부
              </th>

              <th className="border-b border-[#ECEEF1] px-4 py-3">
                상태
              </th>

              <th className="w-[185px] border-b border-[#ECEEF1] px-5 py-3 text-right sm:px-6">
                관리
              </th>
            </tr>
          </thead>

          <tbody>
            {newCategory && (
              <tr className="border-b border-[#E8D8DD] bg-[#FFF9FB]">
                <td className="px-5 py-3 sm:px-6">
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
                    disabled={
                      creating
                    }
                    placeholder="새 경비분류명"
                    className="h-10 w-full rounded-[10px] border border-[#D7B9C2] bg-white px-3 text-[12px] font-bold text-[#2D3035] outline-none"
                  />
                </td>

                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={
                      newCategory.sortOrder
                    }
                    onChange={(
                      event
                    ) =>
                      setNewCategory(
                        (current) =>
                          current
                            ? {
                                ...current,
                                sortOrder:
                                  event.target.value,
                              }
                            : current
                      )
                    }
                    disabled={
                      creating
                    }
                    className="h-10 w-full rounded-[10px] border border-[#D7B9C2] bg-white px-3 text-center text-[12px] font-black text-[#2D3035] outline-none"
                  />
                </td>

                <td className="px-4 py-3">
                  <span className="inline-flex h-8 items-center rounded-full bg-[#EDF8F1] px-3 text-[10px] font-black text-[#287348]">
                    신규 · 사용중
                  </span>
                </td>

                <td className="px-4 py-3">
                  {createMessage ? (
                    <span
                      className={[
                        "text-[10px] font-bold",
                        createMessage.type ===
                        "success"
                          ? "text-[#287348]"
                          : "text-[#A50034]",
                      ].join(
                        " "
                      )}
                    >
                      {createMessage.text}
                    </span>
                  ) : (
                    <span className="text-[10px] font-black text-[#A50034]">
                      신규 입력
                    </span>
                  )}
                </td>

                <td className="px-5 py-3 sm:px-6">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={
                        cancelNewRow
                      }
                      disabled={
                        creating
                      }
                      className="inline-flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#DDE0E5] bg-white text-[#777C84]"
                      title="추가 취소"
                    >
                      <X
                        size={14}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={
                        createCategory
                      }
                      disabled={
                        creating
                      }
                      className="inline-flex h-9 min-w-[88px] items-center justify-center gap-1.5 rounded-[9px] bg-[#A50034] px-3 text-[11px] font-black text-white disabled:bg-[#D7D9DC]"
                    >
                      {creating ? (
                        <LoaderCircle
                          size={14}
                          className="animate-spin"
                        />
                      ) : (
                        <Save
                          size={14}
                        />
                      )}
                      저장
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {visibleRows.map(
              (row) => {
                const saved =
                  savedMap.get(
                    row.id
                  );

                const dirty =
                  !sameRow(
                    row,
                    saved
                  );

                const saving =
                  savingId ===
                  row.id;

                const deleting =
                  deletingId ===
                  row.id;

                const message =
                  messages[
                    row.id
                  ];

                return (
                  <tr
                    key={
                      row.id
                    }
                    className={[
                      "border-b border-[#F0F1F3] last:border-b-0",
                      row.isActive
                        ? "bg-white"
                        : "bg-[#FAFAFB]",
                    ].join(
                      " "
                    )}
                  >
                    <td className="px-5 py-3 sm:px-6">
                      <input
                        type="text"
                        value={
                          row.name
                        }
                        onChange={(
                          event
                        ) =>
                          updateRow(
                            row.id,
                            {
                              name:
                                event.target.value,
                            }
                          )
                        }
                        disabled={
                          saving ||
                          deleting
                        }
                        className="h-10 w-full rounded-[10px] border border-[#DDE0E5] bg-white px-3 text-[12px] font-bold text-[#2D3035] outline-none"
                      />
                    </td>

                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={
                          row.sortOrder
                        }
                        onChange={(
                          event
                        ) =>
                          updateRow(
                            row.id,
                            {
                              sortOrder:
                                Number(
                                  event.target.value
                                ),
                            }
                          )
                        }
                        disabled={
                          saving ||
                          deleting
                        }
                        className="h-10 w-full rounded-[10px] border border-[#DDE0E5] bg-white px-3 text-center text-[12px] font-black tabular-nums text-[#2D3035] outline-none"
                      />
                    </td>

                    <td className="px-4 py-3">
                      <select
                        value={
                          row.isActive
                            ? "active"
                            : "inactive"
                        }
                        onChange={(
                          event
                        ) =>
                          updateRow(
                            row.id,
                            {
                              isActive:
                                event.target.value ===
                                "active",
                            }
                          )
                        }
                        disabled={
                          saving ||
                          deleting
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
                    </td>

                    <td className="px-4 py-3">
                      {message ? (
                        <div
                          className={[
                            "flex items-center gap-1.5 text-[10px] font-bold",
                            message.type ===
                            "success"
                              ? "text-[#287348]"
                              : "text-[#A50034]",
                          ].join(
                            " "
                          )}
                        >
                          {message.type ===
                            "success" && (
                            <Check
                              size={13}
                            />
                          )}

                          {message.text}
                        </div>
                      ) : dirty ? (
                        <span className="text-[10px] font-black text-[#986219]">
                          변경됨
                        </span>
                      ) : row.hasHistory ? (
                        <span className="rounded-full bg-[#F1F2F4] px-2 py-1 text-[9px] font-black text-[#737880]">
                          경비사용 이력 있음
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-[#A0A4AA]">
                          미사용
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3 sm:px-6">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            resetRow(
                              row.id
                            )
                          }
                          disabled={
                            saving ||
                            deleting ||
                            !dirty
                          }
                          className="inline-flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#DDE0E5] bg-white text-[#777C84] disabled:opacity-35"
                          title="변경 취소"
                        >
                          <RotateCcw
                            size={14}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            saveRow(
                              row
                            )
                          }
                          disabled={
                            saving ||
                            deleting ||
                            !dirty
                          }
                          className="inline-flex h-9 min-w-[82px] items-center justify-center gap-1.5 rounded-[9px] bg-[#A50034] px-3 text-[11px] font-black text-white disabled:bg-[#D7D9DC]"
                        >
                          {saving ? (
                            <LoaderCircle
                              size={14}
                              className="animate-spin"
                            />
                          ) : (
                            <Save
                              size={14}
                            />
                          )}
                          저장
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            deleteRow(
                              row
                            )
                          }
                          disabled={
                            !row.canDelete ||
                            saving ||
                            deleting
                          }
                          title={
                            row.canDelete
                              ? "경비분류 삭제"
                              : "이미 경비에 사용되어 삭제할 수 없습니다."
                          }
                          className="inline-flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#F0CDD4] bg-white text-[#A50034] disabled:cursor-not-allowed disabled:opacity-25"
                        >
                          {deleting ? (
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
                    </td>
                  </tr>
                );
              }
            )}

            {visibleRows.length ===
              0 &&
              !newCategory && (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-10 text-center text-[11px] font-bold text-[#9A9EA5]"
                >
                  {showAll
                    ? "등록된 경비분류가 없습니다."
                    : "현재 사용중인 경비분류가 없습니다. 전체 분류 보기 또는 경비분류 추가를 이용하세요."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[#ECEEF1] bg-[#FCFCFD] px-5 py-4 sm:px-6">
        <p className="text-[10px] font-bold leading-5 text-[#8B9098]">
          ※ 사용중지한 분류는 판매시재의 새 경비 입력 선택목록에서 제외되며, 과거 경비내역의 분류 연결은 유지됩니다.
        </p>
      </div>
    </section>
  );
}
