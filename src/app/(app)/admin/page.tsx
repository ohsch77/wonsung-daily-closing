import {
  CalendarDays,
  ClipboardList,
  CreditCard,
  Settings2,
  UsersRound,
} from "lucide-react";

import DailyMetricSettingsPanel from "@/components/admin/DailyMetricSettingsPanel";
import ManagerSettingsPanel from "@/components/admin/ManagerSettingsPanel";
import ExpenseCategorySettingsPanel from "@/components/admin/ExpenseCategorySettingsPanel";
import StoreCalendarSettingsPanel from "@/components/admin/StoreCalendarSettingsPanel";
import DataResetPanel from "@/components/admin/DataResetPanel";
import SettingsSectionLink from "@/components/admin/SettingsSectionLink";
import SettingsReturnToCardsButton from "@/components/admin/SettingsReturnToCardsButton";

import type {
  DailyMetricCategorySettingsRow,
  DailyMetricSettingsRow,
} from "@/components/admin/DailyMetricSettingsPanel";

import type {
  ManagerSettingsRow,
} from "@/components/admin/ManagerSettingsPanel";

import type {
  ExpenseCategorySettingsRow,
} from "@/components/admin/ExpenseCategorySettingsPanel";

import {
  createClient,
} from "@/lib/supabase/server";


export const dynamic =
  "force-dynamic";


type AdminManagerRow = {
  id: unknown;
  employee_no: unknown;
  name: unknown;
  role: unknown;
  is_active: unknown;
  display_order: unknown;
  has_login_account: unknown;
};


type DailyMetricSettingsPayload = {
  categories?: unknown;
  metrics?: unknown;
};


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


function toManagerSettingsRow(
  row: AdminManagerRow,
  index: number
): ManagerSettingsRow {
  const rawOrder =
    Number(
      row.display_order
    );

  return {
    id:
      String(
        row.id ?? ""
      ),
    employeeNo:
      String(
        row.employee_no ??
          ""
      ),
    name:
      String(
        row.name ?? ""
      ),
    role:
      row.role === "admin"
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
        : index + 1,
    hasLoginAccount:
      row.has_login_account ===
      true,
  };
}


function toCategoryRows(
  value: unknown
): DailyMetricCategorySettingsRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(
    (item, index) => {
      const row =
        asRecord(item);

      const rawOrder =
        Number(
          row.display_order
        );

      return {
        id:
          String(
            row.id ?? ""
          ),
        code:
          String(
            row.code ?? ""
          ),
        name:
          String(
            row.name ?? ""
          ),
        displayOrder:
          Number.isFinite(
            rawOrder
          ) &&
          rawOrder >= 1
            ? rawOrder
            : (index + 1) * 10,
        isActive:
          row.is_active !==
          false,
        isCustom:
          row.is_custom ===
          true,
        canDelete:
          row.can_delete ===
          true,
      };
    }
  );
}


function toMetricRows(
  value: unknown
): DailyMetricSettingsRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(
    (item, index) => {
      const row =
        asRecord(item);

      const rawOrder =
        Number(
          row.display_order
        );

      const rawEffectSign =
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
            row.id ?? ""
          ),
        categoryId:
          String(
            row.category_id ??
              ""
          ),
        code:
          String(
            row.code ?? ""
          ),
        name:
          String(
            row.name ?? ""
          ),
        unit,
        effectSign:
          rawEffectSign < 0
            ? -1
            : 1,
        aggregationType,
        numeratorMetricId:
          nullableString(
            row.numerator_metric_id
          ),
        denominatorMetricId:
          nullableString(
            row.denominator_metric_id
          ),
        displayOrder:
          Number.isFinite(
            rawOrder
          ) &&
          rawOrder >= 1
            ? rawOrder
            : (index + 1) * 10,
        isActive:
          row.is_active !==
          false,
        isCustom:
          row.is_custom ===
          true,
        hasHistory:
          row.has_history ===
          true,
        isFormulaSource:
          row.is_formula_source ===
          true,
        canDelete:
          row.can_delete ===
          true,
      };
    }
  );
}


function toExpenseCategoryRows(
  value: unknown
): ExpenseCategorySettingsRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(
    (item, index) => {
      const row =
        asRecord(item);

      const rawOrder =
        Number(
          row.sort_order
        );

      return {
        id:
          String(
            row.id ?? ""
          ),

        name:
          String(
            row.name ?? ""
          ),

        sortOrder:
          Number.isFinite(
            rawOrder
          ) &&
          rawOrder >= 1
            ? rawOrder
            : (index + 1) * 10,

        isActive:
          row.is_active !==
          false,

        hasHistory:
          row.has_history ===
          true,

        canDelete:
          row.can_delete ===
          true,
      };
    }
  );
}


