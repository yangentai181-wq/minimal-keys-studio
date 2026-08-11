import { useCallback, useLayoutEffect, useRef, useState } from "react";

export function useSlidingTabIndicator<T extends string>(activeId: T) {
  const containerRef = useRef<HTMLElement | null>(null);
  const itemsRef = useRef(new Map<T, HTMLElement>());
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    width: number;
  } | null>(null);

  const registerItem = useCallback(
    (id: T) => (element: HTMLElement | null) => {
      if (element) {
        itemsRef.current.set(id, element);
      } else {
        itemsRef.current.delete(id);
      }
    },
    [],
  );

  useLayoutEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const item = itemsRef.current.get(activeId);
      if (!container || !item) {
        setIndicatorStyle(null);
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      if (containerRect.width === 0 || itemRect.width === 0) {
        setIndicatorStyle(null);
        return;
      }

      setIndicatorStyle({
        left: itemRect.left - containerRect.left,
        width: itemRect.width,
      });
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeId]);

  return { containerRef, registerItem, indicatorStyle };
}
