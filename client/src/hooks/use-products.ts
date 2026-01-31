import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { insertProductSchema } from "@shared/schema";
import { z } from "zod";

type CreateProductInput = z.infer<typeof insertProductSchema>;

export function useProducts(categoryId?: string, search?: string) {
  return useQuery({
    queryKey: [api.products.list.path, categoryId, search],
    queryFn: async () => {
      const url = new URL(api.products.list.path, window.location.origin);
      if (categoryId) url.searchParams.append("categoryId", categoryId);
      if (search) url.searchParams.append("search", search);
      
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Mahsulotlarni yuklab bo'lmadi");
      return api.products.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateProductInput) => {
      const res = await fetch(api.products.create.path, {
        method: api.products.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Mahsulot yaratishda xatolik");
      return api.products.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
    },
  });
}
