import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useDashboardStats() {
  return useQuery({
    queryKey: [api.reports.dashboard.path],
    queryFn: async () => {
      const res = await fetch(api.reports.dashboard.path, { credentials: "include" });
      if (!res.ok) throw new Error("Statistikani yuklab bo'lmadi");
      return api.reports.dashboard.responses[200].parse(await res.json());
    },
  });
}
