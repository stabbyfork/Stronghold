import { ButtonStyle, SeparatorSpacingSize } from 'discord.js';
import { Dui } from './core.js';

function toTextNodes(lines: string[]): Dui.ElementNode<'text'>[] {
	return lines.filter((line) => line.trim().length > 0).map((line) => Dui.createText(line));
}

export namespace DuiBuiltins {
	/**
	 * Props for the Card component.
	 * @see Card
	 */
	export interface CardProps {
		/** Title (rendered as ## heading) */
		title: string;
		/** Optional description/subtitle */
		description?: string;
		/** Body text, accepts single string or array of strings */
		body?: string | string[];
		/** Optional footer text (rendered with small -# prefix) */
		footer?: string;
		/** Optional accent color (number, RGB tuple, or Discord color key like 'Blue') */
		accentColor?: Dui.Intrinsics['container']['accentColor'];
		/** Optional icon/thumbnail accessory */
		accessory?: Dui.Intrinsics['section']['accessory'];
		/** Child elements to append after body */
		children?: Dui.Child[];
	}

	/**
	 * A styled card component with title, description, body text, and optional footer.
	 */
	export const Card: Dui.ComponentType<CardProps> = (props) => {
		const bodyLines = Array.isArray(props.body) ? props.body : props.body ? [props.body] : [];
		const sectionText: Dui.Child[] = [
			Dui.createText(`## ${props.title}`),
			...(props.description ? [Dui.createText(props.description)] : []),
			...toTextNodes(bodyLines),
		];
		return Dui.createElement(
			'container',
			{ accentColor: props.accentColor },
			Dui.createElement('section', { accessory: props.accessory }, ...sectionText),
			...(props.children ?? []),
			...(props.footer
				? [
						Dui.createElement('separator', { spacing: SeparatorSpacingSize.Large, divider: false }),
						Dui.createText(`-# ${props.footer}`),
					]
				: []),
		);
	};

	/**
	 * Props for the ConfirmActions component.
	 * @see ConfirmActions
	 */
	export interface ConfirmActionsProps {
		/** Custom ID for the confirm button */
		confirmId: string;
		/** Custom ID for the cancel button */
		cancelId: string;
		/** Label for confirm button (default: "Confirm") */
		confirmLabel?: string;
		/** Label for cancel button (default: "Cancel") */
		cancelLabel?: string;
	}

	/**
	 * A two-button action row with Confirm (success, green) and Cancel (secondary) buttons.
	 *
	 * @example
	 * <ConfirmActions confirmId="setup:done" cancelId="setup:cancel" />
	 *
	 * @example
	 * <ConfirmActions
	 *   confirmId="delete:yes"
	 *   cancelId="delete:no"
	 *   confirmLabel="Delete"
	 *   cancelLabel="Keep"
	 * />
	 */
	export const ConfirmActions: Dui.ComponentType<ConfirmActionsProps> = (props) =>
		Dui.createElement(
			'actionRow',
			{},
			Dui.createElement('button', {
				customId: props.confirmId,
				label: props.confirmLabel ?? 'Confirm',
				style: ButtonStyle.Success,
			}),
			Dui.createElement('button', {
				customId: props.cancelId,
				label: props.cancelLabel ?? 'Cancel',
				style: ButtonStyle.Secondary,
			}),
		);

	/**
	 * A single label/value pair for display in a field list.
	 */
	export interface FieldListItem {
		/** Field label (bolded) */
		label: string;
		/** Field value */
		value: string;
	}

	/**
	 * Props for the FieldList component.
	 * @see FieldList
	 */
	export interface FieldListProps {
		/** Title (rendered as ## heading) */
		title: string;
		/** Array of label/value pairs to display */
		items: FieldListItem[];
		/** Text to show if items array is empty (default: "No items.") */
		emptyText?: string;
	}

