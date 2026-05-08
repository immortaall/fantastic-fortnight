import {
  getMaterialResumo,
  buscarPorDescricao,
  buscarPorCliente,
  buscarPorCompradora,
  getOpResumo,
  getMaterialsComFalta,
  getMaterialsComPCAberto,
  getMaterialsSemEstoque,
  getMaterialsAbaixoPontoPedido,
  getSpreadsheetStats,
  type MaterialResumo,
  type OpResumo,
} from "./spreadsheet.js";

interface QueryResult {
  resposta: string;
  found: boolean;
  tipo: string;
}

// ── Detecção de intenção ───────────────────────────────────────────────────

type Intencao =
  | "op"
  | "urgente"
  | "pc_aberto"
  | "sem_estoque"
  | "faltas"
  | "necessidade_compra"
  | "cliente"
  | "compradora"
  | "descricao"
  | "material";

function detectarIntencao(texto: string): Intencao {
  const t = norm(texto);

  if (t.startsWith("!")) return "urgente";

  if (/^op[\s\-#]*\d+/i.test(t) || /^\d{7,}$/.test(t.replace(/\s/g, ""))) return "op";

  if (hasAny(t, ["pc em aberto", "pedido de compra", "pc aberto"])) return "pc_aberto";
  if (hasAny(t, ["qual material tem pc", "tem pc", "quais tem pc"])) return "pc_aberto";

  if (hasAny(t, ["sem estoque", "estoque zero", "estoque zerado", "zerado"])) return "sem_estoque";
  if (t === "sem estoque" || t === "semestoque") return "sem_estoque";

  if (hasAny(t, ["falta", "critico", "critica", "shortage", "urgente"])) return "faltas";

  if (hasAny(t, ["ponto de pedido", "precisa comprar", "necessidade", "abaixo do ponto", "comprar"])) return "necessidade_compra";

  if (hasAny(t, ["cliente", "pedido de venda", "para quem", "quem pediu"])) return "cliente";

  if (hasAny(t, ["compradora", "comprador", "responsavel", "quem compra"])) return "compradora";

  // Busca por descrição: frases naturais com palavras > 4 chars
  const palavras = t.split(/\s+/).filter((p) => p.length > 3);
  if (palavras.length >= 2 && !/^[\d.\-/]+$/.test(t)) return "descricao";

  return "material";
}

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(norm(w)));
}

// ── Formatação completa de material ───────────────────────────────────────

