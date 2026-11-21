import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { BRAND_DEFAULTS, getServiceVertical, Lead } from "@/types/crm";
import { formatCurrencyExact, formatDateBr } from "@/lib/utils";

function toWinAnsiSafe(text: string): string {
  return text
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replaceAll("•", "-")
    .replaceAll("°", "o")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("’", "'")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

function drawWrappedText(params: {
  page: PDFPage;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  font: PDFFont;
  size: number;
  lineHeight: number;
  color: ReturnType<typeof rgb>;
}): number {
  const safe = toWinAnsiSafe(params.text);
  const words = safe.split(/\s+/);
  let line = "";
  let currentY = params.y;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const width = params.font.widthOfTextAtSize(testLine, params.size);
    if (width > params.maxWidth && line) {
      params.page.drawText(line, {
        x: params.x,
        y: currentY,
        size: params.size,
        font: params.font,
        color: params.color,
      });
      line = word;
      currentY -= params.lineHeight;
    } else {
      line = testLine;
    }
  }

  if (line) {
    params.page.drawText(line, {
      x: params.x,
      y: currentY,
      size: params.size,
      font: params.font,
      color: params.color,
    });
    currentY -= params.lineHeight;
  }

  return currentY;
}

export async function generateLeadContractPdf(lead: Lead): Promise<{
  bytes: Uint8Array;
  fileName: string;
  docType: "corporativo" | "retratos";
}> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 Portrait
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Official ÚLTIMO QUADRO palette (#0C0C0C obsidian + #CC551E burnt orange + #4A4A4A film gray)
  const darkBg = rgb(0.047, 0.047, 0.047);
  const accent = rgb(0.8, 0.333, 0.118); // #CC551E
  const filmGray = rgb(0.29, 0.29, 0.29); // #4A4A4A
  const ink = rgb(0.08, 0.08, 0.09);
  const muted = rgb(0.42, 0.42, 0.46);
  const border = rgb(0.86, 0.86, 0.88);
  const softBox = rgb(0.96, 0.96, 0.96);

  const vertical = getServiceVertical(lead.funnel);
  const isPortrait = Boolean(lead.cpf) && !lead.cnpj;
  const docType: "corporativo" | "retratos" = isPortrait
    ? "retratos"
    : "corporativo";

  const margin = 44;
  const contentWidth = width - margin * 2;

  // Top cinema header band (#0C0C0C)
  page.drawRectangle({
    x: 0,
    y: height - 102,
    width,
    height: 102,
    color: darkBg,
  });

  // Burnt orange 97% timeline accent bar (#CC551E)
  page.drawRectangle({
    x: 0,
    y: height - 105,
    width,
    height: 3,
    color: accent,
  });

  // Mini 3-frame mark on top right
  const markX = width - margin - 86;
  const markY = height - 56;
  page.drawRectangle({ x: markX, y: markY, width: 24, height: 14, borderColor: filmGray, borderWidth: 1.5 });
  page.drawRectangle({ x: markX + 30, y: markY, width: 24, height: 14, borderColor: filmGray, borderWidth: 1.5 });
  page.drawRectangle({ x: markX + 60, y: markY, width: 24, height: 14, borderColor: accent, borderWidth: 1.5 });
  page.drawLine({
    start: { x: markX, y: markY - 8 },
    end: { x: markX + 82, y: markY - 8 },
    thickness: 1.5,
    color: filmGray,
  });
  page.drawCircle({ x: markX + 82, y: markY - 8, size: 2.5, color: accent });

  page.drawText("ULTIMO QUADRO", {
    x: margin,
    y: height - 40,
    size: 16,
    font: fontBold,
    color: rgb(0.96, 0.96, 0.96),
  });

  page.drawText(
    toWinAnsiSafe(
      `${BRAND_DEFAULTS.tagline} | ${BRAND_DEFAULTS.subtitle} - ${BRAND_DEFAULTS.location}`
    ),
    {
      x: margin,
      y: height - 58,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.72, 0.72, 0.72),
    }
  );

  page.drawText(
    toWinAnsiSafe(
      `${BRAND_DEFAULTS.whatsappDisplay}  |  ${BRAND_DEFAULTS.email}  |  VERTICAL ${vertical.index}: ${vertical.label.toUpperCase()}`
    ),
    {
      x: margin,
      y: height - 78,
      size: 8.5,
      font: fontBold,
      color: accent,
    }
  );

  let y = height - 132;

  const mainTitle = isPortrait
    ? "TERMO DE CESSAO DE USO DE IMAGEM E CONDICOES DE PRODUCAO"
    : `CONTRATO DE PRESTACAO DE SERVICOS - ${vertical.title.toUpperCase()}`;

  page.drawText(toWinAnsiSafe(mainTitle), {
    x: margin,
    y,
    size: 11.5,
    font: fontBold,
    color: ink,
  });
  y -= 17;

  const refDate = new Intl.DateTimeFormat("pt-BR").format(new Date());
  page.drawText(
    toWinAnsiSafe(
      `Documento #${lead.id.toUpperCase()}  |  Emitido em ${refDate}  |  Belo Horizonte & Nova Lima, MG`
    ),
    {
      x: margin,
      y,
      size: 8.5,
      font: fontRegular,
      color: muted,
    }
  );
  y -= 18;

  // Summary Info Box
  const boxHeight = isPortrait ? 96 : 112;
  page.drawRectangle({
    x: margin,
    y: y - boxHeight,
    width: contentWidth,
    height: boxHeight,
    color: softBox,
    borderColor: border,
    borderWidth: 1,
  });

  const totalValue = lead.estimatedValue || vertical.defaultValue;
  const depositValue = totalValue * 0.5;
  const eventDateFormatted = lead.eventDate
    ? formatDateBr(lead.eventDate)
    : "A definir em comum acordo";
  const packageName =
    lead.proposalPackage || vertical.packages[1]?.name || vertical.packages[0].name;
  const addonsList =
    lead.proposalAddons && lead.proposalAddons.length > 0
      ? lead.proposalAddons.join(", ")
      : "Nenhum adicional selecionado";

  let boxY = y - 18;
  const drawField = (label: string, value: string, xOffset = 0) => {
    page.drawText(toWinAnsiSafe(label), {
      x: margin + 12 + xOffset,
      y: boxY,
      size: 7.5,
      font: fontBold,
      color: muted,
    });
    page.drawText(toWinAnsiSafe(value), {
      x: margin + 12 + xOffset,
      y: boxY - 12,
      size: 9.2,
      font: fontBold,
      color: ink,
    });
  };

  if (isPortrait) {
    drawField("CONTRATANTE / RETRATADO(A)", lead.razaoSocial || lead.contactName, 0);
    drawField("CPF", lead.cpf || "Nao informado", 275);
    boxY -= 32;
    drawField("DATA DA PRODUCAO", eventDateFormatted, 0);
    drawField("PACOTE ESCOLHIDO", `${vertical.label} - ${packageName}`.slice(0, 40), 275);
    boxY -= 32;
    drawField("VALOR TOTAL", formatCurrencyExact(totalValue), 0);
    drawField("SINAL DE RESERVA (50%)", formatCurrencyExact(depositValue), 275);
  } else {
    drawField("RAZAO SOCIAL / MARCA", lead.razaoSocial || lead.companyName, 0);
    drawField("CNPJ", lead.cnpj || "Nao informado", 295);
    boxY -= 32;
    drawField("RESPONSAVEL / DECISOR", lead.contactName, 0);
    drawField("DATA DA PRODUCAO", eventDateFormatted, 295);
    boxY -= 32;
    drawField(
      "PACOTE E ADICIONAIS",
      `${packageName} (${addonsList})`.slice(0, 52),
      0
    );
    drawField(
      "INVESTIMENTO / SINAL (50%)",
      `${formatCurrencyExact(totalValue)} | Sinal: ${formatCurrencyExact(depositValue)}`,
      295
    );
  }

  y -= boxHeight + 22;

  const clauses = isPortrait
    ? [
        {
          title: "1. OBJETO E CONDICOES DA PRODUCAO",
          body: `O presente Termo regula a realizacao de producao fotografica e/ou audiovisual 4K pela ULTIMO QUADRO (${BRAND_DEFAULTS.location}) para ${lead.razaoSocial || lead.contactName}, vertical "${vertical.title}", pacote "${packageName}", agendada para ${eventDateFormatted}.`,
        },
        {
          title: "2. INVESTIMENTO, RESERVA (50%) E QUITACAO",
          body: `O investimento total e de ${formatCurrencyExact(totalValue)}, estruturado em 50% de sinal (${formatCurrencyExact(depositValue)}) via Pix no aceite para bloqueio exclusivo da data, e 50% finais (${formatCurrencyExact(depositValue)}) quitados na entrega da galeria final.`,
        },
        {
          title: "3. CESSAO E LICENCA DE USO DE IMAGEM",
          body: `O(A) CONTRATANTE autoriza a captacao de sua imagem e voz, recebendo licenca plena de uso pessoal, profissional e comercial (Instagram, LinkedIn, site, Meta Ads e imprensa). Autoriza exibicao selecionada no portfolio da Ultimo Quadro, salvo solicitacao expressa de sigilo por escrito.`,
        },
        {
          title: "4. PADRAO TECNICO, BACKUP DUPLO E PRAZOS",
          body: `Producao realizada com equipamento profissional Full-Frame 4K com gravacao simultanea em backup duplo e iluminacao dedicada. Prazos da vertical: ${vertical.deliverySummary}.`,
        },
        {
          title: "5. REAGENDAMENTO E FORO",
          body: `Solicitacoes de reagendamento devem ser comunicadas com antecedencia minima de 48 horas, sujeitas a disponibilidade de agenda. Fica eleito o foro da Comarca de Belo Horizonte/MG.`,
        },
      ]
    : [
        {
          title: "1. OBJETO DA PRESTACAO DE SERVICOS",
          body: `A CONTRATADA (ULTIMO QUADRO - Fotografia Autoral & Producao Audiovisual, Belo Horizonte & Nova Lima - MG) compromete-se a executar a producao contratada por ${lead.razaoSocial || lead.companyName} (CNPJ: ${lead.cnpj || "a informar"}), vertical "${vertical.title}", pacote "${packageName}"${lead.proposalAddons && lead.proposalAddons.length > 0 ? ` + adicionais: ${lead.proposalAddons.join(", ")}` : ""}, prevista para ${eventDateFormatted}.`,
        },
        {
          title: "2. VALORES, SINAL DE 50% E EMISSAO DE NFS-e",
          body: `O investimento total e de ${formatCurrencyExact(totalValue)}. A reserva definitiva da agenda ocorre mediante sinal de 50% (${formatCurrencyExact(depositValue)}) via Pix. Os 50% restantes (${formatCurrencyExact(depositValue)}) sao quitados na entrega final, com atendimento PJ formalizado e emissao de Nota Fiscal de Servicos Eletronica (NFS-e).`,
        },
        {
          title: "3. ENTREGAVEIS E PRAZOS EXPRESSOS",
          body: `A ULTIMO QUADRO segue rigorosamente os prazos da vertical ${vertical.label}: ${vertical.deliverySummary}. Todos os arquivos sao entregues em galeria digital privada em alta resolucao e versoes otimizadas para redes sociais, imprensa ou trafego pago.`,
        },
        {
          title: "4. RIGOR DE SET, FULL-FRAME 4K E BACKUP SIMULTANEO",
          body: `Toda captacao e realizada com otica fixa luminosa (35/50/85mm), cameras Full-Frame 4K com gravacao simultanea em dois cartoes de memoria independentes (risco zero de perda de material) e redundancia em nuvem imediatamente apos a producao.`,
        },
        {
          title: "5. DIREITOS DE USO, CANCELAMENTO E FORO",
          body: `A CONTRATANTE recebe licenca comercial completa de uso do material em redes sociais, anuncios, endomarketing e imprensa. Reagendamentos devem ser comunicados com 7 dias de antecedencia, sujeitos a agenda. Foro eleito: Comarca de Belo Horizonte - MG.`,
        },
      ];

  for (const clause of clauses) {
    page.drawText(toWinAnsiSafe(clause.title), {
      x: margin,
      y,
      size: 9,
      font: fontBold,
      color: ink,
    });
    y -= 13;

    y = drawWrappedText({
      page,
      text: clause.body,
      x: margin,
      y,
      maxWidth: contentWidth,
      font: fontRegular,
      size: 8.6,
      lineHeight: 12.2,
      color: muted,
    });
    y -= 9;
  }

  // Signature & Electronic Acceptance Footer
  const sigY = 102;
  page.drawLine({
    start: { x: margin, y: sigY + 26 },
    end: { x: width - margin, y: sigY + 26 },
    thickness: 0.75,
    color: border,
  });

  page.drawLine({
    start: { x: margin, y: sigY - 8 },
    end: { x: margin + 225, y: sigY - 8 },
    thickness: 0.8,
    color: ink,
  });
  page.drawText("ULTIMO QUADRO (CONTRATADA)", {
    x: margin,
    y: sigY - 21,
    size: 8,
    font: fontBold,
    color: ink,
  });
  page.drawText(
    toWinAnsiSafe("Belo Horizonte & Nova Lima - MG | ultimoquadrofilmes@gmail.com"),
    {
      x: margin,
      y: sigY - 32,
      size: 7.3,
      font: fontRegular,
      color: muted,
    }
  );

  const rightX = width - margin - 225;
  page.drawLine({
    start: { x: rightX, y: sigY - 8 },
    end: { x: width - margin, y: sigY - 8 },
    thickness: 0.8,
    color: ink,
  });
  page.drawText(
    toWinAnsiSafe(
      `${lead.razaoSocial || lead.contactName || lead.companyName} (CONTRATANTE)`
    ).slice(0, 44),
    {
      x: rightX,
      y: sigY - 21,
      size: 8,
      font: fontBold,
      color: ink,
    }
  );
  page.drawText(
    toWinAnsiSafe(
      `Aceite digital registrado em ${refDate} via Proposta Web Ultimo Quadro`
    ),
    {
      x: rightX,
      y: sigY - 32,
      size: 7.3,
      font: fontRegular,
      color: muted,
    }
  );

  page.drawText(
    "ULTIMO QUADRO - A historia termina. A imagem fica. | https://ultimo-quadro.vercel.app",
    {
      x: margin,
      y: 28,
      size: 7.5,
      font: fontRegular,
      color: muted,
    }
  );

  const bytes = await pdfDoc.save();
  const slug = (lead.companyName || lead.id)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  const fileName = isPortrait
    ? `Termo-Uso-Imagem-Ultimo-Quadro-${slug}.pdf`
    : `Contrato-Ultimo-Quadro-${slug}.pdf`;

  return { bytes, fileName, docType };
}
