/*!
 * V4Fire Client Core
 * https://github.com/V4Fire/Client
 *
 * Released under the MIT license
 * https://github.com/V4Fire/Client/blob/master/LICENSE
 */

// tslint:disable:max-file-line-count

import $C = require('collection.js');

import log from 'core/log';
import Async from 'core/async';

import Vue, { ComponentOptions, FunctionalComponentOptions } from 'vue';
import { ComponentField, ComponentMeta, VueInterface } from 'core/component';
import { GLOBAL } from 'core/const/links';

export interface ComponentConstructor<T = any> {
	new(): T;
}

export const
	defaultWrapper = Symbol('Default wrapper'),
	vueProto = {};

{
	const
		obj = Vue.prototype;

	for (const key in obj) {
		if (key.length === 2) {
			vueProto[key] = obj[key];
		}
	}
}

/**
 * Returns an object for the Vue component
 *
 * @param constructor
 * @param meta
 */
export function getComponent(
	constructor: ComponentConstructor,
	meta: ComponentMeta
): ComponentOptions<Vue> | FunctionalComponentOptions<Vue> {
	const
		p = meta.params,
		m = p.model;

	if (p.functional === true) {
		return getFunctionalComponent(constructor, meta);
	}

	const
		{component, instance} = getBaseComponent(constructor, meta),
		{methods} = meta;

	return {
		...<any>component,

		parent: p.parent,
		inheritAttrs: p.inheritAttrs,
		provide: p.provide,
		inject: p.inject,

		model: m && {
			prop: m.prop,
			model: m.event && m.event.dasherize()
		},

		data(): Dictionary {
			const
				ctx = <any>this,
				data = ctx.$$data;

			initDataObject(meta.fields, ctx, instance, data);
			runHook('beforeDataCreate', ctx.meta, ctx).catch(stderr);

			ctx.$$data = this;
			return data;
		},

		beforeCreate(): void {
			const
				ctx = <any>this;

			let
				p = ctx.$parent;

			while (p && p.isFunctional) {
				p = p.$parent;
			}

			ctx.$$data = {};
			ctx.$normalParent = p;
			ctx.$async = new Async(this);
			ctx.instance = instance;
			ctx.componentName = meta.name;
			ctx.meta = createMeta(meta);

			runHook('beforeRuntime', ctx.meta, ctx)
				.catch(stderr);

			for (let o = meta.accessors, keys = Object.keys(o), i = 0; i < keys.length; i++) {
				const
					key = keys[i],
					el = o[key];

				Object.defineProperty(ctx, keys[i], {
					get: el.get,
					set: el.set
				});
			}

			initDataObject(
				meta.systemFields,
				ctx,
				instance,
				ctx
			);

			runHook('beforeCreate', meta, ctx).then(async () => {
				if (methods.beforeCreate) {
					await methods.beforeCreate.fn.call(ctx);
				}
			}, stderr);

			bindWatchers(ctx);
		},

		created(): void {
			this.hook = 'created';
			bindWatchers(this);

			runHook('created', this.meta, this).then(async () => {
				if (methods.created) {
					await methods.created.fn.call(this);
				}
			}, stderr);
		},

		beforeMount(): void {
			runHook('beforeMount', this.meta, this).then(async () => {
				if (methods.beforeMount) {
					await methods.beforeMount.fn.call(this);
				}
			}, stderr);
		},

		mounted(): void {
			this.$el.vueComponent = this;
			this.hook = 'mounted';
			bindWatchers(this);

			runHook('mounted', this.meta, this).then(async () => {
				if (methods.mounted) {
					await methods.mounted.fn.call(this);
				}
			}, stderr);
		},

		beforeUpdate(): void {
			runHook('beforeUpdate', this.meta, this).then(async () => {
				if (methods.beforeUpdate) {
					await methods.beforeUpdate.fn.call(this);
				}
			}, stderr);
		},

		updated(): void {
			runHook('updated', this.meta, this).then(async () => {
				if (methods.updated) {
					await methods.updated.fn.call(this);
				}
			}, stderr);
		},

		activated(): void {
			runHook('activated', this.meta, this).then(async () => {
				if (methods.activated) {
					await methods.activated.fn.call(this);
				}
			}, stderr);
		},

		deactivated(): void {
			runHook('deactivated', this.meta, this).then(async () => {
				if (methods.deactivated) {
					await methods.deactivated.fn.call(this);
				}
			}, stderr);
		},

		beforeDestroy(): void {
			this.$async.clearAll();
			runHook('beforeDestroy', this.meta, this).then(async () => {
				if (methods.beforeDestroy) {
					await methods.beforeDestroy.fn.call(this);
				}
			}, stderr);
		},

		destroyed(): void {
			runHook('destroyed', this.meta, this).then(async () => {
				if (methods.destroyed) {
					await methods.destroyed.fn.call(this);
				}
			}, stderr);
		},

		errorCaptured(): void {
			const
				args = arguments;

			runHook('errorCaptured', this.meta, this, ...args).then(async () => {
				if (methods.errorCaptured) {
					await methods.errorCaptured.fn.apply(this, args);
				}
			}, stderr);
		}
	};
}