function formatarMaterial(m: MaterialResumo): string {
  const opPrincipal = m.ops[0];
  const linhas: string[] = [];

  linhas.push(`📦 *Código:* ${m.codigo}`);
  linhas.push(`📝 *Descrição:* ${m.descricao || "—"}`);

  // Info da OP (do PLANO)
  if (opPrincipal) {
    linhas.push(`🏭 *OP:* ${opPrincipal.codigoOP}`);
    if (opPrincipal.dataPlanejada) linhas.push(`📅 *Data da OP:* ${opPrincipal.dataPlanejada}`);
    if (opPrincipal.pedido) linhas.push(`🧾 *Pedido:* ${opPrincipal.pedido}`);
    if (opPrincipal.cliente) linhas.push(`👤 *Cliente:* ${opPrincipal.cliente}`);
    if (opPrincipal.setor) linhas.push(`🏢 *Setor:* ${opPrincipal.setor}`);
    linhas.push(`📊 *Qtd empenhada:* ${opPrincipal.qtdEmpenho} un`);
  }

  linhas.push(`📦 *Estoque:* ${m.saldoAtual} un`);

  // PC
  if (m.qtdPC > 0) {
    linhas.push(`🛒 *Pedido de compra:* ${m.qtdPC} un`);
    if (m.dataChegada) linhas.push(`📅 *Data do PC:* ${m.dataChegada}`);
  }

  // Ponto de pedido (SOLICITAR)
  if (m.pontoPedido != null) {
    linhas.push(`🎯 *Ponto de pedido:* ${m.pontoPedido} un`);
    if (m.diferencaEstoque != null) {
      if (m.diferencaEstoque > 0) {
        linhas.push(`⚠️ *Necessidade de compra:* ${m.diferencaEstoque} un abaixo do ponto`);
      } else {
        linhas.push(`✅ *Estoque acima do ponto de pedido*`);
      }
    }
  }

  // Compradora (MATR120)
  if (m.compradora) linhas.push(`👩‍💼 *Compradora:* ${m.compradora}`);

  // Falta
  if (m.qtdFalta > 0) {
    linhas.push(`\n🔴 *Falta:* ${m.qtdFalta} un`);
    if (m.opCritica) linhas.push(`🔴 *OP crítica:* ${m.opCritica}`);
  } else if (opPrincipal) {
    linhas.push(`✅ *Estoque atende a demanda*`);
  }

  // Múltiplos clientes
  if (m.clientes.length > 1) {
    linhas.push(`\n👥 *Outros clientes:* ${m.clientes.slice(1, 4).join(", ")}`);
  }

  // Múltiplas OPs
  if (m.ops.length > 1) {
    linhas.push(`\n📋 *Total de OPs:* ${m.ops.length}`);
    m.ops.slice(1, 4).forEach((op) => {
      linhas.push(`• OP ${op.codigoOP} — ${op.qtdEmpenho} un${op.cliente ? ` (${op.cliente})` : ""}`);
    });
    if (m.ops.length > 4) linhas.push(`_...e mais ${m.ops.length - 4} OPs_`);
  }

  return linhas.join("\n");
}

// ── Formatação de OP ───────────────────────────────────────────────────────

function formatarOP(op: OpResumo): string {
  const linhas: string[] = [`🏭 *OP ${op.op}*`];

  if (op.dataPlanejada) linhas.push(`📅 *Data planejada:* ${op.dataPlanejada}`);
  if (op.pedido) linhas.push(`🧾 *Pedido:* ${op.pedido}`);
  if (op.cliente) linhas.push(`👤 *Cliente:* ${op.cliente}`);
  if (op.setor) linhas.push(`🏢 *Setor:* ${op.setor}`);

  if (op.materials.length === 0) {
    linhas.push(`\n✅ Nenhum material com falta nesta OP.`);
  } else {
    linhas.push(`\n⚠️ *Materiais em falta (${op.materials.length}):*`);
    op.materials.slice(0, 8).forEach((m) => {
      linhas.push(`• *${m.codigo}* — ${m.descricao.slice(0, 30)}`);
      linhas.push(`  Estoque: ${m.saldoAtual} | Falta: ${m.qtdFalta} un`);
    });
    if (op.materials.length > 8) linhas.push(`_...e mais ${op.materials.length - 8} materiais_`);
  }

  return linhas.join("\n");
}

// ── Listas ─────────────────────────────────────────────────────────────────

function listarFaltas(): QueryResult {
  const faltas = getMaterialsComFalta().slice(0, 8);
  if (faltas.length === 0)
    return { resposta: "✅ Nenhum material com falta no momento.", found: true, tipo: "faltas" };

  const lista = faltas
    .map(
      (f, i) =>
        `${i + 1}. *${f.material}* — ${f.descricao.slice(0, 25)}\n   Falta: ${f.qtdFalta} un | OP: ${f.opCritica}${f.compradora !== "—" ? ` | 👩‍💼 ${f.compradora}` : ""}`
    )
    .join("\n");
  return {
    resposta: `📋 *Top materiais com falta:*\n\n${lista}\n\n_Envie o código para detalhes._`,
    found: true,
    tipo: "faltas",
  };
}

