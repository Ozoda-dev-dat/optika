import { useDashboardStats } from "@/hooks/use-reports";
import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/PageHeader";
import { Users, ShoppingCart, AlertTriangle, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function Dashboard() {
  const { data, isLoading } = useDashboardStats();

  if (isLoading) {
    return <div className="p-8 flex justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div>;
  }

  // Mock chart data if real data is complex
  const chartData = [
    { name: 'Du', savdo: 4000 },
    { name: 'Se', savdo: 3000 },
    { name: 'Ch', savdo: 2000 },
    { name: 'Pa', savdo: 2780 },
    { name: 'Ju', savdo: 1890 },
    { name: 'Sh', savdo: 2390 },
    { name: 'Ya', savdo: 3490 },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader title="Bosh Sahifa" description="Bugungi ko'rsatkichlar va statistika" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Bugungi Savdo"
          value={`${data?.dailySales?.toLocaleString() || 0} UZS`}
          icon={TrendingUp}
          trend="+12%"
          trendUp={true}
        />
        <StatCard
          title="Oylik Savdo"
          value={`${data?.monthlySales?.toLocaleString() || 0} UZS`}
          icon={ShoppingCart}
        />
        <StatCard
          title="Jami Mijozlar"
          value={data?.totalClients || 0}
          icon={Users}
        />
        <StatCard
          title="Kam Qolgan Mahsulotlar"
          value={data?.lowStockCount || 0}
          icon={AlertTriangle}
          className={data?.lowStockCount && data.lowStockCount > 0 ? "border-amber-200 bg-amber-50" : ""}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="col-span-1 lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle>Haftalik Savdo Statistikasi</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280'}} />
                <Tooltip 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                  cursor={{fill: '#f3f4f6'}}
                />
                <Bar dataKey="savdo" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-1 shadow-sm">
          <CardHeader>
            <CardTitle>Top Mahsulotlar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.topProducts?.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.brand}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">{item.count} dona</p>
                  </div>
                </div>
              ))}
              {!data?.topProducts?.length && (
                <p className="text-muted-foreground text-center py-4">Ma'lumot yo'q</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
