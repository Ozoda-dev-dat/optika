import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";

export function useInventory(branchId?: string, search?: string) {
  return useQuery({
    queryKey: [api.inventory.list.path, branchId, search],
    queryFn: async () => {
      const url = new URL(api.inventory.list.path, window.location.origin);
      if (branchId) url.searchParams.append("branchId", branchId);
      if (search) url.searchParams.append("search", search);

      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Ombor ma'lumotlarini yuklab bo'lmadi");
      return api.inventory.list.responses[200].parse(await res.json());
    },
  });
}

type UpdateStockInput = z.infer<typeof api.inventory.update.input>;

export function useUpdateStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateStockInput) => {
      const res = await fetch(api.inventory.update.path, {
        method: api.inventory.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Ombor yangilashda xatolik");
      return api.inventory.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.inventory.list.path] });
    },
  });
}