/**
 * Returns an object for the Vue functional component
 *
 * @param constructor
 * @param meta
 */
export function getFunctionalComponent(
	constructor: ComponentConstructor,
	meta: ComponentMeta
): FunctionalComponentOptions<Vue> {
	const
		{component, instance} = getBaseComponent(constructor, meta),
		{params: p} = meta;

	const
		props = {};

	component.ctx = Object.assign(Object.create(vueProto), {
		meta,
		instance,
		componentName: meta.componentName,
		$options: {}
	});

	for (let o = component.props, keys = Object.keys(o), i = 0; i < keys.length; i++) {
		const
			key = keys[i],
			el = o[key],
			prop = props[key] = {...el};

		if (Object.isFunction(el.default) && !el.default[defaultWrapper]) {
			prop.default = undefined;
		}
	}

	return <any>{
		props,
		name: meta.name,
		functional: true,
		inject: p.inject,
		render: component.render
	};
}

/**
 * Creates new meta object with the specified parent
 * @param parent
 */
export function createMeta(parent: ComponentMeta): ComponentMeta {
	const meta = Object.assign(Object.create(parent), {
		watchers: {},
		hooks: {}
	});

	for (let o = meta.hooks, p = parent.hooks, keys = Object.keys(p), i = 0; i < keys.length; i++) {
		const key = keys[i];
		o[key] = p[key].slice();
	}

	for (let o = meta.watchers, p = parent.watchers, keys = Object.keys(p), i = 0; i < keys.length; i++) {
		const key = keys[i];
		o[key] = p[key].slice();
	}

	return meta;
}

const
	customWatcherRgxp = /^([!?]?)([^!?:]*):(.*)/;

/**
 * Binds watchers to the specified component
 * @param ctx - component context
 */
export function bindWatchers(ctx: VueInterface): void {
	const
		// @ts-ignore
		{meta, hook, $async: $a} = ctx;

	if (!{beforeCreate: true, created: true, mounted: true}[hook]) {
		return;
	}

	const
		ctxObj = $C(ctx),
		globalObj = $C(GLOBAL);

	const
		isBeforeCreate = hook === 'beforeCreate',
		isCreated = hook === 'created',
		isMounted = hook === 'mounted';

	for (let o = meta.watchers, keys = Object.keys(o), i = 0; i < keys.length; i++) {
		let
			key = keys[i],
			onBeforeCreate = false,
			onMounted = false,
			root = <any>ctx;

		const
			watchers = o[key],
			customWatcher = customWatcherRgxp.exec(key);

		if (customWatcher) {
			const
				m = customWatcher[1],
				l = customWatcher[2];

			onBeforeCreate = m === '!';
			onMounted = m === '?';

			root = l ? ctxObj.get(l) || globalObj.get(l) || ctx : ctx;
			key = customWatcher[3][l ? 'toString' : 'dasherize']();
		}

		if (
			isBeforeCreate && !onBeforeCreate ||
			isCreated && (onMounted || onBeforeCreate) ||
			isMounted && !onMounted
		) {
			continue;
		}

		for (let i = 0; i < watchers.length; i++) {
			const
				el = watchers[i];

			let
				label = el.method != null ? el.method : undefined,
				f;

			let handler = f = el.method ? el.handler : (...args) => {
				const
					fn = el.handler;

				if (Object.isString(fn)) {
					label = fn;

					if (!Object.isFunction(ctx[fn])) {
						throw new ReferenceError(`The specified method (${fn}) for watching is not defined`);
					}

					// @ts-ignore
					$a.setImmediate(() => ctx[fn](...args), {
						group: 'watchers',
						label: fn
					});

				} else {
					label = fn.name;

					if (el.provideArgs === false) {
						fn();

					} else {
						fn(ctx, ...args);
					}
				}
			};

			label = label ?
				`[[WATCHER:${key}:${label}]]` : undefined;

			if (el.provideArgs === false) {
				const l = handler;
				handler = () => l.call(ctx);

			} else {
				handler = handler.bind(ctx);
			}

			if (el.wrapper) {
				handler = <any>el.wrapper(ctx, handler);
			}

			(async () => {
				const
					group = {group: el.group, label},
					eventParams = {...group, options: el.options, single: el.single};

				const
					needDefEmitter = root === ctx && !Object.isFunction(root.on) && !Object.isFunction(root.addListener);

				if (Object.isPromise(handler)) {
					handler = await $a.promise(handler, group);
				}

				if (customWatcher) {
					if (needDefEmitter) {
						// @ts-ignore
						ctx.$on(key, handler);

					} else {
						$a.on(root, key, handler, eventParams, ...el.args);
					}

					return;
				}

				// @ts-ignore
				ctx.$watch(key, {
					deep: el.deep,
					immediate: el.immediate,
					handler
				});
			})();
		}
	}
}

