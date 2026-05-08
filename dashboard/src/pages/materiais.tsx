import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSpreadsheetPreview, getMaterial, consultar } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Package, AlertTriangle, CheckCircle } from "lucide-react";
import type { MaterialResumo } from "@/lib/api";

function MaterialDetailDialog({
  material,
  open,
  onOpenChange,
}: {
  material: MaterialResumo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!material) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {material.codigo}
          </DialogTitle>
          <DialogDescription>{material.descricao}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {/* Status */}
          <div className="flex gap-2">
            {material.qtdFalta > 0 ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="w-3 h-3" />
                Falta: {material.qtdFalta}
              </Badge>
            ) : (
              <Badge variant="default" className="gap-1">
                <CheckCircle className="w-3 h-3" />
                Estoque OK
              </Badge>
            )}
            {material.precisaComprar && (
              <Badge variant="secondary">Precisa Comprar</Badge>
            )}
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Saldo Atual</p>
              <p className="text-lg font-semibold">{material.saldoAtual}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Qtd em PC</p>
              <p className="text-lg font-semibold">{material.qtdPC}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Empenho</p>
              <p className="text-lg font-semibold">{material.totalEmpenho}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Qtd Falta</p>
              <p className="text-lg font-semibold text-destructive">
                {material.qtdFalta}
              </p>
            </div>
            {material.pontoPedido && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Ponto de Pedido</p>
                <p className="text-lg font-semibold">{material.pontoPedido}</p>
              </div>
            )}
            {material.diferencaEstoque !== null && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Diferenca Estoque</p>
                <p className="text-lg font-semibold">{material.diferencaEstoque}</p>
              </div>
            )}
            {material.dataChegada && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Data Chegada PC</p>
                <p className="text-lg font-semibold">{material.dataChegada}</p>
              </div>
            )}
            {material.compradora && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Compradora</p>
                <p className="text-lg font-semibold">{material.compradora}</p>
              </div>
            )}
          </div>

          {/* OP Info */}
          {material.opCritica && (
            <div className="p-3 bg-destructive/10 rounded-lg">
              <p className="text-sm font-medium text-destructive">OP Critica</p>
              <p className="font-mono">{material.opCritica}</p>
            </div>
          )}

          {/* Cliente/Setor */}
          {(material.clientePrincipal || material.setorPrincipal) && (
            <div className="grid grid-cols-2 gap-4">
              {material.clientePrincipal && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Cliente Principal</p>
                  <p className="font-semibold">{material.clientePrincipal}</p>
                </div>
              )}
              {material.setorPrincipal && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Setor</p>
                  <p className="font-semibold">{material.setorPrincipal}</p>
                </div>
              )}
            </div>
          )}

          {/* OPs List */}
          {material.ops.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Ordens de Producao ({material.ops.length})</p>
              <div className="max-h-48 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>OP</TableHead>
                      <TableHead>Empenho</TableHead>
                      <TableHead>Data Plan.</TableHead>
                      <TableHead>Cliente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {material.ops.map((op, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono">{op.codigoOP}</TableCell>
                        <TableCell>{op.qtdEmpenho}</TableCell>
                        <TableCell>{op.dataPlanejada ?? "-"}</TableCell>
                        <TableCell>{op.cliente ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function MateriaisPage() {
  const [search, setSearch] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialResumo | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const { data: materiais, isLoading } = useQuery({
    queryKey: ["materiais-preview"],
    queryFn: () => getSpreadsheetPreview(100),
  });

  const handleSearch = async () => {
    if (!search.trim()) return;
    setIsSearching(true);
    try {
      const result = await consultar(search.trim());
      if (result.ok && result.data) {
        setSelectedMaterial(result.data);
      } else {
        // Try getMaterial directly
        try {
          const material = await getMaterial(search.trim());
          setSelectedMaterial(material);
        } catch {
          alert(result.error || "Material nao encontrado");
        }
      }
    } catch (error) {
      alert("Erro ao buscar material");
    } finally {
      setIsSearching(false);
    }
  };

  const filteredMateriais = materiais?.filter((m) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      m.codigo.toLowerCase().includes(term) ||
      m.descricao.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Materiais</h1>
        <p className="text-muted-foreground">
          Consulte e visualize informacoes dos materiais
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Buscar Material</CardTitle>
          <CardDescription>
            Digite o codigo do material ou parte da descricao
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Codigo ou descricao do material..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? "Buscando..." : "Buscar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Materials Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Lista de Materiais
          </CardTitle>
          <CardDescription>
            Mostrando {filteredMateriais?.length ?? 0} materiais
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredMateriais?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum material encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Codigo</TableHead>
                    <TableHead>Descricao</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Em PC</TableHead>
                    <TableHead className="text-right">Empenho</TableHead>
                    <TableHead className="text-right">Falta</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMateriais?.map((material) => (
                    <TableRow
                      key={material.codigo}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedMaterial(material)}
                    >
                      <TableCell className="font-mono font-medium">
                        {material.codigo}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {material.descricao}
                      </TableCell>
                      <TableCell className="text-right">{material.saldoAtual}</TableCell>
                      <TableCell className="text-right">{material.qtdPC}</TableCell>
                      <TableCell className="text-right">{material.totalEmpenho}</TableCell>
                      <TableCell className="text-right font-semibold">
                        <span className={material.qtdFalta > 0 ? "text-destructive" : ""}>
                          {material.qtdFalta}
                        </span>
                      </TableCell>
                      <TableCell>
                        {material.qtdFalta > 0 ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Falta
                          </Badge>
                        ) : (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle className="w-3 h-3" />
                            OK
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <MaterialDetailDialog
        material={selectedMaterial}
        open={!!selectedMaterial}
        onOpenChange={(open) => !open && setSelectedMaterial(null)}
      />
    </div>
  );
}
