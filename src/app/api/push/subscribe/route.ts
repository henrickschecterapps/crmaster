import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/apiGuard";
import {
  getOrCreateVapidKeys,
  listPushSubscriptions,
  removePushSubscription,
  savePushSubscription,
  sendAdminPushNotification,
} from "@/lib/webPush";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authErr = await requireAdminApiAuth(req);
  if (authErr) return authErr;

  const [vapid, subs] = await Promise.all([
    getOrCreateVapidKeys(),
    listPushSubscriptions(),
  ]);

  return NextResponse.json({
    publicKey: vapid.publicKey,
    devicesCount: subs.length,
  });
}

export async function POST(req: NextRequest) {
  const authErr = await requireAdminApiAuth(req);
  if (authErr) return authErr;

  try {
    const body = (await req.json()) as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json(
        { error: "Subscrição Web Push inválida." },
        { status: 400 }
      );
    }

    await savePushSubscription({
      endpoint: body.endpoint,
      keys: {
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
      userAgent: req.headers.get("user-agent") || undefined,
    });

    const subs = await listPushSubscriptions();
    return NextResponse.json({
      subscribed: true,
      devicesCount: subs.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Falha ao registrar notificações Push." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const authErr = await requireAdminApiAuth(req);
  if (authErr) return authErr;

  const body = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (body.endpoint) {
    await removePushSubscription(body.endpoint);
  }
  const subs = await listPushSubscriptions();
  return NextResponse.json({
    subscribed: false,
    devicesCount: subs.length,
  });
}

export async function PUT(req: NextRequest) {
  const authErr = await requireAdminApiAuth(req);
  if (authErr) return authErr;

  const result = await sendAdminPushNotification({
    title: "ÚLTIMO QUADRO · Push Ativo",
    body: "Seu celular está conectado ao Radar em Tempo Real do CRM.",
    url: "/",
    tag: "uq-test-push",
  });

  return NextResponse.json(result);
}
