import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClients";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import ProductForm, { ProductFormSubmit } from "@/components/inventory/ProductForm";
import { Plus, Search } from "lucide-react";

type Category = { id: number; name: string; slug: string };

type Product = {
  id: number;
  name: string;
  sku: string | null;
  categoryId: number;
  brand: string | null;
  model: string | null;
  price: string;       // decimal -> string
  costPrice: string;   // decimal -> string
  imageUrl: string | null;
  supplier: string | null;
  unit: string;
  minStock: number;
  receivedDate: string | null;
  status: string;
  category?: Category | null;
};

export default function Inventory() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Categories
  const categoriesQuery = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories", { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  // Products
  const productsQuery = useQuery<Product[]>({
    queryKey: ["/api/products", search ? `?search=${encodeURIComponent(search)}` : ""],
    queryFn: async ({ queryKey }) => {
      const url = `${queryKey[0]}${queryKey[1] ?? ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const categories = categoriesQuery.data ?? [];
  const products = productsQuery.data ?? [];

  const categoryMap = useMemo(() => {
    const m = new Map<number, Category>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  const onCreate = async (payload: ProductFormSubmit) => {
    try {
      await apiRequest("POST", "/api/products", payload);
      await productsQuery.refetch();
      setOpen(false);
      toast({ title: "Saqlandi", description: "Yangi mahsulot qo‘shildi ✅" });
    } catch (e: any) {
      toast({
        title: "Xatolik",
        description: e?.message || "Mahsulot qo‘shishda xatolik",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ombor</h1>
          <p className="text-muted-foreground">Mahsulotlar va qoldiqlar</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Mahsulot qo‘shish
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Yangi mahsulot</DialogTitle>
            </DialogHeader>

            <ProductForm
              categories={categories}
              loadingCategories={categoriesQuery.isLoading}
              onSubmit={onCreate}
              onCancel={() => setOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3 bg-card p-4 rounded-xl border">
        <Search className="w-5 h-5 text-muted-foreground" />
        <Input
          className="border-0 shadow-none focus-visible:ring-0 bg-transparent"
          placeholder="Nomi yoki SKU bo‘yicha qidirish..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {productsQuery.isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Yuklanmoqda...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => {
            const cat = p.category ?? categoryMap.get(p.categoryId) ?? null;
            return (
              <Card key={p.id} className="p-4 space-y-2">
                <div className="font-semibold text-lg">{p.name}</div>
                <div className="text-sm text-muted-foreground">
                  SKU: {p.sku ?? "—"} • Kategoriya: {cat?.name ?? "—"}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Sotuv:</span> {Number(p.price).toLocaleString()} UZS
                  {" • "}
                  <span className="font-medium">Tan:</span> {Number(p.costPrice).toLocaleString()} UZS
                </div>
                <div className="text-xs text-muted-foreground">
                  Birlik: {p.unit} • Minimal qoldiq: {p.minStock}
                </div>
              </Card>
            );
          })}

          {products.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
              Mahsulot topilmadi
            </div>
          )}
        </div>
      )}
    </div>
  );
}