/**
 * Initializes fields to the specified data object and returns it
 *
 * @param fields
 * @param ctx - component context
 * @param instance - component class instance
 * @param [data] - data object
 */
export function initDataObject(
	fields: Dictionary<ComponentField>,
	ctx: Dictionary,
	instance: Dictionary,
	data: Dictionary = {}
): Dictionary {
	const
		queue = new Set();

	while (true) {
		const
			o = fields,
			fieldList = <string[]>[];

		for (let keys = Object.keys(fields), i = 0; i < keys.length; i++) {
			const
				key = keys[i],
				el = o[key];

			if (el.atom || !el.init && (el.default !== undefined || key in instance)) {
				fieldList.unshift(key);

			} else {
				fieldList.push(key);
			}
		}

		for (let i = 0; i < fieldList.length; i++) {
			const
				key = ctx.$activeField = fieldList[i],
				el = o[key];

			if (key in data) {
				continue;
			}

			const initVal = () => {
				queue.delete(key);

				let
					val;

				if (el.init) {
					val = el.init(<any>ctx, data);
				}

				// tslint:disable-next-line
				if (val === undefined) {
					if (data[key] === undefined) {
						val = el.default !== undefined ? el.default : Object.fastClone(instance[key]);
						data[key] = val;
					}

				} else {
					data[key] = val;
				}
			};

			if (el.after.size) {
				let
					res = true;

				for (let o = el.after.values(), val = o.next(); !val.done; val = o.next()) {
					if (!(val.value in data)) {
						queue.add(key);
						res = false;
						break;
					}
				}

				if (res) {
					initVal();
				}

			} else {
				initVal();
			}
		}

		if (!queue.size) {
			break;
		}
	}

	return data;
}

/**
 * Runs a hook from the specified meta object
 *
 * @param hook
 * @param meta
 * @param ctx - link to context
 * @param args - event arguments
 */
export async function runHook(hook: string, meta: ComponentMeta, ctx: Dictionary, ...args: any[]): Promise<void> {
	ctx.hook = hook;

	if (ctx.log) {
		ctx.log(`hook:${hook}`, ...args);

	} else {
		log(`component:hook:${meta.componentName}:${hook}`, ...args, ctx);
	}

	if (!meta.hooks[hook].length) {
		return;
	}

	const event = {
		queue: [] as Function[],
		events: {} as Dictionary<{event: Set<string>; cb: Function}[]>,

		on(event: Set<string> | undefined, cb: Function): void {
			if (event && event.size) {
				for (let v = event.values(), el = v.next(); !el.done; el = v.next()) {
					this.events[el.value] = this.events[el.value] || [];
					this.events[el.value].push({event, cb});
				}

				return;
			}

			this.queue.push(cb);
		},

		async emit(event: string): Promise<void> {
			if (!this.events[event]) {
				return;
			}

			const
				tasks = <any[]>[];

			for (let o = this.events[event], i = 0; i < o.length; i++) {
				const
					el = o[i];

				if (!el.event.delete(event).size) {
					tasks.push(el.cb());
				}
			}

			await Promise.all(tasks);
		},

		async fire(): Promise<void> {
			const
				tasks = <any[]>[];

			for (let i = 0; i < this.queue.length; i++) {
				tasks.push(this.queue[i]());
			}

			await Promise.all(tasks);
		}
	};

	for (let hooks = meta.hooks[hook], i = 0; i < hooks.length; i++) {
		const
			el = hooks[i];

		event.on(el.after, async () => {
			await el.fn.apply(ctx, args);
			await event.emit(el.name || Math.random().toString());
		});
	}

	await event.fire();
}

/**
 * Returns a base component object from the specified constructor
 *
 * @param constructor
 * @param meta
 */
