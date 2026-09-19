"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  BanknoteArrowDown,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LoaderCircle,
  ReceiptText,
  RotateCcw,
} from "lucide-react";

import {
  createClient,
} from "@/lib/supabase/client";

import type {
  CashExpenseCategory,
} from "@/components/cash-ledger/CashLedgerWorkspace";


type Props = {
  today: string;
  categories: CashExpenseCategory[];
  onOpenDay: (date: string) => void;
};


const MONTH_OPTIONS = [
  "1월",
  "2월",
  "3월",
  "4월",
  "5월",
  "6월",
  "7월",
  "8월",
  "9월",
  "10월",
  "11월",
  "12월",
] as const;


type DailyRow = {
  id: string;
  business_date: string;
  status: string;
  opening_balance: number;
  actual_balance: number | null;
  confirmed_closing_balance: number | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  edit_started_at: string | null;
  edit_started_by: string | null;
  edit_reason: string | null;
};


type EntryRow = {
  id: string;
  daily_id: string;
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


type MonthlyLedgerRow = {
  daily: DailyRow;
  entries: EntryRow[];
  cashCollection: number;
  cashRefill: number;
  companyDeposit: number;
  expense: number;
  customerCashPayout: number;
  customerBankPayout: number;
  compensationIn: number;
  compensationOut: number;
  compensationNet: number;
  otherCashImpact: number;
  expectedBalance: number;
  actualBalance: number | null;
  difference: number | null;
  reconciledBalance: number | null;
};


function formatWon(
  value: number
) {
  return `${value.toLocaleString("ko-KR")}원`;
}


function formatSignedWon(
  value: number
) {
  if (value > 0) {
    return `+${formatWon(value)}`;
  }

  return formatWon(value);
}


function getMonthRange(
  monthValue: string
) {
  const [
    yearText,
    monthText,
  ] = monthValue.split("-");

  const year = Number(yearText);
  const month = Number(monthText);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error(
      "조회 월을 올바르게 선택해주세요."
    );
  }

  const nextYear =
    month === 12
      ? year + 1
      : year;
  const nextMonth =
    month === 12
      ? 1
      : month + 1;

  return {
    start:
      `${yearText}-${monthText}-01`,
    end:
      `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`,
  };
}


function formatDateLabel(
  dateValue: string
) {
  const date = new Date(
    `${dateValue}T00:00:00+09:00`
  );

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone: "Asia/Seoul",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    }
  ).format(date);
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
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(date);
}


function statusInfo(
  status: string
) {
  switch (status) {
    case "confirmed":
      return {
        label: "확정",
        className:
          "bg-[#EDF8F1] text-[#287348]",
      };

    case "editing":
      return {
        label: "수정모드",
        className:
          "bg-[#FFF2E2] text-[#986219]",
      };

    case "draft":
      return {
        label: "작성중",
        className:
          "bg-[#EEF4FF] text-[#315F9B]",
      };

    default:
      return {
        label: status || "미입력",
        className:
          "bg-[#F2F3F5] text-[#737881]",
      };
  }
}


function getErrorMessage(
  error: unknown
) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (
      error as {
        message?: unknown;
      }
    ).message === "string"
  ) {
    return (
      error as {
        message: string;
      }
    ).message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "판매시재 월별 내역을 불러오지 못했습니다.";
}


