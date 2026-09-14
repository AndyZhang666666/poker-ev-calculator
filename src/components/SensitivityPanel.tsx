"use client";

// Tab 2：敏感性分析。x = 手牌强度 0..100，y = 三个决策的 EV。
// 其余参数沿用 tab 1 的当前值，所以这页是「在你现在这个局面下，牌要多强才该跟 / 该加」。

import { useEffect, useMemo, useRef } from "react";
import { Chart, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Filler } from "chart.js";
import styles from "@/styles/Calculator.module.css";
import type { EVParams, OpponentAction } from "@/lib/types";
import { actionLabel, sensitivityAnalysis, calculateEV } from "@/lib/ev";

Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Filler);

const C = { fold: "#9a968f", call: "#3a6ea5", raise: "#d97b2a" };

/** 找 0..100 上「最优决策」的分段边界（步长 1） */
function zones(params: EVParams) {
  const out: { action: "fold" | "call" | "raise"; from: number; to: number }[] = [];
  for (let s = 0; s <= 100; s++) {
    const b = calculateEV({ ...params, handStrength: s }).bestAction;
    const last = out[out.length - 1];
    if (last && last.action === b) last.to = s;
    else out.push({ action: b, from: s, to: s });
  }
  return out;
}

export default function SensitivityPanel({ params, currentStrength }: { params: EVParams; currentStrength: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const oa: OpponentAction = params.opponentAction;

  const points = useMemo(() => sensitivityAnalysis(params, 5), [params]);
  const zs = useMemo(() => zones(params), [params]);
  const be = useMemo(() => calculateEV(params).breakEvenStrength, [params]);
  const raiseAvailable = calculateEV(params).raiseAvailable;

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => `手牌强度 ${items[0]?.label}`,
              label: (ctx) => ` ${ctx.dataset.label}: ${(ctx.parsed.y ?? 0) >= 0 ? "+" : ""}${(ctx.parsed.y ?? 0).toFixed(1)}`,
            },
          },
        },
        scales: {
          x: { title: { display: true, text: "手牌强度" }, grid: { display: false } },
          y: { title: { display: true, text: "EV（筹码）" }, grid: { color: "#eeece7" } },
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
    chart.data.labels = points.map((p) => String(p.handStrength));
    const mk = (key: "fold" | "call" | "raise", color: string, dash?: number[]) => ({
      label: actionLabel(key, oa),
      data: points.map((p) => Math.round(p[key] * 100) / 100),
      borderColor: color,
      backgroundColor: color + "22",
      borderWidth: key === "fold" ? 1.5 : 2.5,
      borderDash: dash,
      pointRadius: points.map((p) => (p.handStrength === Math.round(currentStrength / 5) * 5 ? 5 : 0)),
      pointBackgroundColor: color,
      tension: 0.25,
      fill: false,
    });
    chart.data.datasets = [
      mk("fold", C.fold, [4, 4]),
      mk("call", C.call),
      ...(raiseAvailable ? [mk("raise", C.raise)] : []),
    ];
    chart.update();
  }, [points, oa, currentStrength, raiseAvailable]);

  const zoneColor = (a: string) => (a === "fold" ? C.fold : a === "call" ? C.call : C.raise);

  return (
    <div>
      <div className={styles.panel}>
        <h2>
          EV vs 手牌强度
          <small>
            底池 {params.pot} · 对手{oa === "check" ? "过牌" : `${oa === "bet" ? "下注" : "加注"} ${params.opponentBet}`} · 对手
            {params.opponentType === "loose" ? "松" : params.opponentType === "tight" ? "紧" : "平衡"} · 当前强度 {currentStrength}
          </small>
        </h2>
        <div className={styles.legend}>
          <span className={styles.fold}>{actionLabel("fold", oa)}（恒 0）</span>
          <span className={styles.call}>{actionLabel("call", oa)}</span>
          {raiseAvailable && <span className={styles.raise}>{actionLabel("raise", oa)}</span>}
          <span style={{ marginLeft: "auto" }}>● 当前位置</span>
        </div>
        <div className={styles.lineBox}>
          <canvas ref={canvasRef} role="img" aria-label="EV 随手牌强度变化的曲线" />
        </div>

        <div className={styles.zones}>
          {zs.map((z, i) => (
            <div key={i} className={styles.zone} style={{ borderLeftColor: zoneColor(z.action) }}>
              <div className={styles.zname}>强度 {z.from === z.to ? z.from : `${z.from} – ${z.to}`}</div>
              <div className={styles.zrange}>{actionLabel(z.action, oa)}</div>
            </div>
          ))}
        </div>

        <div className={styles.note}>
          {be !== null ? (
            <>
              <b>跟注临界点：手牌强度 {be.toFixed(1)}</b>。这里跟注 EV = 0，即胜率恰好等于底池赔率{" "}
              {((Math.min(params.opponentBet, params.myStack) / (params.pot + params.opponentBet + Math.min(params.opponentBet, params.myStack))) * 100).toFixed(1)}%。
              强度再低一点就该弃牌 —— 除非加注能把对手逼走。
            </>
          ) : oa === "check" ? (
            <>对手过牌，{actionLabel("call", oa)}不花钱，永远不亏，所以没有临界点；问题只剩「要不要下注」。</>
          ) : (
            <>在当前底池赔率下，跟注所需胜率超出了模型 5%–95% 的可达范围，没有临界点。</>
          )}
          {" "}三条曲线都是分段线性的，因为胜率对强度是线性的，只在 5% / 95% 处被夹平。
        </div>
      </div>
    </div>
  );
}
