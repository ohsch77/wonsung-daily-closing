"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  Dispatch,
  SetStateAction,
} from "react";

import {
  AlertCircle,
  BanknoteArrowDown,
  BanknoteArrowUp,
  CalendarDays,
  CircleDollarSign,
  LoaderCircle,
  LockKeyhole,
  PencilLine,
  Plus,
  ReceiptText,
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


export type CashExpenseCategory = {
  id: string;
  name: string;
  isActive: boolean;
};


export type CashExpenseManager = {
  id: string;
  name: string;
};


type Props = {
  today: string;
  initialDate?: string;
  onSelectedDateChange?: (date: string) => void;
  currentManagerName: string;
  categories: CashExpenseCategory[];
  managers: CashExpenseManager[];
};


type ExpenseDraft = {
  key: string;
  id: string | null;
  categoryId: string;
  usageDetail: string;
  amount: string;
  managerName: string;
  note: string;
};


type CustomerPayoutDraft = {
  key: string;
  id: string | null;
  paymentMethod:
    | "cash"
    | "bank_transfer";
  customerName: string;
  amount: string;
  referenceNo: string;
  payoutReason: string;
};


type DailyRow = {
  id: string;
  business_date: string;
  status: string;
  opening_balance: number;
  opening_source_type: string;
  opening_source_daily_id: string | null;
  actual_balance: number | null;
  confirmed_closing_balance: number | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  edit_started_at: string | null;
  edit_started_by: string | null;
  edit_reason: string | null;
};


type OpeningSourceRow = {
  id: string;
  business_date: string;
  confirmed_closing_balance: number | null;
};


type EntryRow = {
  id: string;
  entry_type: string;
  entry_subtype: string | null;
  direction: string;
  amount: number;
  affects_cash: boolean;
  expense_category_id: string | null;
  payment_method: string | null;
  customer_name: string | null;
  reference_no: string | null;
  memo: string | null;
  manager_name: string | null;
  expense_note: string | null;
  sort_order: number | null;
};


function createExpenseKey() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}


function normalizeNumberInput(
  value: string
) {
  return value
    .replace(/[^\d]/g, "")
    .replace(/^0+(?=\d)/, "");
}


function formatNumberInput(
  value: string
) {
  if (value === "") {
    return "";
  }

  const normalized =
    value.replace(
      /^0+(?=\d)/,
      ""
    );

  return normalized.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ","
  );
}


function parseAmount(
  value: string
) {
  const normalized =
    value.replace(/,/g, "");

  if (normalized === "") {
    return null;
  }

  const result =
    Number(normalized);

  if (
    !Number.isFinite(result) ||
    result < 0
  ) {
    return null;
  }

  return Math.floor(result);
}


function formatWon(
  value: number
) {
  return `${value.toLocaleString("ko-KR")}원`;
}


function formatKstDateTime(
  value: string | null
) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(date);
}


function isManagedDayInputEntry(
  entry: EntryRow
) {
  if (
    [
      "expense",
      "customer_payout",
      "difference_compensation",
    ].includes(
      entry.entry_type
    )
  ) {
    return true;
  }

  return (
    entry.entry_type ===
      "sales_cash" &&
    [
      "cash_collection",
      "cash_refill",
      "company_deposit",
    ].includes(
      entry.entry_subtype ??
        ""
    )
  );
}


function statusText(
  status: string | null,
  hasCashCollection: boolean
) {
  if (status === "confirmed") {
    return "확정";
  }

  if (status === "editing") {
    return "수정모드";
  }

  if (hasCashCollection) {
    return "입력완료";
  }

  if (status === "draft") {
    return "작성중";
  }

  return "미입력";
}


