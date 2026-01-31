import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type SaleInput } from "@shared/routes";

export function useSales(branchId?: string, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: [api.sales.list.path, branchId, startDate, endDate],
    queryFn: async () => {
      const url = new URL(api.sales.list.path, window.location.origin);
      if (branchId) url.searchParams.append("branchId", branchId);
      if (startDate) url.searchParams.append("startDate", startDate);
      if (endDate) url.searchParams.append("endDate", endDate);

      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Sotuv tarixini yuklab bo'lmadi");
      return api.sales.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: SaleInput) => {
      const res = await fetch(api.sales.create.path, {
        method: api.sales.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Sotuvni amalga oshirishda xatolik");
      return api.sales.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.sales.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.inventory.list.path] }); // Stock updates
      queryClient.invalidateQueries({ queryKey: [api.reports.dashboard.path] });
    },
  });
}
