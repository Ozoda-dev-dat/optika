import { useState } from "react";
import { useShipments, useCreateShipment, useReceiveShipment } from "@/hooks/use-shipments";
import { useBranches } from "@/hooks/use-branches";
import { useProducts } from "@/hooks/use-products";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useForm, useFieldArray } from "react-hook-form";
import { Plus, Truck, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Shipments() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: shipments, isLoading } = useShipments(isAdmin ? undefined : user?.branchId ?? undefined);
  const { data: branches } = useBranches();
  const { data: products } = useProducts();
  const createShipment = useCreateShipment();
  const receiveShipment = useReceiveShipment();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      fromWarehouseId: 1,
      toBranchId: "",
      items: [{ productId: "", qtySent: 1 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  });

  const onSubmit = (data: any) => {
    createShipment.mutate({
      fromWarehouseId: Number(data.fromWarehouseId),
      toBranchId: Number(data.toBranchId),
      items: data.items.map((i: any) => ({
        productId: Number(i.productId),
        qtySent: Number(i.qtySent)
      }))
    }, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
        toast({ title: "Yuborildi", description: "Mahsulotlar filialga yuborildi" });
      },
      onError: (error) => {
        toast({ title: "Xatolik", description: error.message, variant: "destructive" });
      }
    });
  };

  const handleReceive = (shipment: any) => {
    const items = shipment.items.map((i: any) => ({
      productId: i.productId,
      qtyReceived: i.qtySent - i.qtyReceived
    }));
    
    receiveShipment.mutate({ id: shipment.id, items }, {
      onSuccess: () => {
        toast({ title: "Qabul qilindi", description: "Mahsulotlar filial omboriga qo'shildi" });
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Kutilmoqda</Badge>;
      case "partially_received": return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Qisman qabul qilindi</Badge>;
      case "received": return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Qabul qilindi</Badge>;
      case "cancelled": return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Bekor qilindi</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Yuk tashish" description="Ombor va filiallar o'rtasidagi mahsulot harakati">
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> Yuk yuborish</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Yangi yuk yuborish</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="fromWarehouseId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Qaysi ombordan</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value.toString()}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {branches?.filter(b => b.id === 1).map(b => (
                                <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="toBranchId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Qaysi filialga</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Filialni tanlang" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {branches?.filter(b => b.id !== 1).map(b => (
                                <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <Label>Mahsulotlar</Label>
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex gap-4 items-end">
                        <div className="flex-1">
                          <FormField
                            control={form.control}
                            name={`items.${index}.productId`}
                            render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl><SelectTrigger><SelectValue placeholder="Mahsulotni tanlang" /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    {products?.map(p => (
                                      <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="w-32">
                          <FormField
                            control={form.control}
                            name={`items.${index}.qtySent`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><AlertCircle className="w-4 h-4" /></Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: "", qtySent: 1 })}>
                      <Plus className="w-4 h-4 mr-2" /> Mahsulot qo'shish
                    </Button>
                  </div>

                  <Button type="submit" className="w-full" disabled={createShipment.isPending}>
                    {createShipment.isPending ? "Yuborilmoqda..." : "Tasdiqlash va Yuborish"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </PageHeader>

      <div className="grid gap-6">
        {isLoading ? (
          <div className="text-center py-12">Yuklanmoqda...</div>
        ) : shipments?.length === 0 ? (
          <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground">Yuk tashishlar mavjud emas</CardContent></Card>
        ) : (
          shipments?.map((ship: any) => (
            <Card key={ship.id} className="overflow-hidden">
              <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between py-3 px-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Yuk #{ship.id}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {ship.fromWarehouse.name} &rarr; {ship.toBranch.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {getStatusBadge(ship.status)}
                  {ship.status !== "received" && ship.toBranchId === user?.branchId && (
                    <Button size="sm" onClick={() => handleReceive(ship)} disabled={receiveShipment.isPending}>
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Qabul qilish
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead className="pl-6">Mahsulot</TableHead><TableHead className="text-center">Yuborildi</TableHead><TableHead className="text-center">Qabul qilindi</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {ship.items.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="pl-6 font-medium">{item.product.name}</TableCell>
                        <TableCell className="text-center font-mono">{item.qtySent}</TableCell>
                        <TableCell className="text-center font-mono">{item.qtyReceived}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
