"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  isNavigationItemActive,
  navigationItems,
} from "@/config/navigation";

import type {
  ManagerProfile,
} from "@/types/app";

type Props = {
  manager: ManagerProfile;
};

export default function AppSidebar({
  manager,
}: Props) {
  const pathname = usePathname();

  const visibleItems =
    navigationItems.filter(
      (item) =>
        !item.adminOnly ||
        manager.role === "admin"
    );

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-white/5 bg-[#17191D] lg:flex">

      <div className="flex h-[82px] items-center border-b border-white/[0.07] px-6">
        <div>
          <div className="text-[11px] font-bold tracking-[0.18em] text-[#D4265B]">
            WONSUNG DAILY
          </div>

          <div className="mt-1 text-[18px] font-bold tracking-[-0.03em] text-white">
            원성점 일마감
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <div className="space-y-1">

          {visibleItems.map((item) => {
            const active =
              isNavigationItemActive(
                pathname,
                item.href
              );

            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "group relative flex h-[46px] items-center gap-3 rounded-[12px] px-3 text-[14px] font-semibold transition",
                  active
                    ? "bg-white/[0.10] text-white"
                    : "text-[#A8ADB5] hover:bg-white/[0.06] hover:text-white",
                ].join(" ")}
              >
                {active && (
                  <span className="absolute bottom-[10px] left-0 top-[10px] w-[3px] rounded-r-full bg-[#D4265B]" />
                )}

                <Icon
                  size={19}
                  strokeWidth={
                    active ? 2.2 : 1.8
                  }
                  className={
                    active
                      ? "text-white"
                      : "text-[#828791] group-hover:text-white"
                  }
                />

                <span>
                  {item.label}
                </span>
              </Link>
            );
          })}

        </div>
      </nav>

      <div className="border-t border-white/[0.07] p-4">
        <div className="rounded-[14px] bg-white/[0.06] px-4 py-3">

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">

              <p className="truncate text-[13px] font-bold text-white">
                {manager.name}
              </p>

              <p className="mt-1 truncate text-[11px] text-[#8D929B]">
                {manager.employee_no}
              </p>

            </div>

            <span className="shrink-0 rounded-full bg-white/[0.08] px-2.5 py-1 text-[10px] font-semibold text-[#C9CDD3]">
              {manager.role === "admin"
                ? "관리자"
                : "매니저"}
            </span>

          </div>

        </div>
      </div>

    </aside>
  );
}