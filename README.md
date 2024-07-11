# coral-command

# What?

A tiny "framework" for handling discord.js-esque commands in a modular, more sound way.

# How?

```ts
// starting from the @discordjs/core example on the docs
import { REST } from '@discordjs/rest';
import { WebSocketManager } from '@discordjs/ws';
import { GatewayDispatchEvents, GatewayIntentBits, InteractionType, MessageFlags, Client } from '@discordjs/core';
import { Executor, HandlerStep, ActionKind, type InteractionHandler } from 'coral-command';

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

const gateway = new WebSocketManager({
	token: process.env.DISCORD_TOKEN,
	intents: GatewayIntentBits.GuildMessages | GatewayIntentBits.MessageContent,
	rest,
});

const client = new Client({ rest, gateway });
const executor = new Executor(client.api, process.env.APPLICATION_ID);

// For the sake of ensuring that the handler `yield`s correct types, without the awkawardness of errors when calling `executor.handleInteraction()`, we explicitly type the handler as follows
const pingHandler: InteractionHandler = async function* pingHandler(interaction) {
	yield HandlerStep.from({
		action: ActionKind.Respond,
		options: {
			content: 'Pong!',
			flags: MessageFlags.Ephemeral,
		},
	});
};

client.on(GatewayDispatchEvents.InteractionCreate, async ({ data: interaction, api }) => {
	if (interaction.type !== InteractionType.ApplicationCommand || interaction.data.name !== 'ping') {
		return;
	}

	await executor.handleInteraction(pingHandler(interaction), interaction);
});

client.once(GatewayDispatchEvents.Ready, () => console.log('Ready!'));

void gateway.connect();
```

# But... why?

Generally speaking, it's difficult to write RE-USEABLE code when responding to interactions. The API this package offers
aims to sort of make those operations more safe. It's certainly not perfect, but it's a start.

The following actions are available:

- `ActionKind.Respond` - Serves as a "reply or edit" action.
- `ActionKind.EnsureDefer` - Ensures that the interaction is deferred. If it's already deferred, it does nothing.
- `ActionKind.Delete` - Deletes the initial interaction response.
- `ActionKind.FollowUp` - Sends a follow up message, more below.
- `ActionKind.UpdateFollowUp` / `ActionKind.DeleteFollowUp` - Updates or deletes a follow up message.
- `ActionKind.ExecuteWithoutErrorReport` - Provided a callback, effectively marks the code inside of it as "this is fine if it fails, it doesn't matter to the user or the flow of the command, just move along".

# Still not following

Here's some more cool stuff you can accomplish on top of this:

```ts
const executor = new Executor(client.api, process.env.APPLICATION_ID);
executor
	.on(ExecutorEvents.CallbackError, (error) => {
		console.error('An unhandled error occurred while executing a non-report:', error);
	})
	.on(ExecutorEvents.InteractionError, (error, actions) => {
		console.error('An unhandled occurred while executing an interaction:', error);
		// note that now we don't give anything else to the user. you can use the `actions` object for that.
		// (which also has a .interaction prop)`
	});

const someHelper: InteractionHandler = async function* pingHandler(interaction): Promise<Snowflake> {
	yield HandlerStep.from({
		action: ActionKind.Respond,
		options: {
			content:
				'So, any call to this handler will make the interaction response into... this! Regardless of it was already sent or not.',
			flags: MessageFlags.Ephemeral,
		},
	});

	const container = yield HandlerStep.from({
		action: ActionKind.FollowUp,
		options: {
			content: 'This is a follow up message!',
		},
	});
	// Due to TS limitations, any `yield` expression returns the same type regardless of what you yield.
	// As such, the framework returns a wrapper type, meant to serve as a sort of type cast (i.e. "yes, this is a follow up")
	// We do this as opposed to just giving you Snowflake | undefined so that in case you actually change it to be a different action
	// but forget, you get a cleaner runtime error.
	const messageId = container.unwrap();

	yield HandlerStep.from({
		action: ActionKind.UpdateFollowUp,
		options: {
			content: 'yippie',
		},
		messageId,
	});

	// Lovingly enough, we can return state. Making these helpers useful for "prompting" the user for something.
	return messageId;
};

const actualCommandHandler: InteractionHandler = async function* actualCommandHandler(interaction) {
	const messageId = yield* someHelper(interaction);
	// Do something with the messageId

	// At this point, we're done with our work, but we want to do some logging. If our code throws, we don't want to
	// report the error, so we can do the following:
	yield HandlerStep.from({
		action: ActionKind.ExecuteWithoutErrorReport,
		callback: async () => {
			// Do some logging
		},
	});
};
```

# On error handling

For unhandled errors within `ExecuteWithoutErrorReport` callbacks, if there is no `CallbackError` listener, the error will be thrown.
This is to ensure errors don't get swallowed. It's best if you attach a listener and handle it as you desire.

For other errors, including poor data formatting within `yield`s, `HandlerError` will be emitted regardless of listeners present.
That being said, if no listeners are present, the framework will log the error, then make 2 attempts at reporting it:
first, it will a regular "Respond" op, then it will attempt a "FollowUp" op. If both fail, an additional log will appear
letting you know.

# On using with discord.js

You can absolutely do this. Note that stuff like `Interaction#replied` will obviously not be updated, because the framework
makes raw calls. You just need a couple of `toJSON()` calls to get raw interaction data & to read the client's REST instance,
(manually constructing a `API` instance from core), and you're good to go.
