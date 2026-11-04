type Labels = Record<string, string | number | boolean>;

const counters = new Map<string, number>();
const histograms = new Map<string, { count: number; sum: number }>();

export function incCounter(name: string, by: number = 1, _labels?: Labels) {
  counters.set(name, (counters.get(name) || 0) + by);
}

export function observeDuration(name: string, ms: number, _labels?: Labels) {
  const cur = histograms.get(name) || { count: 0, sum: 0 };
  cur.count += 1;
  cur.sum += ms;
  histograms.set(name, cur);
}

export function getMetricsSnapshot() {
  return {
    counters: Array.from(counters.entries()),
    histograms: Array.from(histograms.entries()),
  };
}

