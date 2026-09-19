import {
  redirect,
} from "next/navigation";

import CashLedgerCenter from "@/components/cash-ledger/CashLedgerCenter";

import {
  createClient,
} from "@/lib/supabase/server";

import type {
  CashExpenseCategory,
  CashExpenseManager,
} from "@/components/cash-ledger/CashLedgerWorkspace";


export const dynamic =
  "force-dynamic";


function getKstToday() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "Asia/Seoul",
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const year =
    parts.find(
      (part) =>
        part.type === "year"
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type === "month"
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type === "day"
    )?.value;

  if (
    !year ||
    !month ||
    !day
  ) {
    throw new Error(
      "한국 날짜를 계산할 수 없습니다."
    );
  }

  return `${year}-${month}-${day}`;
}


export default async function CashLedgerPage() {
  const supabase =
    await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } =
    await supabase.auth
      .getClaims();

  const userId =
    claimsData?.claims?.sub;

  if (
    claimsError ||
    !userId
  ) {
    redirect(
      "/login"
    );
  }

  const [
    managerResult,
    categoriesResult,
    expenseManagersResult,
  ] =
    await Promise.all([
      supabase
        .from("managers")
        .select(
          "id,name,role,is_active"
        )
        .eq(
          "auth_user_id",
          userId
        )
        .maybeSingle(),

      supabase
        .from(
          "sales_cash_expense_categories"
        )
        .select(
          "id,name,sort_order,is_active"
        )
        .order(
          "sort_order",
          {
            ascending: true,
          }
        )
        .order(
          "name",
          {
            ascending: true,
          }
        ),

      supabase
        .from("managers")
        .select(
          "id,name,is_active,display_order"
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "display_order",
          {
            ascending: true,
          }
        )
        .order(
          "name",
          {
            ascending: true,
          }
        ),
    ]);

  if (
    managerResult.error ||
    !managerResult.data ||
    !managerResult.data.is_active
  ) {
    redirect(
      "/closing-report"
    );
  }

  if (categoriesResult.error) {
    return (
      <section className="rounded-[22px] border border-[#E5E7EA] bg-white p-8">
        <p className="text-[11px] font-bold tracking-[0.12em] text-[#A50034]">
          CASH LEDGER
        </p>

        <h2 className="mt-2 text-[24px] font-bold tracking-[-0.03em] text-[#22252A]">
          판매시재 경비분류를 불러오지 못했습니다.
        </h2>

        <p className="mt-3 text-[13px] leading-6 text-[#777C84]">
          판매시재 경비분류 테이블과 Supabase 권한 연결상태를 확인해주세요.
        </p>
      </section>
    );
  }

  const categories:
    CashExpenseCategory[] =
    (
      categoriesResult.data ??
      []
    ).map(
      (category) => ({
        id:
          String(
            category.id
          ),
        name:
          String(
            category.name
          ),
        isActive:
          category.is_active !==
          false,
      })
    );


  const managers:
    CashExpenseManager[] =
    expenseManagersResult.error
      ? [
          {
            id:
              String(
                managerResult.data.id
              ),
            name:
              String(
                managerResult.data.name
              ),
          },
        ]
      : (
          expenseManagersResult.data ??
          []
        ).map(
          (manager) => ({
            id:
              String(
                manager.id
              ),
            name:
              String(
                manager.name
              ),
          })
        );

  return (
    <CashLedgerCenter
      today={getKstToday()}
      currentManagerName={
        String(
          managerResult.data.name
        )
      }
      categories={categories}
      managers={managers}
    />
  );
}
