import type { API, APIInteraction, Snowflake } from '@discordjs/core';
import { AsyncEventEmitter } from '@vladfrangu/async_event_emitter';
import { ActionKind, Actions, type FollowUpData, type RespondData } from './actions/Actions.js';
import type { UpdateFollowUpData } from './actions/FollowUpActions.js';

class FollowUpMessageContainer {
	readonly #id: Snowflake | null;

	public constructor(id: Snowflake | null) {
		this.#id = id;
	}

	public unwrap(): Snowflake {
		if (this.#id === null) {
			throw new Error('Tried to unwrap but we were not working with a follow-up action.');
		}

		return this.#id;
	}
}

export interface RespondStep {
	action: ActionKind.Respond;
	data: RespondData;
}

export interface EnsureDeferStep {
	action: ActionKind.EnsureDefer;
	data: RespondData;
}

export interface DeleteStep {
	action: ActionKind.Delete;
}

export interface FollowUpStep {
	action: ActionKind.FollowUp;
	data: FollowUpData;
}

export interface UpdateFollowUpStep {
	action: ActionKind.UpdateFollowUp;
	data: UpdateFollowUpData;
	messageId: Snowflake;
}

export interface DeleteFollowUpStep {
	action: ActionKind.DeleteFollowUp;
	messageId: Snowflake;
}

export interface ExecuteWithoutErrorReportStep {
	action: ActionKind.ExecuteWithoutErrorReport;
	callback(): Promise<void>;
}

export type HandlerStep =
	| DeleteFollowUpStep
	| DeleteStep
	| EnsureDeferStep
	| ExecuteWithoutErrorReportStep
	| FollowUpStep
	| RespondStep
	| UpdateFollowUpStep;

export type InteractionHandler = (
	interaction: APIInteraction,
) => AsyncGenerator<HandlerStep, HandlerStep, FollowUpMessageContainer>;

export enum ExecutorEvents {
	CallbackError = 'callbackError',
	HandlerError = 'handlerError',
}

export interface ExecutorEventsMap {
	[ExecutorEvents.CallbackError]: [error: Error];
	[ExecutorEvents.HandlerError]: [error: Error];
}

export class Executor extends AsyncEventEmitter<ExecutorEventsMap> {
	readonly #api: API;

	readonly #applicationId: Snowflake;

	public constructor(api: API, applicationId: Snowflake) {
		super();

		this.#api = api;
		this.#applicationId = applicationId;
	}

	public async handleInteraction(handler: InteractionHandler, interaction: APIInteraction): Promise<void> {
		const generator = handler(interaction);
		const actions = new Actions(this.#api, this.#applicationId, interaction);

		let nextValue: FollowUpMessageContainer | undefined;

		while (true) {
			try {
				const { value: op, done } = nextValue ? await generator.next(nextValue) : await generator.next();
				// This should only throw if the user used a wrong op, which we want to report as usual
				nextValue = await this.handleOp(actions, op);

				if (done) {
					break;
				}
			} catch (error) {
				await this.emitHandlerError(this.toError(error), actions);
			}
		}
	}

	private async handleOp(actions: Actions, op: HandlerStep): Promise<FollowUpMessageContainer> {
		let nextValue = new FollowUpMessageContainer(null);

		switch (op.action) {
			case ActionKind.Respond: {
				await actions.respond(op.data);
				break;
			}

			case ActionKind.EnsureDefer: {
				await actions.ensureDefer(op.data);
				break;
			}

			case ActionKind.Delete: {
				await actions.delete();
				break;
			}

			case ActionKind.FollowUp: {
				const followUp = await actions.followUp(op.data);
				nextValue = new FollowUpMessageContainer(followUp.messageId);
				break;
			}

			case ActionKind.UpdateFollowUp: {
				const followUp = actions.getExistingFollowUp(op.messageId);
				await followUp.update(op.data);
				break;
			}

			case ActionKind.DeleteFollowUp: {
				const followUp = actions.getExistingFollowUp(op.messageId);
				await followUp.delete();
				break;
			}

			case ActionKind.ExecuteWithoutErrorReport: {
				// Make sure we don't throw here
				try {
					await op.callback();
				} catch (error) {
					this.emitCallbackError(this.toError(error));
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

	private emitCallbackError(error: Error) {
		if (this.listenerCount(ExecutorEvents.CallbackError) === 0) {
			throw error;
		}

		this.emit(ExecutorEvents.CallbackError, error);
	}

	private async emitHandlerError(error: Error, actions: Actions) {
		this.emit(ExecutorEvents.HandlerError, error);

		if (this.listenerCount(ExecutorEvents.HandlerError) !== 0) {
			console.error(`Executor: An error occurred while processing the command: ${error.message}`, error);

			const data = {
				content: 'An error occurred while processing the command.',
			};

			const attempts: HandlerStep[] = [
				{
					action: ActionKind.Respond,
					data,
				},
				{
					action: ActionKind.FollowUp,
					data,
				},
			];

			for (const attempt of attempts) {
				try {
					// Keep trying until something works
					await this.handleOp(actions, attempt);
					break;
				} catch {}
			}

			console.log('Executor: The error was NOT reported to the user.');
		}
	}
}
