"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";

import {
  MoreHorizontal,
  X,
} from "lucide-react";

import LogoutButton from "@/components/auth/LogoutButton";

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

const primaryPaths = [
  "/daily-performance",
  "/system-performance",
  "/card-management",
  "/closing-report",
];

export default function MobileNav({
  manager,
}: Props) {
  const pathname =
    usePathname();

  const [
    moreOpen,
    setMoreOpen,
  ] = useState(false);

  /*
   * 더보기 메뉴가 열려 있는 동안
   * 뒤쪽 화면 스크롤 방지
   *
   * DOM이라는 외부 시스템을 동기화하는
   * 정상적인 Effect 사용입니다.
   */
  useEffect(() => {
    if (!moreOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [moreOpen]);

  const visibleItems =
    navigationItems.filter(
      (item) =>
        !item.adminOnly ||
        manager.role === "admin"
    );

  const primaryItems =
    visibleItems.filter(
      (item) =>
        primaryPaths.includes(
          item.href
        )
    );

  const moreItems =
    visibleItems.filter(
      (item) =>
        !primaryPaths.includes(
          item.href
        )
    );

  const moreActive =
    moreItems.some(
      (item) =>
        isNavigationItemActive(
          pathname,
          item.href
        )
    );

  return (
    <>
      {/* More Menu */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">

          {/* Background */}
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={() =>
              setMoreOpen(false)
            }
            className="absolute inset-0 bg-black/35"
          />

          {/* More Panel */}
          <section className="absolute bottom-[82px] left-3 right-3 overflow-hidden rounded-[22px] border border-[#E2E4E8] bg-white shadow-[0_20px_70px_rgba(0,0,0,0.18)]">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#ECEEF1] px-5 py-4">

              <div>
                <p className="text-[12px] font-semibold text-[#8A8E96]">
                  원성점 일마감
                </p>

                <p className="mt-1 text-[16px] font-bold text-[#24272C]">
                  {manager.name}
                </p>
              </div>

              <button
                type="button"
                aria-label="닫기"
                onClick={() =>
                  setMoreOpen(false)
                }
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F2F3F5] text-[#5E626A]"
              >
                <X size={18} />
              </button>

            </div>

            {/* More Navigation */}
            <nav className="grid grid-cols-2 gap-2 p-3">

              {moreItems.map((item) => {
                const Icon =
                  item.icon;

                const active =
                  isNavigationItemActive(
                    pathname,
                    item.href
                  );

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() =>
                      setMoreOpen(false)
                    }
                    className={[
                      "flex min-h-[72px] flex-col justify-between rounded-[15px] border p-4 transition",
                      active
                        ? "border-[#E4CBD3] bg-[#FFF5F8] text-[#A50034]"
                        : "border-[#ECEEF1] bg-[#FAFAFB] text-[#3D4148]",
                    ].join(" ")}
                  >
                    <Icon
                      size={20}
                      strokeWidth={2}
                    />

                    <span className="mt-3 text-[13px] font-bold">
                      {item.label}
                    </span>
                  </Link>
                );
              })}

            </nav>

            {/* Logout */}
            <div className="border-t border-[#ECEEF1] p-4">
              <LogoutButton />
            </div>

          </section>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#E0E2E6] bg-white/95 px-1 pb-[calc(6px+env(safe-area-inset-bottom))] pt-1.5 backdrop-blur lg:hidden">

        <div className="mx-auto grid max-w-[620px] grid-cols-5">

          {primaryItems.map((item) => {
            const Icon =
              item.icon;

            const active =
              isNavigationItemActive(
                pathname,
                item.href
              );

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-[12px] text-[10px] font-semibold transition",
                  active
                    ? "text-[#A50034]"
                    : "text-[#7B8088]",
                ].join(" ")}
              >
                <Icon
                  size={21}
                  strokeWidth={
                    active
                      ? 2.3
                      : 1.8
                  }
                />

                <span>
                  {item.shortLabel ??
                    item.label}
                </span>
              </Link>
            );
          })}

          {/* More */}
          <button
            type="button"
            onClick={() =>
              setMoreOpen(true)
            }
            className={[
              "flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-[12px] text-[10px] font-semibold transition",
              moreActive || moreOpen
                ? "text-[#A50034]"
                : "text-[#7B8088]",
            ].join(" ")}
          >
            <MoreHorizontal
              size={22}
              strokeWidth={
                moreActive ||
                moreOpen
                  ? 2.3
                  : 1.8
              }
            />

            <span>
              더보기
            </span>
          </button>

        </div>

      </nav>
    </>
  );
}