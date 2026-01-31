import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Branch } from "@shared/routes";
import { insertBranchSchema } from "@shared/schema";
import { z } from "zod";

type CreateBranchInput = z.infer<typeof insertBranchSchema>;

export function useBranches() {
  return useQuery({
    queryKey: [api.branches.list.path],
    queryFn: async () => {
      const res = await fetch(api.branches.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Filiallar ro'yxatini yuklab bo'lmadi");
      return api.branches.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateBranchInput) => {
      const res = await fetch(api.branches.create.path, {
        method: api.branches.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Filial yaratishda xatolik");
      return api.branches.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.branches.list.path] });
    },
  });
}
