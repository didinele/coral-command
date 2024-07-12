import type { Snowflake } from '@discordjs/core';
import type { ActionKind, FollowUpOptions, ReplyOptions, UpdateMessageOptions } from './actions/Actions.js';
import type { UpdateFollowUpData } from './actions/FollowUpActions.js';

export interface ReplyStepData {
	action: ActionKind.Reply;
	options: ReplyOptions;
}

export interface EnsureDeferStepData {
	action: ActionKind.EnsureDeferReply;
	options: ReplyOptions;
}

export interface UpdateMessageStepData {
	action: ActionKind.UpdateMessage;
	options: UpdateMessageOptions;
}

export interface EnsureDeferUpdateMessageStepData {
	action: ActionKind.EnsureDeferUpdateMessage;
}

export interface DeleteStepData {
	action: ActionKind.Delete;
}

export interface FollowUpStepData {
	action: ActionKind.FollowUp;
	options: FollowUpOptions;
}

export interface UpdateFollowUpStepData {
	action: ActionKind.UpdateFollowUp;
	messageId: Snowflake;
	options: UpdateFollowUpData;
}

export interface DeleteFollowUpStepData {
	action: ActionKind.DeleteFollowUp;
	messageId: Snowflake;
}

export interface ExecuteWithoutErrorReportStepData {
	action: ActionKind.ExecuteWithoutErrorReport;
	callback(): Promise<void>;
}

export type HandlerStepData =
	| DeleteFollowUpStepData
	| DeleteStepData
	| EnsureDeferStepData
	| EnsureDeferUpdateMessageStepData
	| ExecuteWithoutErrorReportStepData
	| FollowUpStepData
	| ReplyStepData
	| UpdateFollowUpStepData
	| UpdateMessageStepData;

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
export type InteractionHandler<TReturn = void> =
	| AsyncGenerator<HandlerStep, TReturn, Snowflake>
	| Generator<HandlerStep, TReturn, Snowflake>;

export class HandlerStep {
	public readonly data: HandlerStepData;

	public readonly cause: Error;

	private constructor(data: HandlerStepData, cause: Error) {
		this.data = data;
		this.cause = cause;
	}

	public static from(data: FollowUpStepData): InteractionHandler<Snowflake>;
	public static from(data: Exclude<HandlerStepData, FollowUpStepData>): InteractionHandler<void>;

	// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
	public static *from(data: HandlerStepData): InteractionHandler<Snowflake | void> {
		const messageId = yield new HandlerStep(data, new Error('An operation caused an error within the Executor.'));
		if (messageId) {
			return messageId;
		}
	}
}
