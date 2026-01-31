import { useState } from "react";
import { useProducts } from "@/hooks/use-products";
import { useCreateSale } from "@/hooks/use-sales";
import { useClients } from "@/hooks/use-clients";
import { useBranches } from "@/hooks/use-branches";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ShoppingCart, Trash2, CreditCard, Banknote, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SaleInputSchema } from "@shared/schema";

export default function Sales() {
  const [search, setSearch] = useState("");
  const { data: products } = useProducts(undefined, search);
  const { data: clients } = useClients();
  const { data: branches } = useBranches();
  const createSale = useCreateSale();
  const { toast } = useToast();

  const [cart, setCart] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");

  const addToCart = (product: any) => {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      setCart(cart.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { product, quantity: 1, price: Number(product.price) }]);
    }
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(cart.map(item => {
      if (item.product.id === productId) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    }));
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleCheckout = () => {
    if (!selectedBranch) {
      toast({ title: "Xatolik", description: "Iltimos filialni tanlang", variant: "destructive" });
      return;
    }
    if (cart.length === 0) {
      toast({ title: "Xatolik", description: "Savat bo'sh", variant: "destructive" });
      return;
    }

    const payload = {
      branchId: Number(selectedBranch),
      clientId: selectedClient ? Number(selectedClient) : undefined,
      items: cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        price: item.price,
        discount: 0
      })),
      paymentMethod: paymentMethod as any,
      discount: 0
    };

    createSale.mutate(payload, {
      onSuccess: () => {
        toast({ title: "Sotuv amalga oshirildi", description: `Jami: ${total.toLocaleString()} UZS` });
        setCart([]);
        setSelectedClient("");
      },
      onError: (err) => {
        toast({ title: "Xatolik", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col md:flex-row gap-6 animate-in fade-in duration-500">
      {/* Left Side: Product Selection */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        <div className="flex items-center gap-4 bg-card p-4 rounded-xl border shadow-sm shrink-0">
          <Search className="w-5 h-5 text-muted-foreground" />
          <Input 
            className="border-0 shadow-none focus-visible:ring-0 bg-transparent" 
            placeholder="Mahsulot qidirish..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
          {products?.map((product: any) => (
            <Card key={product.id} className="cursor-pointer hover:shadow-md transition-all hover:border-primary group" onClick={() => addToCart(product)}>
              <CardContent className="p-4 flex flex-col h-full">
                <div className="aspect-square rounded-lg bg-muted mb-3 flex items-center justify-center text-muted-foreground/50">
                  IMG
                </div>
                <h3 className="font-semibold text-sm line-clamp-2 mb-1 group-hover:text-primary transition-colors">{product.name}</h3>
                <p className="text-xs text-muted-foreground mb-2">{product.sku}</p>
                <div className="mt-auto font-bold text-primary">
                  {Number(product.price).toLocaleString()} UZS
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Right Side: Cart & Checkout */}
      <div className="w-full md:w-[400px] flex flex-col bg-card rounded-xl border shadow-lg shrink-0 h-full">
        <div className="p-4 border-b space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" /> Savat
          </h2>
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger>
              <SelectValue placeholder="Filialni tanlang" />
            </SelectTrigger>
            <SelectContent>
              {branches?.map((b: any) => (
                <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger>
              <SelectValue placeholder="Mijoz (ixtiyoriy)" />
            </SelectTrigger>
            <SelectContent>
              {clients?.map((c: any) => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.firstName} {c.lastName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.map((item) => (
            <div key={item.product.id} className="flex gap-3 items-center bg-muted/30 p-2 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium line-clamp-1">{item.product.name}</p>
                <p className="text-xs text-muted-foreground">{Number(item.price).toLocaleString()} UZS</p>
              </div>
              <div className="flex items-center gap-2 bg-background rounded-md border p-1">
                <button onClick={() => updateQuantity(item.product.id, -1)} className="w-6 h-6 flex items-center justify-center hover:bg-muted rounded">-</button>
                <span className="text-sm w-4 text-center">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.product.id, 1)} className="w-6 h-6 flex items-center justify-center hover:bg-muted rounded">+</button>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => removeFromCart(item.product.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="text-center py-10 text-muted-foreground opacity-50">
              Savat bo'sh
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-muted/10 space-y-4">
           <div className="grid grid-cols-3 gap-2">
             {['cash', 'card', 'click'].map(method => (
               <button 
                 key={method}
                 onClick={() => setPaymentMethod(method)}
                 className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-medium transition-all ${paymentMethod === method ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}
               >
                 {method === 'cash' && <Banknote className="w-4 h-4 mb-1" />}
                 {method === 'card' && <CreditCard className="w-4 h-4 mb-1" />}
                 {method === 'click' && <Smartphone className="w-4 h-4 mb-1" />}
                 {method.toUpperCase()}
               </button>
             ))}
           </div>
           
           <div className="flex justify-between items-center text-lg font-bold">
             <span>Jami:</span>
             <span>{total.toLocaleString()} UZS</span>
           </div>
           
           <Button className="w-full py-6 text-lg shadow-xl shadow-primary/20" onClick={handleCheckout} disabled={createSale.isPending}>
             {createSale.isPending ? "Jarayonda..." : "To'lov Qilish"}
           </Button>
        </div>
      </div>
    </div>
  );
}
