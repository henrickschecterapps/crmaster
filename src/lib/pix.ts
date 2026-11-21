import QRCode from "qrcode";

function sanitizeEmvText(text: string, maxLen: number): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, maxLen);
}

function sanitizeTxId(txId: string): string {
  const cleaned = txId
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 25);
  return cleaned || "HMSTUDIO01";
}

function tlv(id: string, value: string): string {
  const length = String(value.length).padStart(2, "0");
  return `${id}${length}${value}`;
}

/**
 * Computes standard EMV / Banco Central Pix CRC16-CCITT (polynomial 0x1021, initial 0xFFFF).
 */
export function computeCrc16Ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface PixPayloadParams {
  pixKey: string;
  recipientName?: string;
  city?: string;
  amount: number;
  txId?: string;
  description?: string;
}

/**
 * Generates a valid Banco Central Static Pix BR Code (EMV QRCPS-MPM).
 */
export function generateStaticPixPayload(params: PixPayloadParams): string {
  const key = params.pixKey.trim();
  const merchantName = sanitizeEmvText(
    params.recipientName || "Ultimo Quadro",
    25
  );
  const merchantCity = sanitizeEmvText(params.city || "BELO HORIZONTE", 15);
  const txId = sanitizeTxId(params.txId || "UQSTUDIO");

  const gui = tlv("00", "br.gov.bcb.pix");
  const keyField = tlv("01", key);
  const descField = params.description
    ? tlv("02", sanitizeEmvText(params.description, 40))
    : "";

  const merchantAccountInfo = tlv("26", `${gui}${keyField}${descField}`);
  const additionalData = tlv("62", tlv("05", txId));

  const amountStr =
    params.amount > 0 ? tlv("54", params.amount.toFixed(2)) : "";

  const basePayload = [
    tlv("00", "01"), // Payload Format Indicator
    merchantAccountInfo,
    tlv("52", "0000"), // Merchant Category Code
    tlv("53", "986"), // Currency BRL (986)
    amountStr,
    tlv("58", "BR"), // Country Code
    tlv("59", merchantName),
    tlv("60", merchantCity),
    additionalData,
    "6304", // CRC16 header
  ].join("");

  const crc = computeCrc16Ccitt(basePayload);
  return `${basePayload}${crc}`;
}

export async function generatePixQrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 280,
    color: {
      dark: "#09090B",
      light: "#FFFFFF",
    },
  });
}
