export interface AgentInstallationCandidate {
  id: string;
  orderNumber: string;
  city: string | null;
  installationDate?: string | null;
  [key: string]: unknown;
}

export interface InstallationCityGroup {
  city: string;
  orders: AgentInstallationCandidate[];
}

function resolveCityLabel(city: string | null) {
  return city?.trim() || 'לא צוינה עיר';
}

function parseScheduleTimestamp(order: AgentInstallationCandidate): number | null {
  if (!order.installationDate) return null;
  const date = new Date(order.installationDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
}

export function groupInstallationCandidates(
  orders: AgentInstallationCandidate[],
  locale: string = 'he-IL'
): InstallationCityGroup[] {
  const cityMap = new Map<string, AgentInstallationCandidate[]>();

  orders.forEach((order) => {
    const label = resolveCityLabel(order.city);
    if (!cityMap.has(label)) {
      cityMap.set(label, []);
    }
    cityMap.get(label)!.push(order);
  });

  const groups = Array.from(cityMap.entries()).map(([city, items]) => ({
    city,
    orders: items.sort((a, b) => {
      const aTime = parseScheduleTimestamp(a);
      const bTime = parseScheduleTimestamp(b);

      if (aTime === null && bTime === null) {
        return a.orderNumber.localeCompare(b.orderNumber, locale);
      }
      if (aTime === null) return 1;
      if (bTime === null) return -1;
      if (aTime !== bTime) return aTime - bTime;
      return a.orderNumber.localeCompare(b.orderNumber, locale);
    }),
  }));

  return groups.sort((a, b) => a.city.localeCompare(b.city, locale));
}
