import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelSelectMenuBuilder,
	Colors,
	ContainerBuilder,
	FileBuilder,
	FileUploadBuilder,
	MediaGalleryBuilder,
	MediaGalleryItemBuilder,
	ModalBuilder,
	type InteractionReplyOptions,
	MessageFlags,
	type Message,
	type MessageComponentInteraction,
	type ModalSubmitInteraction,
	type RGBTuple,
	type RepliableInteraction,
	MentionableSelectMenuBuilder,
	RoleSelectMenuBuilder,
	SectionBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	StringSelectMenuBuilder,
	TextDisplayBuilder,
	TextInputBuilder,
	TextInputStyle,
	UserSelectMenuBuilder,
	LabelBuilder,
} from 'discord.js';

export namespace Dui {
	export const Fragment = Symbol('dui.fragment');

	export type Primitive = string | number | null | undefined | boolean;
	export type DuiInteraction = MessageComponentInteraction | ModalSubmitInteraction;

	/**
	 * Internal context during rendering, passed through the element tree resolver.
	 * Tracks custom ID prefixes and handler registration.
	 *
	 * @internal
	 */
	export interface RenderContext {
		customIdPrefix?: string;
		ids?: Record<string, string>;
		sequence?: SequenceController<any, any>;
		handlers?: RegisteredHandler<any, any>[];
		modalHandlers?: RegisteredModalHandler<any, any>[];
		onError?: (error: unknown, context: InteractionHandlerContext<any, any, any>) => Promise<void> | void;
	}

	export interface IdContext<TIds extends Record<string, string>> {
		readonly ids: TIds;
		id<K extends keyof TIds>(key: K): TIds[K];
	}

	/**
	 * Create a typed custom ID set for use with a DUI runtime.
	 *
	 * @template TIds The shape of the custom ID set
	 * @param namespace A string prefix to namespace all IDs
	 * @param ids An object mapping logical names to custom ID strings
	 * @returns The same ID object, typed as const
	 *
	 * @example
	 * const ids = Dui.createIds('setup', {
	 *   confirmation: 'confirm',
	 *   cancellation: 'cancel',
	 * } as const); // {confirmation: 'setup:confirm', cancellation: 'setup:cancel'}
	 */
	export function createIds<const Prefix extends string, const TIds extends Record<string, string>>(
		namespace: Prefix,
		ids: TIds,
	): { [K in keyof TIds]: `${Prefix}:${TIds[K]}` } {
		for (const [key, value] of Object.entries(ids)) {
			//@ts-expect-error This is a type-level transformation, not a runtime one. The prefix is applied during rendering.
			ids[key] = `${namespace}:${value}`;
		}
		return ids as unknown as { [K in keyof TIds]: `${Prefix}:${TIds[K]}` };
	}

	/**
	 * Create a typed ID context wrapper for access in render functions.
	 *
	 * @template TIds The shape of your custom ID set
	 * @param ids The custom ID set
	 * @returns An object with `.id(key)` method for type-safe lookups
	 *
	 * @example
	 * const idCtx = Dui.createIdContext(ids);
	 * const confirmId = idCtx.id('confirmation');
	 */
	export function createIdContext<const TIds extends Record<string, string>>(ids: TIds): IdContext<TIds> {
		return {
			ids,
			id: (key) => ids[key],
		};
	}

	export interface ButtonProps {
		customId?: string;
		style?: ButtonStyle;
		label?: string;
		disabled?: boolean;
		url?: string;
		onInteract?: InteractionHandler<Record<string, string>, unknown, MessageComponentInteraction>;
	}

	export interface StringSelectOption {
		label: string;
		value: string;
		description?: string;
		emoji?: string;
		default?: boolean;
	}

	export interface BaseSelectProps {
		customId: string;
		placeholder?: string;
		minValues?: number;
		maxValues?: number;
		disabled?: boolean;
		label?: string;
		description?: string;
		onInteract?: InteractionHandler<Record<string, string>, unknown, MessageComponentInteraction>;
	}

	export interface Intrinsics {
		container: {
			accentColor?: number | RGBTuple | keyof typeof Colors;
		};
		section: {
			accessory?: ElementNode<'button'> | ElementNode<'thumbnail'>;
		};
		label: {
			label: string;
			description?: string;
		};
		text: {
			content: string;
		};
		separator: {
			spacing?: SeparatorSpacingSize;
			divider?: boolean;
		};
		actionRow: Record<string, never>;
		button: ButtonProps;
		stringSelect: BaseSelectProps & {
			options: StringSelectOption[];
		};
		userSelect: BaseSelectProps;
		roleSelect: BaseSelectProps;
		channelSelect: BaseSelectProps;
		mentionableSelect: BaseSelectProps;
		modal: {
			customId: string;
			title: string;
			onSubmit?: ModalSubmitHandler;
		};
		textInput: {
			customId: string;
			style: TextInputStyle;
			label?: string;
			description?: string;
			placeholder?: string;
			required?: boolean;
			minLength?: number;
			maxLength?: number;
			value?: string;
		};
		/** A standalone file rendered in a container. */
		file: {
			url: string;
			spoiler?: boolean;
		};
		/** Container for media gallery items. Items should be provided as children. */
		mediaGallery: Record<string, never>;
		/** A single media gallery item with image/video URL and optional description. */
		mediaGalleryItem: {
			url: string;
			description?: string;
			spoiler?: boolean;
		};
		thumbnail: {
			url: string;
			description?: string;
		};
		fileUpload: {
			customId: string;
			label?: string;
			description?: string;
			minValues?: number;
			maxValues?: number;
			required?: boolean;
		};
	}

