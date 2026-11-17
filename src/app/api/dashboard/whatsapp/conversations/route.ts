import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/staff";

export async function GET(request: Request) {
  const { error } = await requireStaff({ pode: "crm" });
  if (error) return error;
  const query = new URL(request.url).searchParams;
  const search = query.get("q")?.trim().slice(0, 100);
  const status = query.get("status");
  const conversations = await prisma.whatsAppConversation.findMany({
    where: {
      ...(status && ["OPEN", "WAITING", "ARCHIVED"].includes(status) ? { status } : {}),
      ...(search ? { OR: [{ contactName: { contains: search, mode: "insensitive" } }, { phone: { contains: search } }, { lastMessageText: { contains: search, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    take: 100,
    select: { id: true, phone: true, contactName: true, status: true, unreadCount: true, lastMessageAt: true, lastMessageText: true },
  });
  return NextResponse.json(conversations);
}