export default async function AdminPage() {
  const supabase =
    await createClient();

  const [
    managersResult,
    metricSettingsResult,
    expenseCategoriesResult,
  ] =
    await Promise.all([
      supabase.rpc(
        "admin_list_managers"
      ),
      supabase.rpc(
        "admin_list_daily_metric_settings"
      ),

      supabase.rpc(
        "admin_list_sales_cash_expense_categories"
      ),
    ]);

  if (
    managersResult.error ||
    metricSettingsResult.error ||
    expenseCategoriesResult.error
  ) {
    const errorMessage =
      managersResult.error?.message ??
      metricSettingsResult.error?.message ??
      expenseCategoriesResult.error?.message ??
      "설정 데이터를 불러오지 못했습니다.";

    return (
      <section className="rounded-[22px] border border-[#E5E7EA] bg-white p-8">
        <p className="text-[11px] font-bold tracking-[0.12em] text-[#A50034]">
          SETTINGS
        </p>

        <h2 className="mt-2 text-[24px] font-bold tracking-[-0.03em] text-[#22252A]">
          설정 정보를 불러오지 못했습니다.
        </h2>

        <p className="mt-3 text-[13px] leading-6 text-[#777C84]">
          설정 관련 Supabase SQL 적용상태를 확인해주세요.
        </p>

        <div className="mt-5 rounded-[14px] border border-[#F1DFC0] bg-[#FFF9EF] px-4 py-3">
          <p className="break-words text-[11px] font-bold leading-5 text-[#87621E]">
            {errorMessage}
          </p>
        </div>
      </section>
    );
  }

  const managers =
    (
      (managersResult.data ??
        []) as
        AdminManagerRow[]
    ).map(
      toManagerSettingsRow
    );

  const payload =
    asRecord(
      metricSettingsResult.data
    ) as
      DailyMetricSettingsPayload;

  const categories =
    toCategoryRows(
      payload.categories
    );

  const metrics =
    toMetricRows(
      payload.metrics
    );


  const expenseCategories =
    toExpenseCategoryRows(
      expenseCategoriesResult.data
    );

  const activeManagerCount =
    managers.filter(
      (manager) =>
        manager.isActive
    ).length;

  const adminCount =
    managers.filter(
      (manager) =>
        manager.isActive &&
        manager.role ===
          "admin"
    ).length;

  const activeCategoryCount =
    categories.filter(
      (category) =>
        category.isActive
    ).length;

  const activeInputMetricCount =
    metrics.filter(
      (metric) =>
        metric.isActive &&
        metric.aggregationType !==
          "rate"
    ).length;

  const activeCalculatedMetricCount =
    metrics.filter(
      (metric) =>
        metric.isActive &&
        metric.aggregationType ===
          "rate"
    ).length;


  const activeExpenseCategoryCount =
    expenseCategories.filter(
      (category) =>
        category.isActive
    ).length;

  return (
    <div className="space-y-5">
      <SettingsReturnToCardsButton />
      <section className="rounded-[22px] border border-[#E5E7EA] bg-white p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[#FFF1F4] text-[#A50034]">
            <Settings2
              size={20}
            />
          </div>

          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.12em] text-[#A50034]">
              SETTINGS
            </p>

            <h2 className="mt-1 text-[26px] font-bold tracking-[-0.03em] text-[#22252A]">
              설정
            </h2>

            <p className="mt-2 text-[12px] font-medium leading-5 text-[#777C84]">
              일마감보고 운영에 필요한 기준정보를 관리합니다. 설정 메뉴는 관리자만 사용할 수 있습니다.
            </p>
          </div>
        </div>
      </section>

      <section id="settings-shortcuts" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SettingsSectionLink
          targetId="manager-settings"
          title="매니저 설정 영역으로 이동"
          className="rounded-[18px] border border-[#E5E7EA] bg-white p-5 group cursor-pointer transition duration-150 hover:-translate-y-0.5 hover:border-[#C8CCD2] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#A50034]/20"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#F5F6F7] text-[#777C84]">
            <UsersRound
              size={17}
            />
          </div>

          <h3 className="mt-4 text-[16px] font-black text-[#292C31]">
            매니저 설정
          </h3>

          <p className="mt-1 text-[11px] font-bold leading-5 text-[#7D828A]">
            사용중 {activeManagerCount}명 · 관리자 {adminCount}명
          </p>

          <p className="mt-3 text-[11px] leading-5 text-[#92969D]">
            이름, 권한, 표시순서, 사용여부를 관리합니다.
          </p>
        </SettingsSectionLink>

        <SettingsSectionLink
          targetId="daily-metric-settings"
          title="일실적 항목 영역으로 이동"
          className="rounded-[18px] border border-[#E5E7EA] bg-white p-5 group cursor-pointer transition duration-150 hover:-translate-y-0.5 hover:border-[#C8CCD2] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#A50034]/20"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#F5F6F7] text-[#777C84]">
            <ClipboardList
              size={17}
            />
          </div>

          <h3 className="mt-4 text-[16px] font-black text-[#292C31]">
            일실적 항목
          </h3>

          <p className="mt-1 text-[11px] font-bold leading-5 text-[#7D828A]">
            사용중 분류 {activeCategoryCount}개 · 입력 {activeInputMetricCount}개 · 계산 {activeCalculatedMetricCount}개
          </p>

          <p className="mt-3 text-[11px] leading-5 text-[#92969D]">
            실제 입력항목과 분석용 자동 계산지표를 함께 관리합니다.
          </p>
        </SettingsSectionLink>

        <SettingsSectionLink
          targetId="expense-category-settings"
          title="경비분류 설정 영역으로 이동"
          className="rounded-[18px] border border-[#E5E7EA] bg-white p-5 group cursor-pointer transition duration-150 hover:-translate-y-0.5 hover:border-[#C8CCD2] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#A50034]/20"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#F5F6F7] text-[#777C84]">
            <CreditCard
              size={17}
            />
          </div>

          <h3 className="mt-4 text-[16px] font-black text-[#292C31]">
            경비분류 설정
          </h3>

          <p className="mt-1 text-[11px] font-bold leading-5 text-[#7D828A]">
            사용중 {activeExpenseCategoryCount}개 · 전체 {expenseCategories.length}개
          </p>

          <p className="mt-3 text-[11px] leading-5 text-[#92969D]">
            판매시재의 경비분류, 표시순서와 사용여부를 관리합니다.
          </p>
        </SettingsSectionLink>

        <SettingsSectionLink
          targetId="store-calendar-settings"
          title="지점 운영일 설정 영역으로 이동"
          className="rounded-[18px] border border-[#E5E7EA] bg-white p-5 group cursor-pointer transition duration-150 hover:-translate-y-0.5 hover:border-[#C8CCD2] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#A50034]/20"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#F5F6F7] text-[#777C84]">
            <CalendarDays
              size={17}
            />
          </div>

          <h3 className="mt-4 text-[16px] font-black text-[#292C31]">
            지점 운영일
          </h3>

          <p className="mt-1 text-[11px] font-bold leading-5 text-[#7D828A]">
            정상영업 · 지점휴무 · 휴일영업
          </p>

          <p className="mt-3 text-[11px] leading-5 text-[#92969D]">
            지점휴무 기간을 등록하고 실제 영업일은 휴일영업으로 전환합니다.
          </p>
        </SettingsSectionLink>

        <SettingsSectionLink
          targetId="data-reset"
          title="실적 데이터 초기화 영역으로 이동"
          className="rounded-[18px] border border-[#E7C9D1] bg-[#FFF8FA] p-5 group cursor-pointer transition duration-150 hover:-translate-y-0.5 hover:border-[#C8CCD2] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#A50034]/20"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-white text-[#A50034] shadow-sm">
            <Settings2
              size={17}
            />
          </div>

          <h3 className="mt-4 text-[16px] font-black text-[#292C31]">
            데이터 초기화
          </h3>

          <p className="mt-1 text-[11px] font-bold leading-5 text-[#A50034]">
            관리자 전용 · 실적 데이터만
          </p>

          <p className="mt-3 text-[11px] leading-5 text-[#92969D]">
            기간별 또는 전체 수기·업로드 실적을 안전하게 초기화합니다.
          </p>
        </SettingsSectionLink>
      </section>

      <div id="manager-settings">
  <ManagerSettingsPanel
          initialManagers={
            managers
          }
        />
      </div>

      <div id="daily-metric-settings">
  <DailyMetricSettingsPanel
          initialCategories={
            categories
          }
          initialMetrics={
            metrics
          }
        />
      </div>

      <div id="expense-category-settings">
  <ExpenseCategorySettingsPanel
          initialCategories={
            expenseCategories
          }
        />
      </div>

      <div id="data-reset" className="scroll-mt-24">
        <DataResetPanel />
      </div>

      <div id="store-calendar-settings" className="scroll-mt-24">
  <StoreCalendarSettingsPanel />
      </div>
    </div>
  );
}