	/**
	 * Context passed to interaction handlers (onInteract callbacks).
	 * Provides access to state, custom IDs, the message, and update methods.
	 *
	 * @template TIds Custom ID set shape
	 * @template TState Runtime state shape
	 */
	export interface InteractionHandlerContext<
		TIds extends Record<string, string> = Record<string, string>,
		TState = unknown,
		TInteraction extends DuiInteraction = MessageComponentInteraction,
	> {
		interaction: TInteraction;
		ids: TIds;
		state: TState;
		sequence: SequenceController<TIds, TState>;
	}

	export type InteractionHandler<
		TIds extends Record<string, string> = Record<string, string>,
		TState = unknown,
		TInteraction extends DuiInteraction = MessageComponentInteraction,
	> = (context: InteractionHandlerContext<TIds, TState, TInteraction>) => Promise<void> | void;

	export type ModalSubmitHandler<
		TIds extends Record<string, string> = Record<string, string>,
		TState = unknown,
	> = InteractionHandler<TIds, TState, ModalSubmitInteraction>;

	export interface RegisteredHandler<TIds extends Record<string, string> = Record<string, string>, TState = unknown> {
		customId: string;
		handler: InteractionHandler<TIds, TState, MessageComponentInteraction>;
	}

	export interface RegisteredModalHandler<
		TIds extends Record<string, string> = Record<string, string>,
		TState = unknown,
	> {
		customId: string;
		handler: ModalSubmitHandler<TIds, TState>;
	}

	export interface SequenceController<
		TIds extends Record<string, string> = Record<string, string>,
		TState = unknown,
	> {
		readonly ids: TIds;
		readonly state: TState;
		readonly message: Message | null;
		setState(next: TState | ((state: TState) => TState | Promise<TState>)): Promise<TState>;
		update(
			nextView?:
				| Child
				| ((context: InteractionHandlerContext<TIds, TState, DuiInteraction>) => Child | Promise<Child>),
		): Promise<void>;
		showModal(
			modal:
				| ElementNode<'modal'>
				| ((
						context: InteractionHandlerContext<TIds, TState, DuiInteraction>,
				  ) => ElementNode<'modal'> | Promise<ElementNode<'modal'>>),
		): Promise<void>;
		stop(): void;
	}

	/**
	 * Options for creating a DUI runtime.
	 *
	 * @template TIds Shape of custom ID set (created with `Dui.createIds`)
	 * @template TState Shape of state object
	 */
	export interface RuntimeOptions<TIds extends Record<string, string>, TState> {
		ids: TIds;
		state: TState;
		render: (context: RuntimeRenderContext<TIds, TState>) => Child | Promise<Child>;
		onError?: (error: unknown, context: InteractionHandlerContext<TIds, TState, any>) => Promise<void> | void;
	}

	export interface RuntimeRenderContext<
		TIds extends Record<string, string>,
		TState,
	> extends InteractionHandlerContext<TIds, TState, DuiInteraction> {
		readonly sequence: SequenceController<TIds, TState>;
	}

	export interface RuntimeReplyOptions extends Omit<InteractionReplyOptions, 'components' | 'flags'> {
		customIdPrefix?: string;
	}

	export type IntrinsicType = keyof Intrinsics;
	export type ComponentType<P = Record<string, unknown>> = (
		props: P & { children: Child[] },
		ctx: RenderContext,
	) => Child;

	export type ElementType = IntrinsicType | typeof Fragment | ComponentType<any>;

	export type PropsFor<T extends ElementType> = T extends keyof Intrinsics
		? Intrinsics[T]
		: T extends ComponentType<infer P>
			? P
			: Record<string, never>;

	export interface ElementNode<T extends ElementType = ElementType> {
		type: T;
		props: PropsFor<T>;
		children: Child[];
	}

	export type Child = Primitive | ElementNode | Child[];

	type ResolvedNode =
		| ContainerBuilder
		| SectionBuilder
		| TextDisplayBuilder
		| SeparatorBuilder
		| FileBuilder
		| MediaGalleryBuilder
		| MediaGalleryItemBuilder
		| {
				kind: 'thumbnailAccessory';
				url: string;
				description?: string;
		  }
		| ActionRowBuilder<
				| ButtonBuilder
				| StringSelectMenuBuilder
				| UserSelectMenuBuilder
				| RoleSelectMenuBuilder
				| ChannelSelectMenuBuilder
				| MentionableSelectMenuBuilder
		  >
		| ButtonBuilder
		| StringSelectMenuBuilder
		| UserSelectMenuBuilder
		| RoleSelectMenuBuilder
		| ChannelSelectMenuBuilder
		| MentionableSelectMenuBuilder;

	interface RuntimeRecord<TIds extends Record<string, string>, TState> {
		runtime: Runtime<TIds, TState>;
		handlers: Map<string, InteractionHandler<TIds, TState, MessageComponentInteraction>>;
		modalHandlers: Map<string, ModalSubmitHandler<TIds, TState>>;
	}

	const runtimeRegistry = new Map<string, RuntimeRecord<any, any>>();
	const modalRegistry = new Map<string, RuntimeRecord<any, any>>();

	/**
	 * The rendered payload to send to Discord.
	 * Contains ContainerBuilder instances and the Components V2 flag.
	 */
	export interface RenderOutput {
		components: [ContainerBuilder];
		flags: MessageFlags.IsComponentsV2;
	}

