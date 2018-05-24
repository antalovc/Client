/*!
 * V4Fire Client Core
 * https://github.com/V4Fire/Client
 *
 * Released under the MIT license
 * https://github.com/V4Fire/Client/blob/master/LICENSE
 */

import $C = require('collection.js');
import iBlock, { VueElement, ModsTable } from 'super/i-block/i-block';
import { EventEmitter2 as EventEmitter } from 'eventemitter2';

/**
 * Enum of available block statuses
 */
export enum statuses {
	destroyed = -1,
	inactive = 0,
	loading = 1,
	beforeReady = 2,
	ready = 3,
	unloaded = 0
}

export type Reason =
	'initSetMod' |
	'setMod' |
	'removeMod';

/**
 * Base class for BEM like develop
 */
export default class Block<T extends iBlock = iBlock> {
	/**
	 * Current block name
	 */
	readonly blockName: string;

	/**
	 * Link to a block node
	 */
	readonly node: VueElement<T>;

	/**
	 * Vue component
	 */
	readonly component: T;

	/**
	 * Local event emitter
	 */
	readonly event: EventEmitter;

	/**
	 * List of applied modifiers
	 */
	readonly mods: Dictionary<string | undefined>;

	/**
	 * Map of available block statuses
	 */
	readonly statuses: typeof statuses = statuses;

	/**
	 * Block init status
	 */
	protected blockStatus: number = statuses.unloaded;

	/**
	 * Sets a new status to the current block
	 * @param value
	 */
	set status(value: number) {
		if (this.blockStatus === value) {
			return;
		}

		this.blockStatus = value = value in this.statuses ? value : 0;

		const
			stringStatus = this.statuses[value];

		// @ts-ignore
		this.component.componentStatus = stringStatus;
		this.event.emit(`block.status.${stringStatus}`, value);
		this.component.emit(`status-${stringStatus}`, value);
	}

	/**
	 * Current block status
	 */
	get status(): number {
		return this.blockStatus;
	}

	/**
	 * @param component - component instance
	 */
	constructor(component: T) {
		this.blockName = component.componentName;
		this.mods = Object.createDict();
		this.component = component;

		// @ts-ignore
		this.event = component.localEvent;

		// @ts-ignore
		this.node = component.$el;
		this.node.classList.add(this.blockName, 'i-block-helper');

		this.event.once('block.status.loading', () => {
			const
				m = component.mods;

			for (let keys = Object.keys(m), i = 0; i < keys.length; i++) {
				const name = keys[i];
				this.setMod(name, m[name], 'initSetMod');
			}
		});

		// @ts-ignore
		component.async.setImmediate(() => this.status = this.statuses.loading);
	}

	/**
	 * Returns a full name of the current block
	 *
	 * @param [modName]
	 * @param [modValue]
	 */
	getFullBlockName(modName?: string, modValue?: any): string {
		return this.blockName + (modName ? `_${modName.dasherize()}_${String(modValue).dasherize()}` : '');
	}

	/**
	 * Returns a full name of the specified element
	 *
	 * @param elName
	 * @param [modName]
	 * @param [modValue]
	 */
	getFullElName(elName: string, modName?: string, modValue?: any): string {
		const modStr = modName ? `_${modName.dasherize()}_${String(modValue).dasherize()}` : '';
		return `${this.blockName}__${elName.dasherize()}${modStr}`;
	}

	/**
	 * Returns CSS selector for the specified element
	 *
	 * @param elName
	 * @param [mods]
	 */
	getElSelector(elName: string, mods?: ModsTable): string {
		const
			sel = `.${this.getFullElName(elName)}`;

		let
			res = `${sel}.${this.component.componentId}`;

		if (mods) {
			for (let keys = Object.keys(mods), i = 0; i < keys.length; i++) {
				const name = keys[i];
				res += `${sel}_${name}_${mods[name]}`;
			}
		}

		return res;
	}

	/**
	 * Returns block child elements by the specified request
	 *
	 * @param elName
	 * @param [mods]
	 */
	elements<E extends Element = Element>(elName: string, mods?: ModsTable): NodeListOf<E> {
		return this.node.querySelectorAll(this.getElSelector(elName, mods));
	}

