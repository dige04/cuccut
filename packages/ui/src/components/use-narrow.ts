import { useEffect, useState, type RefObject } from 'react';

/** Returns true when the element is narrower than `width`. Containers whose spacing changes with the mode use border-box, so the content width does not flip the mode back. */
export function useNarrow(ref: RefObject<HTMLElement | null>, width: number, box: 'content-box' | 'border-box' = 'content-box'): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const measured = box === 'border-box'
        ? (entry?.borderBoxSize?.[0]?.inlineSize ?? element.getBoundingClientRect().width)
        : (entry?.contentRect.width ?? width);
      setNarrow(measured < width);
    });
    observer.observe(element, { box });
    return () => observer.disconnect();
  }, [ref, width, box]);
  return narrow;
}
