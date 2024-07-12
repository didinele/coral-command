import type { API, APIInteraction, Snowflake } from '@discordjs/core';
import { AsyncEventEmitter } from '@vladfrangu/async_event_emitter';
import { HandlerStep, type InteractionHandler } from './Step.js';
import { ActionKind, Actions } from './actions/Actions.js';

export enum ExecutorEvents {
	CallbackError = 'callbackError',
	HandlerError = 'handlerError',
}

export interface ExecutorEventsMap {
	[ExecutorEvents.CallbackError]: [error: Error, interaction: APIInteraction];
	[ExecutorEvents.HandlerError]: [error: Error, actions: Actions];
}

export class Executor extends AsyncEventEmitter<ExecutorEventsMap> {
	readonly #api: API;

	readonly #applicationId: Snowflake;

	public constructor(api: API, applicationId: Snowflake) {
		super();

		this.#api = api;
		this.#applicationId = applicationId;
	}

	public async handleInteraction(generator: InteractionHandler<void>, interaction: APIInteraction): Promise<void> {
		const actions = new Actions(this.#api, this.#applicationId, interaction);

		let nextValue: Snowflake | null = null;

		while (true) {
			try {
				// `next` throws if the user's code within the generator threw. Errors are natural
				const { value: op, done } = nextValue ? await generator.next(nextValue) : await generator.next();
				nextValue = null;

				if (op) {
					// Type-wise this shouldn't happen, but let's be safe
					if (!(op instanceof HandlerStep)) {
						continue;
					}

					try {
						// This throwing means the user sent malformed data (assuming no internal bug). Without this extra logic
						// (esp. the Step class having a .cause error), the trace would not include the actual cause
						// of the error.
						nextValue = await this.handleOp(actions, op, interaction);
					} catch (error) {
						if (error instanceof Error) {
							error.cause = op.cause;
							await this.emitHandlerError(error, actions);
						} else {
							await this.emitHandlerError(this.toError(error), actions);
						}
					}
				}

				if (done) {
					break;
				}
			} catch (error) {
				await this.emitHandlerError(this.toError(error), actions);
			}
		}
	}

	private async handleOp(actions: Actions, op: HandlerStep, interaction: APIInteraction): Promise<Snowflake | null> {
		let nextValue: Snowflake | null = null;

		switch (op.data.action) {
			case ActionKind.Reply: {
				await actions.reply(op.data.options);
				break;
			}

			case ActionKind.EnsureDeferReply: {
				await actions.deferReply(op.data.options);
				break;
			}

			case ActionKind.UpdateMessage: {
				await actions.updateMessage(op.data.options);
				break;
			}

			case ActionKind.EnsureDeferUpdateMessage: {
				await actions.ensureDeferUpdateMessage();
				break;
			}

			case ActionKind.Delete: {
				await actions.delete();
				break;
			}

			case ActionKind.FollowUp: {
				const followUp = await actions.followUp(op.data.options);
				nextValue = followUp.messageId;
				break;
			}

			case ActionKind.UpdateFollowUp: {
				const followUp = actions.getExistingFollowUp(op.data.messageId);
				await followUp.update(op.data.options);
				break;
			}

			case ActionKind.DeleteFollowUp: {
				const followUp = actions.getExistingFollowUp(op.data.messageId);
				await followUp.delete();
				break;
			}

			case ActionKind.ExecuteWithoutErrorReport: {
				// Make sure we don't throw here
				try {
					await op.data.callback();
				} catch (error) {
					this.emitCallbackError(this.toError(error), interaction);
				}

				break;
			}
		}

		return nextValue;
	}

	private toError(value: unknown) {
		if (value instanceof Error) {
			return value;
		}

		if (typeof value === 'string') {
			return new Error(value);
		}

		return typeof value === 'object' && value !== null && 'toString' in value
			? // eslint-disable-next-line @typescript-eslint/no-base-to-string
				new Error(value.toString())
			: new Error('An unknown error occurred (that could not be stringified).');
	}

	private emitCallbackError(error: Error, interaction: APIInteraction) {
		if (this.listenerCount(ExecutorEvents.CallbackError) === 0) {
			throw error;
		}

		this.emit(ExecutorEvents.CallbackError, error, interaction);
	}

	private async emitHandlerError(error: Error, actions: Actions): Promise<void> {
		this.emit(ExecutorEvents.HandlerError, error, actions);

		if (this.listenerCount(ExecutorEvents.HandlerError) === 0) {
			console.error(`Executor: An error occurred while processing the command: ${error.message}`, error);

			const data = {
				content: 'An error occurred while processing the command.',
			};

			// Try both and hopefully something works
			try {
				await actions.reply(data);
				return;
			} catch {
				try {
					await actions.followUp(data);
					return;
				} catch {}
			}

			console.log('Executor: The error was NOT reported to the user.');
		}
	}
}