	/**
	 * Type guard to check if a value is a valid element node.
	 *
	 * @param value The value to test
	 * @returns True if the value is an ElementNode
	 */
	export function isElementNode(value: unknown): value is ElementNode {
		if (!value || typeof value !== 'object') return false;
		if (!('type' in value) || !('props' in value) || !('children' in value)) return false;
		return true;
	}

	/**
	 * Create a DUI element. Use this directly or with `Dui.h()` for JSX support.
	 *
	 * @template T The element type (intrinsic like 'button' or a component function)
	 * @param type Element type descriptor
	 * @param props Component props, or null for defaults
	 * @param children Child elements (can be nested arrays, strings, numbers)
	 * @returns A virtual element node to be rendered later
	 */
	export function createElement<T extends ElementType>(
		type: T,
		props: PropsFor<T> | null,
		...children: Child[]
	): ElementNode<T> {
		return {
			type,
			props: (props ?? {}) as PropsFor<T>,
			children: normaliseChildren(children),
		};
	}

	/** Alias for `createElement`. Use this with JSX to create elements. */
	export const h = createElement;

	/**
	 * Create a text element with content.
	 *
	 * @param content The text to display
	 * @returns A text element
	 *
	 * @example
	 * const title = Dui.createText('## Hello World');
	 */
	export function createText(content: string): ElementNode<'text'> {
		return createElement('text', { content });
	}

	/**
	 * Create a container (Discord).
	 *
	 * @param props Container options (e.g., accentColor)
	 * @param children Child elements
	 * @returns A container element
	 *
	 * @example
	 * const ui = Dui.createContainer(
	 *   { accentColor: 0x0033ff },
	 *   Dui.createText('Goog'),
	 *   Dui.createElement('button', { customId: 'goog', label: 'Gooog' }),
	 * );
	 */
	export function createContainer(
		props: Intrinsics['container'] = {},
		...children: Child[]
	): ElementNode<'container'> {
		return createElement('container', props, ...children);
	}

	export class Runtime<TIds extends Record<string, string>, TState> implements SequenceController<TIds, TState> {
		readonly ids: TIds;
		private _state: TState;
		private renderView: (context: RuntimeRenderContext<TIds, TState>) => Child | Promise<Child>;
		private readonly handlers = new Map<string, InteractionHandler<TIds, TState, MessageComponentInteraction>>();
		private readonly modalHandlers = new Map<string, ModalSubmitHandler<TIds, TState>>();
		private currentMessage: Message | null = null;
		private currentInteraction: DuiInteraction | null = null;
		private stopped = false;
		private readonly onError?: (
			error: unknown,
			context: InteractionHandlerContext<TIds, TState, any>,
		) => Promise<void> | void;

		constructor(options: RuntimeOptions<TIds, TState>) {
			this.ids = options.ids;
			this._state = options.state;
			this.renderView = options.render;
			this.onError = options.onError;
		}

		get state(): TState {
			return this._state;
		}

		get message(): Message | null {
			return this.currentMessage;
		}

		/**
		 * Reply to an interaction with the current UI state.
		 * The runtime attaches itself to the message so future interactions are sent back.
		 *
		 * @param interaction The interaction to reply to
		 * @param options Additional reply options (content, embeds, etc.)
		 * @returns The sent message
		 * @throws If the interaction cannot be replied to
		 *
		 * @example
		 * const msg = await runtime.reply(interaction, { content: 'hi' });
		 */
		async reply(interaction: RepliableInteraction, options: RuntimeReplyOptions = {}): Promise<Message> {
			const payload = await this.buildPayload();
			await interaction.reply({
				...options,
				components: payload.components,
				flags: payload.flags,
			} as InteractionReplyOptions);
			const message = (await interaction.fetchReply()) as Message;
			this.attachMessage(message);
			return message;
		}

		/**
		 * Update the message with new UI content.
		 * If `nextView` is a function, it receives the current interaction context.
		 * If omitted, the message is re-rendered with the current state.
		 *
		 * @param nextView Optional tree to render, or a function that returns one
		 * @throws If called before the runtime has been replied to
		 *
		 * @example
		 * // Re-render with current state
		 * await sequence.update();
		 *
		 * @example
		 * // Render a new tree
		 * await sequence.update(Dui.createText('New stuff'));
		 *
		 * @example
		 * // Render based on interaction context
		 * await sequence.update((ctx) => {
		 *   return ctx.state.isComplete
		 *     ? Dui.createText('done')
		 *     : Dui.createText('doing');
		 * });
		 */
		async update(
			nextView?:
				| Child
				| ((context: InteractionHandlerContext<TIds, TState, DuiInteraction>) => Child | Promise<Child>),
		): Promise<void> {
			if (!this.currentMessage) {
				throw new Error('Cannot update a DUI runtime before it has been replied to.');
			}
			const interaction = this.currentInteraction;
			if (interaction && !interaction.deferred && !interaction.replied) {
				await interaction.deferUpdate().catch(() => undefined);
			}
			if (nextView !== undefined) {
				const context = this.createInteractionContext(interaction ?? undefined);
				const resolved = typeof nextView === 'function' ? await nextView(context) : nextView;
				await this.editMessage(resolved);
				return;
			}
			await this.editMessage();
		}

