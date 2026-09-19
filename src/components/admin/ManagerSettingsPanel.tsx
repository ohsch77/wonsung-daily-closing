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
  UserRoundCheck,
  X,
} from "lucide-react";

import {
  createClient,
} from "@/lib/supabase/client";


export type ManagerSettingsRow = {
  id: string;
  employeeNo: string;
  name: string;
  role:
    | "admin"
    | "manager";
  isActive: boolean;
  displayOrder: number;
  hasLoginAccount: boolean;
};


type Props = {
  initialManagers:
    ManagerSettingsRow[];
};


type RowMessage = {
  type:
    | "success"
    | "error";
  text: string;
};


type NewManagerDraft = {
  employeeNo: string;
  name: string;
  role:
    | "admin"
    | "manager";
  isActive: boolean;
  displayOrder: string;
};


function sortManagers(
  rows: ManagerSettingsRow[]
) {
  return [
    ...rows,
  ].sort(
    (a, b) => {
      const orderDiff =
        a.displayOrder -
        b.displayOrder;

      if (
        orderDiff !== 0
      ) {
        return orderDiff;
      }

      return a.name.localeCompare(
        b.name,
        "ko"
      );
    }
  );
}


function sameRow(
  a: ManagerSettingsRow,
  b:
    | ManagerSettingsRow
    | undefined
) {
  if (!b) {
    return false;
  }

  return (
    a.name === b.name &&
    a.role === b.role &&
    a.isActive ===
      b.isActive &&
    a.displayOrder ===
      b.displayOrder
  );
}


function normalizeResult(
  value: unknown,
  fallback:
    ManagerSettingsRow
): ManagerSettingsRow {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return fallback;
  }

  const row =
    value as Record<
      string,
      unknown
    >;

  const rawOrder =
    Number(
      row.display_order
    );

  return {
    id:
      String(
        row.id ??
          fallback.id
      ),

    employeeNo:
      String(
        row.employee_no ??
          fallback.employeeNo
      ),

    name:
      String(
        row.name ??
          fallback.name
      ),

    role:
      row.role ===
      "admin"
        ? "admin"
        : "manager",

    isActive:
      row.is_active !==
      false,

    displayOrder:
      Number.isFinite(
        rawOrder
      ) &&
      rawOrder >= 1
        ? rawOrder
        : fallback.displayOrder,

    hasLoginAccount:
      typeof row.has_login_account ===
      "boolean"
        ? row.has_login_account
        : fallback.hasLoginAccount,
  };
}


