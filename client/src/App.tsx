import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/Sidebar";

import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Branches from "@/pages/Branches";
import Inventory from "@/pages/Inventory";
import Clients from "@/pages/Clients";
import ClientDetails from "@/pages/ClientDetails";
import Sales from "@/pages/Sales";
import Expenses from "@/pages/Expenses";
import Login from "@/pages/Login";
import Shipments from "@/pages/Shipments";

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 overflow-y-auto max-h-screen">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <ProtectedLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/branches" component={Branches} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/clients" component={Clients} />
        <Route path="/clients/:id" component={ClientDetails} />
        <Route path="/sales" component={Sales} />
        <Route path="/shipments" component={Shipments} />
        <Route path="/expenses" component={Expenses} />
        <Route component={NotFound} />
      </Switch>
    </ProtectedLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
