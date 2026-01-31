import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  className?: string;
}

export function StatCard({ title, value, icon: Icon, trend, trendUp, className }: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden hover:shadow-lg transition-shadow duration-300", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
          </div>
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10 text-primary")}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
        {trend && (
          <div className="mt-4 flex items-center text-xs">
            <span className={cn("font-medium", trendUp ? "text-emerald-600" : "text-red-600")}>
              {trend}
            </span>
            <span className="text-muted-foreground ml-2">o'tgan oyga nisbatan</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
