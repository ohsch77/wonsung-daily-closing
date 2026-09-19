"use client";

import {
  useCallback,
  useState,
} from "react";

import {
  CalendarDays,
  PencilLine,
} from "lucide-react";

import CashLedgerWorkspace from "@/components/cash-ledger/CashLedgerWorkspace";
import CashLedgerMonthlyHistory from "@/components/cash-ledger/CashLedgerMonthlyHistory";

import type {
  CashExpenseCategory,
  CashExpenseManager,
} from "@/components/cash-ledger/CashLedgerWorkspace";


type Props = {
  today: string;
  currentManagerName: string;
  categories: CashExpenseCategory[];
  managers: CashExpenseManager[];
};


type ViewMode =
  | "daily"
  | "monthly";


export default function CashLedgerCenter({
  today,
  currentManagerName,
  categories,
  managers,
}: Props) {
  const [
    viewMode,
    setViewMode,
  ] = useState<ViewMode>(
    "daily"
  );

  const [
    dailyDate,
    setDailyDate,
  ] = useState(today);

  const handleDailyDateChange =
    useCallback(
      (date: string) => {
        setDailyDate(date);
      },
      []
    );

  const handleOpenDay =
    useCallback(
      (date: string) => {
        setDailyDate(date);
        setViewMode("daily");
      },
      []
    );

  return (
    <div className="space-y-5">
      <section className="rounded-[18px] border border-[#E5E7EA] bg-white p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-1 sm:inline-grid sm:min-w-[300px]">
          <button
            type="button"
            onClick={() =>
              setViewMode("daily")
            }
            className={[
              "inline-flex h-[42px] items-center justify-center gap-2 rounded-[11px] px-4 text-[12px] font-black transition",
              viewMode === "daily"
                ? "bg-[#A50034] text-white shadow-sm"
                : "text-[#686D75] hover:bg-[#F5F6F7]",
            ].join(" ")}
          >
            <PencilLine size={15} />
            당일입력
          </button>

          <button
            type="button"
            onClick={() =>
              setViewMode("monthly")
            }
            className={[
              "inline-flex h-[42px] items-center justify-center gap-2 rounded-[11px] px-4 text-[12px] font-black transition",
              viewMode === "monthly"
                ? "bg-[#A50034] text-white shadow-sm"
                : "text-[#686D75] hover:bg-[#F5F6F7]",
            ].join(" ")}
          >
            <CalendarDays size={15} />
            월별내역
          </button>
        </div>
      </section>

      <div
        className={
          viewMode === "daily"
            ? "block"
            : "hidden"
        }
      >
        <CashLedgerWorkspace
          today={today}
          initialDate={dailyDate}
          onSelectedDateChange={
            handleDailyDateChange
          }
          currentManagerName={
            currentManagerName
          }
          categories={categories}
          managers={managers}
        />
      </div>

      {viewMode === "monthly" && (
        <CashLedgerMonthlyHistory
          today={today}
          categories={categories}
          onOpenDay={handleOpenDay}
        />
      )}
    </div>
  );
}
