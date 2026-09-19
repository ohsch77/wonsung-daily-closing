"use client";

import {
  ChevronUp,
  LayoutGrid,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";


function findScrollParent(
  element: HTMLElement
) {
  let parent =
    element.parentElement;

  while (
    parent &&
    parent !== document.body
  ) {
    const style =
      window.getComputedStyle(
        parent
      );
    const overflowY =
      style.overflowY;

    if (
      (overflowY === "auto" ||
        overflowY === "scroll") &&
      parent.scrollHeight >
        parent.clientHeight
    ) {
      return parent;
    }

    parent =
      parent.parentElement;
  }

  return null;
}


export default function SettingsReturnToCardsButton() {
  const [visible, setVisible] =
    useState(false);

  const updateVisibility =
    useCallback(() => {
      const target =
        document.getElementById(
          "settings-shortcuts"
        );

      if (!target) {
        setVisible(false);
        return;
      }

      const rect =
        target.getBoundingClientRect();

      setVisible(
        rect.bottom < 86
      );
    }, []);

  useEffect(() => {
    let frameId =
      window.requestAnimationFrame(
        updateVisibility
      );

    const target =
      document.getElementById(
        "settings-shortcuts"
      );

    if (!target) {
      return () => {
        window.cancelAnimationFrame(
          frameId
        );
      };
    }

    const scrollParent =
      findScrollParent(target);

    const handleScroll = () => {
      window.cancelAnimationFrame(
        frameId
      );

      frameId =
        window.requestAnimationFrame(
          updateVisibility
        );
    };

    const scrollTarget:
      | HTMLElement
      | Window =
      scrollParent ?? window;

    scrollTarget.addEventListener(
      "scroll",
      handleScroll,
      {
        passive: true,
      }
    );

    window.addEventListener(
      "resize",
      handleScroll
    );

    return () => {
      window.cancelAnimationFrame(
        frameId
      );

      scrollTarget.removeEventListener(
        "scroll",
        handleScroll
      );
      window.removeEventListener(
        "resize",
        handleScroll
      );
    };
  }, [updateVisibility]);

  const handleReturn = () => {
    const target =
      document.getElementById(
        "settings-shortcuts"
      );

    if (!target) {
      return;
    }

    const scrollParent =
      findScrollParent(target);

    if (scrollParent) {
      const parentRect =
        scrollParent.getBoundingClientRect();
      const targetRect =
        target.getBoundingClientRect();
      const top =
        scrollParent.scrollTop +
        targetRect.top -
        parentRect.top -
        16;

      scrollParent.scrollTo({
        top: Math.max(0, top),
        behavior: "smooth",
      });
    }
    else {
      const top =
        window.scrollY +
        target.getBoundingClientRect().top -
        72;

      window.scrollTo({
        top: Math.max(0, top),
        behavior: "smooth",
      });
    }

    window.history.replaceState(
      null,
      "",
      window.location.pathname +
        window.location.search
    );
  };

  if (!visible) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleReturn}
      className="z-[90] inline-flex h-11 items-center gap-2 rounded-full border border-[#E0C8CF] bg-white px-4 text-[11px] font-black text-[#A50034] shadow-[0_12px_34px_rgba(0,0,0,0.15)] transition hover:-translate-y-0.5 hover:bg-[#FFF7F9] focus:outline-none focus:ring-2 focus:ring-[#A50034]/20"
      style={{
        position: "fixed",
        right: 24,
        bottom: 24,
      }}
      aria-label="설정 상단 카드로 이동"
      title="설정 상단 카드로 이동"
    >
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#FFF1F4]">
        <ChevronUp
          size={14}
        />
      </span>

      <span className="hidden sm:inline">
        설정 메뉴
      </span>

      <LayoutGrid
        size={14}
        className="sm:hidden"
      />
    </button>
  );
}
