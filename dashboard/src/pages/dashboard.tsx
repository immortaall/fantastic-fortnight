import { useQuery } from "@tanstack/react-query";
import { getSystemStatus, getQueryStats, getDebugInfo } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  FileSpreadsheet,
  AlertTriangle,
  MessageSquare,
  Bot,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ connected, label }: { connected: boolean; label: string }) {
  return (
    <Badge variant={connected ? "default" : "destructive"} className="gap-1">
      {connected ? (
        <CheckCircle className="w-3 h-3" />
      ) : (
        <XCircle className="w-3 h-3" />
      )}
      {label}
    </Badge>
  );
}

export function DashboardPage() {
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["system-status"],
    queryFn: getSystemStatus,
    refetchInterval: 10000,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["query-stats"],
    queryFn: getQueryStats,
    refetchInterval: 30000,
  });

  const { data: debug } = useQuery({
    queryKey: ["debug-info"],
    queryFn: getDebugInfo,
    refetchInterval: 30000,
  });

  const isLoading = statusLoading || statsLoading;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Visao geral do sistema MRP Bot
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge
            connected={status?.telegram?.connected ?? false}
            label={status?.telegram?.connected ? "Telegram Online" : "Telegram Offline"}
          />
          <StatusBadge
            connected={status?.spreadsheet?.loaded ?? false}
            label={status?.spreadsheet?.loaded ? "Planilha OK" : "Sem Planilha"}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <StatCard
              title="Total Materiais"
              value={status?.spreadsheet?.materiais ?? 0}
              description="Materiais carregados"
              icon={Package}
            />
            <StatCard
              title="Ordens de Producao"
              value={status?.spreadsheet?.ops ?? 0}
              description="OPs ativas"
              icon={FileSpreadsheet}
            />
            <StatCard
              title="Materiais em Falta"
              value={stats?.totalFaltas ?? 0}
              description={`${stats?.criticas ?? 0} criticos`}
              icon={AlertTriangle}
            />
            <StatCard
              title="Consultas Hoje"
              value={stats?.hoje ?? 0}
              description={`${stats?.totalConsultas ?? 0} total`}
              icon={MessageSquare}
            />
          </>
        )}
      </div>

      {/* Details Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Telegram Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              Status do Telegram
            </CardTitle>
            <CardDescription>
              Informacoes sobre a conexao do bot
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={status?.telegram?.connected ? "default" : "destructive"}>
                {status?.telegram?.status ?? "Desconhecido"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Bot</span>
              <span className="text-sm font-medium">
                {status?.telegram?.number ?? "Nao configurado"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Mensagens Processadas</span>
              <span className="text-sm font-medium">
                {debug?.totalMensagensProcessadas ?? 0}
              </span>
            </div>
            {debug?.ultimaMensagemRecebida && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Ultima mensagem:</p>
                <p className="text-sm truncate">{debug.ultimaMensagemRecebida.texto}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(debug.ultimaMensagemRecebida.hora).toLocaleString("pt-BR")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Spreadsheet Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Status da Planilha
            </CardTitle>
            <CardDescription>
              Informacoes sobre os dados carregados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Arquivo</span>
              <span className="text-sm font-medium truncate max-w-[200px]">
                {status?.spreadsheet?.filename ?? "Nenhum arquivo"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Linhas</span>
              <span className="text-sm font-medium">
                {status?.spreadsheet?.totalLinhas?.toLocaleString("pt-BR") ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Materiais</span>
              <span className="text-sm font-medium">
                {status?.spreadsheet?.materiais?.toLocaleString("pt-BR") ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">OPs</span>
              <span className="text-sm font-medium">
                {status?.spreadsheet?.ops?.toLocaleString("pt-BR") ?? 0}
              </span>
            </div>
            {status?.spreadsheet?.uploadedAt && (
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Atualizado em
                </span>
                <span className="text-sm font-medium">
                  {new Date(status.spreadsheet.uploadedAt).toLocaleString("pt-BR")}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Info */}
      {debug && (
        <Card>
          <CardHeader>
            <CardTitle>Informacoes do Sistema</CardTitle>
            <CardDescription>
              Dados tecnicos e de debug
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Uptime</p>
                <p className="text-lg font-medium">
                  {Math.floor(debug.uptime / 3600)}h {Math.floor((debug.uptime % 3600) / 60)}m
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Webhooks Recebidos</p>
                <p className="text-lg font-medium">{debug.totalWebhooksRecebidos}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Webhook URL</p>
                <p className="text-xs font-mono truncate">{debug.webhookUrl}</p>
              </div>
            </div>
            {debug.ultimoErro && (
              <div className="mt-4 p-3 bg-destructive/10 rounded-lg">
                <p className="text-sm font-medium text-destructive">Ultimo Erro:</p>
                <p className="text-xs text-destructive/80 mt-1">{debug.ultimoErro}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