function buildMonthlyRow(
  daily: DailyRow,
  entries: EntryRow[]
): MonthlyLedgerRow {
  let cashCollection = 0;
  let cashRefill = 0;
  let companyDeposit = 0;
  let expense = 0;
  let customerCashPayout = 0;
  let customerBankPayout = 0;
  let compensationIn = 0;
  let compensationOut = 0;
  let otherCashImpact = 0;

  for (const entry of entries) {
    const amount = Number(
      entry.amount ?? 0
    );

    if (
      entry.entry_type ===
        "sales_cash" &&
      entry.entry_subtype ===
        "cash_collection"
    ) {
      cashCollection += amount;
      continue;
    }

    if (
      entry.entry_type ===
        "sales_cash" &&
      entry.entry_subtype ===
        "cash_refill"
    ) {
      cashRefill += amount;
      continue;
    }

    if (
      entry.entry_type ===
        "sales_cash" &&
      entry.entry_subtype ===
        "company_deposit"
    ) {
      companyDeposit += amount;
      continue;
    }

    if (
      entry.entry_type ===
      "expense"
    ) {
      expense += amount;
      continue;
    }

    if (
      entry.entry_type ===
      "customer_payout"
    ) {
      if (
        entry.payment_method ===
        "bank_transfer"
      ) {
        customerBankPayout += amount;
      }
      else {
        customerCashPayout += amount;
      }

      continue;
    }

    if (
      entry.entry_type ===
      "difference_compensation"
    ) {
      if (entry.direction === "in") {
        compensationIn += amount;
      }
      else if (
        entry.direction === "out"
      ) {
        compensationOut += amount;
      }

      continue;
    }

    if (!entry.affects_cash) {
      continue;
    }

    if (entry.direction === "in") {
      otherCashImpact += amount;
    }
    else if (
      entry.direction === "out"
    ) {
      otherCashImpact -= amount;
    }
  }

  const expectedBalance =
    Number(daily.opening_balance ?? 0) +
    cashCollection +
    cashRefill -
    companyDeposit -
    expense -
    customerCashPayout +
    otherCashImpact;

  const actualBalance =
    daily.actual_balance === null
      ? null
      : Number(
          daily.actual_balance
        );

  const difference =
    actualBalance === null
      ? null
      : actualBalance -
        expectedBalance;

  const compensationNet =
    compensationIn -
    compensationOut;

  const reconciledBalance =
    actualBalance === null
      ? null
      : actualBalance +
        compensationNet;

  return {
    daily,
    entries,
    cashCollection,
    cashRefill,
    companyDeposit,
    expense,
    customerCashPayout,
    customerBankPayout,
    compensationIn,
    compensationOut,
    compensationNet,
    otherCashImpact,
    expectedBalance,
    actualBalance,
    difference,
    reconciledBalance,
  };
}


