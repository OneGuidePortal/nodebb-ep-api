'use strict';

const plugin = {};

plugin.init = async (params) => {
	const { router, middleware, controllers } = params;

	console.log('NodeBB ElasticPress API Plugin Initialized');

	// We can add routes here later if needed
};

module.exports = plugin;
