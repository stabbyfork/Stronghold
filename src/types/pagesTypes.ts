//#region Pages

import { ContainerBuilder } from 'discord.js';

export type Page = ContainerBuilder;
export type CreatePageFunction = (index: number, itemsPerPage: number) => Promise<Page>;

//#endregion