export default function CashLedgerMonthlyHistory({
  today,
  categories,
  onOpenDay,
}: Props) {
  const supabase =
    useMemo(
      () => createClient(),
      []
    );

  const [
    selectedMonth,
    setSelectedMonth,
  ] = useState(
    today.slice(0, 7)
  );

  const [
    monthPickerOpen,
    setMonthPickerOpen,
  ] = useState(false);

  const [
    monthPickerYear,
    setMonthPickerYear,
  ] = useState(
    Number(today.slice(0, 4))
  );

  const [
    rows,
    setRows,
  ] = useState<MonthlyLedgerRow[]>(
    []
  );

  const [
    expandedDailyId,
    setExpandedDailyId,
  ] = useState<string | null>(
    null
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const categoryNameMap =
    useMemo(
      () =>
        new Map(
          categories.map(
            (category) => [
              category.id,
              category.name,
            ]
          )
        ),
      [categories]
    );

  const loadMonth =
    useCallback(
      async () => {
        setLoading(true);
        setErrorMessage("");
        setExpandedDailyId(null);

        try {
          const range =
            getMonthRange(
              selectedMonth
            );

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
                  actual_balance,
                  confirmed_closing_balance,
                  confirmed_at,
                  confirmed_by,
                  edit_started_at,
                  edit_started_by,
                  edit_reason
                `
              )
              .gte(
                "business_date",
                range.start
              )
              .lt(
                "business_date",
                range.end
              )
              .lte(
                "business_date",
                today
              )
              .order(
                "business_date",
                {
                  ascending: true,
                }
              );

          if (dailyError) {
            throw dailyError;
          }

          const dailyRows =
            (
              dailyData ?? []
            ) as DailyRow[];

          if (
            dailyRows.length === 0
          ) {
            setRows([]);
            return;
          }

          const dailyIds =
            dailyRows.map(
              (daily) => daily.id
            );

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
                  daily_id,
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
                  sort_order,
                  created_at
                `
              )
              .in(
                "daily_id",
                dailyIds
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

          const entryRows =
            (
              entryData ?? []
            ) as EntryRow[];

          const entriesByDailyId =
            new Map<
              string,
              EntryRow[]
            >();

          for (
            const entry of entryRows
          ) {
            const current =
              entriesByDailyId.get(
                entry.daily_id
              ) ?? [];

            current.push(entry);
            entriesByDailyId.set(
              entry.daily_id,
              current
            );
          }

          setRows(
            dailyRows.map(
              (daily) =>
                buildMonthlyRow(
                  daily,
                  entriesByDailyId.get(
                    daily.id
                  ) ?? []
                )
            )
          );
        }
        catch (error) {
          console.error(
            "판매시재 월별 내역 조회 오류:",
            error
          );

          setErrorMessage(
            getErrorMessage(error)
          );
          setRows([]);
        }
        finally {
          setLoading(false);
        }
      },
      [
        selectedMonth,
        supabase,
        today,
      ]
    );

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          void loadMonth();
        },
        0
      );

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [loadMonth]);

  useEffect(() => {
    if (!monthPickerOpen) {
      return;
    }

    const handleKeyDown =
      (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          setMonthPickerOpen(false);
        }
      };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [monthPickerOpen]);

  const totals =
    useMemo(
      () =>
        rows.reduce(
          (result, row) => ({
            cashCollection:
              result.cashCollection +
              row.cashCollection,
            cashRefill:
              result.cashRefill +
              row.cashRefill,
            companyDeposit:
              result.companyDeposit +
              row.companyDeposit,
            expense:
              result.expense +
              row.expense,
            customerCashPayout:
              result.customerCashPayout +
              row.customerCashPayout,
            customerBankPayout:
              result.customerBankPayout +
              row.customerBankPayout,
            compensationIn:
              result.compensationIn +
              row.compensationIn,
            compensationOut:
              result.compensationOut +
              row.compensationOut,
          }),
          {
            cashCollection: 0,
            cashRefill: 0,
            companyDeposit: 0,
            expense: 0,
            customerCashPayout: 0,
            customerBankPayout: 0,
            compensationIn: 0,
            compensationOut: 0,
          }
        ),
      [rows]
    );

  const firstOpeningBalance =
    rows.length > 0
      ? Number(
          rows[0].daily
            .opening_balance ?? 0
        )
      : null;

  const maxMonth =
    today.slice(0, 7);

  const currentYear =
    Number(maxMonth.slice(0, 4));
  const currentMonthNumber =
    Number(maxMonth.slice(5, 7));
  const selectedYear =
    Number(selectedMonth.slice(0, 4));
  const selectedMonthNumber =
    Number(selectedMonth.slice(5, 7));

  const selectedMonthLabel =
    `${selectedYear}년 ${String(selectedMonthNumber).padStart(2, "0")}월`;

  const canMoveNextYear =
    monthPickerYear < currentYear;

  return (
    <div className="space-y-5">
      <section className="rounded-[22px] border border-[#E5E7EA] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-[0.12em] text-[#A50034]">
              CASH LEDGER HISTORY
            </p>

            <h1 className="mt-2 text-[26px] font-black tracking-[-0.03em] text-[#25282D]">
              판매시재 월별 내역
            </h1>

            <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[#777C84]">
              저장된 판매시재를 월 단위로 조회합니다. 날짜별 현금 흐름과 경비·고객지급·차액보전·확정 시재를 한 화면에서 확인할 수 있습니다.
            </p>
          </div>

          <div className="flex items-end gap-2">
            <div className="relative flex w-[190px] shrink-0 flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#777C84]">
                <CalendarDays size={14} />
                조회 월
              </span>

              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={monthPickerOpen}
                onClick={() => {
                  setMonthPickerYear(
                    selectedYear
                  );
                  setMonthPickerOpen(
                    (current) =>
                      !current
                  );
                }}
                className={[
                  "flex h-[44px] w-full items-center justify-between rounded-[12px] border bg-white px-3 text-left transition",
                  monthPickerOpen
                    ? "border-[#A50034] shadow-[0_0_0_3px_rgba(165,0,52,0.07)]"
                    : "border-[#D9DCE1] hover:border-[#BFC3C9] hover:bg-[#FCFCFD]",
                ].join(" ")}
              >
                <span className="text-[13px] font-black tracking-[-0.02em] text-[#34383E]">
                  {selectedMonthLabel}
                </span>
                <ChevronDown
                  size={15}
                  className={[
                    "text-[#8D9299] transition-transform duration-200",
                    monthPickerOpen
                      ? "rotate-180"
                      : "",
                  ].join(" ")}
                />
              </button>

              {monthPickerOpen && (
                <>
                  <button
                    type="button"
                    aria-label="월 선택 닫기"
                    onClick={() =>
                      setMonthPickerOpen(false)
                    }
                    className="fixed inset-0 z-40 cursor-default"
                  />

                  <div
                    role="dialog"
                    aria-label="판매시재 조회 월 선택"
                    className="absolute right-0 top-[calc(100%+10px)] z-50 overflow-hidden rounded-[24px] border border-[#E4E5E8] bg-white shadow-[0_24px_70px_rgba(24,28,34,0.18)]"
                    style={{
                      width: "420px",
                      maxWidth: "calc(100vw - 32px)",
                    }}
                  >
                    <div className="px-5 pb-4 pt-5">
                      <div
                        className="flex items-center justify-between gap-3"
                        style={{ minWidth: 0 }}
                      >
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-label="5년 이전"
                            onClick={() =>
                              setMonthPickerYear(
                                (year) =>
                                  year - 5
                              )
                            }
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E2E4E7] bg-white text-[#9A9EA5] transition hover:border-[#CDD0D5] hover:bg-[#F8F9FA] hover:text-[#555A62]"
                          >
                            <ChevronsLeft size={16} />
                          </button>
                          <button
                            type="button"
                            aria-label="이전 연도"
                            onClick={() =>
                              setMonthPickerYear(
                                (year) =>
                                  year - 1
                              )
                            }
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E2E4E7] bg-white text-[#9A9EA5] transition hover:border-[#CDD0D5] hover:bg-[#F8F9FA] hover:text-[#555A62]"
                          >
                            <ChevronLeft size={16} />
                          </button>
                        </div>

                        <div
                          className="text-center"
                          style={{
                            flex: "1 1 auto",
                            minWidth: 0,
                            padding: "0 8px",
                          }}
                        >
                          <p
                            className="text-[22px] font-black tracking-[-0.04em] text-[#17191D]"
                            style={{ whiteSpace: "nowrap" }}
                          >
                            {monthPickerYear}년
                          </p>
                          <p
                            className="mt-1 text-[9px] font-black tracking-[0.22em] text-[#A50034]"
                            style={{ whiteSpace: "nowrap" }}
                          >
                            LG PREMIUM MONTH
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-label="다음 연도"
                            disabled={!canMoveNextYear}
                            onClick={() =>
                              setMonthPickerYear(
                                (year) =>
                                  Math.min(
                                    year + 1,
                                    currentYear
                                  )
                              )
                            }
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E2E4E7] bg-white text-[#9A9EA5] transition hover:border-[#CDD0D5] hover:bg-[#F8F9FA] hover:text-[#555A62] disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ChevronRight size={16} />
                          </button>
                          <button
                            type="button"
                            aria-label="5년 이후"
                            disabled={!canMoveNextYear}
                            onClick={() =>
                              setMonthPickerYear(
                                (year) =>
                                  Math.min(
                                    year + 5,
                                    currentYear
                                  )
                              )
                            }
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E2E4E7] bg-white text-[#9A9EA5] transition hover:border-[#CDD0D5] hover:bg-[#F8F9FA] hover:text-[#555A62] disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ChevronsRight size={16} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="border-y border-[#F0F1F3] px-5 py-5">
                      <div
                        className="grid gap-3"
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(3, minmax(0, 1fr))",
                        }}
                      >
                        {MONTH_OPTIONS.map(
                          (monthLabel, index) => {
                            const monthNumber =
                              index + 1;
                            const monthValue =
                              `${monthPickerYear}-${String(monthNumber).padStart(2, "0")}`;
                            const isSelected =
                              monthValue ===
                              selectedMonth;
                            const isFuture =
                              monthPickerYear >
                                currentYear ||
                              (monthPickerYear ===
                                currentYear &&
                                monthNumber >
                                  currentMonthNumber);

                            return (
                              <button
                                key={monthValue}
                                type="button"
                                disabled={isFuture}
                                onClick={() => {
                                  setSelectedMonth(
                                    monthValue
                                  );
                                  setMonthPickerOpen(false);
                                }}
                                className={[
                                  "h-[50px] rounded-[14px] text-[13px] font-black transition",
                                  isSelected
                                    ? "bg-[#C9003F] text-white shadow-[0_9px_22px_rgba(201,0,63,0.22)]"
                                    : isFuture
                                      ? "cursor-not-allowed bg-[#FAFAFB] text-[#D6D8DC]"
                                      : "bg-white text-[#42464D] hover:bg-[#F7F8F9] hover:text-[#A50034]",
                                ].join(" ")}
                                style={{
                                  width: "100%",
                                  minWidth: 0,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {monthLabel}
                              </button>
                            );
                          }
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 px-5 py-4">
                      <button
                        type="button"
                        onClick={() =>
                          setMonthPickerOpen(false)
                        }
                        className="h-[40px] rounded-[11px] border border-[#DDE0E4] bg-white px-4 text-[11px] font-black text-[#666B73] transition hover:bg-[#F8F9FA]"
                      >
                        닫기
                      </button>

                      <p
                        className="text-center text-[9px] font-bold text-[#A2A6AC]"
                        style={{ whiteSpace: "nowrap" }}
                      >
                        미래 월은 선택할 수 없습니다
                      </p>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMonth(
                            maxMonth
                          );
                          setMonthPickerYear(
                            currentYear
                          );
                          setMonthPickerOpen(false);
                        }}
                        className="h-[40px] rounded-[11px] bg-[#C9003F] px-4 text-[11px] font-black text-white shadow-[0_8px_20px_rgba(201,0,63,0.18)] transition hover:bg-[#B40038]"
                      >
                        이번 달
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                void loadMonth()
              }
              disabled={loading}
              className="inline-flex h-[44px] shrink-0 items-center justify-center gap-2 rounded-[12px] border border-[#D9DCE1] bg-white px-4 text-[11px] font-black text-[#555A62] transition hover:bg-[#F7F8F9] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? (
                <LoaderCircle
                  size={15}
                  className="animate-spin"
                />
              ) : (
                <RotateCcw size={15} />
              )}
              새로고침
            </button>
          </div>
        </div>
      </section>

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

      <section className="overflow-hidden rounded-[22px] border border-[#E5E7EA] bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-[#ECEEF1] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-[15px] font-black tracking-[-0.02em] text-[#25282D]">
              {selectedMonth} 판매시재
            </h2>
            <p className="mt-1 text-[10px] font-bold leading-5 text-[#92969D]">
              저장된 날짜 기준 · 날짜를 누르면 해당 일자의 당일입력 화면으로 이동합니다.
              월 합계는 현금수금·리필·회사입금·경비·고객지급·차액보전처럼 실제 흐름이 있는 금액만 합산합니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black">
            <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[#6F747C]">
              첫 입력일 이월 {firstOpeningBalance === null ? "-" : formatWon(firstOpeningBalance)}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <span className="inline-flex items-center gap-2 text-[12px] font-bold text-[#858A92]">
              <LoaderCircle
                size={16}
                className="animate-spin"
              />
              월별 판매시재를 불러오는 중
            </span>
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-14 text-center sm:px-6">
            <p className="text-[14px] font-black text-[#555A62]">
              {selectedMonth}에 저장된 판매시재가 없습니다.
            </p>
            <p className="mt-2 text-[11px] leading-5 text-[#92969D]">
              당일입력에서 판매시재를 저장하면 이곳에 자동으로 표시됩니다.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1880px] table-fixed">
              <thead>
                <tr className="bg-[#FAFAFB] text-left text-[10px] font-black text-[#7B8088]">
                  <th className="w-[52px] border-b border-[#ECEEF1] px-3 py-3 text-center">
                    상세
                  </th>
                  <th className="w-[120px] border-b border-[#ECEEF1] px-3 py-3">
                    날짜
                  </th>
                  <th className="w-[92px] border-b border-[#ECEEF1] px-3 py-3">
                    상태
                  </th>
                  <th className="w-[135px] border-b border-[#ECEEF1] px-3 py-3 text-right">
                    전일이월
                  </th>
                  <th className="w-[135px] border-b border-[#ECEEF1] px-3 py-3 text-right">
                    현금수금
                  </th>
                  <th className="w-[125px] border-b border-[#ECEEF1] px-3 py-3 text-right">
                    리필
                  </th>
                  <th className="w-[135px] border-b border-[#ECEEF1] px-3 py-3 text-right">
                    회사입금
                  </th>
                  <th className="w-[125px] border-b border-[#ECEEF1] px-3 py-3 text-right">
                    경비
                  </th>
                  <th className="w-[145px] border-b border-[#ECEEF1] px-3 py-3 text-right">
                    고객지급(현금)
                  </th>
                  <th className="w-[150px] border-b border-[#ECEEF1] px-3 py-3 text-right">
                    고객지급(무통장)
                  </th>
                  <th className="w-[145px] border-b border-[#ECEEF1] px-3 py-3 text-right">
                    예상시재
                  </th>
                  <th className="w-[135px] border-b border-[#ECEEF1] px-3 py-3 text-right">
                    실금액
                  </th>
                  <th className="w-[125px] border-b border-[#ECEEF1] px-3 py-3 text-right">
                    차액
                  </th>
                  <th className="w-[130px] border-b border-[#ECEEF1] px-3 py-3 text-right">
                    차액보전
                  </th>
                  <th className="w-[145px] border-b border-[#ECEEF1] px-3 py-3 text-right">
                    확정시재
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map(
                  (row) => {
                    const status =
                      statusInfo(
                        row.daily.status
                      );
                    const expanded =
                      expandedDailyId ===
                      row.daily.id;
                    const expenses =
                      row.entries.filter(
                        (entry) =>
                          entry.entry_type ===
                          "expense"
                      );
                    const payouts =
                      row.entries.filter(
                        (entry) =>
                          entry.entry_type ===
                          "customer_payout"
                      );

                    return (
                      <Fragment
                        key={row.daily.id}
                      >
                        <tr
                          className="transition hover:bg-[#FCFCFD]"
                        >
                          <td className="border-b border-[#F0F1F3] px-3 py-3 text-center">
                            <button
                              type="button"
                              aria-label={expanded ? "상세 접기" : "상세 펼치기"}
                              onClick={() =>
                                setExpandedDailyId(
                                  expanded
                                    ? null
                                    : row.daily.id
                                )
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-[9px] text-[#777C84] transition hover:bg-[#F1F2F4]"
                            >
                              {expanded ? (
                                <ChevronDown size={15} />
                              ) : (
                                <ChevronRight size={15} />
                              )}
                            </button>
                          </td>

                          <td className="border-b border-[#F0F1F3] px-3 py-3">
                            <button
                              type="button"
                              onClick={() =>
                                onOpenDay(
                                  row.daily.business_date
                                )
                              }
                              className="text-left text-[11px] font-black text-[#315F9B] underline decoration-[#C9D7EA] underline-offset-3 transition hover:text-[#A50034]"
                            >
                              {formatDateLabel(
                                row.daily.business_date
                              )}
                            </button>
                          </td>

                          <td className="border-b border-[#F0F1F3] px-3 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-black ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </td>

                          <td className="border-b border-[#F0F1F3] px-3 py-3 text-right text-[11px] font-bold tabular-nums text-[#555A62]">
                            {formatWon(
                              Number(
                                row.daily.opening_balance ?? 0
                              )
                            )}
                          </td>
                          <td className="border-b border-[#F0F1F3] px-3 py-3 text-right text-[11px] font-black tabular-nums text-[#287348]">
                            {formatWon(row.cashCollection)}
                          </td>
                          <td className="border-b border-[#F0F1F3] px-3 py-3 text-right text-[11px] font-bold tabular-nums text-[#287348]">
                            {formatWon(row.cashRefill)}
                          </td>
                          <td className="border-b border-[#F0F1F3] px-3 py-3 text-right text-[11px] font-bold tabular-nums text-[#A50034]">
                            {formatWon(row.companyDeposit)}
                          </td>
                          <td className="border-b border-[#F0F1F3] px-3 py-3 text-right text-[11px] font-bold tabular-nums text-[#A50034]">
                            {formatWon(row.expense)}
                          </td>
                          <td className="border-b border-[#F0F1F3] px-3 py-3 text-right text-[11px] font-bold tabular-nums text-[#A50034]">
                            {formatWon(row.customerCashPayout)}
                          </td>
                          <td className="border-b border-[#F0F1F3] px-3 py-3 text-right text-[11px] font-bold tabular-nums text-[#315F9B]">
                            {formatWon(row.customerBankPayout)}
                          </td>
                          <td className="border-b border-[#F0F1F3] px-3 py-3 text-right text-[11px] font-black tabular-nums text-[#34383E]">
                            {formatWon(row.expectedBalance)}
                          </td>
                          <td className="border-b border-[#F0F1F3] px-3 py-3 text-right text-[11px] font-bold tabular-nums text-[#555A62]">
                            {row.actualBalance === null
                              ? "-"
                              : formatWon(row.actualBalance)}
                          </td>
                          <td className={`border-b border-[#F0F1F3] px-3 py-3 text-right text-[11px] font-black tabular-nums ${row.difference === null ? "text-[#92969D]" : row.difference === 0 ? "text-[#287348]" : "text-[#A50034]"}`}>
                            {row.difference === null
                              ? "-"
                              : formatSignedWon(row.difference)}
                          </td>
                          <td className={`border-b border-[#F0F1F3] px-3 py-3 text-right text-[11px] font-black tabular-nums ${row.compensationNet === 0 ? "text-[#92969D]" : row.compensationNet > 0 ? "text-[#287348]" : "text-[#A50034]"}`}>
                            {formatSignedWon(
                              row.compensationNet
                            )}
                          </td>
                          <td className="border-b border-[#F0F1F3] px-3 py-3 text-right">
                            {row.daily.confirmed_closing_balance === null ? (
                              <span className="text-[11px] font-black tabular-nums text-[#92969D]">
                                -
                              </span>
                            ) : row.daily.status === "editing" ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="text-[11px] font-black tabular-nums text-[#806B43]">
                                  {formatWon(
                                    Number(
                                      row.daily.confirmed_closing_balance
                                    )
                                  )}
                                </span>
                                <span className="text-[8px] font-black text-[#986219]">
                                  이전 확정
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] font-black tabular-nums text-[#174F34]">
                                {formatWon(
                                  Number(
                                    row.daily.confirmed_closing_balance
                                  )
                                )}
                              </span>
                            )}
                          </td>
                        </tr>

                        {expanded && (
                          <tr key={`${row.daily.id}-detail`}>
                            <td
                              colSpan={15}
                              className="border-b border-[#E6E8EB] bg-[#FAFBFC] px-5 py-5 sm:px-6"
                            >
                              <div className="grid gap-4 xl:grid-cols-[1fr_1fr_0.8fr]">
                                <div className="rounded-[14px] border border-[#E5E7EA] bg-white p-4">
                                  <div className="flex items-center gap-2">
                                    <ReceiptText
                                      size={14}
                                      className="text-[#A50034]"
                                    />
                                    <h3 className="text-[11px] font-black text-[#3D4148]">
                                      매장경비 {expenses.length}건
                                    </h3>
                                  </div>

                                  {expenses.length === 0 ? (
                                    <p className="mt-3 text-[10px] font-bold text-[#9A9EA6]">
                                      등록된 매장경비가 없습니다.
                                    </p>
                                  ) : (
                                    <div className="mt-3 space-y-2">
                                      {expenses.map(
                                        (entry) => (
                                          <div
                                            key={entry.id}
                                            className="rounded-[10px] bg-[#F8F9FA] px-3 py-2.5"
                                          >
                                            <div className="flex items-start justify-between gap-3">
                                              <div className="min-w-0">
                                                <p className="text-[10px] font-black text-[#555A62]">
                                                  {entry.expense_category_id
                                                    ? categoryNameMap.get(entry.expense_category_id) ?? "경비"
                                                    : "경비"}
                                                  {entry.manager_name
                                                    ? ` · ${entry.manager_name}`
                                                    : ""}
                                                </p>
                                                <p className="mt-1 break-words text-[10px] font-bold leading-5 text-[#777C84]">
                                                  {entry.memo || "사용처/내용 없음"}
                                                </p>
                                                {entry.expense_note && (
                                                  <p className="mt-1 break-words text-[9px] leading-4 text-[#9A9EA6]">
                                                    메모: {entry.expense_note}
                                                  </p>
                                                )}
                                              </div>
                                              <span className="shrink-0 text-[11px] font-black tabular-nums text-[#A50034]">
                                                {formatWon(
                                                  Number(entry.amount ?? 0)
                                                )}
                                              </span>
                                            </div>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  )}
                                </div>

                                <div className="rounded-[14px] border border-[#E5E7EA] bg-white p-4">
                                  <div className="flex items-center gap-2">
                                    <BanknoteArrowDown
                                      size={14}
                                      className="text-[#315F9B]"
                                    />
                                    <h3 className="text-[11px] font-black text-[#3D4148]">
                                      고객지급 {payouts.length}건
                                    </h3>
                                  </div>

                                  {payouts.length === 0 ? (
                                    <p className="mt-3 text-[10px] font-bold text-[#9A9EA6]">
                                      등록된 고객지급이 없습니다.
                                    </p>
                                  ) : (
                                    <div className="mt-3 space-y-2">
                                      {payouts.map(
                                        (entry) => (
                                          <div
                                            key={entry.id}
                                            className="rounded-[10px] bg-[#F8F9FA] px-3 py-2.5"
                                          >
                                            <div className="flex items-start justify-between gap-3">
                                              <div className="min-w-0">
                                                <p className="text-[10px] font-black text-[#555A62]">
                                                  {entry.payment_method === "bank_transfer"
                                                    ? "무통장"
                                                    : "현금시재"}
                                                  {entry.customer_name
                                                    ? ` · ${entry.customer_name}`
                                                    : ""}
                                                </p>
                                                <p className="mt-1 break-words text-[10px] font-bold leading-5 text-[#777C84]">
                                                  {entry.memo || "지급사유 없음"}
                                                </p>
                                                {entry.reference_no && (
                                                  <p className="mt-1 text-[9px] leading-4 text-[#9A9EA6]">
                                                    주문/참고번호: {entry.reference_no}
                                                  </p>
                                                )}
                                              </div>
                                              <span className="shrink-0 text-[11px] font-black tabular-nums text-[#A50034]">
                                                {formatWon(
                                                  Number(entry.amount ?? 0)
                                                )}
                                              </span>
                                            </div>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  )}
                                </div>

                                <div className="rounded-[14px] border border-[#E5E7EA] bg-white p-4">
                                  <h3 className="text-[11px] font-black text-[#3D4148]">
                                    시재 / 확정 정보
                                  </h3>

                                  <div className="mt-3 space-y-2.5 text-[10px]">
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="font-bold text-[#8B9098]">
                                        예상시재
                                      </span>
                                      <span className="font-black text-[#34383E]">
                                        {formatWon(row.expectedBalance)}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="font-bold text-[#8B9098]">
                                        실금액
                                      </span>
                                      <span className="font-black text-[#34383E]">
                                        {row.actualBalance === null
                                          ? "-"
                                          : formatWon(row.actualBalance)}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="font-bold text-[#8B9098]">
                                        보전 후 시재
                                      </span>
                                      <span className="font-black text-[#34383E]">
                                        {row.reconciledBalance === null
                                          ? "-"
                                          : formatWon(row.reconciledBalance)}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 border-t border-[#ECEEF1] pt-2.5">
                                      <span className="font-bold text-[#8B9098]">
                                        확정자
                                      </span>
                                      <span className="font-black text-[#34383E]">
                                        {row.daily.confirmed_by ?? "-"}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="font-bold text-[#8B9098]">
                                        확정시간
                                      </span>
                                      <span className="font-black text-[#34383E]">
                                        {formatKstDateTime(
                                          row.daily.confirmed_at
                                        )}
                                      </span>
                                    </div>
                                  </div>

                                  {row.daily.edit_reason && (
                                    <div className="mt-3 rounded-[10px] border border-[#F1DFC0] bg-[#FFF9EF] px-3 py-2.5">
                                      <p className="text-[9px] font-black text-[#986219]">
                                        최근 수정사유
                                      </p>
                                      <p className="mt-1 break-words text-[9px] font-bold leading-4 text-[#806B43]">
                                        {row.daily.edit_reason}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  }
                )}
              </tbody>

              <tfoot>
                <tr className="bg-[#F7F8F9] text-[10px] font-black text-[#555A62]">
                  <td
                    colSpan={3}
                    className="border-t border-[#E1E3E6] px-3 py-4"
                  >
                    월 합계 · {rows.length}일
                  </td>
                  <td className="border-t border-[#E1E3E6] px-3 py-4 text-right text-[#92969D]">
                    -
                  </td>
                  <td className="border-t border-[#E1E3E6] px-3 py-4 text-right tabular-nums text-[#287348]">
                    {formatWon(totals.cashCollection)}
                  </td>
                  <td className="border-t border-[#E1E3E6] px-3 py-4 text-right tabular-nums text-[#287348]">
                    {formatWon(totals.cashRefill)}
                  </td>
                  <td className="border-t border-[#E1E3E6] px-3 py-4 text-right tabular-nums text-[#A50034]">
                    {formatWon(totals.companyDeposit)}
                  </td>
                  <td className="border-t border-[#E1E3E6] px-3 py-4 text-right tabular-nums text-[#A50034]">
                    {formatWon(totals.expense)}
                  </td>
                  <td className="border-t border-[#E1E3E6] px-3 py-4 text-right tabular-nums text-[#A50034]">
                    {formatWon(totals.customerCashPayout)}
                  </td>
                  <td className="border-t border-[#E1E3E6] px-3 py-4 text-right tabular-nums text-[#315F9B]">
                    {formatWon(totals.customerBankPayout)}
                  </td>
                  <td className="border-t border-[#E1E3E6] px-3 py-4 text-right text-[#92969D]">
                    -
                  </td>
                  <td className="border-t border-[#E1E3E6] px-3 py-4 text-right text-[#92969D]">
                    -
                  </td>
                  <td className="border-t border-[#E1E3E6] px-3 py-4 text-right text-[#92969D]">
                    -
                  </td>
                  <td className="border-t border-[#E1E3E6] px-3 py-4 text-right tabular-nums text-[#986219]">
                    {formatSignedWon(
                      totals.compensationIn -
                      totals.compensationOut
                    )}
                  </td>
                  <td className="border-t border-[#E1E3E6] px-3 py-4 text-right text-[#92969D]">
                    -
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
