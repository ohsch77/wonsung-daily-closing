export function findAnalyticsScrollParent(
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

    if (
      (
        style.overflowY ===
          "auto" ||
        style.overflowY ===
          "scroll"
      ) &&
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


export function scrollToAnalyticsTarget(
  targetId: string
) {
  const target =
    document.getElementById(
      targetId
    );

  if (!target) {
    return;
  }

  const scrollParent =
    findAnalyticsScrollParent(
      target
    );

  if (scrollParent) {
    const parentRect =
      scrollParent.getBoundingClientRect();
    const targetRect =
      target.getBoundingClientRect();

    const top =
      scrollParent.scrollTop +
      targetRect.top -
      parentRect.top -
      18;

    scrollParent.scrollTo({
      top: Math.max(
        0,
        top
      ),
      behavior: "smooth",
    });

    return;
  }

  const top =
    window.scrollY +
    target.getBoundingClientRect()
      .top -
    88;

  window.scrollTo({
    top: Math.max(
      0,
      top
    ),
    behavior: "smooth",
  });
}


export function scheduleAnalyticsScroll(
  targetId: string
) {
  window.requestAnimationFrame(
    () => {
      window.requestAnimationFrame(
        () => {
          scrollToAnalyticsTarget(
            targetId
          );
        }
      );
    }
  );
}
