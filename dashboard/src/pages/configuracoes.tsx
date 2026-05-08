import { useQuery } from "@tanstack/react-query";
import { getTelegramConfig, getDebugInfo } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Bot, Link2, Shield, Clock } from "lucide-react";

export function ConfiguracoesPage() {
  const { data: telegramConfig, isLoading: configLoading } = useQuery({
    queryKey: ["telegram-config"],
    queryFn: getTelegramConfig,
  });

  const { data: debug, isLoading: debugLoading } = useQuery({
    queryKey: ["debug-info"],
    queryFn: getDebugInfo,
  });

  const isLoading = configLoading || debugLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuracoes</h1>
        <p className="text-muted-foreground">
          Visualize as configuracoes do sistema
        </p>
      </div>

      {/* Telegram Config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Configuracao do Telegram
          </CardTitle>
          <CardDescription>
            Informacoes do bot do Telegram
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Token</span>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {telegramConfig?.token}
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Usuario</span>
                <span className="text-sm font-medium">
                  {telegramConfig?.username ?? "Nao configurado"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Modo</span>
                <Badge variant={telegramConfig?.polling ? "default" : "secondary"}>
                  {telegramConfig?.polling ? "Long Polling" : "Webhook"}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook Config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Webhook URL
          </CardTitle>
          <CardDescription>
            Endereco para receber mensagens do Telegram
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="bg-muted p-3 rounded-lg">
              <code className="text-sm break-all">{debug?.webhookUrl}</code>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Informacoes do Sistema
          </CardTitle>
          <CardDescription>
            Estatisticas e status do servidor
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Uptime</p>
                  <p className="font-medium">
                    {Math.floor((debug?.uptime ?? 0) / 3600)}h{" "}
                    {Math.floor(((debug?.uptime ?? 0) % 3600) / 60)}m
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Webhooks Recebidos</p>
                  <p className="font-medium">{debug?.totalWebhooksRecebidos ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Bot className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Mensagens Processadas</p>
                  <p className="font-medium">{debug?.totalMensagensProcessadas ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Planilha Carregada</p>
                  <Badge variant={debug?.planilhaCarregada ? "default" : "destructive"}>
                    {debug?.planilhaCarregada ? "Sim" : "Nao"}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Last Error */}
      {debug?.ultimoErro && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Ultimo Erro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-destructive/10 p-3 rounded-lg">
              <code className="text-sm text-destructive break-all">
                {debug.ultimoErro}
              </code>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Variaveis de Ambiente</CardTitle>
          <CardDescription>
            Variaveis necessarias para o funcionamento do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <code className="bg-muted px-2 py-1 rounded text-xs">DATABASE_URL</code>
              <span className="text-muted-foreground">URL de conexao com o PostgreSQL</span>
            </div>
            <div className="flex items-start gap-2">
              <code className="bg-muted px-2 py-1 rounded text-xs">TELEGRAM_BOT_TOKEN</code>
              <span className="text-muted-foreground">Token do bot do Telegram</span>
            </div>
            <div className="flex items-start gap-2">
              <code className="bg-muted px-2 py-1 rounded text-xs">PORT</code>
              <span className="text-muted-foreground">Porta do servidor (padrao: 3000)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
