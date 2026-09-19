"use client";

import {
  BarChart3,
  Building2,
  CalendarRange,
  CircleDollarSign,
  CreditCard,
  Gauge,
  ReceiptText,
  TrendingUp,
  UsersRound,
  WalletCards,
} from "lucide-react";
import {
  useState,
} from "react";

import AnalyticsWorkspace from "@/components/analytics/AnalyticsWorkspace";
import StorePerformanceAnalytics from "@/components/analytics/StorePerformanceAnalytics";
import ManagerPerformanceAnalytics from "@/components/analytics/ManagerPerformanceAnalytics";
import { scheduleAnalyticsScroll } from "@/lib/analytics-scroll";


type AnalyticsSection =
  | "overview"
  | "store-performance"
  | "manager-performance"
  | "system-comparison"
  | "card-analysis"
  | "cash-analysis"
  | "expense-analysis"
  | "annual-evaluation";


type AnalyticsMenuItem = {
  key: AnalyticsSection;
  title: string;
  description: string;
  detailLines: string[];
  Icon: typeof BarChart3;
};


const ANALYTICS_MENU: AnalyticsMenuItem[] = [
  {
    key: "overview",
    title: "종합분석",
    description:
      "지점 운영 핵심지표를 한 화면에서 종합 비교합니다.",
    detailLines: [
      "일실적 · 전산실적 · 카드실적 핵심지표",
      "판매시재 · 경비 · 시재차액",
      "월간 일별 추이와 매니저 요약",
    ],
    Icon: Gauge,
  },
  {
    key: "store-performance",
    title: "지점 실적",
    description:
      "지점 전체 실적의 월별·일자별 변화 추이를 분석합니다.",
    detailLines: [
      "선택기간의 월별 실적",
      "선택월의 일자별 실적",
      "일실적 항목별 차트 · 표",
    ],
    Icon: Building2,
  },
  {
    key: "manager-performance",
    title: "매니저 실적",
    description:
      "전체 매니저 비교와 개별 매니저 실적 추이를 확인합니다.",
    detailLines: [
      "전체 매니저 항목별 비교",
      "개별 매니저 월별 · 일자별 추이",
      "근무일수 · 근무일 평균 · 무실적일",
    ],
    Icon: UsersRound,
  },
  {
    key: "system-comparison",
    title: "전산 비교",
    description:
      "일실적과 전산 판매·매출의 차이와 추이를 비교합니다.",
    detailLines: [
      "일실적 ↔ 전산 판매 비교",
      "전산 판매 · 전산 매출 추이",
      "차이 발생일과 월별 차이",
    ],
    Icon: TrendingUp,
  },
  {
    key: "card-analysis",
    title: "카드분석",
    description:
      "카드 승인·취소·순액의 변화를 기간별로 분석합니다.",
    detailLines: [
      "승인액 · 취소액 · 순액",
      "월별 · 일자별 변화",
      "취소율과 취소 추이",
    ],
    Icon: CreditCard,
  },
  {
    key: "cash-analysis",
    title: "판매시재",
    description:
      "판매시재의 수금·지급·차액 흐름을 분석합니다.",
    detailLines: [
      "현금수금 · 고객지급",
      "시작시재 · 확정시재 · 차액",
      "월별 · 일자별 시재 흐름",
    ],
    Icon: WalletCards,
  },
  {
    key: "expense-analysis",
    title: "경비분석",
    description:
      "매장 경비를 분류별·기간별로 분석합니다.",
    detailLines: [
      "경비분류별 사용금액",
      "월별 · 일자별 경비 추이",
      "분류별 비중과 증감",
    ],
    Icon: ReceiptText,
  },
  {
    key: "annual-evaluation",
    title: "연간평가자료",
    description:
      "연간 실적과 실제 근무일 데이터를 평가자료로 정리합니다.",
    detailLines: [
      "연간 총실적 · 월평균",
      "총근무일수 · 근무일 평균",
      "무실적 근무일 · 주요 항목 추이",
    ],
    Icon: CalendarRange,
  },
];


function AnalyticsMenuCard({
  item,
  selected,
  onClick,
}: {
  item: AnalyticsMenuItem;
  selected: boolean;
  onClick: () => void;
}) {
  const Icon = item.Icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "min-h-[172px] rounded-[20px] border p-5 text-left transition duration-150",
        "hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#A50034]/20",
        selected
          ? "border-[#D8A7B6] bg-[#FFF8FA]"
          : "border-[#E5E7EA] bg-white hover:border-[#C8CCD2]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={[
            "flex h-10 w-10 items-center justify-center rounded-[12px]",
            selected
              ? "bg-white text-[#A50034] shadow-sm"
              : "bg-[#F5F6F7] text-[#737880]",
          ].join(" ")}
        >
          <Icon size={18} />
        </div>

        <span
          className={[
            "rounded-full px-2.5 py-1 text-[9px] font-black",
            selected
              ? "bg-[#A50034] text-white"
              : "bg-[#F5F6F7] text-[#8B9098]",
          ].join(" ")}
        >
          상세보기
        </span>
      </div>

      <h2 className="mt-4 text-[17px] font-black tracking-[-0.025em] text-[#292C31]">
        {item.title}
      </h2>

      <p className="mt-1.5 text-[11px] font-semibold leading-5 text-[#8C9199]">
        {item.description}
      </p>

      <div className="mt-3 space-y-1">
        {item.detailLines.slice(0, 2).map((line) => (
          <p
            key={line}
            className="flex items-center gap-2 text-[10px] font-bold text-[#6E737B]"
          >
            <span className="h-1 w-1 shrink-0 rounded-full bg-[#A50034]/60" />
            <span>{line}</span>
          </p>
        ))}
      </div>
    </button>
  );
}


