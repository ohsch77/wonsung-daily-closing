"use client";

import { usePathname } from "next/navigation";

import LogoutButton from "@/components/auth/LogoutButton";

import {
  navigationItems,
} from "@/config/navigation";

import type {
  ManagerProfile,
} from "@/types/app";

type Props = {
  manager: ManagerProfile;
};

function getPageTitle(
  pathname: string
) {
  const match =
    navigationItems.find(
      (item) =>
        pathname === item.href ||
        pathname.startsWith(
          `${item.href}/`
        )
    );

  return match?.label ?? "원성점 일마감";
}

export default function AppHeader({
  manager,
}: Props) {
  const pathname =
    usePathname();

  const pageTitle =
    getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-[#E6E8EC] bg-white/95 backdrop-blur">

      <div className="flex min-h-[68px] items-center justify-between gap-4 px-4 sm:px-6 lg:min-h-[74px] lg:px-8">

        <div className="min-w-0">

          <p className="hidden text-[11px] font-bold tracking-[0.14em] text-[#A50034] lg:block">
            WONSUNG DAILY
          </p>

          <h1 className="truncate text-[20px] font-bold tracking-[-0.04em] text-[#1D1F23] lg:mt-1 lg:text-[22px]">
            {pageTitle}
          </h1>

        </div>

        <div className="flex items-center gap-3 sm:gap-4">

          <div className="text-right">
            <p className="text-[13px] font-bold text-[#292C31] sm:text-[14px]">
              {manager.name}
            </p>

            <p className="mt-0.5 hidden text-[11px] text-[#8A8E96] sm:block">
              {manager.employee_no}
              {" · "}
              {manager.role === "admin"
                ? "관리자"
                : "매니저"}
            </p>
          </div>

          <div className="hidden sm:block">
            <LogoutButton />
          </div>

        </div>

      </div>

    </header>
  );
}