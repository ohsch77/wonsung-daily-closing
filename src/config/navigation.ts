import type { LucideIcon } from "lucide-react";

import {
  ClipboardList,
  FileText,
  Building2,
  CreditCard,
  Wallet,
  BarChart3,
  Settings,
} from "lucide-react";

export type NavigationItem = {
  href: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

export const navigationItems: NavigationItem[] = [
  {
    href: "/daily-performance",
    label: "일실적",
    shortLabel: "일실적",
    icon: ClipboardList,
  },
  {
    href: "/system-performance",
    label: "전산실적",
    icon: Building2,
  },
  {
    href: "/card-management",
    label: "카드실적",
    icon: CreditCard,
  },
  {
    href: "/cash-ledger",
    label: "판매시재",
    shortLabel: "시재",
    icon: Wallet,
  },
  {
    href: "/closing-report",
    label: "마감보고",
    shortLabel: "보고",
    icon: FileText,
  },
  {
    href: "/analytics",
    label: "분석",
    icon: BarChart3,
  },
  {
    href: "/admin",
    label: "설정",
    icon: Settings,
    adminOnly: true,
  },
];

export function isNavigationItemActive(
  pathname: string,
  href: string
) {
  return (
    pathname === href ||
    pathname.startsWith(`${href}/`)
  );
}
