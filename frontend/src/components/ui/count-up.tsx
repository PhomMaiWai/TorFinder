"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts the first number in `value` up from zero once on screen, keeping any
 * prefix/suffix ("฿450M+"). Renders the final text until it starts, so
 * server output and reduced-motion users see the real figure.
 */
export function CountUp({ value, duration = 1200 }: { value: string | number; duration?: number }) {
  const text = String(value);
  const match = /^(\D*)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(text);
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState<number | null>(null);

  const target = match ? Number(match[2].replace(/,/g, "")) : 0;
  const decimals = match?.[2].split(".")[1]?.length ?? 0;
  const grouped = match?.[2].includes(",") ?? false;

  useEffect(() => {
    const node = ref.current;
    if (!node || !match) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / duration, 1);
        setShown(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) frame = requestAnimationFrame(tick);
        else setShown(null);
      };
      setShown(0);
      frame = requestAnimationFrame(tick);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, duration]);

  if (!match) return <span>{text}</span>;

  const body =
    shown === null
      ? match[2]
      : shown.toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
          useGrouping: grouped,
        });

  return (
    <span ref={ref} className="tabular-nums">
      {match[1]}
      {body}
      {match[3]}
    </span>
  );
}
