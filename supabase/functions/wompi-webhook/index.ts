// Supabase Edge Function: wompi-webhook
// Recibe eventos de Wompi Sandbox / Producción (transaction.updated),
// verifica el checksum SHA-256 y actualiza el estado del pedido en PostgreSQL.

interface WompiWebhookPayload {
  event: string;
  data?: {
    transaction?: {
      id: string;
      reference: string;
      amount_in_cents: number;
      currency: string;
      status: 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'PENDING';
    };
  };
  signature?: {
    properties: string[];
    checksum: string;
  };
  timestamp?: number;
}

interface DenoGlobal {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const denoRuntime = (globalThis as unknown as { Deno?: DenoGlobal }).Deno;

if (denoRuntime) {
  denoRuntime.serve(async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const payload = (await req.json()) as WompiWebhookPayload;
      const transaction = payload.data?.transaction;

      if (!transaction || !transaction.reference) {
        return new Response(JSON.stringify({ error: 'Payload sin referencia de transacción' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Verificación opcional de firma de eventos de Wompi si WOMPI_EVENTS_SECRET está configurado
      const eventsSecret = denoRuntime.env.get('WOMPI_EVENTS_SECRET');
      if (eventsSecret && payload.signature?.checksum && payload.timestamp) {
        const rawConcat = `${transaction.id}${transaction.status}${transaction.amount_in_cents}${payload.timestamp}${eventsSecret}`;
        const computedChecksum = await sha256Hex(rawConcat);
        if (computedChecksum.toLowerCase() !== payload.signature.checksum.toLowerCase()) {
          return new Response(JSON.stringify({ error: 'Firma de webhook inválida' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      let nuevoEstado: 'pendiente' | 'pagado' | 'cancelado' = 'pendiente';
      if (transaction.status === 'APPROVED') {
        nuevoEstado = 'pagado';
      } else if (
        transaction.status === 'DECLINED' ||
        transaction.status === 'VOIDED' ||
        transaction.status === 'ERROR'
      ) {
        nuevoEstado = 'cancelado';
      }

      const supabaseUrl = denoRuntime.env.get('SUPABASE_URL') ?? '';
      const serviceRoleKey = denoRuntime.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

      if (supabaseUrl && serviceRoleKey) {
        await fetch(`${supabaseUrl}/rest/v1/rpc/cambiar_estado_pedido`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            p_pedido_id: transaction.reference,
            p_nuevo_estado: nuevoEstado,
            p_referencia_pago: transaction.id,
          }),
        });
      }

      return new Response(
        JSON.stringify({
          ok: true,
          reference: transaction.reference,
          status: nuevoEstado,
          wompi_id: transaction.id,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : 'Error interno en webhook' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  });
}