function PendingSection({
  item,
}: {
  item: AnalyticsMenuItem;
}) {
  const Icon = item.Icon;

  return (
    <section className="rounded-[22px] border border-[#E5E7EA] bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-[#FFF1F5] text-[#A50034]">
              <Icon size={20} />
            </div>

            <div>
              <p className="text-[10px] font-black tracking-[0.12em] text-[#A50034]">
                DETAIL ANALYTICS
              </p>
              <h2 className="mt-1 text-[22px] font-black tracking-[-0.035em] text-[#25282D]">
                {item.title}
              </h2>
            </div>
          </div>

          <p className="mt-4 max-w-[720px] text-[12px] font-semibold leading-6 text-[#8A8F97]">
            {item.description}
          </p>
        </div>

        <div className="rounded-full border border-[#E3E5E8] bg-[#FAFAFB] px-3 py-1.5 text-[10px] font-black text-[#777C84]">
          상세 구현 단계
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {item.detailLines.map((line, index) => (
          <div
            key={line}
            className="rounded-[16px] border border-[#E8EAED] bg-[#FAFAFB] p-4"
          >
            <p className="text-[9px] font-black tracking-[0.08em] text-[#A50034]">
              {String(index + 1).padStart(2, "0")}
            </p>
            <p className="mt-2 text-[12px] font-black leading-5 text-[#3D4249]">
              {line}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-[16px] border border-dashed border-[#D9DCE1] bg-[#FCFCFD] px-5 py-8 text-center">
        <BarChart3
          size={24}
          className="mx-auto text-[#A6AAB1]"
        />
        <p className="mt-3 text-[12px] font-black text-[#656A72]">
          이 영역에 기간선택 · 항목선택 · 차트 · 상세표를 순차 구현합니다.
        </p>
        <p className="mt-1 text-[10px] font-semibold text-[#A0A4AA]">
          지점 실적과 매니저 실적은 항목별 추이 차트를 우선 구현합니다.
        </p>
      </div>
    </section>
  );
}


export default function AnalyticsHub() {
  const [selectedSection, setSelectedSection] =
    useState<AnalyticsSection>("overview");

  const selectedItem =
    ANALYTICS_MENU.find(
      (item) =>
        item.key === selectedSection
    ) ?? ANALYTICS_MENU[0];

  const handleSelectSection = (
    section: AnalyticsSection
  ) => {
    setSelectedSection(
      section
    );

    scheduleAnalyticsScroll(
      "analytics-detail-title"
    );
  };

  return (
    <div className="space-y-5 pb-8">
      <section className="rounded-[22px] border border-[#E5E7EA] bg-white p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-[#FFF1F5] text-[#A50034]">
            <BarChart3 size={20} />
          </div>

          <div>
            <p className="text-[10px] font-black tracking-[0.14em] text-[#A50034]">
              ANALYTICS CENTER
            </p>
            <h1 className="mt-1 text-[26px] font-black tracking-[-0.04em] text-[#202226]">
              분석
            </h1>
          </div>
        </div>

        <p className="mt-3 text-[12px] font-semibold leading-5 text-[#8B9098]">
          지점 실적부터 매니저 실적·전산·카드·판매시재·경비까지 분석 목적에 맞는 메뉴를 선택합니다.
        </p>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-black text-[#30343A]">
              분석 메뉴
            </h2>
            <p className="mt-1 text-[10px] font-semibold text-[#9A9EA5]">
              원하는 분석 카드를 선택하면 아래 상세분석 영역이 전환됩니다.
            </p>
          </div>

          <div className="hidden items-center gap-2 rounded-full bg-[#F5F6F7] px-3 py-1.5 text-[10px] font-black text-[#777C84] sm:flex">
            <CircleDollarSign size={12} />
            8개 분석영역
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {ANALYTICS_MENU.map((item) => (
            <AnalyticsMenuCard
              key={item.key}
              item={item}
              selected={
                selectedSection === item.key
              }
              onClick={() =>
                handleSelectSection(
                  item.key
                )
              }
            />
          ))}
        </div>
      </section>

      <div id="analytics-detail-title" className="border-t border-[#E2E4E7] pt-5">
        {selectedSection === "overview" ? (
          <AnalyticsWorkspace />
        ) : selectedSection === "store-performance" ? (
          <StorePerformanceAnalytics />
        ) : selectedSection === "manager-performance" ? (
          <ManagerPerformanceAnalytics />
        ) : (
          <PendingSection
            item={selectedItem}
          />
        )}
      </div>
    </div>
  );
}
