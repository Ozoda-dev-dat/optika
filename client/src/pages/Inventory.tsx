import { useState } from "react";
import { useProducts, useCreateProduct } from "@/hooks/use-products";
import { useCategories } from "@/hooks/use-categories";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProductSchema } from "@shared/schema";
import { Plus, Search, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

type ProductFormValues = z.infer<typeof insertProductSchema>;

export default function Inventory() {
  const [search, setSearch] = useState("");
  const { data: products, isLoading } = useProducts(undefined, search);
  const { data: categories } = useCategories();
  const createProduct = useCreateProduct();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(insertProductSchema),
    defaultValues: { name: "", sku: "", price: "0", costPrice: "0", categoryId: 0 },
  });

  const onSubmit = (data: ProductFormValues) => {
    // Ensure numbers are numbers
    const payload = {
      ...data,
      price: data.price.toString(),
      costPrice: data.costPrice.toString(),
      categoryId: Number(data.categoryId),
    };
    
    createProduct.mutate(payload, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
        toast({ title: "Mahsulot qo'shildi", description: "Yangi mahsulot omborga kiritildi" });
      },
      onError: (error) => {
        toast({ title: "Xatolik", description: error.message, variant: "destructive" });
      },
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader title="Ombor" description="Mahsulotlar va qoldiqlar">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Mahsulot Qo'shish
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Yangi mahsulot</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nomi</FormLabel>
                      <FormControl><Input placeholder="Ray-Ban Aviator..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="sku"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Artikul (SKU)</FormLabel>
                        <FormControl><Input placeholder="RB-3025" {...field} value={field.value || ''} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kategoriya</FormLabel>
                        <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Tanlang" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories?.map((cat: any) => (
                              <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="costPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tan Narxi (UZS)</FormLabel>
                        <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sotuv Narxi (UZS)</FormLabel>
                        <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createProduct.isPending}>
                  {createProduct.isPending ? "Saqlanmoqda..." : "Saqlash"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <Search className="w-5 h-5 text-muted-foreground" />
        <Input 
          className="border-0 shadow-none focus-visible:ring-0 bg-transparent" 
          placeholder="Mahsulot nomi yoki SKU bo'yicha qidirish..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Nomi</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Kategoriya</TableHead>
              <TableHead className="text-right">Tan Narxi</TableHead>
              <TableHead className="text-right">Sotuv Narxi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
               <TableRow><TableCell colSpan={6} className="text-center py-8">Yuklanmoqda...</TableCell></TableRow>
            ) : products?.length === 0 ? (
               <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Mahsulot topilmadi</TableCell></TableRow>
            ) : (
              products?.map((product: any) => (
                <TableRow key={product.id} className="group hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary">
                      <Package className="w-4 h-4" />
                    </div>
                    {product.name}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{product.sku || '-'}</TableCell>
                  <TableCell>{product.brand || '-'}</TableCell>
                  <TableCell>{product.category?.name}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{Number(product.costPrice).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-bold text-primary">{Number(product.price).toLocaleString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
