import { ChartOptions } from "chart.js";
import { Bar, Line } from "react-chartjs-2";
// Registers Chart.js scales/elements as a side effect
import "../Charts";

export const COLORS = {
  primary: "#1f3a93",
  secondary: "#e2843a",
  control: "#6b7280",
  treatment: "#1f3a93",
  good: "#2f7d4f",
  bad: "#b4232a",
};

type Series = { label: string; data: (number | null)[]; color: string; yAxis?: "y" | "y1"; dashed?: boolean };

export const TrendChart = ({
  labels,
  series,
  yFormat,
  y1Format,
  height = 260,
}: {
  labels: string[];
  series: Series[];
  yFormat?: (v: number) => string;
  y1Format?: (v: number) => string;
  height?: number;
}) => {
  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } },
    elements: { point: { radius: 0 }, line: { tension: 0.25, borderWidth: 2 } },
    scales: {
      x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } },
      y: { beginAtZero: true, ticks: { callback: (v) => (yFormat ? yFormat(Number(v)) : String(v)) } },
      ...(series.some((s) => s.yAxis === "y1")
        ? {
            y1: {
              position: "right" as const,
              beginAtZero: true,
              grid: { display: false },
              ticks: { callback: (v: string | number) => (y1Format ? y1Format(Number(v)) : String(v)) },
            },
          }
        : {}),
    },
  };
  return (
    <div style={{ height }}>
      <Line
        options={options}
        data={{
          labels,
          datasets: series.map((s) => ({
            label: s.label,
            data: s.data,
            borderColor: s.color,
            backgroundColor: s.color,
            yAxisID: s.yAxis ?? "y",
            borderDash: s.dashed ? [6, 4] : undefined,
          })),
        }}
      />
    </div>
  );
};

export const BarsChart = ({
  labels,
  series,
  horizontal,
  format,
  height = 260,
  stacked,
}: {
  labels: string[];
  series: { label: string; data: number[]; color: string }[];
  horizontal?: boolean;
  format?: (v: number) => string;
  height?: number;
  stacked?: boolean;
}) => {
  const valueAxis = { beginAtZero: true, stacked, ticks: { callback: (v: string | number) => (format ? format(Number(v)) : String(v)) } };
  const categoryAxis = { grid: { display: false }, stacked };
  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? "y" : "x",
    plugins: {
      legend: { display: series.length > 1, position: "bottom", labels: { boxWidth: 12 } },
      tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${format ? format(Number(ctx.raw)) : ctx.raw}` } },
    },
    scales: horizontal ? { x: valueAxis, y: categoryAxis } : { x: categoryAxis, y: valueAxis },
  };
  return (
    <div style={{ height }}>
      <Bar
        options={options}
        data={{
          labels,
          datasets: series.map((s) => ({ label: s.label, data: s.data, backgroundColor: s.color, borderRadius: 3, maxBarThickness: 38 })),
        }}
      />
    </div>
  );
};
