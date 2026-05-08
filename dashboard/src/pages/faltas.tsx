import { useQuery } from "@tanstack/react-query";
import { getFaltas } from "@/lib/api";
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
import { AlertTriangle, Package } from "lucide-react";

export function FaltasPage() {
  const { data: faltas, isLoading } = useQuery({
    queryKey: ["faltas"],
    queryFn: getFaltas,
    refetchInterval: 60000,
  });

  const criticos = faltas?.filter((f) => f.criticidade === "Critico") ?? [];
  const atencao = faltas?.filter((f) => f.criticidade === "Atencao") ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Materiais em Falta</h1>
        <p className="text-muted-foreground">
          Acompanhe os materiais com falta de estoque
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total em Falta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{faltas?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="border-destructive/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-destructive">
              Criticos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{criticos.length}</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600">
              Atencao
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{atencao.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Faltas Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Lista de Faltas
          </CardTitle>
          <CardDescription>
            Materiais ordenados por quantidade em falta
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : faltas?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum material em falta</p>
              <p className="text-sm">Todos os materiais estao com estoque adequado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Codigo</TableHead>
                    <TableHead>Descricao</TableHead>
                    <TableHead className="text-right">Falta</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Em PC</TableHead>
                    <TableHead>OP Critica</TableHead>
                    <TableHead>Previsao</TableHead>
                    <TableHead>Compradora</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {faltas?.map((item) => (
                    <TableRow key={item.material}>
                      <TableCell className="font-mono font-medium">
                        {item.material}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {item.descricao}
                      </TableCell>
                      <TableCell className="text-right font-bold text-destructive">
                        {item.qtdFalta}
                      </TableCell>
                      <TableCell className="text-right">{item.saldoAtual}</TableCell>
                      <TableCell className="text-right">{item.qtdPC}</TableCell>
                      <TableCell className="font-mono">{item.opCritica}</TableCell>
                      <TableCell>{item.previsao}</TableCell>
                      <TableCell>{item.compradora}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.criticidade === "Critico"
                              ? "destructive"
                              : item.criticidade === "Atencao"
                              ? "secondary"
                              : "default"
                          }
                        >
                          {item.criticidade}
                        </Badge>
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
