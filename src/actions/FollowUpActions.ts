import type { APIMessage, RESTPatchAPIWebhookWithTokenMessageJSONBody, Snowflake } from '@discordjs/core';
import type { RawFile } from '@discordjs/rest';
import type { Actions } from './Actions.js';

export type UpdateFollowUpData = RESTPatchAPIWebhookWithTokenMessageJSONBody & {
	files?: RawFile[];
	thread_id?: string;
};

export class FollowUpActions {
	public readonly actions: Actions;

	readonly #message: APIMessage;

	#deleted = false;

	public get messageId(): Snowflake {
		return this.#message.id;
	}

	public constructor(actions: Actions, message: APIMessage) {
		this.actions = actions;
		this.#message = message;
	}

	public async update(data: UpdateFollowUpData): Promise<void> {
		if (this.#deleted) {
			throw new Error('Cannot update a deleted follow-up message');
		}

		await this.actions.api.webhooks.editMessage(
			this.actions.applicationId,
			this.actions.interaction.token,
			this.#message.id,
			data,
		);
	}

	public async delete(): Promise<void> {
		if (this.#deleted) {
			throw new Error('Cannot delete a deleted follow-up message');
		}

		await this.actions.api.webhooks.deleteMessage(
			this.actions.applicationId,
			this.actions.interaction.token,
			this.#message.id,
		);

		this.#deleted = true;
		this.actions.followUpActionsMap.delete(this.#message.id);
	}
}
