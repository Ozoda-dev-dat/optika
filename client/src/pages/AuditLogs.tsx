import { useQuery } from "@tanstack/react-query";
import { AuditLog, User } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ShieldCheck } from "lucide-react";

export default function AuditLogs() {
  const { data: logs, isLoading } = useQuery<(AuditLog & { actor: User })[]>({
    queryKey: ["/api/audit-logs"],
  });

  if (isLoading) return <div className="p-8">Yuklanmoqda...</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <ShieldCheck className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Audit Loglari</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chegirmalar va Tizim Harakatlari</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sana</TableHead>
                <TableHead>Xodim</TableHead>
                <TableHead>Harakat</TableHead>
                <TableHead>Obyekt</TableHead>
                <TableHead>Tafsilotlar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs?.map((log) => {
                const metadata = log.metadata ? JSON.parse(log.metadata) : {};
                return (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">
                      {format(new Date(log.createdAt!), "dd.MM.yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      {log.actor.firstName} {log.actor.lastName}
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                        {log.actionType}
                      </span>
                    </TableCell>
                    <TableCell>
                      {log.entityType} #{log.entityId}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground text-xs">
                      {log.actionType === "DISCOUNT_APPLIED" ? (
                        <span>
                          Old: {metadata.oldTotal} | 
                          Disc: {metadata.discountPercent}% ({metadata.discountAmount}) | 
                          New: {metadata.newTotal}
                        </span>
                      ) : log.metadata}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
