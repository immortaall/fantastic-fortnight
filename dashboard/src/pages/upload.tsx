import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { uploadSpreadsheet, getSpreadsheetStatus, reloadSpreadsheet } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Clock,
} from "lucide-react";

export function UploadPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["spreadsheet-status"],
    queryFn: getSpreadsheetStatus,
    refetchInterval: 5000,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      setUploadProgress(0);
      // Simulate progress
      const interval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      return uploadSpreadsheet(file).finally(() => {
        clearInterval(interval);
        setUploadProgress(100);
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["spreadsheet-status"] });
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
      queryClient.invalidateQueries({ queryKey: ["materiais-preview"] });
      queryClient.invalidateQueries({ queryKey: ["faltas"] });
      toast({
        title: "Upload concluido",
        description: `Planilha processada: ${result.materiais} materiais, ${result.ops} OPs`,
      });
      setTimeout(() => setUploadProgress(0), 2000);
    },
    onError: (error: Error) => {
      setUploadProgress(0);
      toast({
        title: "Erro no upload",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const reloadMutation = useMutation({
    mutationFn: reloadSpreadsheet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spreadsheet-status"] });
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
      toast({
        title: "Recarregado",
        description: "A planilha foi recarregada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao recarregar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|xlsm)$/i)) {
      toast({
        title: "Arquivo invalido",
        description: "Por favor, selecione um arquivo Excel (.xlsx, .xls ou .xlsm)",
        variant: "destructive",
      });
      return;
    }
    uploadMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload de Planilha</h1>
        <p className="text-muted-foreground">
          Faca upload da planilha MRP para atualizar os dados
        </p>
      </div>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Upload de Arquivo</CardTitle>
          <CardDescription>
            Arraste e solte ou clique para selecionar a planilha Excel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.xlsm"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
            />

            {uploadMutation.isPending ? (
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                </div>
                <div>
                  <p className="font-medium">Processando planilha...</p>
                  <p className="text-sm text-muted-foreground">
                    Isso pode levar alguns segundos
                  </p>
                </div>
                <Progress value={uploadProgress} className="max-w-xs mx-auto" />
              </div>
            ) : (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="font-medium mb-1">Arraste a planilha aqui</p>
                <p className="text-sm text-muted-foreground mb-4">
                  ou clique para selecionar
                </p>
                <Button onClick={() => fileInputRef.current?.click()}>
                  Selecionar Arquivo
                </Button>
                <p className="text-xs text-muted-foreground mt-4">
                  Formatos aceitos: .xlsx, .xls, .xlsm (max 150MB)
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Status Atual
          </CardTitle>
          <CardDescription>
            Informacoes sobre a planilha carregada
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-1/3"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
          ) : !status?.loaded ? (
            <div className="flex items-center gap-3 text-muted-foreground">
              <AlertCircle className="w-5 h-5" />
              <span>Nenhuma planilha carregada</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Carregada
                </Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Arquivo</p>
                  <p className="font-medium truncate">{status.filename}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Linhas</p>
                  <p className="font-medium">{status.totalLinhas?.toLocaleString("pt-BR")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Materiais</p>
                  <p className="font-medium">{status.materiais?.toLocaleString("pt-BR")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">OPs</p>
                  <p className="font-medium">{status.ops?.toLocaleString("pt-BR")}</p>
                </div>
              </div>

              {status.uploadedAt && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  Ultima atualizacao: {new Date(status.uploadedAt).toLocaleString("pt-BR")}
                </div>
              )}

              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => reloadMutation.mutate()}
                  disabled={reloadMutation.isPending}
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-2 ${reloadMutation.isPending ? "animate-spin" : ""}`}
                  />
                  Recarregar Dados
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Requisitos da Planilha</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <p>A planilha deve conter as seguintes abas:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li><strong>SD4</strong> (obrigatoria) - Dados principais dos materiais e OPs</li>
              <li><strong>Plano</strong> (opcional) - Informacoes de pedidos e clientes</li>
              <li><strong>Solicitar</strong> (opcional) - Pontos de pedido</li>
              <li><strong>MATR120</strong> (opcional) - Informacoes de compradores</li>
            </ul>
            <p className="text-muted-foreground">
              Os dados das abas secundarias serao cruzados automaticamente com a SD4.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
