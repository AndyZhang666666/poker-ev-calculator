"use client";

// Tab 2：敏感性分析。x = 手牌强度 0..100，y = 三个决策的 EV。
// 其余参数沿用 tab 1 的当前值，所以这页是「在你现在这个局面下，牌要多强才该跟 / 该加」。

import { useEffect, useMemo, useRef } from "react";
import { Chart, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Filler } from "chart.js";
import styles from "@/styles/Calculator.module.css";
import type { EVParams, OpponentAction } from "@/lib/types";
import { actionLabel, sensitivityAnalysis, calculateEV } from "@/lib/ev";

Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Filler);

const C = { fold: "#7b858c", call: "#1d5fbf", raise: "#283a46" };

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
  const result=useMemo(()=>calculateEV(params),[params]);
  const be=result.breakEvenStrength,raiseAvailable=result.raiseAvailable;

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 250 },
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
      tension: 0,
      fill: false,
    });
    chart.data.datasets = [
      mk("fold", C.fold, [4, 4]),
      mk("call", C.call),
      ...(raiseAvailable ? [mk("raise", C.raise,[7,3])] : []),
    ];
    chart.update();
  }, [points, oa, currentStrength, raiseAvailable]);

  const zoneColor = (a: string) => (a === "fold" ? C.fold : a === "call" ? C.call : C.raise);
  if(!result.decisionAvailable)return <section className={styles.panel}><h2>暂无可比较的行动</h2><p>没有剩余筹码。请先回到计算器调整参数，再查看敏感性。</p></section>;

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
          <span style={{color:C.fold}}>{actionLabel("fold", oa)} · 细虚线</span>
          <span style={{color:C.call}}>{actionLabel("call", oa)} · 蓝实线</span>
          {raiseAvailable && <span style={{color:C.raise}}>{actionLabel("raise", oa)} · 深虚线</span>}
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
              {(result.potOdds*100).toFixed(1)}%。
              强度再低一点就该弃牌 —— 除非加注能把对手逼走。
            </>
          ) : oa === "check" ? (
            <>对手过牌，{actionLabel("call", oa)}不花钱，永远不亏，所以没有临界点；问题只剩「要不要下注」。</>
          ) : (
            <>当前强度 0–100 内没有从负转正的内部跟注临界点，可能始终非负或始终非正；请看实际曲线，端点打平和夹平区间不算内部切换。</>
          )}
          {" "}跟注与弃牌是分段线性；加注还组合了弃牌率与被跟注后胜率，不一定线性。连线只连接实际计算点，不做平滑插值。
        </div>
      </div>
    </div>
  );
}
