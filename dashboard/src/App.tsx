import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { DashboardPage } from "@/pages/dashboard";
import { MateriaisPage } from "@/pages/materiais";
import { FaltasPage } from "@/pages/faltas";
import { WhitelistPage } from "@/pages/whitelist";
import { HistoricoPage } from "@/pages/historico";
import { UploadPage } from "@/pages/upload";
import { ConfiguracoesPage } from "@/pages/configuracoes";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/materiais" component={MateriaisPage} />
        <Route path="/faltas" component={FaltasPage} />
        <Route path="/whitelist" component={WhitelistPage} />
        <Route path="/historico" component={HistoricoPage} />
        <Route path="/upload" component={UploadPage} />
        <Route path="/configuracoes" component={ConfiguracoesPage} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
