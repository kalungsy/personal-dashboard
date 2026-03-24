export const TICKERS = [
  "CVX",
  "COP",
  "OXY",
  "NKE",
  "UNH",
  "TSLA",
  "MSFT",
  "AAPL",
  "SOUN",
  "ACHR",
  "ROKU",
  "IONQ",
  "RBLX",
  "PATH",
  "ACN",
  "CRM",
  "ORCL",
  "QCOM",
  "GLD",
  "LMT",
] as const;

export type Ticker = (typeof TICKERS)[number];

export const RANGES = [
  { label: "3D", days: 3 },
  { label: "1W", days: 5 },
  { label: "1M", days: 21 },
  { label: "3M", days: 999 },
] as const;

export const COLORS = {
  BUY: "#26c96c",
  SELL: "#ef5350",
  HOLD: "#ffa726",
  boxTop: "#26c96c",
  boxBottom: "#ef5350",
  price: "#7986cb",
  volume: "#5c6bc0",
  avgVol: "#ff7043",
  sma50: "#f59e0b",
} as const;
