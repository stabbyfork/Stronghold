//#region Pages

import { AttachmentBuilder, ContainerBuilder } from 'discord.js';

export type Page = ContainerBuilder;
export type CreatePageFunction = (index: number, itemsPerPage: number, files: AttachmentBuilder[]) => Promise<Page>;

//#endregion
