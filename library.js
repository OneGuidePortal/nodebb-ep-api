'use strict';

const meta = require.main.require('./src/meta');
const socketAdmin = require.main.require('./src/socket.io/admin');
const winston = require.main.require('winston');
const { Client } = require('@elastic/elasticsearch');
const { getSettings, getMapping } = require('./src/Mapping/NobelPrizeMapping.js');

const plugin = {};

plugin.init = async (params) => {
	const { router, middleware, controllers } = params;

	const renderAdmin = (req, res) => {
		res.render('admin/plugins/ep-api', {
			title: 'ElasticPress API',
		});
	};

	router.get('/admin/plugins/ep-api', middleware.admin.buildHeader, renderAdmin);
	router.get('/api/admin/plugins/ep-api', renderAdmin);

	socketAdmin.plugins.epApi = {
		setup: async (socket) => {
			winston.info('[ep-api] Starting setup process...');
			const settings = await meta.settings.get('ep-api');
			
			if (!settings.host || !settings.subscription_id || !settings.subscription_token || !settings.wordpress_url || !settings.wordpress_site_id) {
				winston.error('[ep-api] Setup failed: Missing settings');
				throw new Error('Please configure and save all settings first.');
			}

			winston.info('[ep-api] Connecting to Elasticsearch at: ' + settings.host);
			const client = new Client({
				node: settings.host,
				auth: {
					username: settings.subscription_id,
					password: settings.subscription_token,
				},
			});

			// Sanitize WordPress URL: remove protocol and special chars
			let sanitizedUrl = settings.wordpress_url.replace(/(^\w+:|^)\/\//, ''); // Remove protocol
			sanitizedUrl = sanitizedUrl.replace(/[^a-zA-Z0-9]/g, ''); // Remove non-alphanumeric

			const indexName = `${settings.subscription_id}-${sanitizedUrl}-forums-${settings.wordpress_site_id}`;

			winston.info('[ep-api] Checking if index exists: ' + indexName);
			const { body: indexExists } = await client.indices.exists({ index: indexName });

			if (indexExists) {
				winston.info('[ep-api] Index exists, deleting...');
				await client.indices.delete({ index: indexName });
				winston.info('[ep-api] Index deleted successfully');
			}

			winston.info('[ep-api] Creating index with mappings...');
			await client.indices.create({
				index: indexName,
				body: {
					settings: getSettings(),
					mappings: getMapping(),
				},
			});

			winston.info('[ep-api] Setup complete for index: ' + indexName);
			return { indexName };
		}
	};
};

plugin.addAdminNavigation = async (header) => {
	header.plugins.push({
		route: '/plugins/ep-api',
		icon: 'fa-search',
		name: 'ElasticPress API',
	});
	return header;
};

module.exports = plugin;
