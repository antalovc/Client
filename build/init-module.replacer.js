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
	skipRgxp = /\/src\/core\/modules.ts$/;

/**
 * Monic replacer for module initializing
 *
 * @param {string} str
 * @param {string} file
 * @returns {string}
 */
module.exports = function (str, file) {
	if (skipRgxp.test(file)) {
		return str;
	}

	let
		fname = path.basename(file, path.extname(file));

	if (fname === 'index') {
		fname = path.basename(path.dirname(file));
	}

	return `
// @ts-ignore
import ${link} from 'core/modules';
${link}.push({name: '${fname}', path: '${file}'});

${str}
${link}.pop();
`
};
