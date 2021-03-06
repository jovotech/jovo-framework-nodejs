import {
  Action,
  ActionType,
  Client,
  ClientEvent,
  delay,
  ParallelAction,
  SequentialAction,
  SpeechAction,
} from '..';

export class ActionHandler {
  constructor(readonly $client: Client) {}

  async handleActions(actions: Action[]): Promise<void> {
    for (let i = 0, len = actions.length; i < len; i++) {
      await this.handleAction(actions[i]);
    }
  }

  async handleAction(action: Action): Promise<void> {
    if (action.delay) {
      await delay(action.delay);
    }

    this.$client.emit(ClientEvent.Action, action);

    switch (action.type) {
      case ActionType.SequenceContainer:
        return this.handleActions((action as SequentialAction).actions);
      case ActionType.ParallelContainer:
        const promises = [];
        for (let i = 0, len = (action as ParallelAction).actions.length; i < len; i++) {
          promises.push(this.handleAction((action as ParallelAction).actions[i]));
        }
        await Promise.all(promises);
        break;
      case ActionType.Speech:
        const { ssml, plain, displayText } = action as SpeechAction;
        return this.$client.$ssmlHandler.handleSSML(ssml || plain || displayText || '');
      case ActionType.QuickReply:
      case ActionType.Custom:
        break;
      default:
        // tslint:disable-next-line
        console.info(`ActionType ${action.type} is not supported currently.`);
    }
  }
}