		async showModal(
			modal:
				| ElementNode<'modal'>
				| ((
						context: InteractionHandlerContext<TIds, TState, DuiInteraction>,
				  ) => ElementNode<'modal'> | Promise<ElementNode<'modal'>>),
		): Promise<void> {
			const interaction = this.currentInteraction;
			if (!interaction || !('showModal' in interaction)) {
				throw new Error('Cannot show a DUI modal without an active showModal-capable interaction.');
			}
			const context = this.createInteractionContext(interaction);
			const nextModal = typeof modal === 'function' ? await modal(context) : modal;
			const modalContext: RenderContext = {
				ids: this.ids,
				sequence: this,
				modalHandlers: [],
				onError: this.handleError.bind(this),
			};
			const builtModal = buildModal<TIds, TState>(nextModal, modalContext);
			await interaction.showModal(builtModal.modal);
			for (const entry of builtModal.handlers) {
				this.modalHandlers.set(entry.customId, entry.handler as ModalSubmitHandler<TIds, TState>);
				modalRegistry.set(entry.customId, {
					runtime: this,
					handlers: this.handlers,
					modalHandlers: this.modalHandlers,
				});
			}
		}

		/**
		 * Update the runtime state. Can replace it entirely or use a function.
		 * The render function is NOT called automatically; call `update()` after this.
		 *
		 * @param next New state or an updater function
		 * @returns The new state
		 *
		 * @example
		 * // Direct replacement
		 * await sequence.setState({ step: 1 });
		 *
		 * @example
		 * // Function-based update
		 * await sequence.setState(s => ({ ...s, count: s.count + 1 }));
		 *
		 * @example
		 * // Async updater
		 * await sequence.setState(async (s) => {
		 *   const data = await fetchData();
		 *   return { ...s, data };
		 * });
		 */
		async setState(next: TState | ((state: TState) => TState | Promise<TState>)): Promise<TState> {
			if (typeof next === 'function') {
				this._state = await (next as (state: TState) => TState | Promise<TState>)(this._state);
			} else {
				this._state = next;
			}
			return this._state;
		}

		/**
		 * Stop this runtime from accepting further interactions.
		 * Useful for marking a flow as complete or cancelled.
		 *
		 * @example
		 * await sequence.setState({ complete: true });
		 * await sequence.update();
		 * sequence.stop();
		 */
		stop(): void {
			this.stopped = true;
			if (this.currentMessage) runtimeRegistry.delete(this.currentMessage.id);
			for (const customId of this.modalHandlers.keys()) {
				modalRegistry.delete(customId);
			}
		}

		async dispatch(interaction: MessageComponentInteraction): Promise<boolean> {
			if (this.stopped) return false;
			if (!interaction.message || this.currentMessage?.id !== interaction.message.id) return false;
			const handler = this.handlers.get(interaction.customId);
			if (!handler) return false;
			this.currentInteraction = interaction;
			const context = this.createInteractionContext(interaction) as unknown as InteractionHandlerContext<
				TIds,
				TState,
				MessageComponentInteraction
			>;
			try {
				await handler(context);
			} catch (error) {
				await this.handleError(error, context);
			}
			return true;
		}

		async dispatchModal(interaction: ModalSubmitInteraction): Promise<boolean> {
			if (this.stopped) return false;
			const handler = this.modalHandlers.get(interaction.customId);
			if (!handler) return false;
			this.currentInteraction = interaction;
			const context = this.createInteractionContext(interaction) as unknown as InteractionHandlerContext<
				TIds,
				TState,
				ModalSubmitInteraction
			>;
			try {
				await handler(context);
			} catch (error) {
				await this.handleError(error, context);
			}
			return true;
		}

		private async buildPayload(view?: Child): Promise<RenderOutput> {
			const handlers: RegisteredHandler<TIds, TState>[] = [];
			const modalHandlers: RegisteredModalHandler<TIds, TState>[] = [];
			const context: RenderContext = {
				ids: this.ids,
				sequence: this,
				handlers,
				modalHandlers,
				onError: this.handleError.bind(this),
			};
			const tree =
				view ?? (await this.renderView(this.createInteractionContext(this.currentInteraction ?? undefined)));
			const payload = render(tree, context);
			this.handlers.clear();
			this.modalHandlers.clear();
			for (const entry of handlers) {
				this.handlers.set(entry.customId, entry.handler);
			}
			for (const entry of modalHandlers) {
				this.modalHandlers.set(entry.customId, entry.handler as ModalSubmitHandler<TIds, TState>);
				modalRegistry.set(entry.customId, {
					runtime: this,
					handlers: this.handlers,
					modalHandlers: this.modalHandlers,
				});
			}
			return payload;
		}

		private async editMessage(view?: Child): Promise<void> {
			if (!this.currentMessage) throw new Error('Cannot edit DUI runtime without an attached message.');
			const payload = await this.buildPayload(view);
			await this.currentMessage.edit({ components: payload.components, flags: payload.flags });
		}

		private attachMessage(message: Message): void {
			this.currentMessage = message;
			runtimeRegistry.set(message.id, {
				runtime: this,
				handlers: this.handlers,
				modalHandlers: this.modalHandlers,
			});
		}

		private createInteractionContext(
			interaction: DuiInteraction | RepliableInteraction | undefined,
		): RuntimeRenderContext<TIds, TState> {
			return {
				interaction: interaction as DuiInteraction,
				ids: this.ids,
				state: this._state,
				sequence: this,
			};
		}

		private async handleError(
			error: unknown,
			context: InteractionHandlerContext<TIds, TState, any>,
		): Promise<void> {
			if (this.onError) {
				await this.onError(error, context);
				return;
			}
			console.error('DUI runtime error:', error);
		}
	}

