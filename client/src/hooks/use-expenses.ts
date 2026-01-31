import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { insertExpenseSchema } from "@shared/schema";
import { z } from "zod";

type CreateExpenseInput = z.infer<typeof insertExpenseSchema>;

export function useExpenses(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: [api.expenses.list.path, startDate, endDate],
    queryFn: async () => {
      const url = new URL(api.expenses.list.path, window.location.origin);
      if (startDate) url.searchParams.append("startDate", startDate);
      if (endDate) url.searchParams.append("endDate", endDate);

      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Xarajatlarni yuklab bo'lmadi");
      return api.expenses.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateExpenseInput) => {
      const res = await fetch(api.expenses.create.path, {
        method: api.expenses.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Xarajat yaratishda xatolik");
      return api.expenses.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.expenses.list.path] });
    },
  });
}
