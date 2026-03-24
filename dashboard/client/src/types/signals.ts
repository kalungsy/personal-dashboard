export type SignalRow = {
  date: string;
  close: number;
  signal: string;
  reason: string;
  box_top: number | null;
  box_bottom: number | null;
  volume: number;
  avg_volume: number;
};

export type PriceHistory = {
  dates: string[];
  close: number[];
  volume: number[];
  box_top: number;
  box_bottom: number;
};

export type TickerBundle = {
  ticker: string;
  last_updated?: string;
  signals: SignalRow[];
  price_history?: PriceHistory;
};

export type SignalsFile = Record<string, TickerBundle>;
