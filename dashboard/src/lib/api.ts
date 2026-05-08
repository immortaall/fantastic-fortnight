// API client para o MRP Bot
const API_BASE = "/api";

export interface SpreadsheetStatus {
  loaded: boolean;
  filename: string | null;
  uploadedAt: string | null;
  materiais: number;
  ops: number;
  faltas: number;
  totalLinhas: number;
  processing: boolean;
  abas: string[];
}

export interface TelegramStatus {
  connected: boolean;
  status: string;
  number: string | null;
}

export interface SystemStatus {
  ok: boolean;
  telegram: TelegramStatus;
  spreadsheet: SpreadsheetStatus;
  ts: number;
}

export interface WhitelistItem {
  id: number;
  phone: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface QueryHistoryItem {
  id: number;
  phone: string;
  type: string;
  query: string;
  found: boolean;
  response: string;
  createdAt: string;
}

export interface MaterialResumo {
  codigo: string;
  descricao: string;
  saldoAtual: number;
  qtdPC: number;
  dataChegada: string | null;
  qtdFalta: number;
  totalEmpenho: number;
  opCritica: string | null;
  ops: OpInfo[];
  clientePrincipal: string | null;
  setorPrincipal: string | null;
  pedidoPrincipal: string | null;
  clientes: string[];
  pontoPedido: number | null;
  diferencaEstoque: number | null;
  precisaComprar: boolean;
  compradora: string | null;
}

export interface OpInfo {
  codigoOP: string;
  qtdEmpenho: number;
  dataPlanejada: string | null;
  pedido: string | null;
  cliente: string | null;
  setor: string | null;
}

export interface FaltaItem {
  material: string;
  descricao: string;
  opCritica: string;
  qtdFalta: number;
  saldoAtual: number;
  qtdPC: number;
  dataChegada: string;
  previsao: string;
  compradora: string;
  criticidade: string;
}

export interface QueryStats {
  ok: boolean;
  totalConsultas: number;
  hoje: number;
  totalFaltas: number;
  criticas: number;
}

export interface DebugInfo {
  planilhaCarregada: boolean;
  totalMateriais: number;
  totalFaltas: number;
  arquivo: string | null;
  carregadaEm: string | null;
  webhookUrl: string;
  telegram: {
    token: string;
    username: string | null;
    polling: boolean;
  };
  totalWebhooksRecebidos: number;
  totalMensagensProcessadas: number;
  ultimaMensagemRecebida: {
    numero: string;
    texto: string;
    hora: string;
  } | null;
  ultimoErro: string | null;
  uptime: number;
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// Status
export const getSystemStatus = () => fetchApi<SystemStatus>("/status");
export const getQueryStats = () => fetchApi<QueryStats>("/query/stats");
export const getDebugInfo = () => fetchApi<DebugInfo>("/debug");

// Telegram
export const getTelegramStatus = () => fetchApi<TelegramStatus>("/telegram/status");
export const getTelegramConfig = () => fetchApi<{ token: string; username: string | null; polling: boolean }>("/telegram/config");

// Spreadsheet
export const getSpreadsheetStatus = () => fetchApi<SpreadsheetStatus>("/spreadsheet/status");
export const getSpreadsheetPreview = (limit = 20) => fetchApi<MaterialResumo[]>(`/spreadsheet/preview?limit=${limit}`);
export const getMaterial = (codigo: string) => fetchApi<MaterialResumo>(`/spreadsheet/material/${encodeURIComponent(codigo)}`);
export const getOP = (codigo: string) => fetchApi<{ op: string; dataPlanejada: string | null; pedido: string | null; cliente: string | null; setor: string | null; materials: MaterialResumo[] }>(`/spreadsheet/op/${encodeURIComponent(codigo)}`);

export async function uploadSpreadsheet(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/spreadsheet/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const reloadSpreadsheet = () => fetchApi<{ ok: boolean }>("/spreadsheet/reload", { method: "POST" });

// Relatórios
export const getFaltas = () => fetchApi<FaltaItem[]>("/relatorio/faltas");

// Whitelist
export const getWhitelist = () => fetchApi<WhitelistItem[]>("/whitelist");
export const addToWhitelist = (phone: string, name: string) =>
  fetchApi<{ ok: boolean; item: WhitelistItem }>("/whitelist", {
    method: "POST",
    body: JSON.stringify({ phone, name }),
  });
export const updateWhitelist = (id: number, data: Partial<WhitelistItem>) =>
  fetchApi<{ ok: boolean; item: WhitelistItem }>(`/whitelist/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
export const toggleWhitelist = (id: number) =>
  fetchApi<{ ok: boolean; item: WhitelistItem }>(`/whitelist/${id}/toggle`, {
    method: "PATCH",
  });
export const removeFromWhitelist = (id: number) =>
  fetchApi<{ ok: boolean }>(`/whitelist/${id}`, {
    method: "DELETE",
  });

// Query History
export const getQueryHistory = () => fetchApi<QueryHistoryItem[]>("/query/history");

// Consulta manual
export const consultar = (texto: string) =>
  fetchApi<{ ok: boolean; tipo?: string; resposta: string; data?: MaterialResumo; error?: string }>("/consultar", {
    method: "POST",
    body: JSON.stringify({ texto }),
  });
