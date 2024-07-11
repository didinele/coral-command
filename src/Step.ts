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

export class HandlerStep {
	public readonly data: HandlerStepData;

	public readonly cause: Error;

	private constructor(data: HandlerStepData, cause: Error) {
		this.data = data;
		this.cause = cause;
	}

	public static from(data: HandlerStepData): HandlerStep {
		return new HandlerStep(data, new Error('A malformed API payload was send to the handler.'));
	}
}