function listarPCAberto(): QueryResult {
  const materiais = getMaterialsComPCAberto().slice(0, 8);
  if (materiais.length === 0)
    return { resposta: "✅ Nenhum material com pedido de compra em aberto.", found: true, tipo: "pc_aberto" };

  const lista = materiais
    .map(
      (m, i) =>
        `${i + 1}. *${m.codigo}* — ${m.descricao.slice(0, 28)}\n   PC: ${m.qtdPC} un | Chegada: ${m.dataChegada ?? "—"}${m.compradora ? ` | 👩‍💼 ${m.compradora}` : ""}`
    )
    .join("\n");
  return {
    resposta: `🛒 *Materiais com PC em aberto (${materiais.length}):*\n\n${lista}\n\n_Envie o código para ver detalhes._`,
    found: true,
    tipo: "pc_aberto",
  };
}

function listarSemEstoque(): QueryResult {
  const materiais = getMaterialsSemEstoque().slice(0, 8);
  if (materiais.length === 0)
    return { resposta: "✅ Nenhum material com estoque zerado e empenho ativo.", found: true, tipo: "sem_estoque" };

  const lista = materiais
    .map(
      (m, i) =>
        `${i + 1}. *${m.codigo}* — ${m.descricao.slice(0, 28)}\n   Empenho: ${m.totalEmpenho} un | PC: ${m.qtdPC > 0 ? `${m.qtdPC} un` : "nenhum"}${m.compradora ? ` | 👩‍💼 ${m.compradora}` : ""}`
    )
    .join("\n");
  return {
    resposta: `🔴 *Materiais sem estoque com empenho ativo:*\n\n${lista}`,
    found: true,
    tipo: "sem_estoque",
  };
}

function listarNecessidadeCompra(): QueryResult {
  const materiais = getMaterialsAbaixoPontoPedido().slice(0, 8);
  if (materiais.length === 0)
    return {
      resposta: "✅ Nenhum material abaixo do ponto de pedido no momento.",
      found: true,
      tipo: "necessidade_compra",
    };

  const lista = materiais
    .map(
      (m, i) =>
        `${i + 1}. *${m.codigo}* — ${m.descricao.slice(0, 28)}\n   Estoque: ${m.saldoAtual} | Ponto: ${m.pontoPedido} | Diff: ${m.diferencaEstoque}${m.compradora ? ` | 👩‍💼 ${m.compradora}` : ""}`
    )
    .join("\n");
  return {
    resposta: `🎯 *Materiais abaixo do ponto de pedido (${materiais.length}):*\n\n${lista}\n\n_Estes materiais precisam de compra._`,
    found: true,
    tipo: "necessidade_compra",
  };
}

function listarPorCliente(termo: string): QueryResult {
  const resultados = buscarPorCliente(termo);
  if (resultados.length === 0)
    return {
      resposta: `❌ Nenhum material encontrado para o cliente *"${termo}"*.`,
      found: false,
      tipo: "cliente",
    };

  const lista = resultados
    .map(
      (m, i) =>
        `${i + 1}. *${m.codigo}* — ${m.descricao.slice(0, 28)}\n   Clientes: ${m.clientes.join(", ")}`
    )
    .join("\n");
  return {
    resposta: `👤 *Materiais do cliente "${termo}" (${resultados.length}):*\n\n${lista}`,
    found: true,
    tipo: "cliente",
  };
}

function listarPorCompradora(termo: string): QueryResult {
  const resultados = buscarPorCompradora(termo);
  if (resultados.length === 0)
    return {
      resposta: `❌ Nenhum material encontrado para a compradora *"${termo}"*.`,
      found: false,
      tipo: "compradora",
    };

  const lista = resultados
    .map(
      (m, i) =>
        `${i + 1}. *${m.codigo}* — ${m.descricao.slice(0, 30)}\n   Estoque: ${m.saldoAtual} | PC: ${m.qtdPC > 0 ? `${m.qtdPC} un` : "—"}`
    )
    .join("\n");
  return {
    resposta: `👩‍💼 *Materiais sob responsabilidade de "${resultados[0].compradora ?? termo}" (${resultados.length}):*\n\n${lista}`,
    found: true,
    tipo: "compradora",
  };
}