export default function CashLedgerWorkspace({
  today,
  initialDate,
  onSelectedDateChange,
  currentManagerName,
  categories,
  managers,
}: Props) {
  const supabase =
    useMemo(
      () => createClient(),
      []
    );

  const activeCategories =
    useMemo(
      () =>
        categories.filter(
          (category) =>
            category.isActive
        ),
      [categories]
    );

  const expenseManagers =
    useMemo(
      () => {
        const seen =
          new Set<string>();

        const result =
          managers.filter(
            (manager) => {
              const name =
                manager.name.trim();

              if (
                !name ||
                seen.has(name)
              ) {
                return false;
              }

              seen.add(name);
              return true;
            }
          );

        if (
          currentManagerName.trim() &&
          !seen.has(
            currentManagerName.trim()
          )
        ) {
          result.push({
            id: "current-manager",
            name:
              currentManagerName.trim(),
          });
        }

        return result;
      },
      [
        currentManagerName,
        managers,
      ]
    );

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(
    initialDate ?? today
  );

  const [
    dailyId,
    setDailyId,
  ] = useState<string | null>(
    null
  );

  const [
    dailyStatus,
    setDailyStatus,
  ] = useState<string | null>(
    null
  );

  const [
    openingBalance,
    setOpeningBalance,
  ] = useState(0);

  const [
    openingSourceType,
    setOpeningSourceType,
  ] = useState("auto");

  const [
    openingSourceDate,
    setOpeningSourceDate,
  ] = useState<string | null>(
    null
  );

  const [
    otherCashImpact,
    setOtherCashImpact,
  ] = useState(0);

  const [
    hasCashCollection,
    setHasCashCollection,
  ] = useState(false);

  const [
    cashCollection,
    setCashCollection,
  ] = useState("");

  const [
    cashRefill,
    setCashRefill,
  ] = useState("");

  const [
    companyDeposit,
    setCompanyDeposit,
  ] = useState("");

  const [
    expenses,
    setExpenses,
  ] = useState<ExpenseDraft[]>(
    []
  );

  const [
    customerPayouts,
    setCustomerPayouts,
  ] = useState<CustomerPayoutDraft[]>(
    []
  );

  const [
    actualBalance,
    setActualBalance,
  ] = useState("");

  const [
    compensationAmount,
    setCompensationAmount,
  ] = useState("");

  const [
    confirmedClosingBalance,
    setConfirmedClosingBalance,
  ] = useState<number | null>(
    null
  );

  const [
    confirmedAt,
    setConfirmedAt,
  ] = useState<string | null>(
    null
  );

  const [
    confirmedBy,
    setConfirmedBy,
  ] = useState<string | null>(
    null
  );

  const [
    editStartedAt,
    setEditStartedAt,
  ] = useState<string | null>(
    null
  );

  const [
    editStartedBy,
    setEditStartedBy,
  ] = useState<string | null>(
    null
  );

  const [
    editReason,
    setEditReason,
  ] = useState<string | null>(
    null
  );

  const [
    actionBusy,
    setActionBusy,
  ] = useState(false);

  const [
    showEditModal,
    setShowEditModal,
  ] = useState(false);

  const [
    editReasonDraft,
    setEditReasonDraft,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    dirty,
    setDirty,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");


  const locked =
    dailyStatus ===
    "confirmed";


  const loadDay =
    useCallback(
      async (
        businessDate: string
      ) => {
        setLoading(true);
        setMessage("");
        setErrorMessage("");

        try {
          const {
            data: dailyData,
            error: dailyError,
          } =
            await supabase
              .from(
                "sales_cash_daily"
              )
              .select(
                `
                  id,
                  business_date,
                  status,
                  opening_balance,
                  opening_source_type,
                  opening_source_daily_id,
                  actual_balance,
                  confirmed_closing_balance,
                  confirmed_at,
                  confirmed_by,
                  edit_started_at,
                  edit_started_by,
                  edit_reason
                `
              )
              .eq(
                "business_date",
                businessDate
              )
              .maybeSingle();

          if (dailyError) {
            throw dailyError;
          }

          const daily =
            dailyData
              ? (
                  dailyData as DailyRow
                )
              : null;

          let resolvedOpeningBalance =
            Number(
              daily?.opening_balance ??
                0
            );
          let resolvedOpeningSourceType =
            daily?.opening_source_type ??
            "auto";
          let resolvedOpeningSourceDate:
            string | null = null;

          const shouldResolveLatestConfirmed =
            !daily ||
            (
              daily.status !==
                "confirmed" &&
              resolvedOpeningSourceType ===
                "auto"
            );

          if (
            shouldResolveLatestConfirmed
          ) {
            const {
              data: sourceData,
              error: sourceError,
            } =
              await supabase
                .from(
                  "sales_cash_daily"
                )
                .select(
                  "id,business_date,confirmed_closing_balance"
                )
                .lt(
                  "business_date",
                  businessDate
                )
                .eq(
                  "status",
                  "confirmed"
                )
                .not(
                  "confirmed_closing_balance",
                  "is",
                  null
                )
                .order(
                  "business_date",
                  {
                    ascending: false,
                  }
                )
                .limit(1)
                .maybeSingle();

            if (sourceError) {
              throw sourceError;
            }

            const source =
              sourceData
                ? (
                    sourceData as OpeningSourceRow
                  )
                : null;

            resolvedOpeningBalance =
              Number(
                source?.confirmed_closing_balance ??
                  0
              );
            resolvedOpeningSourceType =
              "auto";
            resolvedOpeningSourceDate =
              source?.business_date ??
              null;
          }
          else if (
            daily?.opening_source_daily_id
          ) {
            const {
              data: sourceData,
              error: sourceError,
            } =
              await supabase
                .from(
                  "sales_cash_daily"
                )
                .select(
                  "id,business_date,confirmed_closing_balance"
                )
                .eq(
                  "id",
                  daily.opening_source_daily_id
                )
                .maybeSingle();

            if (sourceError) {
              throw sourceError;
            }

            resolvedOpeningSourceDate =
              sourceData?.business_date ??
              null;
          }

          setOpeningBalance(
            resolvedOpeningBalance
          );
          setOpeningSourceType(
            resolvedOpeningSourceType
          );
          setOpeningSourceDate(
            resolvedOpeningSourceDate
          );

          if (!daily) {
            setDailyId(null);
            setDailyStatus(null);
            setOtherCashImpact(0);
            setHasCashCollection(false);
            setCashCollection("");
            setCashRefill("");
            setCompanyDeposit("");
            setExpenses([]);
            setCustomerPayouts([]);
            setActualBalance("");
            setCompensationAmount("");
            setConfirmedClosingBalance(null);
            setConfirmedAt(null);
            setConfirmedBy(null);
            setEditStartedAt(null);
            setEditStartedBy(null);
            setEditReason(null);
            setDirty(false);
            return;
          }

          const {
            data: entryData,
            error: entryError,
          } =
            await supabase
              .from(
                "sales_cash_entries"
              )
              .select(
                `
                  id,
                  entry_type,
                  entry_subtype,
                  direction,
                  amount,
                  affects_cash,
                  expense_category_id,
                  payment_method,
                  customer_name,
                  reference_no,
                  memo,
                  manager_name,
                  expense_note,
                  sort_order
                `
              )
              .eq(
                "daily_id",
                daily.id
              )
              .order(
                "sort_order",
                {
                  ascending: true,
                }
              )
              .order(
                "created_at",
                {
                  ascending: true,
                }
              );

          if (entryError) {
            throw entryError;
          }

          const entries =
            (
              entryData ??
              []
            ) as EntryRow[];

          const collectionEntry =
            entries.find(
              (entry) =>
                entry.entry_type ===
                  "sales_cash" &&
                entry.entry_subtype ===
                  "cash_collection"
            );

          const refillEntry =
            entries.find(
              (entry) =>
                entry.entry_type ===
                  "sales_cash" &&
                entry.entry_subtype ===
                  "cash_refill"
            );

          const depositEntry =
            entries.find(
              (entry) =>
                entry.entry_type ===
                  "sales_cash" &&
                entry.entry_subtype ===
                  "company_deposit"
            );

          const expenseRows =
            entries
              .filter(
                (entry) =>
                  entry.entry_type ===
                  "expense"
              )
              .map(
                (entry) => ({
                  key:
                    createExpenseKey(),
                  id:
                    entry.id,
                  categoryId:
                    entry.expense_category_id ??
                    "",
                  usageDetail:
                    entry.memo ??
                    "",
                  amount:
                    formatNumberInput(
                      String(
                        entry.amount ??
                        0
                      )
                    ),
                  managerName:
                    entry.manager_name ??
                    currentManagerName,
                  note:
                    entry.expense_note ??
                    "",
                })
              );

          const customerPayoutRows =
            entries
              .filter(
                (entry) =>
                  entry.entry_type ===
                  "customer_payout"
              )
              .map(
                (entry) => ({
                  key:
                    createExpenseKey(),
                  id:
                    entry.id,
                  paymentMethod:
                    entry.payment_method ===
                    "bank_transfer"
                      ? "bank_transfer" as const
                      : "cash" as const,
                  customerName:
                    entry.customer_name ??
                    "",
                  amount:
                    formatNumberInput(
                      String(
                        entry.amount ??
                        0
                      )
                    ),
                  referenceNo:
                    entry.reference_no ??
                    "",
                  payoutReason:
                    entry.memo ===
                      "고객지급 · 현금시재" ||
                    entry.memo ===
                      "고객지급 · 무통장"
                      ? ""
                      : entry.memo ??
                        "",
                })
              );

          const compensationEntry =
            entries.find(
              (entry) =>
                entry.entry_type ===
                "difference_compensation"
            );

          const persistedOtherCashImpact =
            entries.reduce(
              (sum, entry) => {
                if (
                  !entry.affects_cash ||
                  isManagedDayInputEntry(
                    entry
                  )
                ) {
                  return sum;
                }

                const amount =
                  Number(
                    entry.amount ??
                      0
                  );

                if (
                  entry.direction ===
                  "in"
                ) {
                  return (
                    sum + amount
                  );
                }

                if (
                  entry.direction ===
                  "out"
                ) {
                  return (
                    sum - amount
                  );
                }

                return sum;
              },
              0
            );

          setDailyId(
            daily.id
          );
          setDailyStatus(
            daily.status
          );
          setOtherCashImpact(
            persistedOtherCashImpact
          );
          setHasCashCollection(
            Boolean(
              collectionEntry
            )
          );
          setCashCollection(
            collectionEntry
              ? formatNumberInput(
                  String(
                    collectionEntry.amount
                  )
                )
              : ""
          );
          setCashRefill(
            refillEntry
              ? formatNumberInput(
                  String(
                    refillEntry.amount
                  )
                )
              : ""
          );
          setCompanyDeposit(
            depositEntry
              ? formatNumberInput(
                  String(
                    depositEntry.amount
                  )
                )
              : ""
          );
          setExpenses(
            expenseRows
          );
          setCustomerPayouts(
            customerPayoutRows
          );
          setActualBalance(
            daily.actual_balance ===
            null
              ? ""
              : formatNumberInput(
                  String(
                    daily.actual_balance
                  )
                )
          );
          setCompensationAmount(
            compensationEntry
              ? formatNumberInput(
                  String(
                    compensationEntry.amount
                  )
                )
              : ""
          );
          setConfirmedClosingBalance(
            daily.confirmed_closing_balance ===
            null
              ? null
              : Number(
                  daily.confirmed_closing_balance
                )
          );
          setConfirmedAt(
            daily.confirmed_at ??
            null
          );
          setConfirmedBy(
            daily.confirmed_by ??
            null
          );
          setEditStartedAt(
            daily.edit_started_at ??
            null
          );
          setEditStartedBy(
            daily.edit_started_by ??
            null
          );
          setEditReason(
            daily.edit_reason ??
            null
          );
          setDirty(false);
        }
        catch (error) {
          console.error(
            "판매시재 조회 오류:",
            error
          );

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "판매시재를 불러오지 못했습니다."
          );
        }
        finally {
          setLoading(false);
        }
      },
      [
        currentManagerName,
        supabase,
      ]
    );


  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          void loadDay(
            selectedDate
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
    loadDay,
    selectedDate,
  ]);


  const expenseTotal =
    useMemo(
      () =>
        expenses.reduce(
          (
            sum,
            expense
          ) =>
            sum +
            (
              parseAmount(
                expense.amount
              ) ??
              0
            ),
          0
        ),
      [expenses]
    );

  const customerCashPayoutTotal =
    useMemo(
      () =>
        customerPayouts.reduce(
          (
            sum,
            payout
          ) =>
            payout.paymentMethod ===
            "cash"
              ? sum +
                (
                  parseAmount(
                    payout.amount
                  ) ??
                  0
                )
              : sum,
          0
        ),
      [customerPayouts]
    );

  const customerBankPayoutTotal =
    useMemo(
      () =>
        customerPayouts.reduce(
          (
            sum,
            payout
          ) =>
            payout.paymentMethod ===
            "bank_transfer"
              ? sum +
                (
                  parseAmount(
                    payout.amount
                  ) ??
                  0
                )
              : sum,
          0
        ),
      [customerPayouts]
    );

  const cashCollectionValue =
    parseAmount(
      cashCollection
    ) ??
    0;

  const cashRefillValue =
    parseAmount(
      cashRefill
    ) ??
    0;

  const companyDepositValue =
    parseAmount(
      companyDeposit
    ) ??
    0;

  const managedDailyCashChange =
    cashCollectionValue +
    cashRefillValue -
    companyDepositValue -
    expenseTotal -
    customerCashPayoutTotal;

  const dailyCashChange =
    managedDailyCashChange +
    otherCashImpact;

  const expectedCashBalance =
    openingBalance +
    dailyCashChange;

  const actualBalanceValue =
    actualBalance ===
    ""
      ? null
      : parseAmount(
          actualBalance
        );

  const cashDifference =
    actualBalanceValue ===
    null
      ? null
      : actualBalanceValue -
        expectedCashBalance;

  const compensationValue =
    parseAmount(
      compensationAmount
    ) ??
    0;

  const compensationDirection =
    cashDifference ===
      null ||
    cashDifference ===
      0
      ? null
      : cashDifference <
          0
        ? "in"
        : "out";

  const signedCompensation =
    compensationDirection ===
    "in"
      ? compensationValue
      : compensationDirection ===
          "out"
        ? -compensationValue
        : 0;

  const reconciledCashBalance =
    actualBalanceValue ===
    null
      ? null
      : actualBalanceValue +
        signedCompensation;

  const remainingDifference =
    reconciledCashBalance ===
    null
      ? null
      : reconciledCashBalance -
        expectedCashBalance;

  useEffect(() => {
    if (
      locked ||
      cashDifference !== 0 ||
      compensationValue === 0
    ) {
      return;
    }

    const timer =
      window.setTimeout(
        () => {
          setCompensationAmount(
            "0"
          );
          setDirty(true);
          setMessage(
            "시재 차액이 0원이 되어 기존 차액보전 금액을 0원으로 초기화했습니다. 저장해주세요."
          );
          setErrorMessage("");
        },
        0
      );

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [
    cashDifference,
    compensationValue,
    locked,
  ]);

  const openingSourceCaption =
    openingSourceType ===
    "initial"
      ? "초기 시재"
      : openingSourceType ===
          "manual"
        ? "수기 지정"
        : openingSourceDate
          ? `${openingSourceDate} 확정 시재 자동이월`
          : "직전 확정 시재 없음 · 0원 적용";

  const confirmReady =
    Boolean(dailyId) &&
    hasCashCollection &&
    actualBalanceValue !== null &&
    remainingDifference === 0 &&
    expectedCashBalance >= 0 &&
    !dirty &&
    dailyStatus !== "confirmed";

  const confirmGuide =
    !dailyId
      ? "판매시재를 먼저 저장해주세요."
      : dirty
        ? "변경내용을 저장한 뒤 확정할 수 있습니다."
        : !hasCashCollection
          ? "당일 현금수금을 저장해주세요. 수금이 없으면 0원을 입력합니다."
          : actualBalanceValue === null
            ? "실금액(금고)을 입력하고 저장해주세요."
            : expectedCashBalance < 0
              ? "금고 예상 시재가 음수입니다. 입력내역을 확인해주세요."
              : remainingDifference !== 0
                ? "남은 차액을 0원으로 맞춘 뒤 저장해주세요."
                : "확정하면 입력이 잠기고 다음 영업일 전일이월 기준이 됩니다.";


  useEffect(() => {
    if (
      !initialDate ||
      initialDate === selectedDate ||
      initialDate > today
    ) {
      return;
    }

    const timer =
      window.setTimeout(
        () => {
          if (
            dirty &&
            !window.confirm(
              "저장하지 않은 판매시재 입력값이 있습니다. 월별내역에서 선택한 날짜로 이동하면 현재 수정내용이 사라집니다. 계속할까요?"
            )
          ) {
            onSelectedDateChange?.(
              selectedDate
            );
            return;
          }

          setSelectedDate(
            initialDate
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
    dirty,
    initialDate,
    onSelectedDateChange,
    selectedDate,
    today,
  ]);


  const handleDateChange =
    (
      nextDate: string
    ) => {
      if (
        !nextDate ||
        nextDate ===
          selectedDate
      ) {
        return;
      }

      if (
        dirty &&
        !window.confirm(
          "저장하지 않은 판매시재 입력값이 있습니다. 날짜를 변경하면 현재 수정내용이 사라집니다. 계속할까요?"
        )
      ) {
        return;
      }

      setSelectedDate(
        nextDate
      );
      onSelectedDateChange?.(
        nextDate
      );
    };


  const updateAmount =
    (
      value: string,
      setter:
        Dispatch<
          SetStateAction<string>
        >
    ) => {
      setter(
        formatNumberInput(
          normalizeNumberInput(
            value
          )
        )
      );
      setDirty(true);
      setMessage("");
    };


  const addExpense = () => {
    const firstCategory =
      activeCategories[0];

    if (
      !firstCategory ||
      locked
    ) {
      return;
    }

    setExpenses(
      (current) => [
        ...current,
        {
          key:
            createExpenseKey(),
          id:
            null,
          categoryId:
            firstCategory.id,
          usageDetail:
            "",
          amount:
            "",
          managerName:
            currentManagerName,
          note:
            "",
        },
      ]
    );

    setDirty(true);
    setMessage("");
  };


  const updateExpense =
    (
      key: string,
      patch:
        Partial<ExpenseDraft>
    ) => {
      setExpenses(
        (current) =>
          current.map(
            (expense) =>
              expense.key ===
              key
                ? {
                    ...expense,
                    ...patch,
                  }
                : expense
          )
      );

      setDirty(true);
      setMessage("");
    };


  const deleteExpense =
    (
      key: string
    ) => {
      if (locked) {
        return;
      }

      setExpenses(
        (current) =>
          current.filter(
            (expense) =>
              expense.key !==
              key
          )
      );

      setDirty(true);
      setMessage("");
    };


  const addCustomerPayout = () => {
    if (locked) {
      return;
    }

    setCustomerPayouts(
      (current) => [
        ...current,
        {
          key:
            createExpenseKey(),
          id:
            null,
          paymentMethod:
            "cash",
          customerName:
            "",
          amount:
            "",
          referenceNo:
            "",
          payoutReason:
            "",
        },
      ]
    );

    setDirty(true);
    setMessage("");
  };


  const updateCustomerPayout =
    (
      key: string,
      patch:
        Partial<CustomerPayoutDraft>
    ) => {
      setCustomerPayouts(
        (current) =>
          current.map(
            (payout) =>
              payout.key ===
              key
                ? {
                    ...payout,
                    ...patch,
                  }
                : payout
          )
      );

      setDirty(true);
      setMessage("");
    };


  const deleteCustomerPayout =
    (
      key: string
    ) => {
      if (locked) {
        return;
      }

      setCustomerPayouts(
        (current) =>
          current.filter(
            (payout) =>
              payout.key !==
              key
          )
      );

      setDirty(true);
      setMessage("");
    };


  const resetInput = () => {
    if (
      locked ||
      !window.confirm(
        "현재 화면에 입력한 당일 판매시재를 모두 비울까요? DB에는 저장 버튼을 누르기 전까지 반영되지 않습니다."
      )
    ) {
      return;
    }

    setCashCollection("");
    setCashRefill("");
    setCompanyDeposit("");
    setExpenses([]);
    setCustomerPayouts([]);
    setActualBalance("");
    setCompensationAmount("");
    setDirty(true);
    setMessage("");
  };


  const handleSave =
    async () => {
      if (
        saving ||
        loading ||
        locked
      ) {
        return;
      }

      const collectionAmount =
        parseAmount(
          cashCollection
        );

      if (
        collectionAmount ===
        null
      ) {
        setErrorMessage(
          "당일 현금수금은 반드시 입력해주세요. 현금수금이 없으면 0을 입력합니다."
        );
        return;
      }

      const refillAmount =
        parseAmount(
          cashRefill
        ) ??
        0;

      const depositAmount =
        parseAmount(
          companyDeposit
        ) ??
        0;

      const expensePayload =
        [] as Array<{
          category_id: string;
          usage_detail: string;
          amount: number;
          manager_name: string;
          note: string;
        }>;

      for (
        const expense of
        expenses
      ) {
        const amount =
          parseAmount(
            expense.amount
          );

        if (
          !expense.categoryId
        ) {
          setErrorMessage(
            "경비분류를 선택해주세요."
          );
          return;
        }

        if (
          !expense.usageDetail.trim()
        ) {
          setErrorMessage(
            "매장경비의 사용처/내용을 입력해주세요."
          );
          return;
        }

        if (
          amount === null ||
          amount <= 0
        ) {
          setErrorMessage(
            "경비 금액은 1원 이상 입력해주세요."
          );
          return;
        }

        if (
          !expense.managerName.trim()
        ) {
          setErrorMessage(
            "매장경비의 담당자를 선택해주세요."
          );
          return;
        }

        expensePayload.push({
          category_id:
            expense.categoryId,
          usage_detail:
            expense.usageDetail.trim(),
          amount,
          manager_name:
            expense.managerName.trim(),
          note:
            expense.note.trim(),
        });
      }

      const customerPayoutPayload =
        [] as Array<{
          payment_method:
            | "cash"
            | "bank_transfer";
          customer_name: string;
          amount: number;
          reference_no: string;
          payout_reason: string;
        }>;

      for (
        const payout of
        customerPayouts
      ) {
        const amount =
          parseAmount(
            payout.amount
          );

        if (
          !payout.customerName.trim()
        ) {
          setErrorMessage(
            "고객지급의 고객명을 입력해주세요."
          );
          return;
        }

        if (
          amount === null ||
          amount <= 0
        ) {
          setErrorMessage(
            "고객지급 금액은 1원 이상 입력해주세요."
          );
          return;
        }

        if (
          !payout.payoutReason.trim()
        ) {
          setErrorMessage(
            "고객지급의 지급사유를 입력해주세요."
          );
          return;
        }

        customerPayoutPayload.push({
          payment_method:
            payout.paymentMethod,
          customer_name:
            payout.customerName.trim(),
          amount,
          reference_no:
            payout.referenceNo.trim(),
          payout_reason:
            payout.payoutReason.trim(),
        });
      }

      const actualAmount =
        actualBalance ===
        ""
          ? null
          : parseAmount(
              actualBalance
            );

      if (
        actualBalance !==
          "" &&
        actualAmount ===
          null
      ) {
        setErrorMessage(
          "실금액(금고)을 올바르게 입력해주세요."
        );
        return;
      }

      const compensation =
        cashDifference ===
          null ||
        cashDifference ===
          0
          ? 0
          : parseAmount(
              compensationAmount
            ) ??
            0;

      if (
        cashDifference !==
          null &&
        compensation >
          Math.abs(
            cashDifference
          )
      ) {
        setErrorMessage(
          "차액보전 금액은 현재 시재 차액보다 크게 입력할 수 없습니다."
        );
        return;
      }

      setSaving(true);
      setMessage("");
      setErrorMessage("");

      try {
        const {
          data,
          error,
        } =
          await supabase.rpc(
            "save_sales_cash_ledger_input",
            {
              p_business_date:
                selectedDate,
              p_cash_collection:
                collectionAmount,
              p_cash_refill:
                refillAmount,
              p_company_deposit:
                depositAmount,
              p_expenses:
                expensePayload,
              p_customer_payouts:
                customerPayoutPayload,
              p_actual_balance:
                actualAmount,
              p_compensation_amount:
                compensation,
              p_actor_name:
                currentManagerName,
            }
          );

        if (error) {
          throw error;
        }

        if (data) {
          setDailyId(
            String(data)
          );
        }

        setMessage(
          `${selectedDate} 판매시재 입력을 저장했습니다.`
        );

        await loadDay(
          selectedDate
        );

        setMessage(
          `${selectedDate} 판매시재 입력을 저장했습니다.`
        );
      }
      catch (error) {
        console.error(
          "판매시재 저장 오류:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "판매시재 저장 중 오류가 발생했습니다."
        );
      }
      finally {
        setSaving(false);
      }
    };


  const handleConfirm =
    async () => {
      if (
        actionBusy ||
        saving ||
        loading ||
        !confirmReady
      ) {
        if (!confirmReady) {
          setErrorMessage(
            confirmGuide
          );
        }
        return;
      }

      const finalBalance =
        reconciledCashBalance ??
        expectedCashBalance;

      const isReconfirm =
        dailyStatus ===
        "editing";

      if (
        !window.confirm(
          `${selectedDate} 판매시재를 ${isReconfirm ? "재확정" : "확정"}할까요?\n\n최종 금고시재: ${formatWon(finalBalance)}\n\n확정 후에는 수정모드로 전환해야 변경할 수 있습니다.`
        )
      ) {
        return;
      }

      setActionBusy(true);
      setMessage("");
      setErrorMessage("");

      try {
        const {
          data,
          error,
        } =
          await supabase.rpc(
            "confirm_sales_cash_ledger",
            {
              p_business_date:
                selectedDate,
              p_actor_name:
                currentManagerName,
            }
          );

        if (error) {
          throw error;
        }

        const updatedFollowingOpeningCount =
          Number(
            (
              data as {
                updated_following_opening_count?: number;
              } | null
            )?.updated_following_opening_count ??
              0
          );

        await loadDay(
          selectedDate
        );

        setMessage(
          updatedFollowingOpeningCount > 0
            ? `${selectedDate} 판매시재를 ${isReconfirm ? "재확정" : "확정"}했습니다. 후속 수정일 ${updatedFollowingOpeningCount}건의 전일이월을 새 확정시재 기준으로 갱신했습니다. 차액보전은 기존 수기 입력값을 유지하므로 후속 날짜의 차액을 확인해 직접 수정 후 재확정해주세요.`
            : `${selectedDate} 판매시재를 ${isReconfirm ? "재확정" : "확정"}했습니다. 다음 영업일 전일이월 기준으로 사용됩니다.`
        );
      }
      catch (error) {
        console.error(
          "판매시재 확정 오류:",
          error
        );

        const confirmErrorMessage =
          error instanceof Error
            ? error.message
            : error &&
                typeof error === "object" &&
                "message" in error &&
                typeof (error as { message?: unknown }).message === "string"
              ? (error as { message: string }).message
              : "판매시재 확정 중 오류가 발생했습니다.";

        setErrorMessage(
          confirmErrorMessage
        );
      }
      finally {
        setActionBusy(false);
      }
    };


  const openEditModeModal =
    () => {
      if (
        !locked ||
        actionBusy ||
        saving
      ) {
        return;
      }

      setEditReasonDraft("");
      setShowEditModal(true);
      setErrorMessage("");
    };


  const handleStartEditMode =
    async () => {
      const reason =
        editReasonDraft.trim();

      if (reason.length < 2) {
        setErrorMessage(
          "수정사유를 2자 이상 입력해주세요."
        );
        return;
      }

      setActionBusy(true);
      setMessage("");
      setErrorMessage("");

      try {
        const {
          data,
          error,
        } =
          await supabase.rpc(
            "start_sales_cash_edit",
            {
              p_business_date:
                selectedDate,
              p_reason:
                reason,
              p_actor_name:
                currentManagerName,
            }
          );

        if (error) {
          throw error;
        }

        const affectedCount =
          Number(
            (
              data as {
                affected_following_count?: number;
              } | null
            )?.affected_following_count ??
              0
          );

        setShowEditModal(false);
        setEditReasonDraft("");

        await loadDay(
          selectedDate
        );

        setMessage(
          affectedCount > 0
            ? `${selectedDate} 판매시재를 수정모드로 전환했습니다. 이 날짜의 시재를 이월받은 후속 확정일 ${affectedCount}건도 날짜 순서대로 재확정해야 합니다.`
            : `${selectedDate} 판매시재를 수정모드로 전환했습니다. 수정 후 저장하고 다시 확정해주세요.`
        );
      }
      catch (error) {
        console.error(
          "판매시재 수정모드 전환 오류:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "수정모드 전환 중 오류가 발생했습니다."
        );
      }
      finally {
        setActionBusy(false);
      }
    };


  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-[22px] border border-[#E5E7EA] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-[0.12em] text-[#A50034]">
              CASH LEDGER
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-[26px] font-black tracking-[-0.03em] text-[#25282D]">
                판매시재
              </h1>

              <span
                className={[
                  "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black",
                  dailyStatus ===
                  "confirmed"
                    ? "bg-[#EDF8F1] text-[#287348]"
                    : dailyStatus ===
                        "editing"
                      ? "bg-[#FFF2E2] text-[#986219]"
                      : hasCashCollection
                        ? "bg-[#EEF4FF] text-[#315F9B]"
                        : "bg-[#F2F3F5] text-[#737881]",
                ].join(" ")}
              >
                {statusText(
                  dailyStatus,
                  hasCashCollection
                )}
              </span>
            </div>

            <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[#777C84]">
              당일 현금수금, 판매시재 리필, 회사계좌 입금, 매장 경비와 고객지급을 입력합니다.
              실금액을 입력하면 시재 차액과 차액보전 결과까지 자동 계산됩니다.
            </p>
          </div>

          <label className="flex min-w-[210px] flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#777C84]">
              <CalendarDays size={14} />
              기준일
            </span>

            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(event) =>
                handleDateChange(
                  event.target.value
                )
              }
              disabled={
                loading ||
                saving ||
                actionBusy
              }
              className="h-[44px] rounded-[12px] border border-[#D9DCE1] bg-white px-3 text-[13px] font-bold text-[#34383E] outline-none transition focus:border-[#A50034] disabled:bg-[#F4F5F6]"
            />
          </label>
        </div>
      </section>

      {message && (
        <section className="rounded-[16px] border border-[#D6E9DC] bg-[#F5FBF7] px-4 py-3 text-[12px] font-bold text-[#287348]">
          {message}
        </section>
      )}

      {errorMessage && (
        <section className="flex items-start gap-2 rounded-[16px] border border-[#F0CDD3] bg-[#FFF5F6] px-4 py-3 text-[12px] font-bold leading-5 text-[#A50034]">
          <AlertCircle
            size={16}
            className="mt-0.5 shrink-0"
          />
          <span>
            {errorMessage}
          </span>
        </section>
      )}

      {locked && (
        <section className="rounded-[18px] border border-[#D6E9DC] bg-[#F5FBF7] px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#287348]">
                <LockKeyhole size={16} />
              </div>

              <div>
                <p className="text-[12px] font-black text-[#287348]">
                  시재 확정 · 입력 잠금
                </p>
                <p className="mt-1 text-[11px] font-bold leading-5 text-[#5E7366]">
                  최종 시재 {confirmedClosingBalance === null ? "-" : formatWon(confirmedClosingBalance)}
                  {confirmedBy ? ` · ${confirmedBy}` : ""}
                  {confirmedAt ? ` · ${formatKstDateTime(confirmedAt)}` : ""}
                </p>
                {editReason && (
                  <p className="mt-1 text-[10px] font-bold leading-5 text-[#7C8B81]">
                    최근 수정사유: {editReason}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={openEditModeModal}
              disabled={
                actionBusy ||
                saving
              }
              className="inline-flex h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-[#D3DED6] bg-white px-4 text-[11px] font-black text-[#3E6950] transition hover:bg-[#EFF8F2] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <PencilLine size={14} />
              수정모드
            </button>
          </div>
        </section>
      )}

      {dailyStatus === "editing" && (
        <section className="rounded-[18px] border border-[#F1DFC0] bg-[#FFF9EF] px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#986219]">
              <PencilLine size={16} />
            </div>

            <div>
              <p className="text-[12px] font-black text-[#986219]">
                현재 수정모드입니다
              </p>
              <p className="mt-1 text-[11px] font-bold leading-5 text-[#806B43]">
                수정사유: {editReason ?? "-"}
                {editStartedBy ? ` · ${editStartedBy}` : ""}
                {editStartedAt ? ` · ${formatKstDateTime(editStartedAt)}` : ""}
              </p>
              <p className="mt-1 text-[10px] font-bold leading-5 text-[#9A8356]">
                필요한 내용을 수정해 저장한 뒤 하단의 [재확정]을 눌러주세요. 이전 수정일이 남아 있으면 날짜 순서대로 재확정해야 합니다.
              </p>
            </div>
          </div>
        </section>
      )}

      {loading ? (
        <section className="flex min-h-[300px] items-center justify-center rounded-[22px] border border-[#E5E7EA] bg-white">
          <span className="inline-flex items-center gap-2 text-[12px] font-bold text-[#858A92]">
            <LoaderCircle
              size={16}
              className="animate-spin"
            />
            판매시재를 불러오는 중
          </span>
        </section>
      ) : (
        <>
          {/* Core input */}
          <section className="overflow-hidden rounded-[22px] border border-[#E5E7EA] bg-white shadow-sm">
            <div className="border-b border-[#ECEEF1] px-5 py-5 sm:px-6">
              <div className="flex items-center gap-2">
                <WalletCards
                  size={17}
                  className="text-[#A50034]"
                />
                <h2 className="text-[16px] font-black tracking-[-0.025em] text-[#25282D]">
                  당일 현금 입력
                </h2>
              </div>

              <p className="mt-1 text-[12px] leading-5 text-[#969AA2]">
                당일 현금수금은 필수 입력입니다. 수금이 없는 날도 0원을 입력해 입력완료 상태를 남깁니다.
              </p>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-3 sm:p-6">
              <label className="rounded-[16px] border border-[#E5E7EA] bg-[#FCFCFD] p-4">
                <span className="flex items-center gap-2 text-[12px] font-black text-[#3D4148]">
                  <CircleDollarSign
                    size={16}
                    className="text-[#A50034]"
                  />
                  당일 현금수금
                </span>

                <span className="mt-1 block text-[10px] font-bold text-[#9A9EA6]">
                  NewBest 기준 · 필수
                </span>

                <div className="relative mt-4">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cashCollection}
                    onChange={(event) =>
                      updateAmount(
                        event.target.value,
                        setCashCollection
                      )
                    }
                    disabled={locked}
                    placeholder="0"
                    className="h-[46px] w-full rounded-[11px] border border-[#DDE0E5] bg-white pl-3 pr-10 text-right text-[15px] font-bold tabular-nums text-[#202328] outline-none transition focus:border-[#767B83] focus:ring-4 focus:ring-black/[0.035] disabled:bg-[#F5F6F7] disabled:text-[#969AA2]"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#9A9EA5]">
                    원
                  </span>
                </div>
              </label>

              <label className="rounded-[16px] border border-[#E5E7EA] bg-[#FCFCFD] p-4">
                <span className="flex items-center gap-2 text-[12px] font-black text-[#3D4148]">
                  <BanknoteArrowUp
                    size={16}
                    className="text-[#315F9B]"
                  />
                  판매시재 리필
                </span>

                <span className="mt-1 block text-[10px] font-bold text-[#9A9EA6]">
                  금고 시재에 추가한 현금
                </span>

                <div className="relative mt-4">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cashRefill}
                    onChange={(event) =>
                      updateAmount(
                        event.target.value,
                        setCashRefill
                      )
                    }
                    disabled={locked}
                    placeholder="0"
                    className="h-[46px] w-full rounded-[11px] border border-[#DDE0E5] bg-white pl-3 pr-10 text-right text-[15px] font-bold tabular-nums text-[#202328] outline-none transition focus:border-[#767B83] focus:ring-4 focus:ring-black/[0.035] disabled:bg-[#F5F6F7] disabled:text-[#969AA2]"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#9A9EA5]">
                    원
                  </span>
                </div>
              </label>

              <label className="rounded-[16px] border border-[#E5E7EA] bg-[#FCFCFD] p-4">
                <span className="flex items-center gap-2 text-[12px] font-black text-[#3D4148]">
                  <BanknoteArrowDown
                    size={16}
                    className="text-[#8B651B]"
                  />
                  회사계좌 입금
                </span>

                <span className="mt-1 block text-[10px] font-bold text-[#9A9EA6]">
                  기존 판매시재의 사장님 입금금액
                </span>

                <div className="relative mt-4">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={companyDeposit}
                    onChange={(event) =>
                      updateAmount(
                        event.target.value,
                        setCompanyDeposit
                      )
                    }
                    disabled={locked}
                    placeholder="0"
                    className="h-[46px] w-full rounded-[11px] border border-[#DDE0E5] bg-white pl-3 pr-10 text-right text-[15px] font-bold tabular-nums text-[#202328] outline-none transition focus:border-[#767B83] focus:ring-4 focus:ring-black/[0.035] disabled:bg-[#F5F6F7] disabled:text-[#969AA2]"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#9A9EA5]">
                    원
                  </span>
                </div>
              </label>
            </div>
          </section>

          {/* Expenses */}
          <section className="overflow-hidden rounded-[22px] border border-[#E5E7EA] bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[#ECEEF1] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <ReceiptText
                      size={17}
                      className="text-[#A50034]"
                    />
                    <h2 className="text-[16px] font-black tracking-[-0.025em] text-[#25282D]">
                      매장 경비
                    </h2>
                  </div>

                  <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[10px] font-black text-[#6F747C]">
                    {selectedDate}
                  </span>

                  <span className="rounded-full bg-[#FFF4F6] px-2.5 py-1 text-[10px] font-black text-[#A50034]">
                    {expenses.length}건 · {formatWon(
                      expenseTotal
                    )}
                  </span>
                </div>

                <p className="mt-1 text-[12px] leading-5 text-[#969AA2]">
                  판매시재에서 실제 현금으로 사용한 경비를 입력합니다. 저장된 경비 합계는 금고 예상 시재에서 자동 차감됩니다.
                </p>
              </div>

              <button
                type="button"
                onClick={addExpense}
                disabled={
                  locked ||
                  activeCategories.length ===
                    0 ||
                  expenseManagers.length ===
                    0
                }
                className="inline-flex h-[38px] items-center justify-center gap-1.5 rounded-[10px] border border-[#D8DFEA] bg-white px-4 text-[11px] font-black text-[#315F9B] transition hover:bg-[#F4F7FC] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus size={14} />
                경비 추가
              </button>
            </div>

            {activeCategories.length ===
            0 ? (
              <div className="px-5 py-8 text-center sm:px-6">
                <p className="text-[13px] font-black text-[#555A62]">
                  사용 가능한 경비분류가 없습니다.
                </p>
                <p className="mt-2 text-[11px] leading-5 text-[#92969D]">
                  관리자 &gt; 판매시재 경비분류에서 사용할 경비분류를 등록해주세요.
                </p>
              </div>
            ) : expenseManagers.length ===
              0 ? (
              <div className="px-5 py-8 text-center sm:px-6">
                <p className="text-[13px] font-black text-[#555A62]">
                  선택할 수 있는 담당자가 없습니다.
                </p>
                <p className="mt-2 text-[11px] leading-5 text-[#92969D]">
                  활성 매니저 정보를 확인해주세요.
                </p>
              </div>
            ) : expenses.length ===
              0 ? (
              <div className="px-5 py-8 text-center sm:px-6">
                <p className="text-[13px] font-bold text-[#777C84]">
                  {selectedDate}에 사용한 매장 경비가 없으면 추가하지 않아도 됩니다.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1260px] table-fixed">
                    <thead>
                      <tr className="bg-[#FAFAFB] text-left text-[10px] font-black text-[#7B8088]">
                        <th className="w-[170px] border-b border-[#ECEEF1] px-5 py-3 sm:px-6">
                          경비분류
                        </th>
                        <th className="w-[300px] border-b border-[#ECEEF1] px-4 py-3">
                          사용처 / 내용
                        </th>
                        <th className="w-[170px] border-b border-[#ECEEF1] px-4 py-3 text-right">
                          금액
                        </th>
                        <th className="w-[150px] border-b border-[#ECEEF1] px-4 py-3">
                          담당자
                        </th>
                        <th className="w-[300px] border-b border-[#ECEEF1] px-4 py-3">
                          메모
                        </th>
                        <th className="w-[70px] border-b border-[#ECEEF1] px-5 py-3 text-right sm:px-6">
                          삭제
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {expenses.map(
                        (expense) => (
                          <tr
                            key={expense.key}
                            className="transition hover:bg-[#FCFCFD]"
                          >
                            <td className="border-b border-[#F0F1F3] px-5 py-3 sm:px-6">
                              <select
                                value={expense.categoryId}
                                onChange={(event) =>
                                  updateExpense(
                                    expense.key,
                                    {
                                      categoryId:
                                        event.target.value,
                                    }
                                  )
                                }
                                disabled={locked}
                                className="h-[40px] w-full rounded-[9px] border border-[#D9DCE1] bg-white px-2.5 text-[12px] font-bold text-[#3D4148] outline-none focus:border-[#A50034] disabled:bg-[#F3F4F5]"
                              >
                                {categories.map(
                                  (category) => (
                                    <option
                                      key={category.id}
                                      value={category.id}
                                    >
                                      {category.name}
                                      {category.isActive
                                        ? ""
                                        : " (사용중지)"}
                                    </option>
                                  )
                                )}
                              </select>
                            </td>

                            <td className="border-b border-[#F0F1F3] px-4 py-3">
                              <input
                                type="text"
                                value={expense.usageDetail}
                                onChange={(event) =>
                                  updateExpense(
                                    expense.key,
                                    {
                                      usageDetail:
                                        event.target.value,
                                    }
                                  )
                                }
                                disabled={locked}
                                placeholder="예: 우체국 / 고객 사은품 택배 발송"
                                className="h-[40px] w-full rounded-[9px] border border-[#D9DCE1] bg-white px-3 text-[12px] font-bold text-[#3D4148] outline-none focus:border-[#A50034] disabled:bg-[#F3F4F5]"
                              />
                            </td>

                            <td className="border-b border-[#F0F1F3] px-4 py-3">
                              <div className="relative">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={expense.amount}
                                  onChange={(event) =>
                                    updateExpense(
                                      expense.key,
                                      {
                                        amount:
                                          formatNumberInput(
                                            normalizeNumberInput(
                                              event.target.value
                                            )
                                          ),
                                      }
                                    )
                                  }
                                  disabled={locked}
                                  placeholder="0"
                                  className="h-[40px] w-full rounded-[9px] border border-[#DDE0E5] bg-white pl-3 pr-10 text-right text-[13px] font-bold tabular-nums text-[#202328] outline-none transition focus:border-[#767B83] focus:ring-4 focus:ring-black/[0.035] disabled:bg-[#F5F6F7]"
                                />
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[#9A9EA5]">
                                  원
                                </span>
                              </div>
                            </td>

                            <td className="border-b border-[#F0F1F3] px-4 py-3">
                              <select
                                value={expense.managerName}
                                onChange={(event) =>
                                  updateExpense(
                                    expense.key,
                                    {
                                      managerName:
                                        event.target.value,
                                    }
                                  )
                                }
                                disabled={locked}
                                className="h-[40px] w-full rounded-[9px] border border-[#D9DCE1] bg-white px-2.5 text-[12px] font-bold text-[#3D4148] outline-none focus:border-[#A50034] disabled:bg-[#F3F4F5]"
                              >
                                {expense.managerName &&
                                  !expenseManagers.some(
                                    (manager) =>
                                      manager.name ===
                                      expense.managerName
                                  ) && (
                                    <option
                                      value={expense.managerName}
                                    >
                                      {expense.managerName} (기존)
                                    </option>
                                  )}

                                {expenseManagers.map(
                                  (manager) => (
                                    <option
                                      key={manager.id}
                                      value={manager.name}
                                    >
                                      {manager.name}
                                    </option>
                                  )
                                )}
                              </select>
                            </td>

                            <td className="border-b border-[#F0F1F3] px-4 py-3">
                              <input
                                type="text"
                                value={expense.note}
                                onChange={(event) =>
                                  updateExpense(
                                    expense.key,
                                    {
                                      note:
                                        event.target.value,
                                    }
                                  )
                                }
                                disabled={locked}
                                placeholder="선택 입력"
                                className="h-[40px] w-full rounded-[9px] border border-[#D9DCE1] bg-white px-3 text-[12px] font-bold text-[#3D4148] outline-none focus:border-[#A50034] disabled:bg-[#F3F4F5]"
                              />
                            </td>

                            <td className="border-b border-[#F0F1F3] px-5 py-3 text-right sm:px-6">
                              <button
                                type="button"
                                aria-label="경비 삭제"
                                onClick={() =>
                                  deleteExpense(
                                    expense.key
                                  )
                                }
                                disabled={locked}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-[9px] text-[#8C9199] transition hover:bg-[#FFF0F3] hover:text-[#A50034] disabled:opacity-30"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-2 border-t border-[#ECEEF1] bg-[#FCFCFD] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <p className="text-[11px] font-bold text-[#8B9098]">
                    입력한 경비는 판매시재 저장 시 함께 저장되며, 삭제·수정도 저장 버튼을 눌러야 DB에 반영됩니다.
                  </p>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold text-[#777C84]">
                      당일 경비 합계
                    </span>
                    <span className="text-[15px] font-black tabular-nums text-[#A50034]">
                      {formatWon(
                        expenseTotal
                      )}
                    </span>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* Customer payouts */}
          <section className="overflow-hidden rounded-[22px] border border-[#E5E7EA] bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[#ECEEF1] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <div className="flex items-center gap-2">
                  <BanknoteArrowDown
                    size={17}
                    className="text-[#A50034]"
                  />
                  <h2 className="text-[16px] font-black tracking-[-0.025em] text-[#25282D]">
                    고객지급
                  </h2>
                </div>

                <p className="mt-1 text-[12px] leading-5 text-[#969AA2]">
                  고객에게 지급한 금액을 등록합니다. 현금시재 지급만 금고 예상 시재에서 차감되며 무통장은 기록만 남깁니다.
                </p>
              </div>

              <button
                type="button"
                onClick={addCustomerPayout}
                disabled={locked}
                className="inline-flex h-[38px] items-center justify-center gap-1.5 rounded-[10px] border border-[#D8DFEA] bg-white px-4 text-[11px] font-black text-[#315F9B] transition hover:bg-[#F4F7FC] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus size={14} />
                고객지급 추가
              </button>
            </div>

            {customerPayouts.length ===
            0 ? (
              <div className="px-5 py-8 text-center sm:px-6">
                <p className="text-[13px] font-bold text-[#777C84]">
                  오늘 고객에게 지급한 금액이 없으면 추가하지 않아도 됩니다.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] table-fixed">
                  <thead>
                    <tr className="bg-[#FAFAFB] text-left text-[10px] font-black text-[#7B8088]">
                      <th className="w-[140px] border-b border-[#ECEEF1] px-5 py-3 sm:px-6">
                        지급방법
                      </th>
                      <th className="w-[170px] border-b border-[#ECEEF1] px-4 py-3">
                        고객명
                      </th>
                      <th className="w-[170px] border-b border-[#ECEEF1] px-4 py-3 text-right">
                        금액
                      </th>
                      <th className="w-[220px] border-b border-[#ECEEF1] px-4 py-3">
                        주문번호
                      </th>
                      <th className="w-[300px] border-b border-[#ECEEF1] px-4 py-3">
                        지급사유
                      </th>
                      <th className="w-[70px] border-b border-[#ECEEF1] px-5 py-3 text-right sm:px-6">
                        삭제
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {customerPayouts.map(
                      (payout) => (
                        <tr
                          key={payout.key}
                          className="transition hover:bg-[#FCFCFD]"
                        >
                          <td className="border-b border-[#F0F1F3] px-5 py-3 sm:px-6">
                            <select
                              value={payout.paymentMethod}
                              onChange={(event) =>
                                updateCustomerPayout(
                                  payout.key,
                                  {
                                    paymentMethod:
                                      event.target.value ===
                                      "bank_transfer"
                                        ? "bank_transfer"
                                        : "cash",
                                  }
                                )
                              }
                              disabled={locked}
                              className="h-[40px] w-full rounded-[9px] border border-[#DDE0E5] bg-white px-3 text-[12px] font-bold text-[#34383E] outline-none transition focus:border-[#767B83] disabled:bg-[#F5F6F7]"
                            >
                              <option value="cash">
                                현금시재
                              </option>
                              <option value="bank_transfer">
                                무통장
                              </option>
                            </select>
                          </td>

                          <td className="border-b border-[#F0F1F3] px-4 py-3">
                            <input
                              type="text"
                              value={payout.customerName}
                              onChange={(event) =>
                                updateCustomerPayout(
                                  payout.key,
                                  {
                                    customerName:
                                      event.target.value,
                                  }
                                )
                              }
                              disabled={locked}
                              placeholder="고객명"
                              className="h-[40px] w-full rounded-[9px] border border-[#DDE0E5] bg-white px-3 text-[12px] font-bold text-[#34383E] outline-none transition focus:border-[#767B83] disabled:bg-[#F5F6F7]"
                            />
                          </td>

                          <td className="border-b border-[#F0F1F3] px-4 py-3">
                            <div className="relative">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={payout.amount}
                                onChange={(event) =>
                                  updateCustomerPayout(
                                    payout.key,
                                    {
                                      amount:
                                        formatNumberInput(
                                          normalizeNumberInput(
                                            event.target.value
                                          )
                                        ),
                                    }
                                  )
                                }
                                disabled={locked}
                                placeholder="0"
                                className="h-[40px] w-full rounded-[9px] border border-[#DDE0E5] bg-white pl-3 pr-10 text-right text-[13px] font-bold tabular-nums text-[#202328] outline-none transition focus:border-[#767B83] focus:ring-4 focus:ring-black/[0.035] disabled:bg-[#F5F6F7]"
                              />
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[#9A9EA5]">
                                원
                              </span>
                            </div>
                          </td>

                          <td className="border-b border-[#F0F1F3] px-4 py-3">
                            <input
                              type="text"
                              value={payout.referenceNo}
                              onChange={(event) =>
                                updateCustomerPayout(
                                  payout.key,
                                  {
                                    referenceNo:
                                      event.target.value,
                                  }
                                )
                              }
                              disabled={locked}
                              placeholder="주문번호 또는 참고번호"
                              className="h-[40px] w-full rounded-[9px] border border-[#DDE0E5] bg-white px-3 text-[12px] font-bold text-[#34383E] outline-none transition focus:border-[#767B83] disabled:bg-[#F5F6F7]"
                            />
                          </td>

                          <td className="border-b border-[#F0F1F3] px-4 py-3">
                            <input
                              type="text"
                              value={payout.payoutReason}
                              onChange={(event) =>
                                updateCustomerPayout(
                                  payout.key,
                                  {
                                    payoutReason:
                                      event.target.value,
                                  }
                                )
                              }
                              disabled={locked}
                              placeholder="지급사유"
                              className="h-[40px] w-full rounded-[9px] border border-[#DDE0E5] bg-white px-3 text-[12px] font-bold text-[#34383E] outline-none transition focus:border-[#767B83] disabled:bg-[#F5F6F7]"
                            />
                          </td>

                          <td className="border-b border-[#F0F1F3] px-5 py-3 text-right sm:px-6">
                            <button
                              type="button"
                              aria-label="고객지급 삭제"
                              onClick={() =>
                                deleteCustomerPayout(
                                  payout.key
                                )
                              }
                              disabled={locked}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-[9px] text-[#8C9199] transition hover:bg-[#FFF0F3] hover:text-[#A50034] disabled:opacity-30"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="grid gap-3 border-t border-[#ECEEF1] bg-[#FCFCFD] px-5 py-4 sm:grid-cols-2 sm:px-6">
              <div className="flex items-center justify-between gap-4 text-[11px]">
                <span className="font-bold text-[#777C84]">
                  현금시재 고객지급
                </span>
                <span className="font-black text-[#A50034]">
                  {formatWon(
                    customerCashPayoutTotal
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 text-[11px]">
                <span className="font-bold text-[#777C84]">
                  무통장 고객지급
                </span>
                <span className="font-black text-[#315F9B]">
                  {formatWon(
                    customerBankPayoutTotal
                  )}
                </span>
              </div>
            </div>
          </section>

          {/* Expected cash balance */}
          <section className="rounded-[22px] border border-[#E5E7EA] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CircleDollarSign
                    size={17}
                    className="text-[#A50034]"
                  />
                  <h2 className="text-[16px] font-black tracking-[-0.025em] text-[#25282D]">
                    당일 금고 예상 시재
                  </h2>
                </div>

                <p className="mt-1 text-[12px] leading-5 text-[#969AA2]">
                  수금·입금·경비와 현금 고객지급을 반영해 금고에 있어야 할 현금을 계산합니다.
                </p>
              </div>

              <span className="inline-flex self-start rounded-full bg-[#F2F3F5] px-2.5 py-1 text-[10px] font-black text-[#737881]">
                입력 즉시 계산
              </span>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_0.9fr]">
              <div className="rounded-[16px] border border-[#ECEEF1] bg-[#FCFCFD] p-4 sm:p-5">
                <div className="space-y-3 text-[12px]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="font-bold text-[#777C84]">
                        전일 이월
                      </span>
                      <span className="mt-0.5 block text-[10px] font-bold text-[#9A9EA6]">
                        {openingSourceCaption}
                      </span>
                    </div>
                    <span className="font-black text-[#34383E]">
                      {formatWon(
                        openingBalance
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="font-bold text-[#777C84]">
                      + 당일 현금수금
                    </span>
                    <span className="font-black text-[#287348]">
                      +{formatWon(
                        cashCollectionValue
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="font-bold text-[#777C84]">
                      + 판매시재 리필
                    </span>
                    <span className="font-black text-[#287348]">
                      +{formatWon(
                        cashRefillValue
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="font-bold text-[#777C84]">
                      - 회사계좌 입금
                    </span>
                    <span className="font-black text-[#A50034]">
                      -{formatWon(
                        companyDepositValue
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="font-bold text-[#777C84]">
                      - 매장경비
                    </span>
                    <span className="font-black text-[#A50034]">
                      -{formatWon(
                        expenseTotal
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="font-bold text-[#777C84]">
                      - 고객지급(현금)
                    </span>
                    <span className="font-black text-[#A50034]">
                      -{formatWon(
                        customerCashPayoutTotal
                      )}
                    </span>
                  </div>

                  {otherCashImpact !==
                    0 && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-bold text-[#777C84]">
                        ± 기타 시재 반영
                      </span>
                      <span
                        className={[
                          "font-black",
                          otherCashImpact < 0
                            ? "text-[#A50034]"
                            : "text-[#287348]",
                        ].join(" ")}
                      >
                        {otherCashImpact > 0
                          ? "+"
                          : ""}
                        {formatWon(
                          otherCashImpact
                        )}
                      </span>
                    </div>
                  )}

                  <div className="border-t border-[#E5E7EA] pt-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-black text-[#555A62]">
                        당일 시재 증감
                      </span>
                      <span
                        className={[
                          "text-[13px] font-black",
                          dailyCashChange < 0
                            ? "text-[#A50034]"
                            : "text-[#287348]",
                        ].join(" ")}
                      >
                        {dailyCashChange > 0
                          ? "+"
                          : ""}
                        {formatWon(
                          dailyCashChange
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={[
                  "flex min-h-[210px] flex-col justify-center rounded-[16px] border p-5 sm:p-6",
                  expectedCashBalance < 0
                    ? "border-[#F0CDD3] bg-[#FFF5F6]"
                    : "border-[#D6E9DC] bg-[#F5FBF7]",
                ].join(" ")}
              >
                <p
                  className={[
                    "text-[11px] font-black tracking-[-0.01em]",
                    expectedCashBalance < 0
                      ? "text-[#A50034]"
                      : "text-[#287348]",
                  ].join(" ")}
                >
                  금고에 있어야 할 금액
                </p>

                <p
                  className={[
                    "mt-3 break-all text-[28px] font-black tracking-[-0.035em] sm:text-[32px]",
                    expectedCashBalance < 0
                      ? "text-[#8F002D]"
                      : "text-[#174F34]",
                  ].join(" ")}
                >
                  {formatWon(
                    expectedCashBalance
                  )}
                </p>

                <p className="mt-3 text-[11px] font-bold leading-5 text-[#777C84]">
                  전일이월 + 현금수금 + 리필 - 회사계좌 입금 - 매장경비 - 고객지급(현금){otherCashImpact !== 0 ? " ± 기타 시재" : ""}
                </p>
              </div>
            </div>

            {customerBankPayoutTotal >
              0 && (
              <p className="mt-4 text-[11px] font-bold leading-5 text-[#315F9B]">
                무통장 고객지급 {formatWon(
                  customerBankPayoutTotal
                )}은 금고 현금에서 지급한 금액이 아니므로 예상 시재에서 차감하지 않습니다.
              </p>
            )}

            <p className="mt-4 text-[11px] leading-5 text-[#969AA2]">
              {openingSourceType ===
                "auto"
                ? openingSourceDate
                  ? `${openingSourceDate}의 확정 금고시재를 자동 이월했습니다. 중간에 휴무일이 있어도 가장 최근 확정일을 기준으로 합니다.`
                  : "직전 확정 판매시재가 없어 전일 이월 0원으로 계산됩니다. 첫 확정일이 생기면 다음 영업일부터 자동 이월됩니다."
                : openingSourceType ===
                    "initial"
                  ? "최초 운영 기준으로 지정된 초기 시재를 사용합니다."
                  : "자동이월이 아닌 수기 지정 이월금액을 사용합니다."}
            </p>
          </section>

          {/* Actual balance / difference compensation */}
          <section className="overflow-hidden rounded-[22px] border border-[#E5E7EA] bg-white shadow-sm">
            <div className="border-b border-[#ECEEF1] px-5 py-5 sm:px-6">
              <div className="flex items-center gap-2">
                <WalletCards
                  size={17}
                  className="text-[#A50034]"
                />
                <h2 className="text-[16px] font-black tracking-[-0.025em] text-[#25282D]">
                  실금액 / 차액보전
                </h2>
              </div>

              <p className="mt-1 text-[12px] leading-5 text-[#969AA2]">
                실제 금고 현금을 입력하면 예상 시재와의 차액을 계산합니다. 차액보전은 원인을 확인한 뒤 필요한 금액만 직접 입력합니다.
              </p>
            </div>

            <div className="grid gap-4 p-5 lg:grid-cols-3 sm:p-6">
              <label className="rounded-[16px] border border-[#E5E7EA] bg-[#FCFCFD] p-4">
                <span className="text-[12px] font-black text-[#3D4148]">
                  실금액(금고)
                </span>

                <span className="mt-1 block text-[10px] font-bold text-[#9A9EA6]">
                  실제로 세어본 금고 현금
                </span>

                <div className="relative mt-4">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={actualBalance}
                    onChange={(event) =>
                      updateAmount(
                        event.target.value,
                        setActualBalance
                      )
                    }
                    disabled={locked}
                    placeholder="미입력"
                    className="h-[46px] w-full rounded-[11px] border border-[#DDE0E5] bg-white pl-3 pr-10 text-right text-[15px] font-bold tabular-nums text-[#202328] outline-none transition focus:border-[#767B83] focus:ring-4 focus:ring-black/[0.035] disabled:bg-[#F5F6F7] disabled:text-[#969AA2]"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#9A9EA5]">
                    원
                  </span>
                </div>
              </label>

              <div
                className={[
                  "rounded-[16px] border p-4",
                  cashDifference ===
                    null
                    ? "border-[#E5E7EA] bg-[#FCFCFD]"
                    : cashDifference ===
                        0
                      ? "border-[#D6E9DC] bg-[#F5FBF7]"
                      : "border-[#F0D9C2] bg-[#FFF9EF]",
                ].join(" ")}
              >
                <span className="text-[12px] font-black text-[#3D4148]">
                  시재 차액
                </span>

                <span className="mt-1 block text-[10px] font-bold text-[#9A9EA6]">
                  실금액 - 금고 예상 시재
                </span>

                <p
                  className={[
                    "mt-5 text-right text-[22px] font-black tabular-nums tracking-[-0.025em]",
                    cashDifference ===
                      null
                      ? "text-[#8B9098]"
                      : cashDifference <
                          0
                        ? "text-[#A50034]"
                        : cashDifference >
                            0
                          ? "text-[#315F9B]"
                          : "text-[#287348]",
                  ].join(" ")}
                >
                  {cashDifference ===
                  null
                    ? "-"
                    : `${cashDifference > 0 ? "+" : ""}${formatWon(
                        cashDifference
                      )}`}
                </p>

                <p className="mt-2 text-right text-[10px] font-bold text-[#777C84]">
                  {cashDifference ===
                  null
                    ? "실금액을 입력하면 자동 계산됩니다."
                    : cashDifference <
                        0
                      ? "금고 현금이 예상 시재보다 부족합니다."
                      : cashDifference >
                          0
                        ? "금고 현금이 예상 시재보다 많습니다."
                        : "예상 시재와 실금액이 일치합니다."}
                </p>
              </div>

              <div className="rounded-[16px] border border-[#E5E7EA] bg-[#FCFCFD] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[12px] font-black text-[#3D4148]">
                      차액보전
                    </span>

                    <span className="mt-1 block text-[10px] font-bold text-[#9A9EA6]">
                      {compensationDirection ===
                      "in"
                        ? "부족분 보전 입금(+) · 수기입력"
                        : compensationDirection ===
                            "out"
                          ? "초과분 회수(-) · 수기입력"
                          : "현재 차액 0원 · 보전 불필요"}
                    </span>
                  </div>


                </div>

                <div className="relative mt-4">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={compensationAmount}
                    onChange={(event) =>
                      updateAmount(
                        event.target.value,
                        setCompensationAmount
                      )
                    }
                    disabled={
                      locked ||
                      cashDifference ===
                        null ||
                      cashDifference ===
                        0
                    }
                    placeholder="0"
                    className="h-[46px] w-full rounded-[11px] border border-[#DDE0E5] bg-white pl-3 pr-10 text-right text-[15px] font-bold tabular-nums text-[#202328] outline-none transition focus:border-[#767B83] focus:ring-4 focus:ring-black/[0.035] disabled:bg-[#F5F6F7] disabled:text-[#969AA2]"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#9A9EA5]">
                    원
                  </span>
                </div>

                <p className="mt-2 text-[10px] font-bold leading-5 text-[#8B9098]">
                  차액보전은 자동계산하지 않습니다. 실제 차액 원인을 확인한 뒤 필요한 금액만 직접 입력합니다.
                </p>
              </div>
            </div>

            <div className="grid gap-3 border-t border-[#ECEEF1] bg-[#FCFCFD] px-5 py-4 sm:grid-cols-2 sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[11px] font-bold text-[#777C84]">
                  보전 후 금고시재
                </span>
                <span className="text-[13px] font-black text-[#34383E]">
                  {reconciledCashBalance ===
                  null
                    ? "-"
                    : formatWon(
                        reconciledCashBalance
                      )}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-[11px] font-bold text-[#777C84]">
                  남은 차액
                </span>
                <span
                  className={[
                    "text-[13px] font-black",
                    remainingDifference ===
                      null
                      ? "text-[#8B9098]"
                      : remainingDifference ===
                          0
                        ? "text-[#287348]"
                        : "text-[#A50034]",
                  ].join(" ")}
                >
                  {remainingDifference ===
                  null
                    ? "-"
                    : `${remainingDifference > 0 ? "+" : ""}${formatWon(
                        remainingDifference
                      )}`}
                </span>
              </div>
            </div>
          </section>

          {/* Save / Confirm */}
          <section className="rounded-[20px] border border-[#E5E7EA] bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-[12px] font-bold text-[#555A62]">
                  {selectedDate}
                  {dailyStatus === "confirmed"
                    ? " · 시재 확정"
                    : dailyStatus === "editing"
                      ? " · 수정모드"
                      : dailyId
                        ? " · 저장된 판매시재 있음"
                        : " · 신규 입력"}
                </p>

                <p className="mt-1 text-[11px] leading-5 text-[#92969D]">
                  {dailyStatus === "confirmed"
                    ? "확정된 시재는 잠겨 있습니다. 변경이 필요하면 수정사유를 남기고 수정모드로 전환하세요."
                    : confirmGuide}
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                {!locked && (
                  <>
                    <button
                      type="button"
                      onClick={resetInput}
                      disabled={
                        saving ||
                        actionBusy
                      }
                      className="inline-flex h-[46px] items-center justify-center gap-2 rounded-[12px] border border-[#D9DCE1] bg-white px-5 text-[12px] font-black text-[#686D75] transition hover:bg-[#F7F8F9] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <RotateCcw size={15} />
                      입력 비우기
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void handleSave()
                      }
                      disabled={
                        saving ||
                        actionBusy
                      }
                      className="inline-flex h-[46px] min-w-[120px] items-center justify-center gap-2 rounded-[12px] border border-[#D9DCE1] bg-white px-5 text-[12px] font-black text-[#555A62] transition hover:bg-[#F7F8F9] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {saving ? (
                        <LoaderCircle
                          size={16}
                          className="animate-spin"
                        />
                      ) : (
                        <Save size={16} />
                      )}
                      {saving
                        ? "저장 중"
                        : "저장"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void handleConfirm()
                      }
                      disabled={
                        saving ||
                        actionBusy ||
                        !confirmReady
                      }
                      className="inline-flex h-[46px] min-w-[140px] items-center justify-center gap-2 rounded-[12px] bg-[#A50034] px-6 text-[13px] font-bold text-white transition hover:bg-[#8D002C] disabled:cursor-not-allowed disabled:bg-[#D7D9DE] disabled:text-[#92969D]"
                    >
                      {actionBusy ? (
                        <LoaderCircle
                          size={17}
                          className="animate-spin"
                        />
                      ) : (
                        <ShieldCheck size={17} />
                      )}
                      {dailyStatus === "editing"
                        ? "재확정"
                        : "시재 확정"}
                    </button>
                  </>
                )}

                {locked && (
                  <button
                    type="button"
                    onClick={openEditModeModal}
                    disabled={
                      actionBusy ||
                      saving
                    }
                    className="inline-flex h-[46px] min-w-[140px] items-center justify-center gap-2 rounded-[12px] border border-[#D3DED6] bg-[#F5FBF7] px-6 text-[13px] font-black text-[#287348] transition hover:bg-[#EDF8F1] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <PencilLine size={16} />
                    수정모드
                  </button>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-[520px] overflow-hidden rounded-[22px] border border-[#E2E4E8] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#ECEEF1] px-5 py-4">
              <div>
                <p className="text-[11px] font-black tracking-[0.12em] text-[#A50034]">
                  EDIT CASH LEDGER
                </p>
                <h3 className="mt-1 text-[19px] font-black tracking-[-0.03em] text-[#25282D]">
                  판매시재 수정모드
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowEditModal(false)
                }
                disabled={actionBusy}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#777C84] transition hover:bg-[#F3F4F6] disabled:opacity-40"
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5">
              <div className="rounded-[14px] border border-[#F1DFC0] bg-[#FFF9EF] px-4 py-3 text-[11px] font-bold leading-5 text-[#806B43]">
                확정된 시재를 수정하면 전일이월 연결관계가 바뀔 수 있습니다. 이 날짜의 확정 시재를 이어받은 후속 확정일이 있으면 함께 수정모드로 전환되며 날짜 순서대로 재확정해야 합니다.
              </div>

              <label className="mt-5 block">
                <span className="text-[12px] font-black text-[#3D4148]">
                  수정사유 <span className="text-[#A50034]">*</span>
                </span>
                <textarea
                  value={editReasonDraft}
                  onChange={(event) =>
                    setEditReasonDraft(
                      event.target.value
                    )
                  }
                  disabled={actionBusy}
                  rows={4}
                  maxLength={300}
                  placeholder="예: 고객지급 금액 오입력 수정"
                  className="mt-2 w-full resize-none rounded-[12px] border border-[#D9DCE1] bg-white px-3 py-3 text-[13px] font-medium leading-6 text-[#34383E] outline-none transition focus:border-[#A50034] focus:ring-4 focus:ring-[#A50034]/[0.05] disabled:bg-[#F5F6F7]"
                />
                <span className="mt-1 block text-right text-[10px] font-bold text-[#A0A4AB]">
                  {editReasonDraft.length}/300
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#ECEEF1] bg-[#FCFCFD] px-5 py-4">
              <button
                type="button"
                onClick={() =>
                  setShowEditModal(false)
                }
                disabled={actionBusy}
                className="inline-flex h-[42px] items-center justify-center rounded-[11px] border border-[#D9DCE1] bg-white px-5 text-[12px] font-black text-[#686D75] transition hover:bg-[#F7F8F9] disabled:opacity-40"
              >
                취소
              </button>

              <button
                type="button"
                onClick={() =>
                  void handleStartEditMode()
                }
                disabled={
                  actionBusy ||
                  editReasonDraft.trim().length < 2
                }
                className="inline-flex h-[42px] min-w-[120px] items-center justify-center gap-2 rounded-[11px] bg-[#A50034] px-5 text-[12px] font-black text-white transition hover:bg-[#8D002C] disabled:cursor-not-allowed disabled:bg-[#D7D9DE] disabled:text-[#92969D]"
              >
                {actionBusy ? (
                  <LoaderCircle
                    size={15}
                    className="animate-spin"
                  />
                ) : (
                  <PencilLine size={15} />
                )}
                수정 시작
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