	/**
	 * Returns a child element by the specified request
	 *
	 * @param elName
	 * @param [mods]
	 */
	element<E extends Element = Element>(elName: string, mods?: ModsTable): E | null {
		return this.node.querySelector(this.getElSelector(elName, mods));
	}

	/**
	 * Sets a block modifier
	 *
	 * @param name
	 * @param value
	 * @param [reason]
	 */
	setMod(name: string, value: any, reason: Reason = 'setMod'): boolean {
		if (value === undefined) {
			return false;
		}

		name = name.camelize(false);
		value = String(value).dasherize();

		const
			prev = this.mods[name];

		if (prev !== value) {
			this.removeMod(name, undefined, 'setMod');
			this.mods[name] = value;

			if (reason !== 'initSetMod') {
				this.node.classList.add(this.getFullBlockName(name, value));
			}

			const event = {
				event: 'block.mod.set',
				type: 'set',
				name,
				value,
				prev,
				reason
			};

			this.event.emit(`block.mod.set.${name}.${value}`, event);
			this.component.emit(`mod_set_${name}_${value}`, event);
			return true;
		}

		return false;
	}

	/**
	 * Removes a block modifier
	 *
	 * @param name
	 * @param [value]
	 * @param [reason]
	 */
	removeMod(name: string, value?: any, reason: Reason = 'removeMod'): boolean {
		name = name.camelize(false);
		value = value !== undefined ? String(value).dasherize() : undefined;

		const
			current = this.mods[name];

		if (current !== undefined && (value === undefined || current === value)) {
			this.mods[name] = undefined;
			this.node.classList.remove(this.getFullBlockName(name, current));

			const event = {
				event: 'block.mod.remove',
				type: 'remove',
				name,
				value: current,
				reason
			};

			this.event.emit(`block.mod.remove.${name}.${current}`, event);
			this.component.emit(`mod_remove_${name}_${current}`, event);
			return true;
		}

		return false;
	}

	/**
	 * Returns a value of the specified block modifier
	 * @param mod
	 */
	getMod(mod: string): string | undefined {
		return this.mods[mod.camelize(false)];
	}

	/**
	 * Sets a modifier to the specified element
	 *
	 * @param link - link to the element
	 * @param elName
	 * @param modName
	 * @param value
	 */
	setElMod(link: Element, elName: string, modName: string, value: any): boolean {
		if (value === undefined) {
			return false;
		}

		elName = elName.camelize(false);
		modName = modName.camelize(false);
		value = String(value).dasherize();

		if (this.getElMod(link, elName, modName) !== value) {
			this.removeElMod(link, elName, modName, undefined, 'setMod');
			link.classList.add(this.getFullElName(elName, modName, value));

			this.event.emit(`el.mod.set.${elName}.${modName}.${value}`, {
				element: elName,
				event: 'el.mod.set',
				type: 'set',
				link,
				modName,
				value
			});

			return true;
		}

		return false;
	}

	/**
	 * Removes a modifier from the specified element
	 *
	 * @param link - link to the element
	 * @param elName
	 * @param modName
	 * @param [value]
	 * @param [reason]
	 */
	removeElMod(link: Element, elName: string, modName: string, value?: any, reason: Reason = 'removeMod'): boolean {
		elName = elName.camelize(false);
		modName = modName.camelize(false);
		value = value !== undefined ? String(value).dasherize() : undefined;

		const
			current = this.getElMod(link, elName, modName);

		if (current !== undefined && (value === undefined || current === value)) {
			link.classList.remove(this.getFullElName(elName, modName, current));
			this.event.emit(`el.mod.remove.${elName}.${modName}.${current}`, {
				element: elName,
				event: 'el.mod.remove',
				type: 'remove',
				link,
				modName,
				value: current,
				reason
			});

			return true;
		}

		return false;
	}

	/**
	 * Returns a value of a modifier from the specified element
	 *
	 * @param link - link to the element
	 * @param elName
	 * @param modName
	 */
	getElMod(link: Element, elName: string, modName: string): string | undefined {
		const
			MOD_VALUE = 3;

		const
			rgxp = new RegExp(`^${this.getFullElName(elName)}_${modName}_`),
			el = $C(link.classList).one.get((el) => rgxp.test(el));

		return el && el.split(/_+/)[MOD_VALUE];
	}
}
