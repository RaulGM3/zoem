import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import * as crypto from 'crypto';
import type {
  ElevenLabsWebhookPayload,
  OtlpAttribute,
  OtlpSpan,
} from './elevenlabs.types';
import type {
  LlamadaResumen,
  Turno,
  EstadoLlamada,
  DatosCapturados,
} from './llamada.types';

admin.initializeApp();

const elevenLabsSecret = defineSecret('ELEVENLABS_WEBHOOK_SECRET');

// ─── OTLP helpers ────────────────────────────────────────────────────────────

function getAllSpans(payload: ElevenLabsWebhookPayload): OtlpSpan[] {
  return (
    payload.data?.otlp_traces?.resourceSpans
      ?.flatMap((rs) => rs.scopeSpans)
      ?.flatMap((ss) => ss.spans) ?? []
  );
}

function getStr(attrs: OtlpAttribute[], key: string): string | undefined {
  return attrs.find((a) => a.key === key)?.value?.stringValue;
}

function getInt(attrs: OtlpAttribute[], key: string): number | undefined {
  const v = attrs.find((a) => a.key === key)?.value?.intValue;
  return v != null ? parseInt(v, 10) : undefined;
}

// ElevenLabs data_collection_results come as Python repr strings:
// "{'data_collection_id': 'nombre', 'value': 'Víctor de Frutos', ...}"
function extractDCValue(pythonRepr: string): string | undefined {
  return pythonRepr.match(/'value':\s*'([^']+)'/)?.[1];
}

// ─── Domain mappers ───────────────────────────────────────────────────────────

function mapStatus(status: string): EstadoLlamada {
  if (status === 'done') return 'completada';
  if (status === 'failed') return 'fallida';
  return 'interrumpida';
}

function parseTranscript(historyRaw: string): Turno[] {
  try {
    const history = JSON.parse(historyRaw) as {
      entries: Array<{ role: string; message: string }>;
    };
    return (history.entries ?? []).map((e) => ({
      rol: e.role === 'agent' ? 'agente' : 'usuario',
      mensaje: e.message,
    }));
  } catch {
    return [];
  }
}

// ─── Signature verification ───────────────────────────────────────────────────

function verifySignature(
  body: string,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader) return false;

  // ElevenLabs format: "t=<unix_timestamp>,v0=<hmac_sha256_hex>"
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => p.split('=') as [string, string])
  );
  const timestamp = parts['t'];
  const v0 = parts['v0'];
  if (!timestamp || !v0) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`, 'utf8')
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(v0, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch {
    return false;
  }
}

// ─── Cloud Function ───────────────────────────────────────────────────────────

export const elevenLabsWebhook = onRequest(
  { secrets: [elevenLabsSecret], invoker: 'public' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    // req.rawBody is the original bytes Firebase preserves before JSON parsing.
    // JSON.stringify(req.body) would differ in key order / unicode escaping.
    const rawBody = (req as unknown as { rawBody: Buffer }).rawBody?.toString('utf8') ?? JSON.stringify(req.body);
    const signature = req.headers['elevenlabs-signature'] as string | undefined;
    const secret = elevenLabsSecret.value();

    if (secret && !verifySignature(rawBody, signature, secret)) {
      res.status(403).json({ error: 'Invalid signature' });
      return;
    }

    const payload = req.body as ElevenLabsWebhookPayload;
    logger.info('ElevenLabs webhook received', { type: payload?.type });

    // Solo procesamos la transcripción — ignoramos post_call_audio y otros
    if (payload?.type !== 'post_call_transcription_otel') {
      res.status(200).json({ ok: true, skipped: true, type: payload?.type });
      return;
    }

    const { conversation_id, agent_id } = payload.data;
    if (!conversation_id) {
      res.status(400).json({ error: 'Missing conversation_id' });
      return;
    }

    const spans = getAllSpans(payload);
    const mainSpan = spans.find((s) => s.name === 'elevenlabs.conversation');
    const attrs = mainSpan?.attributes ?? [];

    const dc = (key: string) => {
      const raw = getStr(attrs, `elevenlabs.analysis.data_collection_results.${key}`);
      return raw ? extractDCValue(raw) : undefined;
    };

    const datosCapturados: DatosCapturados = {
      nombreCliente: dc('nombre_cliente'),
      telefono: dc('telefono'),
      especialidadJuridica: dc('especialidad_juridica'),
      nivelUrgencia: dc('nivel_urgencia'),
      descripcionCaso: dc('descripcion_caso'),
    };

    const historyRaw = getStr(
      attrs,
      'elevenlabs.dynamic_variable.system__conversation_history'
    );

    const llamada: LlamadaResumen = {
      conversationId: conversation_id,
      agentId: agent_id,
      estado: mapStatus(getStr(attrs, 'elevenlabs.status') ?? ''),
      duracionSegundos: Math.round((getInt(attrs, 'elevenlabs.session.duration_ms') ?? 0) / 1000),
      resumen: getStr(attrs, 'elevenlabs.analysis.transcript_summary') ?? '',
      tituloResumen: getStr(attrs, 'elevenlabs.analysis.call_summary_title'),
      transcripcion: historyRaw ? parseTranscript(historyRaw) : [],
      exitosa: getStr(attrs, 'elevenlabs.analysis.call_successful') === 'success',
      datosCapturados,
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    };

    await admin
      .firestore()
      .collection('llamadas')
      .doc(conversation_id)
      .set(llamada);

    logger.info('Llamada guardada', {
      conversationId: conversation_id,
      cliente: datosCapturados.nombreCliente,
      especialidad: datosCapturados.especialidadJuridica,
    });

    res.status(200).json({ ok: true, conversationId: conversation_id });
  }
);

// ─── AEAT Verifactu ─────────────────────────────────────────────────────────
export { storeAeatCredential } from './aeat/storeCredential';
export { verifactuSubmit } from './aeat/verifactuSubmit';

// ─── Generación de documentos ────────────────────────────────────────────────
export { generateDocx } from './htmlToDocx';