export function getBaseComponent(
	constructor: ComponentConstructor,
	meta: ComponentMeta
): {
	mods: Dictionary<string | undefined>;
	component: ComponentMeta['component'];
	instance: Dictionary;
} {
	addMethodsToMeta(constructor, meta);

	const
		{component, methods, watchers, hooks} = meta,
		instance = new constructor();

	for (let o = methods, keys = Object.keys(o), i = 0; i < keys.length; i++) {
		const
			nm = keys[i],
			method = o[nm];

		component.methods[nm] =
			method.fn;

		for (let o = method.watchers, keys = Object.keys(o), i = 0; i < keys.length; i++) {
			const
				key = keys[i],
				el = o[key];

			watchers[key] = watchers[key] || [];
			watchers[key].push({
				method: nm,
				group: el.group,
				single: el.single,
				options: el.options,
				args: [].concat(el.args || []),
				provideArgs: el.provideArgs,
				deep: el.deep,
				immediate: el.immediate,
				wrapper: el.wrapper,
				handler: <any>method.fn
			});
		}

		for (let o = method.hooks, keys = Object.keys(o), i = 0; i < keys.length; i++) {
			const
				key = keys[i],
				el = o[key];

			hooks[key].push({
				name: el.name,
				fn: method.fn,
				after: el.after
			});
		}
	}

	for (let o = meta.computed, keys = Object.keys(o), i = 0; i < keys.length; i++) {
		const key = keys[i];
		component.computed[key] = o[key];
	}

	for (let o = meta.props, keys = Object.keys(o), i = 0; i < keys.length; i++) {
		const
			key = keys[i],
			prop = o[key],
			def = instance[key];

		const cloneDef = () => Object.fastClone(def);
		cloneDef[defaultWrapper] = true;

		component.props[key] = {
			type: prop.type,
			required: prop.required,
			validator: prop.validator,
			default: prop.default !== undefined ? prop.default : prop.type === Function ? def : cloneDef
		};

		watchers[key] = watchers[key] || [];
		for (let w = prop.watchers.values(), el = w.next(); !el.done; el = w.next()) {
			const
				val = el.value;

			watchers[key].push({
				deep: val.deep,
				immediate: val.immediate,
				provideArgs: val.provideArgs,
				handler: val.fn
			});
		}
	}

	for (let o = meta.fields, keys = Object.keys(o), i = 0; i < keys.length; i++) {
		const
			key = keys[i],
			field = o[key];

		for (let w = field.watchers.values(), el = w.next(); !el.done; el = w.next()) {
			const
				val = el.value;

			watchers[key] = watchers[key] || [];
			watchers[key].push({
				deep: val.deep,
				immediate: val.immediate,
				provideArgs: val.provideArgs,
				handler: val.fn
			});
		}
	}

	const
		mods = component.mods;

	for (let o = meta.mods, keys = Object.keys(o), i = 0; i < keys.length; i++) {
		const
			key = keys[i],
			mod = o[key];

		let def;
		if (mod) {
			for (let i = 0; i < mod.length; i++) {
				const
					el = mod[i];

				if (Object.isArray(el)) {
					def = el;
					break;
				}
			}

			mods[key] = def ? String(def[0]) : undefined;
		}
	}

	return {mods, component, instance};
}

/**
 * Iterates the specified constructor prototype and adds methods/accessors to the meta object
 *
 * @param constructor
 * @param meta
 */
export function addMethodsToMeta(constructor: Function, meta: ComponentMeta): void {
	const
		proto = constructor.prototype,
		ownProps = Object.getOwnPropertyNames(proto);

	for (let i = 0; i < ownProps.length; i++) {
		const
			key = ownProps[i];

		if (key === 'constructor') {
			continue;
		}

		const
			desc = <PropertyDescriptor>Object.getOwnPropertyDescriptor(proto, key);

		if ('value' in desc) {
			const
				fn = desc.value;

			if (!Object.isFunction(fn)) {
				continue;
			}

			// tslint:disable-next-line
			meta.methods[key] = Object.assign(meta.methods[key] || {watchers: {}, hooks: {}}, {fn});

		} else {
			const
				field = meta.props[key] ? meta.props : meta.fields[key] ? meta.fields : meta.systemFields,
				metaKey = key in meta.accessors ? 'accessors' : 'computed',
				obj = meta[metaKey];

			if (field[key]) {
				Object.defineProperty(proto, key, {
					writable: true,
					configurable: true,
					value: undefined
				});

				delete field[key];
			}

			const
				old = obj[key],
				set = desc.set || old && old.set,
				get = desc.get || old && old.get;

			if (set) {
				const
					k = `${key}Setter`;

				proto[k] = set;
				meta.methods[k] = {
					fn: set,
					watchers: {},
					hooks: {}
				};
			}

			if (get) {
				const
					k = `${key}Getter`;

				proto[k] = get;
				meta.methods[k] = {
					fn: get,
					watchers: {},
					hooks: {}
				};
			}

			Object.assign(obj, {
				[key]: {
					get: desc.get || old && old.get,
					set
				}
			});
		}
	}
}