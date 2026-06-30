// ── Serviço de notificações WhatsApp via Evolution API ────────────────────
// Variáveis de ambiente necessárias no .env.local:
//   EVOLUTION_API_URL=https://sua-evolution-api.com
//   EVOLUTION_API_KEY=sua-chave-aqui
//   EVOLUTION_INSTANCE=nome-da-instancia

function sanitizarTelefone(telefone: string): string {
  // Remove tudo que não for dígito
  const soDigitos = telefone.replace(/\D/g, "")
  // Se não começar com 55 (Brasil), adiciona
  if (!soDigitos.startsWith("55")) {
    return `55${soDigitos}`
  }
  return soDigitos
}

async function enviarMensagemWhatsApp(telefone: string, mensagem: string): Promise<void> {
  const url = process.env.EVOLUTION_API_URL
  const apiKey = process.env.EVOLUTION_API_KEY
  const instancia = process.env.EVOLUTION_INSTANCE

  if (!url || !apiKey || !instancia) {
    console.warn("[WhatsApp] Variáveis de ambiente não configuradas. Notificação ignorada.")
    return
  }

  const numereLimpo = sanitizarTelefone(telefone)

  const response = await fetch(`${url}/message/sendText/${instancia}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": apiKey,
    },
    body: JSON.stringify({
      number: numereLimpo,
      text: mensagem,
    }),
  })

  if (!response.ok) {
    const erro = await response.text()
    console.error(`[WhatsApp] Falha ao enviar para ${numereLimpo}:`, erro)
    // Não lança erro para não quebrar o fluxo principal
  }
}

export interface DadosNotificacaoConsulta {
  telefonePaciente?: string | null
  nomePaciente: string
  telefoneProfissional?: string | null
  nomeProfissional: string
  dataConsulta: string
  horarioConsulta: string
  procedimento?: string
}

export async function notificarConfirmacaoConsulta(dados: DadosNotificacaoConsulta): Promise<void> {
  const {
    telefonePaciente, nomePaciente,
    telefoneProfissional, nomeProfissional,
    dataConsulta, horarioConsulta, procedimento,
  } = dados

  // Formata a data para exibição
  const dataFormatada = (() => {
    try {
      return new Date(dataConsulta + "T12:00:00").toLocaleDateString("pt-BR", {
        day: "2-digit", month: "long", year: "numeric"
      })
    } catch {
      return dataConsulta
    }
  })()

  const horarioFormatado = horarioConsulta.substring(0, 5)

  const promessas: Promise<void>[] = []

  // Notifica o paciente
  if (telefonePaciente && telefonePaciente.trim() !== "") {
    const mensagemPaciente =
      `Olá, ${nomePaciente}! �\n\n` +
      `Sua consulta no *SyncOdonto* foi *confirmada*! ✅\n\n` +
      `� Data: ${dataFormatada}\n` +
      `⏰ Horário: ${horarioFormatado}\n` +
      (procedimento ? `� Procedimento: ${procedimento}\n` : "") +
      `\nEsperamos você! Qualquer dúvida, entre em contato.`

    promessas.push(enviarMensagemWhatsApp(telefonePaciente, mensagemPaciente))
  }

  // Notifica o profissional
  if (telefoneProfissional && telefoneProfissional.trim() !== "") {
    const mensagemProfissional =
      `Olá, Dr(a). ${nomeProfissional}! �\n\n` +
      `Uma consulta foi *confirmada* na sua agenda. �\n\n` +
      `� Paciente: ${nomePaciente}\n` +
      `� Data: ${dataFormatada}\n` +
      `⏰ Horário: ${horarioFormatado}\n` +
      (procedimento ? `� Procedimento: ${procedimento}\n` : "")

    promessas.push(enviarMensagemWhatsApp(telefoneProfissional, mensagemProfissional))
  }

  // Envia as duas notificações em paralelo
  await Promise.allSettled(promessas)
}
