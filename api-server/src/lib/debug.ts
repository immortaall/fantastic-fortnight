export const debugState = {
  ultimaMensagemRecebida: null as {
    numero: string;
    texto: string;
    hora: string;
  } | null,
  ultimoErro: null as string | null,
  totalWebhooksRecebidos: 0,
  totalMensagensProcessadas: 0,
};
