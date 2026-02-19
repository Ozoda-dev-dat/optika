import { useState } from "react";
import { useCategories, useCreateCategory } from "@/hooks/use-categories";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCategorySchema } from "@shared/schema";
import { Plus, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

type CategoryFormValues = z.infer<typeof insertCategorySchema>;

export default function Categories() {
  const { data: categories, isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(insertCategorySchema),
    defaultValues: { name: "" },
  });

  const onSubmit = (data: CategoryFormValues) => {
    createCategory.mutate(data, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
        toast({ title: "Kategoriya yaratildi", description: "Yangi kategoriya muvaffaqiyatli qo'shildi" });
      },
      onError: (error) => {
        toast({ title: "Xatolik", description: error.message, variant: "destructive" });
      },
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader title="Kategoriyalar" description="Barcha kategoriyalarni boshqarish">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Yangi Kategoriya
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yangi Kategoriya</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nomi</FormLabel>
                    <FormControl>
                      <Input placeholder="Kategoriya nomi" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormMessage />
            </Form>
            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Yaratilmoqda..." : "Yaratish"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {categories?.map((category) => (
            <Card key={category.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {category.name}
                  <Tag className="ml-auto h-6 w-6 p-1 text-xs" variant="secondary">
                    {category.products?.length || 0} mahsulot
                  </Tag>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Kategoriya kodlari: {category.products?.length || 0}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageHeader>
    </div>
  );
}
