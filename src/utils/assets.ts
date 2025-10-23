import { AttachmentBuilder } from 'discord.js';

export enum AssetId {
	DefaultGuildIcon = 'noguildicon.png',
}
export namespace Assets {
	export function getByName<N extends string>(name: N): `./assets/${N}` {
		return `./assets/${name}`;
	}
	export function getById<I extends AssetId>(id: I): `./assets/${I}` {
		return `./assets/${id}`;
	}
	export function getAsFile(name: string | AssetId): AttachmentBuilder {
		return new AttachmentBuilder(getByName(name));
	}
}
