export interface RasaResponse {
  [key: string]: unknown;
  text: string;
  intent: RasaIntent;
  entities: RasaEntity[];
  intent_ranking: RasaIntent[];
}

export interface RasaIntent {
  id: number;
  name: string;
  confidence: number;
}

export interface RasaEntity {
  entity: string;
  start: number;
  end: number;
  confidence_entity: number;
  value: string;
  extractor: string;
  role?: string;
  confidence_role?: number;
  group?: string;
  confidence_group?: number;
  processors?: string[];
}