	/**
	 * Create a stateful DUI runtime that manages interactions and updates.
	 * The runtime handles handler dispatch, state updates, and message editing.
	 *
	 * @template TIds Shape of your custom ID set
	 * @template TState Shape of your state object
	 * @param options Configuration
	 * @param options.ids Typed custom-ID set
	 * @param options.state Initial state value
	 * @param options.render Render function that returns a UI tree based on current state
	 * @param options.onError Optional error handler for failed interactions
	 * @returns A runtime that can reply to interactions and handle updates
	 *
	 * @example
	 * const ids = Dui.createIds({ next: 'wizard:next', back: 'wizard:back' } as const);
	 *
	 * const runtime = Dui.createRuntime({
	 *   ids,
	 *   state: { step: 0 },
	 *   render: (ctx) => (
	 *     <container>
	 *       <text>Step {ctx.state.step}</text>
	 *       <button
	 *         customId={ctx.ids.next}
	 *         label="Next"
	 *         onInteract={async ({ sequence }) => {
	 *           await sequence.setState(s => ({ ...s, step: s.step + 1 }));
	 *           await sequence.update();
	 *         }}
	 *       />
	 *     </container>
	 *   ),
	 *   onError: async (error) => console.error(error),
	 * });
	 *
	 * await runtime.reply(interaction);
	 */
	export function createRuntime<TIds extends Record<string, string>, TState>(
		options: RuntimeOptions<TIds, TState>,
	): Runtime<TIds, TState> {
		return new Runtime(options);
	}

	/**
	 * Route a message component interaction to its associated DUI runtime.
	 * This is called automatically by the event handler in `src/events/interactionCreate.ts`.
	 *
	 * @param interaction The message component interaction
	 * @returns True if a handler was found and executed, false otherwise
	 *
	 * @internal Used internally by the interaction event dispatcher
	 */
	export async function dispatchInteraction(interaction: MessageComponentInteraction): Promise<boolean> {
		if (!interaction.message) return false;
		const record = runtimeRegistry.get(interaction.message.id);
		if (!record) return false;
		return record.runtime.dispatch(interaction);
	}

