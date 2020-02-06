import { EnumRequestType, HandleRequest, Plugin, SpeechBuilder } from 'jovo-core';
import {
  Action,
  ActionType,
  CorePlatformApp,
  CorePlatformRequest,
  CorePlatformResponse,
  CorePlatformUser,
  RequestType,
  SpeechAction,
} from '..';
import { CorePlatform } from '../CorePlatform';
import _get = require('lodash.get');
import _set = require('lodash.set');

export class CorePlatformCore implements Plugin {
  install(platform: CorePlatform) {
    platform.middleware('$init')!.use(this.init.bind(this));
    platform.middleware('$request')!.use(this.request.bind(this));
    platform.middleware('$type')!.use(this.type.bind(this));
    platform.middleware('$session')!.use(this.session.bind(this));
    platform.middleware('$output')!.use(this.output.bind(this));
  }

  async init(handleRequest: HandleRequest) {
    const requestObject = handleRequest.host.getRequestObject() as CorePlatformRequest;

    if (
      requestObject.version &&
      requestObject.request &&
      requestObject.context &&
      requestObject.context.platform
    ) {
      handleRequest.jovo = new CorePlatformApp(
        handleRequest.app,
        handleRequest.host,
        handleRequest,
      );
    }
  }

  async request(corePlatformApp: CorePlatformApp) {
    if (!corePlatformApp.$host) {
      throw new Error(`Could't access host object.`);
    }

    corePlatformApp.$request = CorePlatformRequest.fromJSON(
      corePlatformApp.$host.getRequestObject(),
    ) as CorePlatformRequest;
    corePlatformApp.$user = new CorePlatformUser(corePlatformApp);
  }

  async type(corePlatformApp: CorePlatformApp) {
    const request = corePlatformApp.$request as CorePlatformRequest;
    const requestType = _get(request, 'request.type');

    let type: EnumRequestType = EnumRequestType.INTENT;

    if (requestType === RequestType.Launch) {
      type = EnumRequestType.LAUNCH;
    } else if (requestType === RequestType.End) {
      type = EnumRequestType.END;
    }

    corePlatformApp.$type = {
      type,
    };
  }

  async session(corePlatformApp: CorePlatformApp) {
    const request = corePlatformApp.$request as CorePlatformRequest;
    const sessionData = request.getSessionAttributes() || {};
    corePlatformApp.$requestSessionAttributes = sessionData;
    if (!corePlatformApp.$session) {
      corePlatformApp.$session = { $data: {} };
    }
    corePlatformApp.$session.$data = sessionData;
  }

  output(corePlatformApp: CorePlatformApp) {
    const output = corePlatformApp.$output;
    if (!corePlatformApp.$response) {
      corePlatformApp.$response = new CorePlatformResponse();
    }

    if (Object.keys(output).length === 0) {
      return;
    }

    const coreResponse = corePlatformApp.$response as CorePlatformResponse;
    const { tell, ask } = output;

    if (tell) {
      console.log('Handling tell');
      const tellAction: SpeechAction = {
        plain: SpeechBuilder.removeSSML(tell.speech.toString()),
        ssml: tell.speech.toString(),
        type: ActionType.Speech,
      };
      coreResponse.actions.push(tellAction);
    }

    if (ask) {
      const tellAction: SpeechAction = {
        plain: SpeechBuilder.removeSSML(ask.speech.toString()),
        ssml: ask.speech.toString(),
        type: ActionType.Speech,
      };
      const repromptAction: Action = {
        plain: SpeechBuilder.removeSSML(ask.reprompt.toString()),
        ssml: ask.reprompt.toString(),
        type: ActionType.Speech,
      };
      coreResponse.actions.push(tellAction);
      coreResponse.reprompts.push(repromptAction);
    }

    const actions = corePlatformApp.$actions.build();
    if (actions.length > 0) {
      coreResponse.actions.push(...actions);
    }

    const repromptActions = corePlatformApp.$repromptActions.build();
    if (repromptActions.length > 0) {
      coreResponse.reprompts.push(...repromptActions);
    }

    if (
      _get(corePlatformApp.$response, 'response.shouldEndSession') === false ||
      corePlatformApp.$app.config.keepSessionDataOnSessionEnded
    ) {
      if (corePlatformApp.$session && corePlatformApp.$session.$data) {
        _set(corePlatformApp.$response, 'session.data', corePlatformApp.$session.$data);
      }
    }
  }
}