export interface OtlpAttrValue {
  stringValue?: string;
  intValue?: string;
  doubleValue?: number;
  boolValue?: boolean;
}

export interface OtlpAttribute {
  key: string;
  value: OtlpAttrValue;
}

export interface OtlpSpan {
  name: string;
  attributes: OtlpAttribute[];
}

export interface OtlpTraces {
  resourceSpans: Array<{
    scopeSpans: Array<{
      spans: OtlpSpan[];
    }>;
  }>;
}

export interface ElevenLabsOtlpData {
  conversation_id: string;
  agent_id: string;
  otlp_traces: OtlpTraces;
}

export interface ElevenLabsWebhookPayload {
  type: string;
  event_timestamp: number;
  data: ElevenLabsOtlpData;
}
