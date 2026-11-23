"use client";

/**
 * Compresses and resizes a selected File in the browser using HTML5 Canvas
 * so uploads stay fast on 4G mobile networks and lightweight in storage.
 */
export async function compressImageToDataUrl(
  file: File,
  maxDimension: number = 1080,
  quality: number = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Erro ao ler arquivo de imagem."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Imagem inválida."));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas indisponível."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadStudioImage(params: {
  file: File;
  folder: "thumbnails" | "receipts";
  leadId?: string;
  pin?: string;
}): Promise<{ url: string; storage: string }> {
  const dataUrl = await compressImageToDataUrl(params.file, 960, 0.75);
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dataUrl,
      folder: params.folder,
      leadId: params.leadId,
      pin: params.pin,
      fileName: params.file.name,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.url) {
    throw new Error(json.error || "Falha ao enviar imagem.");
  }
  return { url: json.url, storage: json.storage };
}
