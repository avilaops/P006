import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/staff";
import { getWhatsAppMedia } from "@/lib/whatsapp-storage";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireStaff({ pode: "crm" });
  if (error) return error;
  const { id } = await params;
  const message = await prisma.whatsAppMessage.findUnique({ where: { id }, select: { mediaKey: true, mediaMimeType: true, mediaFileName: true } });
  if (!message?.mediaKey) return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  try {
    const media = await getWhatsAppMedia(message.mediaKey);
    const bytes = await media.body.transformToByteArray();
    const body = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(body).set(bytes);
    return new NextResponse(body, { headers: { "Content-Type": message.mediaMimeType ?? media.contentType, "Content-Length": String(bytes.byteLength), "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(message.mediaFileName ?? "anexo")}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar o anexo." }, { status: 503 });
  }
}
