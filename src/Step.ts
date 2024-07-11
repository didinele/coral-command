import type { Snowflake } from '@discordjs/core';
import type { ActionKind, FollowUpOptions, RespondOptions } from './actions/Actions.js';
import type { UpdateFollowUpData } from './actions/FollowUpActions.js';

export interface RespondStepData {
	action: ActionKind.Respond;
	options: RespondOptions;
}

export interface EnsureDeferStepData {
	action: ActionKind.EnsureDefer;
	options: RespondOptions;
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
	| ExecuteWithoutErrorReportStepData
	| FollowUpStepData
	| RespondStepData
	| UpdateFollowUpStepData;

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
