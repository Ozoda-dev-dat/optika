import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, ShoppingCart, Package, Building2, Receipt, LogOut, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const menuItems = [
  { icon: LayoutDashboard, label: "Bosh Sahifa", href: "/" },
  { icon: ShoppingCart, label: "Sotuv", href: "/sales" },
  { icon: Users, label: "Mijozlar", href: "/clients" },
  { icon: Package, label: "Ombor", href: "/inventory" },
  { icon: Truck, label: "Yuk tashish", href: "/shipments" },
  { icon: Building2, label: "Filiallar", href: "/branches" },
  { icon: Receipt, label: "Xarajatlar", href: "/expenses" },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="flex flex-col h-screen w-64 bg-card border-r border-border/40 fixed left-0 top-0 z-50 shadow-sm">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-lg">O</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-primary">Optika CRM</h1>
      </div>

      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href} className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group",
              isActive 
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}>
              <Icon className={cn("w-5 h-5", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="p-4 mt-auto border-t border-border/40 bg-muted/20">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white font-bold shadow-md">
            {user?.firstName?.[0] || "U"}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-semibold truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <button 
          onClick={() => logout()}
          className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Chiqish
        </button>
      </div>
    </div>
  );
}
