import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { Lead } from "@/types/crm";
import { formatCurrencyExact, formatDateBr } from "@/lib/utils";

function toWinAnsiSafe(text: string): string {
  return text
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replaceAll("•", "-")
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

  const darkBg = rgb(0.06, 0.06, 0.08);
  const accent = rgb(0.84, 0.58, 0.14);
  const ink = rgb(0.11, 0.11, 0.14);
  const muted = rgb(0.4, 0.4, 0.46);
  const border = rgb(0.86, 0.86, 0.89);
  const softBox = rgb(0.96, 0.96, 0.97);

  const isPortrait = lead.funnel === "retratos_lifestyle";
  const docType: "corporativo" | "retratos" = isPortrait
    ? "retratos"
    : "corporativo";

  const margin = 44;
  const contentWidth = width - margin * 2;

  // Top dark editorial header band
  page.drawRectangle({
    x: 0,
    y: height - 96,
    width,
    height: 96,
    color: darkBg,
  });

  page.drawRectangle({
    x: 0,
    y: height - 99,
    width,
    height: 3,
    color: accent,
  });

  page.drawText("HENRIQUE MATOS STUDIO", {
    x: margin,
    y: height - 42,
    size: 16,
    font: fontBold,
    color: rgb(0.98, 0.98, 0.99),
  });

  page.drawText(
    toWinAnsiSafe("Fotografia & Audiovisual Profissional | Belo Horizonte - MG"),
    {
      x: margin,
      y: height - 60,
      size: 9,
      font: fontRegular,
      color: rgb(0.75, 0.75, 0.8),
    }
  );

  const badgeTitle = isPortrait
    ? "TERMO DE CESSAO DE USO DE IMAGEM"
    : "CONTRATO DE PRESTACAO DE SERVICOS";

  page.drawText(badgeTitle, {
    x: margin,
    y: height - 80,
    size: 9.5,
    font: fontBold,
    color: accent,
  });

  let y = height - 128;

  // Document Main Title
  const mainTitle = isPortrait
    ? "TERMO DE CESSAO DE USO DE IMAGEM E CONDICOES DO ENSAIO"
    : "CONTRATO DE PRESTACAO DE SERVICOS FOTOGRAFICOS E AUDIOVISUAIS";

  page.drawText(toWinAnsiSafe(mainTitle), {
    x: margin,
    y,
    size: 12,
    font: fontBold,
    color: ink,
  });
  y -= 18;

  const refDate = new Intl.DateTimeFormat("pt-BR").format(new Date());
  page.drawText(
    toWinAnsiSafe(
      `Documento #${lead.id.toUpperCase()}  |  Emitido em ${refDate}  |  Belo Horizonte, MG`
    ),
    {
      x: margin,
      y,
      size: 8.5,
      font: fontRegular,
      color: muted,
    }
  );
  y -= 20;

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

  const totalValue = lead.estimatedValue || 0;
  const depositValue = totalValue * 0.5;
  const eventDateFormatted = lead.eventDate
    ? formatDateBr(lead.eventDate)
    : "A definir em comum acordo";
  const packageName = lead.proposalPackage || "Corporate Prime";
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
      size: 9.5,
      font: fontBold,
      color: ink,
    });
  };

  if (isPortrait) {
    drawField("CONTRATANTE / MODELO", lead.contactName || lead.companyName, 0);
    drawField("CPF", lead.cpf || "Nao informado", 275);
    boxY -= 32;
    drawField("DATA DO ENSAIO", eventDateFormatted, 0);
    drawField("PACOTE ESCOLHIDO", packageName, 275);
    boxY -= 32;
    drawField("VALOR TOTAL", formatCurrencyExact(totalValue), 0);
    drawField("SINAL DE RESERVA (50%)", formatCurrencyExact(depositValue), 275);
  } else {
    drawField("RAZAO SOCIAL", lead.razaoSocial || lead.companyName, 0);
    drawField("CNPJ", lead.cnpj || "Nao informado", 295);
    boxY -= 32;
    drawField("RESPONSAVEL / DECISOR", lead.contactName, 0);
    drawField("DATA DO EVENTO", eventDateFormatted, 295);
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

  // Clauses
  const clauses = isPortrait
    ? [
        {
          title: "1. OBJETO E CONDICOES DO ENSAIO",
          body: `O presente Termo regula a realizacao de ensaio fotografico e/ou audiovisual de Retratos & Lifestyle pela contratada Henrique Matos Studio (Belo Horizonte - MG) para ${lead.contactName || lead.companyName}, conforme pacote "${packageName}" na data de ${eventDateFormatted}.`,
        },
        {
          title: "2. INVESTIMENTO, RESERVA E PAGAMENTO",
          body: `O valor total ajustado e de ${formatCurrencyExact(totalValue)}, dividido em 50% de sinal (${formatCurrencyExact(depositValue)}) via Pix no ato do aceite para bloqueio exclusivo da agenda, e 50% restantes (${formatCurrencyExact(depositValue)}) quitados na entrega da galeria digital tratada.`,
        },
        {
          title: "3. CESSAO E LICENCA DE USO DE IMAGEM",
          body: `O(A) CONTRATANTE autoriza a captacao de sua imagem e voz durante o ensaio, recebendo licenca plena de uso pessoal, profissional e comercial das fotografias e videos entregues em redes sociais, sites, imprensa e materiais de posicionamento. Autoriza tambem a exibicao selecionada no portfolio do estudio Henrique Matos, salvo solicitacao expressa de sigilo por escrito.`,
        },
        {
          title: "4. SEGURANCA DE ARQUIVOS E PRAZOS DE ENTREGA",
          body: `A captacao e realizada com equipamento profissional full-frame com gravacao simultanea em backup duplo. A selecao previa e disponibilizada em ate 48 horas e a galeria final tratada em alta resolucao e entregue em ate 5 dias uteis apos a selecao.`,
        },
        {
          title: "5. REAGENDAMENTO E FORO",
          body: `Solicitacoes de reagendamento devem ser comunicadas com antecedencia minima de 48 horas, sujeitas a disponibilidade de agenda. Fica eleito o foro da Comarca de Belo Horizonte/MG para dirimir quaisquer duvidas oriundas deste Termo.`,
        },
      ]
    : [
        {
          title: "1. OBJETO DA PRESTACAO DE SERVICOS",
          body: `A CONTRATADA (Henrique Matos Fotografia & Audiovisual, Belo Horizonte - MG) compromete-se a realizar a cobertura fotografica e audiovisual contratada por ${lead.razaoSocial || lead.companyName} (CNPJ: ${lead.cnpj || "a informar"}), sob o pacote "${packageName}"${lead.proposalAddons && lead.proposalAddons.length > 0 ? ` com adicionais: ${lead.proposalAddons.join(", ")}` : ""}, previsto para a data ${eventDateFormatted}.`,
        },
        {
          title: "2. VALORES, SINAL DE 50% E EMISSAO DE NFS-e",
          body: `O investimento total e de ${formatCurrencyExact(totalValue)}. A reserva definitiva da data e confirmada mediante pagamento do sinal de 50% (${formatCurrencyExact(depositValue)}) via Pix ou transferencia. Os 50% finais (${formatCurrencyExact(depositValue)}) serao quitados apos a realizacao do evento com emissao regular de Nota Fiscal de Servicos Eletronica (NFS-e).`,
        },
        {
          title: "3. PRAZOS DE ENTREGA (PREVIA 24H E GALERIA EM 3 DIAS UTEIS)",
          body: `A CONTRATADA entregara uma previa expressa com 15 fotografias selecionadas e tratadas em ate 24 horas apos o encerramento do evento, destinadas a uso imediato em LinkedIn, imprensa e endomarketing. A galeria digital completa em alta resolucao (e video aftermovie vertical, quando incluso) sera entregue em ate 3 dias uteis.`,
        },
        {
          title: "4. EQUIPAMENTO FULL-FRAME E BACKUP DUPLO",
          body: `Todos os registros sao captados com cameras profissionais full-frame dotadas de gravacao simultanea em dois cartoes de memoria independentes (backup duplo em tempo real), alem de redundancia em nuvem imediatamente apos o termino da cobertura, assegurando maxima integridade do material.`,
        },
        {
          title: "5. DIREITOS DE USO, CANCELAMENTO E FORO",
          body: `A CONTRATANTE detem plena licenca corporativa de uso das imagens para comunicacao interna, Employer Branding, midias sociais e imprensa. Alteracoes de data devem ser comunicadas com 7 dias de antecedencia, sujeitas a agenda. Fica eleito o foro da Comarca de Belo Horizonte - MG.`,
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
  const sigY = 104;
  page.drawLine({
    start: { x: margin, y: sigY + 26 },
    end: { x: width - margin, y: sigY + 26 },
    thickness: 0.75,
    color: border,
  });

  // Left signature line
  page.drawLine({
    start: { x: margin, y: sigY - 8 },
    end: { x: margin + 225, y: sigY - 8 },
    thickness: 0.8,
    color: ink,
  });
  page.drawText("Henrique Matos Studio (CONTRATADA)", {
    x: margin,
    y: sigY - 21,
    size: 8,
    font: fontBold,
    color: ink,
  });
  page.drawText("Belo Horizonte - MG | Fotografia & Audiovisual", {
    x: margin,
    y: sigY - 32,
    size: 7.5,
    font: fontRegular,
    color: muted,
  });

  // Right signature line
  const rightX = width - margin - 225;
  page.drawLine({
    start: { x: rightX, y: sigY - 8 },
    end: { x: width - margin, y: sigY - 8 },
    thickness: 0.8,
    color: ink,
  });
  page.drawText(
    toWinAnsiSafe(
      isPortrait
        ? `${lead.contactName || lead.companyName} (CONTRATANTE)`
        : `${lead.razaoSocial || lead.companyName} (CONTRATANTE)`
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
      `Aceite digital registrado em ${refDate} via Proposta Web CRMaster`
    ),
    {
      x: rightX,
      y: sigY - 32,
      size: 7.5,
      font: fontRegular,
      color: muted,
    }
  );

  // Bottom bar
  page.drawText(
    "Documento gerado automaticamente pelo CRMaster - Henrique Matos Studio (Belo Horizonte, MG)",
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
    ? `Termo-Uso-Imagem-${slug}.pdf`
    : `Contrato-Servicos-${slug}.pdf`;

  return { bytes, fileName, docType };
}