function getErrorMessage(
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


export default function ManagerSettingsPanel({
  initialManagers,
}: Props) {
  const supabase =
    useMemo(
      () => createClient(),
      []
    );

  const initialSorted =
    useMemo(
      () =>
        sortManagers(
          initialManagers
        ),
      [initialManagers]
    );

  const [
    rows,
    setRows,
  ] =
    useState<
      ManagerSettingsRow[]
    >(
      initialSorted
    );

  const [
    savedRows,
    setSavedRows,
  ] =
    useState<
      ManagerSettingsRow[]
    >(
      initialSorted
    );

  const [
    savingId,
    setSavingId,
  ] =
    useState<string | null>(
      null
    );

  const [
    rowMessages,
    setRowMessages,
  ] =
    useState<
      Record<
        string,
        RowMessage
      >
    >({});

  const [
    showAll,
    setShowAll,
  ] =
    useState(false);

  const [
    newManager,
    setNewManager,
  ] =
    useState<
      NewManagerDraft | null
    >(null);

  const [
    creatingManager,
    setCreatingManager,
  ] =
    useState(false);

  const [
    createMessage,
    setCreateMessage,
  ] =
    useState<
      RowMessage | null
    >(null);


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


  const activeCount =
    rows.filter(
      (row) =>
        row.isActive
    ).length;


  const visibleRows =
    useMemo(
      () =>
        rows.filter(
          (row) =>
            showAll ||
            row.isActive ||
            savedMap.get(
              row.id
            )?.isActive ===
              true
        ),
      [
        rows,
        showAll,
        savedMap,
      ]
    );


  const nextDisplayOrder =
    useMemo(
      () =>
        Math.max(
          0,
          ...rows.map(
            (row) =>
              Number(
                row.displayOrder
              ) || 0
          )
        ) + 10,
      [rows]
    );


  function openNewManagerRow() {
    setNewManager({
      employeeNo: "",
      name: "",
      role: "manager",
      isActive: true,
      displayOrder:
        String(
          nextDisplayOrder
        ),
    });

    setCreateMessage(
      null
    );
  }


  function cancelNewManagerRow() {
    if (
      creatingManager
    ) {
      return;
    }

    setNewManager(
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
        ManagerSettingsRow
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

    setRowMessages(
      (current) => {
        if (
          !current[id]
        ) {
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
        current.map(
          (row) =>
            row.id === id
              ? {
                  ...saved,
                }
              : row
        )
    );

    setRowMessages(
      (current) => {
        const next = {
          ...current,
        };

        delete next[id];

        return next;
      }
    );
  }


  async function createManager() {
    if (!newManager) {
      return;
    }

    const employeeNo =
      newManager.employeeNo.trim();

    const name =
      newManager.name.trim();

    const displayOrder =
      Number(
        newManager.displayOrder
      );

    if (!employeeNo) {
      setCreateMessage({
        type: "error",
        text:
          "사번을 입력해주세요.",
      });

      return;
    }

    if (!name) {
      setCreateMessage({
        type: "error",
        text:
          "이름을 입력해주세요.",
      });

      return;
    }

    if (
      !Number.isInteger(
        displayOrder
      ) ||
      displayOrder < 1
    ) {
      setCreateMessage({
        type: "error",
        text:
          "표시순서는 1 이상의 정수로 입력해주세요.",
      });

      return;
    }

    setCreatingManager(
      true
    );

    setCreateMessage(
      null
    );

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "admin_create_manager",
          {
            p_employee_no:
              employeeNo,
            p_name:
              name,
            p_role:
              newManager.role,
            p_is_active:
              newManager.isActive,
            p_display_order:
              displayOrder,
          }
        );

      if (error) {
        throw error;
      }

      const created =
        normalizeResult(
          data,
          {
            id:
              `temp-${Date.now()}`,
            employeeNo,
            name,
            role:
              newManager.role,
            isActive:
              newManager.isActive,
            displayOrder,
            hasLoginAccount:
              false,
          }
        );

      setRows(
        (current) =>
          sortManagers([
            ...current,
            created,
          ])
      );

      setSavedRows(
        (current) =>
          sortManagers([
            ...current,
            created,
          ])
      );

      setNewManager(
        null
      );

      setCreateMessage({
        type: "success",
        text:
          "매니저가 추가되었습니다.",
      });
    } catch (
      error
    ) {
      setCreateMessage({
        type: "error",
        text:
          getErrorMessage(
            error,
            "매니저 추가 중 오류가 발생했습니다."
          ),
      });
    } finally {
      setCreatingManager(
        false
      );
    }
  }


  async function saveRow(
    row:
      ManagerSettingsRow
  ) {
    const name =
      row.name.trim();

    if (!name) {
      setRowMessages(
        (current) => ({
          ...current,
          [row.id]: {
            type:
              "error",
            text:
              "이름을 입력해주세요.",
          },
        })
      );

      return;
    }

    const displayOrder =
      Number(
        row.displayOrder
      );

    if (
      !Number.isInteger(
        displayOrder
      ) ||
      displayOrder < 1
    ) {
      setRowMessages(
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

    setRowMessages(
      (current) => {
        const next = {
          ...current,
        };

        delete next[
          row.id
        ];

        return next;
      }
    );

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "admin_update_manager",
          {
            p_manager_id:
              row.id,

            p_name:
              name,

            p_role:
              row.role,

            p_is_active:
              row.isActive,

            p_display_order:
              displayOrder,
          }
        );

      if (error) {
        throw error;
      }

      const updated =
        normalizeResult(
          data,
          {
            ...row,
            name,
            displayOrder,
          }
        );

      setRows(
        (current) =>
          sortManagers(
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
          sortManagers(
            current.map(
              (item) =>
                item.id ===
                row.id
                  ? updated
                  : item
            )
          )
      );

      setRowMessages(
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
      console.error(
        "매니저 설정 저장 오류:",
        error
      );

      setRowMessages(
        (current) => ({
          ...current,
          [row.id]: {
            type:
              "error",
            text:
              getErrorMessage(
                error,
                "매니저 설정 저장 중 오류가 발생했습니다."
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


  return (
    <section className="overflow-hidden rounded-[22px] border border-[#E5E7EA] bg-white">
      <div className="border-b border-[#ECEEF1] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <UserRoundCheck
                size={17}
                className="text-[#A50034]"
              />

              <h3 className="text-[16px] font-black text-[#292C31]">
                매니저 설정
              </h3>
            </div>

            <p className="mt-2 text-[11px] font-medium leading-5 text-[#7D828A]">
              기존 매니저의 이름·권한·표시순서·사용여부를 관리하고, 필요한 경우 새 매니저 기준정보를 추가합니다.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#F5F6F7] px-3 py-1.5 text-[10px] font-black text-[#70757D]">
              전체 {rows.length}명
            </span>

            <span className="rounded-full bg-[#EDF8F1] px-3 py-1.5 text-[10px] font-black text-[#287348]">
              사용중 {activeCount}명
            </span>

            <button
              type="button"
              onClick={() =>
                setShowAll(
                  (current) =>
                    !current
                )
              }
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] border border-[#DDE0E5] bg-white px-3 text-[10px] font-black text-[#666B73] transition hover:bg-[#F7F8F9]"
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
                : "전체보기"}
            </button>

            <button
              type="button"
              onClick={
                openNewManagerRow
              }
              disabled={
                newManager !==
                null
              }
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] bg-[#A50034] px-3 text-[10px] font-black text-white transition hover:bg-[#8C002C] disabled:cursor-not-allowed disabled:bg-[#D7D9DC]"
            >
              <Plus
                size={13}
              />
              매니저 추가
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
              사용중지한 매니저는 과거 실적과 판매시재 기록에는 그대로 남고 새로운 입력 목록에서만 제외됩니다. 새 매니저 추가는 기준정보만 등록하며 로그인 계정은 별도로 연결합니다.
            </p>
          </div>
        </div>

        {createMessage && !newManager && (
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
        <table className="w-full min-w-[1030px] table-fixed">
          <thead>
            <tr className="bg-[#FAFAFB] text-left text-[10px] font-black text-[#7B8088]">
              <th className="w-[120px] border-b border-[#ECEEF1] px-5 py-3 sm:px-6">
                사번
              </th>
              <th className="w-[180px] border-b border-[#ECEEF1] px-4 py-3">
                이름
              </th>
              <th className="w-[145px] border-b border-[#ECEEF1] px-4 py-3">
                권한
              </th>
              <th className="w-[115px] border-b border-[#ECEEF1] px-4 py-3">
                표시순서
              </th>
              <th className="w-[135px] border-b border-[#ECEEF1] px-4 py-3">
                사용여부
              </th>
              <th className="w-[135px] border-b border-[#ECEEF1] px-4 py-3">
                로그인
              </th>
              <th className="border-b border-[#ECEEF1] px-4 py-3">
                상태
              </th>
              <th className="w-[150px] border-b border-[#ECEEF1] px-5 py-3 text-right sm:px-6">
                관리
              </th>
            </tr>
          </thead>

          <tbody>
            {newManager && (
              <tr className="border-b border-[#E8D8DD] bg-[#FFF9FB]">
                <td className="px-5 py-3 sm:px-6">
                  <input
                    autoFocus
                    type="text"
                    value={
                      newManager.employeeNo
                    }
                    onChange={(
                      event
                    ) =>
                      setNewManager(
                        (current) =>
                          current
                            ? {
                                ...current,
                                employeeNo:
                                  event.target.value,
                              }
                            : current
                      )
                    }
                    disabled={
                      creatingManager
                    }
                    placeholder="사번"
                    className="h-10 w-full rounded-[10px] border border-[#D7B9C2] bg-white px-3 text-[12px] font-bold text-[#2D3035] outline-none"
                  />
                </td>

                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={
                      newManager.name
                    }
                    onChange={(
                      event
                    ) =>
                      setNewManager(
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
                      creatingManager
                    }
                    placeholder="이름"
                    className="h-10 w-full rounded-[10px] border border-[#D7B9C2] bg-white px-3 text-[12px] font-bold text-[#2D3035] outline-none"
                  />
                </td>

                <td className="px-4 py-3">
                  <select
                    value={
                      newManager.role
                    }
                    onChange={(
                      event
                    ) =>
                      setNewManager(
                        (current) =>
                          current
                            ? {
                                ...current,
                                role:
                                  event.target.value ===
                                  "admin"
                                    ? "admin"
                                    : "manager",
                              }
                            : current
                      )
                    }
                    disabled={
                      creatingManager
                    }
                    className="h-10 w-full rounded-[10px] border border-[#D7B9C2] bg-white px-3 text-[12px] font-bold text-[#2D3035] outline-none"
                  >
                    <option value="manager">
                      매니저
                    </option>
                    <option value="admin">
                      관리자
                    </option>
                  </select>
                </td>

                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={
                      newManager.displayOrder
                    }
                    onChange={(
                      event
                    ) =>
                      setNewManager(
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
                    disabled={
                      creatingManager
                    }
                    className="h-10 w-full rounded-[10px] border border-[#D7B9C2] bg-white px-3 text-center text-[12px] font-black text-[#2D3035] outline-none"
                  />
                </td>

                <td className="px-4 py-3">
                  <select
                    value={
                      newManager.isActive
                        ? "active"
                        : "inactive"
                    }
                    onChange={(
                      event
                    ) =>
                      setNewManager(
                        (current) =>
                          current
                            ? {
                                ...current,
                                isActive:
                                  event.target.value ===
                                  "active",
                              }
                            : current
                      )
                    }
                    disabled={
                      creatingManager
                    }
                    className="h-10 w-full rounded-[10px] border border-[#D7B9C2] bg-white px-3 text-[12px] font-black text-[#2D3035] outline-none"
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
                  <span className="inline-flex h-8 items-center rounded-full bg-[#F5F6F7] px-3 text-[10px] font-black text-[#7D828A]">
                    미연결
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
                        cancelNewManagerRow
                      }
                      disabled={
                        creatingManager
                      }
                      className="inline-flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#DDE0E5] bg-white text-[#777C84] disabled:opacity-35"
                      title="추가 취소"
                    >
                      <X
                        size={14}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={
                        createManager
                      }
                      disabled={
                        creatingManager
                      }
                      className="inline-flex h-9 min-w-[88px] items-center justify-center gap-1.5 rounded-[9px] bg-[#A50034] px-3 text-[11px] font-black text-white disabled:bg-[#D7D9DC]"
                    >
                      {creatingManager ? (
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

                const message =
                  rowMessages[
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
                      <div className="flex h-10 items-center rounded-[10px] border border-[#E3E5E8] bg-[#F7F8F9] px-3 text-[12px] font-bold text-[#777C84]">
                        {row.employeeNo ||
                          "-"}
                      </div>
                    </td>

                    <td className="px-4 py-3">
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
                          saving
                        }
                        className="h-10 w-full rounded-[10px] border border-[#DDE0E5] bg-white px-3 text-[12px] font-bold text-[#2D3035] outline-none"
                      />
                    </td>

                    <td className="px-4 py-3">
                      <select
                        value={
                          row.role
                        }
                        onChange={(
                          event
                        ) =>
                          updateRow(
                            row.id,
                            {
                              role:
                                event.target.value ===
                                "admin"
                                  ? "admin"
                                  : "manager",
                            }
                          )
                        }
                        disabled={
                          saving
                        }
                        className="h-10 w-full rounded-[10px] border border-[#DDE0E5] bg-white px-3 text-[12px] font-bold text-[#2D3035] outline-none"
                      >
                        <option value="manager">
                          매니저
                        </option>
                        <option value="admin">
                          관리자
                        </option>
                      </select>
                    </td>

                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={
                          row.displayOrder
                        }
                        onChange={(
                          event
                        ) =>
                          updateRow(
                            row.id,
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
                          saving
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
                      <span
                        className={[
                          "inline-flex h-8 items-center rounded-full px-3 text-[10px] font-black",
                          row.hasLoginAccount
                            ? "bg-[#EDF8F1] text-[#287348]"
                            : "bg-[#F5F6F7] text-[#7D828A]",
                        ].join(
                          " "
                        )}
                      >
                        {row.hasLoginAccount
                          ? "연결됨"
                          : "미연결"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {message ? (
                        <div
                          className={[
                            "flex items-center gap-1.5 text-[10px] font-bold leading-4",
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
                              className="shrink-0"
                            />
                          )}
                          <span>
                            {message.text}
                          </span>
                        </div>
                      ) : dirty ? (
                        <span className="text-[10px] font-black text-[#986219]">
                          변경됨
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-[#A0A4AA]">
                          저장됨
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
                            !dirty
                          }
                          title="변경 취소"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#DDE0E5] bg-white text-[#777C84] disabled:opacity-35"
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
                            !dirty
                          }
                          className="inline-flex h-9 min-w-[88px] items-center justify-center gap-1.5 rounded-[9px] bg-[#A50034] px-3 text-[11px] font-black text-white disabled:bg-[#D7D9DC]"
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

                          {saving
                            ? "저장중"
                            : "저장"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }
            )}

            {visibleRows.length ===
              0 &&
              !newManager && (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-10 text-center text-[11px] font-bold text-[#9A9EA5]"
                >
                  {showAll
                    ? "등록된 매니저가 없습니다."
                    : "현재 사용중인 매니저가 없습니다. 전체보기를 눌러 사용중지 매니저를 확인할 수 있습니다."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[#ECEEF1] bg-[#FCFCFD] px-5 py-4 sm:px-6">
        <p className="text-[10px] font-bold leading-5 text-[#8B9098]">
          ※ 새 매니저는 기준정보만 추가되며 로그인 계정은 미연결 상태로 생성됩니다. Supabase Auth 로그인 계정 연결은 별도 보안 단계에서 처리합니다.
        </p>
      </div>
    </section>
  );
}
