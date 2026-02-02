import { useExpenses, useCreateExpense } from "@/hooks/use-expenses";
import { useBranches } from "@/hooks/use-branches";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertExpenseSchema } from "@shared/schema";
import { Plus, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { z } from "zod";

type ExpenseFormValues = z.infer<typeof insertExpenseSchema>;

export default function Expenses() {
  const { data: expenses, isLoading } = useExpenses();
  const { data: branches } = useBranches();
  const { user } = useAuth();
  const createExpense = useCreateExpense();
  const { toast } = useToast();

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(insertExpenseSchema),
    defaultValues: { description: "", amount: "0", category: "other", branchId: 0 },
  });

  const onSubmit = (data: ExpenseFormValues) => {
    if (!user) return;
    const payload = { ...data, userId: user.id, amount: data.amount.toString(), branchId: Number(data.branchId) };
    
    createExpense.mutate(payload, {
      onSuccess: () => {
        form.reset();
        toast({ title: "Xarajat qo'shildi" });
      },
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader title="Xarajatlar" description="Do'kon xarajatlarini nazorat qilish">
         <Dialog>
           <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4"/> Xarajat Qo'shish</Button></DialogTrigger>
           <DialogContent>
             <DialogHeader><DialogTitle>Yangi Xarajat</DialogTitle></DialogHeader>
             <Form {...form}>
               <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                 <FormField control={form.control} name="branchId" render={({field}) => (
                   <FormItem><FormLabel>Filial</FormLabel>
                   <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value?.toString()}>
                     <FormControl><SelectTrigger><SelectValue placeholder="Tanlang"/></SelectTrigger></FormControl>
                     <SelectContent>{branches?.map((b: any) => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}</SelectContent>
                   </Select>
                   <FormMessage/></FormItem>
                 )}/>
                 <FormField control={form.control} name="category" render={({field}) => (
                   <FormItem><FormLabel>Kategoriya</FormLabel>
                   <Select onValueChange={field.onChange} value={field.value}>
                     <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                     <SelectContent>
                       <SelectItem value="rent">Ijara</SelectItem>
                       <SelectItem value="salary">Ish haqi</SelectItem>
                       <SelectItem value="utilities">Kommunal</SelectItem>
                       <SelectItem value="other">Boshqa</SelectItem>
                     </SelectContent>
                   </Select>
                   <FormMessage/></FormItem>
                 )}/>
                 <FormField control={form.control} name="amount" render={({field}) => (<FormItem><FormLabel>Summa</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage/></FormItem>)} />
                 <FormField control={form.control} name="description" render={({field}) => (<FormItem><FormLabel>Izoh</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage/></FormItem>)} />
                 <Button type="submit" className="w-full">Saqlash</Button>
               </form>
             </Form>
           </DialogContent>
         </Dialog>
      </PageHeader>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sana</TableHead>
              <TableHead>Kategoriya</TableHead>
              <TableHead>Izoh</TableHead>
              <TableHead className="text-right">Summa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={4} className="text-center py-8">Yuklanmoqda...</TableCell></TableRow> :
             expenses?.map((ex: any) => (
               <TableRow key={ex.id}>
                 <TableCell>{new Date(ex.date).toLocaleDateString()}</TableCell>
                 <TableCell className="capitalize badge">{ex.category}</TableCell>
                 <TableCell>{ex.description}</TableCell>
                 <TableCell className="text-right font-bold text-destructive">-{Number(ex.amount).toLocaleString()} UZS</TableCell>
               </TableRow>
             ))
            }
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
