import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { insertClientSchema, insertPrescriptionSchema } from "@shared/schema";
import { z } from "zod";

type CreateClientInput = z.infer<typeof insertClientSchema>;
type CreatePrescriptionInput = z.infer<typeof insertPrescriptionSchema>;

export function useClients(search?: string) {
  return useQuery({
    queryKey: [api.clients.list.path, search],
    queryFn: async () => {
      const url = new URL(api.clients.list.path, window.location.origin);
      if (search) url.searchParams.append("search", search);

      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Mijozlarni yuklab bo'lmadi");
      return api.clients.list.responses[200].parse(await res.json());
    },
  });
}

export function useClient(id: number) {
  return useQuery({
    queryKey: [api.clients.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.clients.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Mijoz ma'lumotlarini yuklab bo'lmadi");
      return api.clients.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateClientInput) => {
      const res = await fetch(api.clients.create.path, {
        method: api.clients.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Mijoz yaratishda xatolik");
      return api.clients.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.clients.list.path] });
    },
  });
}

export function useAddPrescription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, ...data }: CreatePrescriptionInput) => {
      const url = buildUrl(api.clients.addPrescription.path, { id: clientId });
      const res = await fetch(url, {
        method: api.clients.addPrescription.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Retsept qo'shishda xatolik");
      return api.clients.addPrescription.responses[201].parse(await res.json());
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.clients.get.path, variables.clientId] });
    },
  });
}
