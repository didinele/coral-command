import {
	InteractionType,
	type API,
	type APIInteraction,
	type APIInteractionResponseCallbackData,
	type APIInteractionResponseDeferredChannelMessageWithSource,
	type Snowflake,
} from '@discordjs/core';
import type { RawFile } from '@discordjs/rest';
import { FollowUpActions } from './FollowUpActions.js';

export enum ActionKind {
	Reply,
	EnsureDeferReply,
	UpdateMessage,
	EnsureDeferUpdateMessage,
	Delete,
	FollowUp,
	UpdateFollowUp,
	DeleteFollowUp,
	ExecuteWithoutErrorReport,
}

export type ReplyOptions = APIInteractionResponseCallbackData & {
	files?: RawFile[];
};

export type DeferReplyOptions = APIInteractionResponseDeferredChannelMessageWithSource['data'];

export type UpdateMessageOptions = APIInteractionResponseCallbackData & {
	files?: RawFile[];
};

export type FollowUpOptions = APIInteractionResponseCallbackData & {
	files?: RawFile[];
};

export class Actions {
	public readonly api: API;

	public readonly applicationId: Snowflake;

	public readonly interaction: APIInteraction;

	public readonly followUpActionsMap = new Map<Snowflake, FollowUpActions>();

	protected replied = false;

	protected deleted = false;

	public constructor(api: API, applicationId: Snowflake, interaction: APIInteraction) {
		this.api = api;
		this.applicationId = applicationId;
		this.interaction = interaction;
	}

	public async reply(options: ReplyOptions): Promise<void> {
		if (this.deleted) {
			throw new Error('Cannot respond to a deleted interaction');
		}

		if (this.replied) {
			await this.api.interactions.editReply(this.applicationId, this.interaction.token, options);
		} else {
			await this.api.interactions.reply(this.interaction.id, this.interaction.token, options);
		}

		this.replied = true;
	}

	public async deferReply(options: DeferReplyOptions): Promise<void> {
		if (this.deleted) {
			throw new Error('Cannot defer a deleted interaction.');
		}

		if (this.replied) {
			return;
		}

		await this.api.interactions.defer(this.interaction.id, this.interaction.token, options);
		this.replied = true;
	}

	public async updateMessage(options: UpdateMessageOptions): Promise<void> {
		if (this.interaction.type !== InteractionType.MessageComponent) {
			throw new Error('Cannot update a message for an interaction that is not a message component.');
		}

		if (this.deleted) {
			throw new Error('Cannot respond to a deleted interaction.');
		}

		if (this.replied) {
			await this.api.channels.editMessage(this.interaction.channel.id, this.interaction.message.id, options);
		} else {
			await this.api.interactions.updateMessage(this.applicationId, this.interaction.token, options);
		}
	}

	public async ensureDeferUpdateMessage(): Promise<void> {
		if (this.interaction.type !== InteractionType.MessageComponent) {
			throw new Error('Cannot defer a message update for an interaction that is not a message component.');
		}

		if (this.deleted) {
			throw new Error('Cannot defer a deleted interaction.');
		}

		if (this.replied) {
			return;
		}

		await this.api.interactions.deferMessageUpdate(this.applicationId, this.interaction.token);
	}

	public async followUp(options: FollowUpOptions): Promise<FollowUpActions> {
		if (this.deleted || !this.replied) {
			throw new Error('Cannot follow up a deleted interaction or interaction we did not reply to');
		}

		const message = await this.api.interactions.followUp(this.applicationId, this.interaction.token, options);
		const actions = new FollowUpActions(this, message);

		this.followUpActionsMap.set(message.id, actions);
		return actions;
	}

	public getExistingFollowUp(messageId: Snowflake): FollowUpActions {
		const actions = this.followUpActionsMap.get(messageId);
		if (!actions) {
			throw new Error('No follow-up message with the given ID exists');
		}

		return actions;
	}

	public async delete(): Promise<void> {
		if (this.deleted || !this.replied) {
			throw new Error('Cannot delete a deleted interaction or interaction we did not reply to');
		}

		await this.api.interactions.deleteReply(this.interaction.id, this.interaction.token);

		this.deleted = true;
	}
}