	/**
	 * A titled list of label/value fields, one per section.
	 * Shows an empty-state message if the items list is empty.
	 * Useful for displaying structured data like settings, user info, or status.
	 */
	export const FieldList: Dui.ComponentType<FieldListProps> = (props) => {
		if (props.items.length === 0) {
			return Dui.createElement(
				'container',
				{},
				Dui.createText(`## ${props.title}`),
				Dui.createText(props.emptyText ?? 'No items.'),
			);
		}
		return Dui.createElement(
			'container',
			{},
			Dui.createText(`## ${props.title}`),
			...props.items.map((item) =>
				Dui.createElement('section', {}, Dui.createText(`**${item.label}**\n${item.value}`)),
			),
		);
	};

	/**
	 * Props for the ChoiceMenu component.
	 * @see ChoiceMenu
	 */
	export interface ChoiceMenuProps {
		/** Custom ID for the select menu */
		customId: string;
		/** Prompt text displayed above the menu */
		prompt: string;
		/** Array of SelectMenuOption objects (label, value, description, emoji, etc.) */
		options: Dui.StringSelectOption[];
		/** Minimum number of selections (Discord limit: 1-25) */
		minValues?: number;
		/** Maximum number of selections (Discord limit: 1-25) */
		maxValues?: number;
		/** Placeholder text shown when menu is collapsed */
		placeholder?: string;
	}

	/**
	 * A prompt text with a string select menu for letting users choose from a list.
	 * Supports multi-select, custom min/max values, and placeholders.
	 *
	 * @example
	 * <ChoiceMenu
	 *   customId="role:select"
	 *   prompt="Which role would you like?"
	 *   options={[\n	 *     { label: 'Admin', value: 'admin:admin' },\n	 *     { label: 'Mod', value: 'admin:mod' },\n	 *   ]}\n	 * />
	 *
	 * @example
	 * <ChoiceMenu
	 *   customId="tags:select"
	 *   prompt="Select categories (multi-select)"
	 *   options={[...]}\n	 *   minValues={1}\n	 *   maxValues={5}\n	 *   placeholder="Choose up to 5 tags"\n	 * />
	 */
	export const ChoiceMenu: Dui.ComponentType<ChoiceMenuProps> = (props) =>
		Dui.createElement(
			'container',
			{},
			Dui.createText(props.prompt),
			Dui.createElement(
				'actionRow',
				{},
				Dui.createElement('stringSelect', {
					customId: props.customId,
					placeholder: props.placeholder,
					minValues: props.minValues,
					maxValues: props.maxValues,
					options: props.options,
				}),
			),
		);

	export interface BannerAdProps {
		/** The advert content, can be markdown */
		content: string;
		/** The URL the advert points to */
		link: string;
		/** The URL of the advert's image. Optional */
		imageUrl?: string;
		/** The associated colour of the advert in one of Discord's colour options. Optional */
		colour: Dui.Intrinsics['container']['accentColor'];
		linkText?: string;
	}
	export const BannerAd: Dui.ComponentType<BannerAdProps> = (props) =>
		Dui.createElement(
			'container',
			{
				accentColor: props.colour,
			},
			Dui.h(
				'section',
				{
					accessory: Dui.h('button', {
						url: props.link,
						label: props.linkText ?? 'Learn More',
						style: ButtonStyle.Link,
					}),
				},
				Dui.createText(`-# ᴀᴅᴠᴇʀᴛɪꜱᴇᴍᴇɴᴛ\n${props.content}`),
			),
			props.imageUrl
				? Dui.createElement(
						'mediaGallery',
						{},
						Dui.createElement('mediaGalleryItem', {
							url: props.imageUrl,
							description: 'Advertisement image',
						}),
					)
				: [],
			Dui.createElement('separator', { spacing: SeparatorSpacingSize.Small, divider: true }),
			Dui.createText("-# Don't want to see ads? Run \`/set ads\` to disable them."),
		);
}
