import { useState } from "react";
import { useBranches, useCreateBranch } from "@/hooks/use-branches";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBranchSchema } from "@shared/schema";
import { Plus, MapPin, Phone, Building } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

type BranchFormValues = z.infer<typeof insertBranchSchema>;

export default function Branches() {
  const { data: branches, isLoading } = useBranches();
  const createBranch = useCreateBranch();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const form = useForm<BranchFormValues>({
    resolver: zodResolver(insertBranchSchema),
    defaultValues: { name: "", address: "", phone: "" },
  });

  const onSubmit = (data: BranchFormValues) => {
    createBranch.mutate(data, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
        toast({ title: "Filial yaratildi", description: "Yangi filial muvaffaqiyatli qo'shildi" });
      },
      onError: (error) => {
        toast({ title: "Xatolik", description: error.message, variant: "destructive" });
      },
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader title="Filiallar" description="Do'kon filiallarini boshqarish">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Yangi Filial
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yangi filial qo'shish</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Filial Nomi</FormLabel>
                      <FormControl><Input placeholder="Markaziy Filial" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Manzil</FormLabel>
                      <FormControl><Input placeholder="Toshkent sh, Yunusobod..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefon</FormLabel>
                      <FormControl><Input placeholder="+998 90 123 45 67" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createBranch.isPending}>
                  {createBranch.isPending ? "Saqlanmoqda..." : "Saqlash"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {isLoading ? (
        <div className="flex justify-center p-8"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches?.map((branch: any) => (
            <Card key={branch.id} className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-primary group">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Building className="w-4 h-4" />
                  </div>
                  {branch.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 mt-0.5 text-primary" />
                  {branch.address}
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Phone className="w-4 h-4 text-primary" />
                  {branch.phone}
                </div>
              </CardContent>
            </Card>
          ))}
          {branches?.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
              Hozircha filiallar yo'q
            </div>
          )}
        </div>
      )}
    </div>
  );
}
