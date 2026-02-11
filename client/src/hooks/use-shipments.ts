import { useQuery, useMutation } from "@tanstack/react-query";
import { Shipment, ShipmentItem, Product, Branch } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function useShipments(branchId?: number) {
  return useQuery<(Shipment & { fromWarehouse: Branch, toBranch: Branch, items: (ShipmentItem & { product: Product })[] })[]>({
    queryKey: branchId ? ["/api/shipments", { branchId }] : ["/api/shipments"],
  });
}

export function useCreateShipment() {
  return useMutation({
    mutationFn: async (data: { fromWarehouseId: number, toBranchId: number, items: { productId: number, qtySent: number }[] }) => {
      const res = await apiRequest("POST", "/api/shipments", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
    },
  });
}

export function useReceiveShipment() {
  return useMutation({
    mutationFn: async ({ id, items }: { id: number, items: { productId: number, qtyReceived: number }[] }) => {
      const res = await apiRequest("POST", `/api/shipments/${id}/receive`, { items });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
    },
  });
}
