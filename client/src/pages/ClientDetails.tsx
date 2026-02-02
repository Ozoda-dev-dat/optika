import { useRoute } from "wouter";
import { useClient, useAddPrescription } from "@/hooks/use-clients";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPrescriptionSchema } from "@shared/schema";
import { Phone, Calendar, Plus, FileText, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

type PrescriptionFormValues = z.infer<typeof insertPrescriptionSchema>;

export default function ClientDetails() {
  const [match, params] = useRoute("/clients/:id");
  const id = Number(params?.id);
  const { data: client, isLoading } = useClient(id);
  const addPrescription = useAddPrescription();
  const { toast } = useToast();

  const form = useForm<PrescriptionFormValues>({
    resolver: zodResolver(insertPrescriptionSchema.omit({ clientId: true })),
    defaultValues: { doctorName: "", sphRight: "", cylRight: "", axisRight: "", sphLeft: "", cylLeft: "", axisLeft: "", notes: "" },
  });

  const onSubmit = (data: any) => {
    addPrescription.mutate({ clientId: id, ...data }, {
      onSuccess: () => {
        form.reset();
        toast({ title: "Retsept qo'shildi", description: "Yangi ko'z o'lchamlari saqlandi" });
      },
    });
  };

  if (isLoading) return <div className="p-8 text-center">Yuklanmoqda...</div>;
  if (!client) return <div className="p-8 text-center">Mijoz topilmadi</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader title={`${client.firstName} ${client.lastName}`} description="Mijoz kartasi">
         <Button variant="outline" onClick={() => window.history.back()}>Orqaga</Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Shaxsiy Ma'lumotlar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                 {client.firstName[0]}
              </div>
              <div>
                <p className="font-medium">Tel: {client.phone}</p>
                <p className="text-sm text-muted-foreground">{client.birthDate ? new Date(client.birthDate).toLocaleDateString() : "Tug'ilgan sana yo'q"}</p>
              </div>
            </div>
            {client.notes && (
              <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground italic">
                "{client.notes}"
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <Tabs defaultValue="prescriptions">
            <CardHeader className="pb-0">
               <div className="flex items-center justify-between mb-4">
                 <CardTitle>Tarix</CardTitle>
                 <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2"><Plus className="w-4 h-4"/> Retsept Qo'shish</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Yangi Retsept</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField 
                          control={form.control} name="doctorName"
                          render={({field}) => (
                            <FormItem><FormLabel>Doktor Ismi</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl></FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-4 border p-4 rounded-lg">
                            <h4 className="font-bold flex items-center gap-2"><Eye className="w-4 h-4"/> O'ng Ko'z (OD)</h4>
                            <div className="grid grid-cols-3 gap-2">
                               <FormField control={form.control} name="sphRight" render={({field}) => (<FormItem><FormControl><Input placeholder="SPH" {...field} value={field.value || ""} /></FormControl></FormItem>)} />
                               <FormField control={form.control} name="cylRight" render={({field}) => (<FormItem><FormControl><Input placeholder="CYL" {...field} value={field.value || ""} /></FormControl></FormItem>)} />
                               <FormField control={form.control} name="axisRight" render={({field}) => (<FormItem><FormControl><Input placeholder="AXIS" {...field} value={field.value || ""} /></FormControl></FormItem>)} />
                            </div>
                            <FormField control={form.control} name="pdRight" render={({field}) => (<FormItem><FormControl><Input placeholder="PD" {...field} value={field.value || ""} /></FormControl></FormItem>)} />
                          </div>
                          <div className="space-y-4 border p-4 rounded-lg">
                            <h4 className="font-bold flex items-center gap-2"><Eye className="w-4 h-4"/> Chap Ko'z (OS)</h4>
                            <div className="grid grid-cols-3 gap-2">
                               <FormField control={form.control} name="sphLeft" render={({field}) => (<FormItem><FormControl><Input placeholder="SPH" {...field} value={field.value || ""} /></FormControl></FormItem>)} />
                               <FormField control={form.control} name="cylLeft" render={({field}) => (<FormItem><FormControl><Input placeholder="CYL" {...field} value={field.value || ""} /></FormControl></FormItem>)} />
                               <FormField control={form.control} name="axisLeft" render={({field}) => (<FormItem><FormControl><Input placeholder="AXIS" {...field} value={field.value || ""} /></FormControl></FormItem>)} />
                            </div>
                            <FormField control={form.control} name="pdLeft" render={({field}) => (<FormItem><FormControl><Input placeholder="PD" {...field} value={field.value || ""} /></FormControl></FormItem>)} />
                          </div>
                        </div>
                        <FormField control={form.control} name="notes" render={({field}) => (<FormItem><FormLabel>Qo'shimcha Izoh</FormLabel><FormControl><Textarea {...field} value={field.value || ""} /></FormControl></FormItem>)} />
                        <Button type="submit" className="w-full">Saqlash</Button>
                      </form>
                    </Form>
                  </DialogContent>
                 </Dialog>
               </div>
               <TabsList>
                 <TabsTrigger value="prescriptions">Retseptlar</TabsTrigger>
                 <TabsTrigger value="sales">Xaridlar</TabsTrigger>
               </TabsList>
            </CardHeader>
            <CardContent className="pt-6">
              <TabsContent value="prescriptions">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sana</TableHead>
                      <TableHead>Doktor</TableHead>
                      <TableHead>OD (O'ng)</TableHead>
                      <TableHead>OS (Chap)</TableHead>
                      <TableHead>Izoh</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {client.prescriptions?.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{new Date(p.date).toLocaleDateString()}</TableCell>
                        <TableCell>{p.doctorName}</TableCell>
                        <TableCell className="font-mono text-xs">
                           SPH:{p.sphRight} / CYL:{p.cylRight} / AX:{p.axisRight}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                           SPH:{p.sphLeft} / CYL:{p.cylLeft} / AX:{p.axisLeft}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{p.notes}</TableCell>
                      </TableRow>
                    ))}
                    {(!client.prescriptions || client.prescriptions.length === 0) && (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Retseptlar yo'q</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
              <TabsContent value="sales">
                 <div className="text-center py-8 text-muted-foreground">Xaridlar tarixi tez orada...</div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
