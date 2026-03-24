import type { Chart } from "chart.js";

/** RSI chart background zones and dashed 30/70 lines (matches legacy index4). */
export const rsiShadingPlugin = {
  id: "rsiShading",
  beforeDraw(chart: Chart) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    const { left, right } = chartArea;
    const yScale = chart.scales.y;
    if (!yScale) return;

    const y30 = yScale.getPixelForValue(30);
    const y70 = yScale.getPixelForValue(70);
    const y0 = yScale.getPixelForValue(0);
    const y100 = yScale.getPixelForValue(100);

    ctx.save();
    ctx.fillStyle = "rgba(239,83,80,0.12)";
    ctx.fillRect(left, y30, right - left, y0 - y30);
    ctx.fillStyle = "rgba(255,112,67,0.12)";
    ctx.fillRect(left, y100, right - left, y70 - y100);

    ctx.strokeStyle = "rgba(239,83,80,0.7)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(left, y30);
    ctx.lineTo(right, y30);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,112,67,0.7)";
    ctx.beginPath();
    ctx.moveTo(left, y70);
    ctx.lineTo(right, y70);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();
  },
};
