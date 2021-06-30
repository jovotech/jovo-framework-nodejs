import {
  axios,
  AxiosRequestConfig,
  AxiosResponse,
  DeepPartial,
  EntityMap,
  HandleRequest,
  Jovo,
  NluData,
  NluPlugin,
  PluginConfig,
} from '@jovotech/framework';
import { RasaEntity, RasaIntent, RasaResponse } from './interfaces';

export interface RasaNluConfig extends PluginConfig {
  serverUrl?: string;
  serverPath?: string;
  //activate alternative intent classifications in $nlu
  //and constrain the number of alternatives by number and/or an confidence cutoff
  alternativeIntents?: { maxAlternatives?: number; confidenceCutoff?: number };
}

interface RasaNluData extends NluData {
  intent: {
    name: string;
    confidence: number;
  };
  alternativeIntents?: RasaIntent[];
  entities: EntityMap;
}

export type RasaNluInitConfig = DeepPartial<RasaNluConfig>;

export class RasaNlu extends NluPlugin<RasaNluConfig> {
  // TODO fully determine default config
  getDefaultConfig(): RasaNluConfig {
    return {
      serverUrl: 'http://localhost:5005',
      serverPath: '/model/parse',
    };
  }

  constructor(config?: RasaNluConfig) {
    super(config);
  }

  async process(handleRequest: HandleRequest, jovo: Jovo): Promise<RasaNluData | undefined> {
    const text = jovo.$request.getRawText();
    if (!text) return;
    try {
      const rasaResponse = await this.sendTextToRasaServer(text || '');
      if (rasaResponse.data.intent.name) {
        const ents: EntityMap = {};
        rasaResponse.data.entities.map((entity: RasaEntity) => {
          let entityAlias = entity.entity;
          // roles can distinguish entities of the same type e.g. departure and destination in
          // a travel use case and should therefore be preferred as entity name
          if (entity.role) {
            entityAlias = entity.role;
          }
          ents[entityAlias] = {
            id: entityAlias,
            key: entityAlias,
            name: entity.entity,
            value: entity.value,
          };
        });

        const nluResult: RasaNluData = {
          intent: {
            name: rasaResponse.data.intent.name,
            confidence: rasaResponse.data.intent.confidence,
          },
          entities: ents,
        };

        if (this.config.alternativeIntents) {
          nluResult.alternativeIntents = this.mapAlternativeIntents(
            rasaResponse.data.intent_ranking,
          );
        }

        return nluResult;
      } else {
        return undefined;
      }
    } catch (e) {
      console.error('Error while retrieving nlu-data from Rasa-server.', e);
      return;
    }
  }

  private sendTextToRasaServer(
    text: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<RasaResponse>> {
    return axios.post(`${this.config.serverUrl}${this.config.serverPath}`, { text }, config);
  }

  private mapAlternativeIntents(altIntents: RasaIntent[]) {
    // remove first element, because its the classified intent
    altIntents.splice(0, 1);
    const cutoff = this.config.alternativeIntents?.confidenceCutoff ?? 1.0;

    return altIntents
      .filter((a) => a.confidence > cutoff)
      .slice(0, this.config.alternativeIntents?.maxAlternatives ?? 7);
  }
}
