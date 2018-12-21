'use strict';

/*!
 * V4Fire Client Core
 * https://github.com/V4Fire/Client
 *
 * Released under the MIT license
 * https://github.com/V4Fire/Client/blob/master/LICENSE
 */

const
	path = require('path');

const
	link = `V4_MODULES_${Number.random(1e6)}`,
	skipFileRgxp = /\/src\/core\/modules.ts$/,
	componentRgxp = /^bgp-/;

/**
 * Monic replacer for module initializing
 *
 * @param {string} str
 * @param {string} file
 * @returns {string}
 */
module.exports = function (str, file) {
	if (skipFileRgxp.test(file)) {
		return str;
	}

	let
		fname = path.basename(file, path.extname(file));

	if (fname === 'index') {
		fname = path.basename(path.dirname(file));
	}

	if (!componentRgxp.test(fname)) {
		return str;
	}

	return `
// @ts-ignore
import ${link} from 'core/modules';
${link}.push('${fname}');

${str}
${link}.pop();
`
};