// ── Interpretação principal ────────────────────────────────────────────────

export async function interpretarTextoLivre(texto: string): Promise<QueryResult> {
  const stats = getSpreadsheetStats();
  if (!stats.loaded) {
    return {
      resposta: "⚠️ Nenhuma planilha carregada. Contate o administrador.",
      found: false,
      tipo: "erro",
    };
  }

  const intencao = detectarIntencao(texto);
  const t = texto.trim();

  switch (intencao) {
    case "urgente":
      return { ...buscarMaterialTexto(t.slice(1).trim()), tipo: "material" };

    case "op": {
      const codigoOP = t.replace(/^op[\s\-#]*/i, "").trim();
      const op = getOpResumo(codigoOP);
      if (!op)
        return {
          resposta: `❌ OP *${codigoOP}* não encontrada.\n\nFormato: OP 04978801`,
          found: false,
          tipo: "op",
        };
      return { resposta: formatarOP(op), found: true, tipo: "op" };
    }

    case "pc_aberto":
      return listarPCAberto();

    case "sem_estoque":
      return listarSemEstoque();

    case "faltas":
      return listarFaltas();

    case "necessidade_compra":
      return listarNecessidadeCompra();

    case "cliente": {
      // Remove a palavra-chave e busca o restante como nome do cliente
      const termo = t
        .replace(/\b(cliente|pedido de venda|para quem|quem pediu)\b/gi, "")
        .trim();
      if (termo.length < 2) return listarFaltas(); // fallback
      return listarPorCliente(termo);
    }

    case "compradora": {
      const termo = t
        .replace(/\b(compradora|comprador|responsavel|quem compra)\b/gi, "")
        .trim();
      if (termo.length < 2) {
        // Lista todas as compradoras únicas
        return {
          resposta: "Informe o nome da compradora. Exemplo: *compradora Ana*",
          found: false,
          tipo: "compradora",
        };
      }
      return listarPorCompradora(termo);
    }

    case "descricao": {
      const r = buscarPorDesc(t);
      if (r.found) return { ...r, tipo: "descricao" };
      // Se não achou por descrição, tenta como código
      return { ...buscarMaterialTexto(t), tipo: "material" };
    }

    case "material":
    default: {
      const porCodigo = buscarMaterialTexto(t);
      if (porCodigo.found) return { ...porCodigo, tipo: "material" };
      // Não achou por código → tenta descrição
      const porDesc = buscarPorDesc(t);
      if (porDesc.found) return { ...porDesc, tipo: "descricao" };
      return {
        resposta: `❌ *"${t}"* não encontrado.\n\nTente:\n• Código do material\n• OP XXXXXXXX\n• Descrição do item\n• *falta*, *sem estoque*, *PC em aberto*`,
        found: false,
        tipo: "nao_encontrado",
      };
    }
  }
}

// ── Helpers de busca ───────────────────────────────────────────────────────

function buscarMaterialTexto(termo: string): Omit<QueryResult, "tipo"> {
  const m = getMaterialResumo(termo);
  if (!m) return { resposta: "", found: false };
  return { resposta: formatarMaterial(m), found: true };
}

function buscarPorDesc(termo: string): Omit<QueryResult, "tipo"> {
  const resultados = buscarPorDescricao(termo);
  if (resultados.length === 0) return { resposta: "", found: false };
  if (resultados.length === 1) return { resposta: formatarMaterial(resultados[0]), found: true };

  const lista = resultados
    .map(
      (m, i) =>
        `${i + 1}. *${m.codigo}* — ${m.descricao.slice(0, 40)}\n   Estoque: ${m.saldoAtual}${m.compradora ? ` | 👩‍💼 ${m.compradora}` : ""}`
    )
    .join("\n");
  return {
    resposta: `🔍 *${resultados.length} resultados para "${termo}":*\n\n${lista}\n\n_Envie o código para detalhes completos._`,
    found: true,
  };
}
