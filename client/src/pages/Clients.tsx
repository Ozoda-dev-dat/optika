import { useState } from "react";
import { useClients, useCreateClient } from "@/hooks/use-clients";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertClientSchema } from "@shared/schema";
import { Plus, Search, User, Phone, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { z } from "zod";

type ClientFormValues = z.infer<typeof insertClientSchema>;

export default function Clients() {
  const [search, setSearch] = useState("");
  const { data: clients, isLoading } = useClients(search);
  const createClient = useCreateClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(insertClientSchema),
    defaultValues: { firstName: "", lastName: "", phone: "", notes: "" },
  });

  const onSubmit = (data: ClientFormValues) => {
    createClient.mutate(data, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
        toast({ title: "Mijoz qo'shildi", description: "Yangi mijoz bazaga kiritildi" });
      },
      onError: (error) => {
        toast({ title: "Xatolik", description: error.message, variant: "destructive" });
      },
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader title="Mijozlar" description="Mijozlar bazasi va retseptlar">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Mijoz Qo'shish
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yangi mijoz</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ism</FormLabel>
                        <FormControl><Input placeholder="Aziz" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Familiya</FormLabel>
                        <FormControl><Input placeholder="Rahimov" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefon</FormLabel>
                      <FormControl><Input placeholder="+998..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="birthDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tug'ilgan sana (Ixtiyoriy)</FormLabel>
                      <FormControl><Input type="date" {...field} value={field.value?.toString() || ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createClient.isPending}>
                  {createClient.isPending ? "Saqlanmoqda..." : "Saqlash"}
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
          placeholder="Ism yoki telefon raqam bo'yicha qidirish..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div>
        ) : clients?.map((client: any) => (
          <Link key={client.id} href={`/clients/${client.id}`} className="block group">
            <Card className="p-5 hover:shadow-lg transition-all duration-300 border-l-4 border-l-transparent hover:border-l-primary cursor-pointer">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  {client.firstName[0]}{client.lastName[0]}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{client.firstName} {client.lastName}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Phone className="w-3 h-3" /> {client.phone}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg">
                <Calendar className="w-3 h-3" />
                Ro'yxatdan o'tgan: {new Date(client.createdAt).toLocaleDateString()}
              </div>
            </Card>
          </Link>
        ))}
        {clients?.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
            Mijoz topilmadi
          </div>
        )}
      </div>
    </div>
  );
}
