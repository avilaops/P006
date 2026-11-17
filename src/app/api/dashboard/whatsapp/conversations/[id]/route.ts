import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/staff";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireStaff({ pode: "crm" });
  if (error) return error;
  const { id } = await params;
  const conversation = await prisma.whatsAppConversation.findUnique({
    where: { id },
    select: {
      id: true, phone: true, contactName: true, status: true,
      messages: { orderBy: { sentAt: "desc" }, take: 300, select: { id: true, direction: true, type: true, body: true, status: true, mediaKey: true, mediaMimeType: true, mediaFileName: true, mediaSize: true, sentAt: true } },
    },
  });
  if (!conversation) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  await prisma.whatsAppConversation.update({ where: { id }, data: { unreadCount: 0 } });
  return NextResponse.json({ ...conversation, messages: [...conversation.messages].reverse() });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireStaff({ pode: "crm" });
  if (error) return error;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { status?: unknown } | null;
  if (!body || !["OPEN", "WAITING", "ARCHIVED"].includes(String(body.status))) return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
  const result = await prisma.whatsAppConversation.updateMany({ where: { id }, data: { status: body.status as string } });
  if (!result.count) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
