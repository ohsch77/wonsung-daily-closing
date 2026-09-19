"use client";

import type {
  MouseEvent,
  ReactNode,
} from "react";


type SettingsSectionLinkProps = {
  targetId: string;
  title: string;
  className: string;
  children: ReactNode;
};


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


export default function SettingsSectionLink({
  targetId,
  title,
  className,
  children,
}: SettingsSectionLinkProps) {
  const handleClick = (
    event: MouseEvent<HTMLAnchorElement>
  ) => {
    event.preventDefault();

    const target =
      document.getElementById(
        targetId
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
        104;

      scrollParent.scrollTo({
        top: Math.max(0, top),
        behavior: "smooth",
      });
    }
    else {
      const top =
        window.scrollY +
        target.getBoundingClientRect().top -
        104;

      window.scrollTo({
        top: Math.max(0, top),
        behavior: "smooth",
      });
    }

    window.history.replaceState(
      null,
      "",
      `#${targetId}`
    );
  };

  return (
    <a
      href={`#${targetId}`}
      title={title}
      className={className}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
