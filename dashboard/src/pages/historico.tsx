import { useQuery } from "@tanstack/react-query";
import { getQueryHistory } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { History, CheckCircle, XCircle, MessageSquare } from "lucide-react";

export function HistoricoPage() {
  const { data: history, isLoading } = useQuery({
    queryKey: ["query-history"],
    queryFn: getQueryHistory,
    refetchInterval: 30000,
  });

  const successCount = history?.filter((h) => h.found).length ?? 0;
  const failCount = history?.filter((h) => !h.found).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Historico de Consultas</h1>
        <p className="text-muted-foreground">
          Veja o historico de consultas realizadas via Telegram
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Consultas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{history?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">
              Encontrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{successCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">
              Nao Encontrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Consultas Recentes
          </CardTitle>
          <CardDescription>
            Ultimas {history?.length ?? 0} consultas registradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : history?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma consulta registrada</p>
              <p className="text-sm">As consultas feitas via Telegram aparecerão aqui</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Consulta</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Resposta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history?.slice().reverse().map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {item.phone}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.type}</Badge>
                      </TableCell>
                      <TableCell className="font-mono max-w-[150px] truncate">
                        {item.query}
                      </TableCell>
                      <TableCell>
                        {item.found ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Encontrado
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="w-3 h-3" />
                            Nao encontrado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate text-sm">
                        {item.response.replace(/[*_`]/g, "").substring(0, 100)}...
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
