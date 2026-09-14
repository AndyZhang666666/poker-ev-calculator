"use client";

// EV 柱状图。Chart.js 直接挂在 canvas 上，不引 react-chartjs-2 —— 少一层依赖，
// 而且我们只需要「数据变了就 update」这一个行为。

import { useEffect, useRef } from "react";
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } from "chart.js";
import type { Action, EVResult, OpponentAction } from "@/lib/types";
import { actionLabel } from "@/lib/ev";
import styles from "@/styles/Calculator.module.css";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

const COLORS: Record<Action, string> = { fold: "#9a968f", call: "#3a6ea5", raise: "#d97b2a" };
const BEST = "#2e8b57";

export default function EVChart({ result, opponentAction }: { result: EVResult; opponentAction: OpponentAction }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderColor: [], borderWidth: 2, borderRadius: 6, maxBarThickness: 96 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` EV ${(ctx.parsed.y ?? 0) >= 0 ? "+" : ""}${(ctx.parsed.y ?? 0).toFixed(2)}`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 13, weight: 600 } } },
          y: {
            grid: { color: "#eeece7" },
            ticks: { callback: (v) => `${Number(v) >= 0 ? "+" : ""}${v}` },
          },
        },
      },
    });
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const actions: Action[] = result.raiseAvailable ? ["fold", "call", "raise"] : ["fold", "call"];
    chart.data.labels = actions.map((a) => `${actionLabel(a, opponentAction)}${a === result.bestAction ? " ✓" : ""}`);
    const ds = chart.data.datasets[0];
    ds.data = actions.map((a) => Math.round(result[a] * 100) / 100);
    ds.backgroundColor = actions.map((a) => COLORS[a] + (a === result.bestAction ? "" : "cc"));
    ds.borderColor = actions.map((a) => (a === result.bestAction ? BEST : COLORS[a]));
    // 让 0 轴永远可见，且上下留白
    const vals = ds.data as number[];
    const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
    const pad = Math.max(5, (hi - lo) * 0.15);
    chart.options.scales!.y!.min = Math.floor(lo - pad);
    chart.options.scales!.y!.max = Math.ceil(hi + pad);
    chart.update();
  }, [result, opponentAction]);

  return (
    <div className={styles.chartBox}>
      <canvas ref={canvasRef} role="img" aria-label="三个决策的 EV 柱状图" />
    </div>
  );
}