	export async function dispatchModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
		const record = modalRegistry.get(interaction.customId);
		if (!record) return false;
		return record.runtime.dispatchModal(interaction);
	}

	/**
	 * Render a DUI element tree to Discord Components V2 builders.
	 * This is called internally by the runtime but can also be used standalone.
	 *
	 * @param node The root element or virtual tree
	 * @param ctx Optional render context (custom ID prefix, handlers, etc.)
	 * @returns A message payload with Discord builder array and Components V2 flag
	 *
	 * @example
	 * const tree = Dui.createElement('container', {}, Dui.createText('hi goog'));
	 * const payload = Dui.render(tree);
	 * await interaction.reply(payload);
	 */
	export function render(node: Child, ctx: RenderContext = {}): RenderOutput {
		const top = resolve(node, ctx);
		if (top instanceof ContainerBuilder) {
			return {
				components: [top],
				flags: MessageFlags.IsComponentsV2,
			};
		}

		const root = new ContainerBuilder();
		appendToContainer(root, [top]);
		return {
			components: [root],
			flags: MessageFlags.IsComponentsV2,
		};
	}

	/**
	 * Recursively flatten and filter a children array.
	 * Removes null, undefined, and boolean values; flattens nested arrays.
	 *
	 * @param input Raw children array (may contain nested arrays)
	 * @returns Flattened array with falsy values removed
	 *
	 * @internal Used internally during element creation
	 */
	export function normaliseChildren(input: Child[]): Child[] {
		const out: Child[] = [];
		for (const child of input) {
			if (Array.isArray(child)) {
				out.push(...normaliseChildren(child));
				continue;
			}
			if (child === null || child === undefined || typeof child === 'boolean') continue;
			out.push(child);
		}
		return out;
	}

	function withPrefix(customId: string, ctx: RenderContext): string {
		if (!ctx.customIdPrefix) return customId;
		return `${ctx.customIdPrefix}:${customId}`;
	}

	export function resolveAccentColor(color: Intrinsics['container']['accentColor']): number | RGBTuple | undefined {
		if (color === undefined) return undefined;
		if (typeof color === 'string') return Colors[color];
		return color;
	}

	interface BuiltModal<TIds extends Record<string, string>, TState> {
		modal: ModalBuilder;
		handlers: RegisteredModalHandler<TIds, TState>[];
	}

	function buildModal<TIds extends Record<string, string>, TState>(
		node: ElementNode<'modal'>,
		ctx: RenderContext,
	): BuiltModal<TIds, TState> {
		if (!isElementNode(node) || node.type !== 'modal') {
			throw new Error('DUI modals must be built from a `modal` intrinsic element.');
		}
		const props = node.props as Intrinsics['modal'];
		const modal = new ModalBuilder().setCustomId(withPrefix(props.customId, ctx)).setTitle(props.title);
		for (const child of node.children) {
			appendToModal(modal, child, ctx);
		}
		const handlers: RegisteredModalHandler<TIds, TState>[] = [];
		if (props.onSubmit) {
			handlers.push({
				customId: withPrefix(props.customId, ctx),
				handler: props.onSubmit as ModalSubmitHandler<TIds, TState>,
			});
		}
		return { modal, handlers };
	}

	const possibleModalChildren = [
		'userSelect',
		'roleSelect',
		'channelSelect',
		'mentionableSelect',
		'stringSelect',
		'textInput',
		'text',
		'fileUpload',
		'label',
	] as const as (keyof Intrinsics | ComponentType)[];

	function buildModalTextInput(node: ElementNode<'textInput'>, ctx: RenderContext): TextInputBuilder {
		const props = node.props as Intrinsics['textInput'];
		const textInput = new TextInputBuilder().setCustomId(withPrefix(props.customId, ctx)).setStyle(props.style);
		if (props.placeholder !== undefined) textInput.setPlaceholder(props.placeholder);
		if (props.required !== undefined) textInput.setRequired(props.required);
		if (props.minLength !== undefined) textInput.setMinLength(props.minLength);
		if (props.maxLength !== undefined) textInput.setMaxLength(props.maxLength);
		if (props.value !== undefined) textInput.setValue(props.value);
		return textInput;
	}

	function buildModalFileUpload(node: ElementNode<'fileUpload'>, ctx: RenderContext): FileUploadBuilder {
		const props = node.props as Intrinsics['fileUpload'];
		const fileUpload = new FileUploadBuilder().setCustomId(withPrefix(props.customId, ctx));
		if (props.minValues !== undefined) fileUpload.setMinValues(props.minValues);
		if (props.maxValues !== undefined) fileUpload.setMaxValues(props.maxValues);
		if (props.required !== undefined) fileUpload.setRequired(props.required);
		return fileUpload;
	}

	function buildModalStringSelect(node: ElementNode<'stringSelect'>, ctx: RenderContext): StringSelectMenuBuilder {
		const props = node.props as Intrinsics['stringSelect'];
		const select = new StringSelectMenuBuilder().setCustomId(withPrefix(props.customId, ctx));
		if (props.placeholder !== undefined) select.setPlaceholder(props.placeholder);
		if (props.minValues !== undefined) select.setMinValues(props.minValues);
		if (props.maxValues !== undefined) select.setMaxValues(props.maxValues);
		if (props.disabled !== undefined) select.setDisabled(props.disabled);
		for (const opt of props.options) {
			select.addOptions({
				label: opt.label,
				value: opt.value,
				description: opt.description,
				emoji: opt.emoji,
				default: opt.default,
			});
		}
		return select;
	}

	function buildModalSelect(
		node: ElementNode<'userSelect' | 'roleSelect' | 'channelSelect' | 'mentionableSelect'>,
		ctx: RenderContext,
	): UserSelectMenuBuilder | RoleSelectMenuBuilder | ChannelSelectMenuBuilder | MentionableSelectMenuBuilder {
		const props = node.props as BaseSelectProps;
		const select =
			node.type === 'userSelect'
				? new UserSelectMenuBuilder()
				: node.type === 'roleSelect'
					? new RoleSelectMenuBuilder()
					: node.type === 'channelSelect'
						? new ChannelSelectMenuBuilder()
						: new MentionableSelectMenuBuilder();
		select.setCustomId(withPrefix(props.customId, ctx));
		if (props.placeholder !== undefined) select.setPlaceholder(props.placeholder);
		if (props.minValues !== undefined) select.setMinValues(props.minValues);
		if (props.maxValues !== undefined) select.setMaxValues(props.maxValues);
		if (props.disabled !== undefined) select.setDisabled(props.disabled);
		return select;
	}

	function buildModalLabelFromChild(child: ElementNode, ctx: RenderContext): LabelBuilder {
		if (child.type === 'label') {
			const labelProps = child.props as Intrinsics['label'];
			if (child.children.length !== 1 || !isElementNode(child.children[0])) {
				throw new Error(
					'A DUI label modal element must contain exactly one interactive modal child component.',
				);
			}
			const nested = child.children[0] as ElementNode;
			const label = new LabelBuilder().setLabel(labelProps.label);
			if (labelProps.description) label.setDescription(labelProps.description);
			if (nested.type === 'textInput') {
				label.setTextInputComponent(buildModalTextInput(nested as ElementNode<'textInput'>, ctx));
				return label;
			}
			if (nested.type === 'fileUpload') {
				label.setFileUploadComponent(buildModalFileUpload(nested as ElementNode<'fileUpload'>, ctx));
				return label;
			}
			if (nested.type === 'stringSelect') {
				label.setStringSelectMenuComponent(buildModalStringSelect(nested as ElementNode<'stringSelect'>, ctx));
				return label;
			}
			if (
				nested.type === 'userSelect' ||
				nested.type === 'roleSelect' ||
				nested.type === 'channelSelect' ||
				nested.type === 'mentionableSelect'
			) {
				const select = buildModalSelect(
					nested as ElementNode<'userSelect' | 'roleSelect' | 'channelSelect' | 'mentionableSelect'>,
					ctx,
				);
				if (nested.type === 'userSelect') label.setUserSelectMenuComponent(select as UserSelectMenuBuilder);
				if (nested.type === 'roleSelect') label.setRoleSelectMenuComponent(select as RoleSelectMenuBuilder);
				if (nested.type === 'channelSelect')
					label.setChannelSelectMenuComponent(select as ChannelSelectMenuBuilder);
				if (nested.type === 'mentionableSelect')
					label.setMentionableSelectMenuComponent(select as MentionableSelectMenuBuilder);
				return label;
			}
			throw new Error(
				'A DUI label modal element can only wrap textInput, fileUpload, or select menu components.',
			);
		}

		if (child.type === 'textInput') {
			const props = child.props as Intrinsics['textInput'];
			const label = new LabelBuilder().setLabel(props.label ?? 'Input');
			if (props.description) label.setDescription(props.description);
			label.setTextInputComponent(buildModalTextInput(child as ElementNode<'textInput'>, ctx));
			return label;
		}

		if (child.type === 'fileUpload') {
			const props = child.props as Intrinsics['fileUpload'];
			const label = new LabelBuilder().setLabel(props.label ?? 'Files');
			if (props.description) label.setDescription(props.description);
			label.setFileUploadComponent(buildModalFileUpload(child as ElementNode<'fileUpload'>, ctx));
			return label;
		}

		if (child.type === 'stringSelect') {
			const props = child.props as Intrinsics['stringSelect'];
			const label = new LabelBuilder().setLabel(props.label ?? 'Select an option');
			if (props.description) label.setDescription(props.description);
			label.setStringSelectMenuComponent(buildModalStringSelect(child as ElementNode<'stringSelect'>, ctx));
			return label;
		}

		if (
			child.type === 'userSelect' ||
			child.type === 'roleSelect' ||
			child.type === 'channelSelect' ||
			child.type === 'mentionableSelect'
		) {
			const props = child.props as BaseSelectProps;
			const label = new LabelBuilder().setLabel(props.label ?? 'Select an option');
			if (props.description) label.setDescription(props.description);
			const select = buildModalSelect(
				child as ElementNode<'userSelect' | 'roleSelect' | 'channelSelect' | 'mentionableSelect'>,
				ctx,
			);
			if (child.type === 'userSelect') label.setUserSelectMenuComponent(select as UserSelectMenuBuilder);
			if (child.type === 'roleSelect') label.setRoleSelectMenuComponent(select as RoleSelectMenuBuilder);
			if (child.type === 'channelSelect') label.setChannelSelectMenuComponent(select as ChannelSelectMenuBuilder);
			if (child.type === 'mentionableSelect')
				label.setMentionableSelectMenuComponent(select as MentionableSelectMenuBuilder);
			return label;
		}

		throw new Error('Unsupported modal label child.');
	}

	function appendToModal(modal: ModalBuilder, child: Child, ctx: RenderContext): void {
		if (Array.isArray(child)) {
			for (const nested of child) appendToModal(modal, nested, ctx);
			return;
		}
		if (child === null || child === undefined || typeof child === 'boolean') return;
		if (!isElementNode(child)) {
			modal.addTextDisplayComponents(new TextDisplayBuilder().setContent(String(child)));
			return;
		}
		if (child.type === Fragment) {
			for (const nested of child.children) appendToModal(modal, nested, ctx);
			return;
		}

		if (!possibleModalChildren.includes(child.type)) {
			throw new Error(
				`DUI modal children must be one of the supported elements: ${possibleModalChildren.map((v) => `\`${v}\``).join(', ')}.`,
			);
		}
		if (child.type === 'text') {
			const props = child.props as Intrinsics['text'];
			modal.addTextDisplayComponents(new TextDisplayBuilder().setContent(props.content));
			return;
		}

		modal.addLabelComponents(buildModalLabelFromChild(child, ctx));
	}

	function resolve(node: Child, ctx: RenderContext): ResolvedNode {
		if (typeof node === 'string' || typeof node === 'number') {
			return new TextDisplayBuilder().setContent(String(node));
		}
		if (Array.isArray(node)) {
			const children = normaliseChildren(node);
			if (children.length === 0) return new TextDisplayBuilder().setContent('');
			if (children.length === 1) return resolve(children[0], ctx);
			const container = new ContainerBuilder();
			appendToContainer(
				container,
				children.map((child) => resolve(child, ctx)),
			);
			return container;
		}
		if (!isElementNode(node)) {
			throw new Error('Invalid Dui node');
		}

		if (node.type === Fragment) {
			const container = new ContainerBuilder();
			appendToContainer(
				container,
				node.children.map((child) => resolve(child, ctx)),
			);
			return container;
		}

		if (typeof node.type === 'function') {
			const rendered = node.type({ ...(node.props as object), children: node.children } as never, ctx);
			return resolve(rendered, ctx);
		}

		switch (node.type) {
			case 'modal':
			case 'textInput': {
				throw new Error('modal and textInput are modal-only intrinsics. Use sequence.showModal(...).');
			}
			case 'container': {
				const builder = new ContainerBuilder();
				const accentColor = resolveAccentColor(node.props.accentColor);
				if (accentColor !== undefined) builder.setAccentColor(accentColor);
				appendToContainer(
					builder,
					node.children.map((child) => resolve(child, ctx)),
				);
				return builder;
			}
			case 'text': {
				return new TextDisplayBuilder().setContent(node.props.content);
			}
			case 'separator': {
				const builder = new SeparatorBuilder();
				if (node.props.spacing !== undefined) builder.setSpacing(node.props.spacing);
				if (node.props.divider !== undefined) builder.setDivider(node.props.divider);
				return builder;
			}
			case 'file': {
				const props = node.props as Intrinsics['file'];
				const file = new FileBuilder().setURL(props.url);
				if (props.spoiler !== undefined) file.setSpoiler(props.spoiler);
				return file;
			}
			case 'section': {
				const section = new SectionBuilder();
				const inner = node.children.map((child) => resolve(child, ctx));
				for (const child of inner) {
					if (child instanceof TextDisplayBuilder) section.addTextDisplayComponents(child);
				}

				const accessoryNode = node.props.accessory;
				if (accessoryNode?.type === 'button') {
					const accessory = resolve(accessoryNode, ctx);
					if (accessory instanceof ButtonBuilder) section.setButtonAccessory(accessory);
				}
				if (accessoryNode?.type === 'thumbnail') {
					const props = accessoryNode.props as Intrinsics['thumbnail'];
					section.setThumbnailAccessory((thumb) => {
						thumb.setURL(props.url);
						if (props.description) thumb.setDescription(props.description);
						return thumb;
					});
				}

				return section;
			}
			case 'mediaGallery': {
				const gallery = new MediaGalleryBuilder();
				for (const child of node.children.map((child) => resolve(child, ctx))) {
					if (child instanceof MediaGalleryItemBuilder) gallery.addItems(child);
				}
				return gallery;
			}
			case 'mediaGalleryItem': {
				const props = node.props as Intrinsics['mediaGalleryItem'];
				const item = new MediaGalleryItemBuilder().setURL(props.url);
				if (props.description !== undefined) item.setDescription(props.description);
				if (props.spoiler !== undefined) item.setSpoiler(props.spoiler);
				return item;
			}
			case 'actionRow': {
				const row = new ActionRowBuilder<
					| ButtonBuilder
					| StringSelectMenuBuilder
					| UserSelectMenuBuilder
					| RoleSelectMenuBuilder
					| ChannelSelectMenuBuilder
					| MentionableSelectMenuBuilder
				>();
				for (const child of node.children.map((child) => resolve(child, ctx))) {
					if (
						child instanceof ButtonBuilder ||
						child instanceof StringSelectMenuBuilder ||
						child instanceof UserSelectMenuBuilder ||
						child instanceof RoleSelectMenuBuilder ||
						child instanceof ChannelSelectMenuBuilder ||
						child instanceof MentionableSelectMenuBuilder
					) {
						row.addComponents(child);
					}
				}
				return row;
			}
			case 'button': {
				const button = new ButtonBuilder();
				if (node.props.customId) button.setCustomId(withPrefix(node.props.customId, ctx));
				if (node.props.style !== undefined) button.setStyle(node.props.style);
				if (node.props.label !== undefined) button.setLabel(node.props.label);
				if (node.props.disabled !== undefined) button.setDisabled(node.props.disabled);
				if (node.props.url) button.setURL(node.props.url);
				if (node.props.onInteract) {
					if (!node.props.customId) throw new Error('Interactive buttons require a customId.');
					ctx.handlers?.push({
						customId: withPrefix(node.props.customId, ctx),
						handler: node.props.onInteract,
					});
				}
				return button;
			}
			case 'stringSelect': {
				const props = node.props as Intrinsics['stringSelect'];
				const select = new StringSelectMenuBuilder().setCustomId(withPrefix(props.customId, ctx));
				if (props.placeholder !== undefined) select.setPlaceholder(props.placeholder);
				if (props.minValues !== undefined) select.setMinValues(props.minValues);
				if (props.maxValues !== undefined) select.setMaxValues(props.maxValues);
				if (props.disabled !== undefined) select.setDisabled(props.disabled);
				const options = props.options as StringSelectOption[];
				for (const opt of options) {
					select.addOptions({
						label: opt.label,
						value: opt.value,
						description: opt.description,
						emoji: opt.emoji,
						default: opt.default,
					});
				}
				if (props.onInteract) {
					ctx.handlers?.push({
						customId: withPrefix(props.customId, ctx),
						handler: props.onInteract,
					});
				}
				return select;
			}
			case 'userSelect': {
				return buildInteractiveSelect(new UserSelectMenuBuilder(), node.props, ctx);
			}
			case 'roleSelect': {
				return buildInteractiveSelect(new RoleSelectMenuBuilder(), node.props, ctx);
			}
			case 'channelSelect': {
				return buildInteractiveSelect(new ChannelSelectMenuBuilder(), node.props, ctx);
			}
			case 'mentionableSelect': {
				return buildInteractiveSelect(new MentionableSelectMenuBuilder(), node.props, ctx);
			}
			case 'thumbnail': {
				const props = node.props as Intrinsics['thumbnail'];
				return {
					kind: 'thumbnailAccessory',
					url: props.url,
					description: props.description,
				};
			}
			default:
				throw new Error(`Unsupported intrinsic element: ${String(node.type)}`);
		}
	}

	function appendToContainer(container: ContainerBuilder, children: ResolvedNode[]): void {
		for (const child of children) {
			if (typeof child === 'object' && 'kind' in child && child.kind === 'thumbnailAccessory') continue;
			if (child instanceof TextDisplayBuilder) container.addTextDisplayComponents(child);
			else if (child instanceof SectionBuilder) container.addSectionComponents(child);
			else if (child instanceof SeparatorBuilder) container.addSeparatorComponents(child);
			else if (child instanceof FileBuilder) container.addFileComponents(child);
			else if (child instanceof MediaGalleryBuilder) container.addMediaGalleryComponents(child);
			else if (child instanceof ActionRowBuilder) container.addActionRowComponents(child);
			else if (child instanceof ContainerBuilder) {
				// Flatten nested containers when composing fragments.
				appendToContainer(container, child.components as unknown as ResolvedNode[]);
			}
		}
	}

	function buildInteractiveSelect<
		T extends
			| UserSelectMenuBuilder
			| RoleSelectMenuBuilder
			| ChannelSelectMenuBuilder
			| MentionableSelectMenuBuilder,
	>(builder: T, props: BaseSelectProps, ctx: RenderContext): T {
		builder.setCustomId(withPrefix(props.customId, ctx));
		if (props.placeholder !== undefined) builder.setPlaceholder(props.placeholder);
		if (props.minValues !== undefined) builder.setMinValues(props.minValues);
		if (props.maxValues !== undefined) builder.setMaxValues(props.maxValues);
		if (props.disabled !== undefined) builder.setDisabled(props.disabled);
		if (props.onInteract) {
			ctx.handlers?.push({
				customId: withPrefix(props.customId, ctx),
				handler: props.onInteract,
			});
		}
		return builder;
	}
}
