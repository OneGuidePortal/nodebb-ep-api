'use strict';

const meta = require.main.require('./src/meta');
const socketAdmin = require.main.require('./src/socket.io/admin');
const winston = require.main.require('winston');
const { Client } = require('@elastic/elasticsearch');
const { getSettings, getMapping } = require('./src/Mapping/Mapping.js');
const Indexer = require('./src/Indexer');

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
				sniffOnStart: false,
				sniffOnConnectionFault: false,
				headers: {
					'x-elastic-product': 'Elasticsearch'
				}
			});

			let sanitizedUrl = settings.wordpress_url.replace(/(^\w+:|^)\/\//, '');
			sanitizedUrl = sanitizedUrl.replace(/[^a-zA-Z0-9]/g, '');

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
		},

		reindex: async (socket) => {
			try {
				await Indexer.reindexAll();
				return { message: 'Reindex initiated. Check server logs for progress.' };
			} catch (err) {
				winston.error(err);
				throw err;
			}
		},

		getStats: async (socket) => {
			try {
				const client = await Indexer.getClient();
				const indexName = await Indexer.getIndexName();
				if (!client || !indexName) return { error: 'Not configured' };

				const { body: exists } = await client.indices.exists({ index: indexName });
				if (!exists) return { error: 'Index does not exist' };

				const { body: stats } = await client.indices.stats({ index: indexName });
				return {
					index: indexName,
					docs: stats.indices[indexName].primaries.docs.count,
					store: stats.indices[indexName].primaries.store.size_in_bytes,
				};
			} catch (err) {
				winston.error(err);
				return { error: err.message };
			}
		},

		refresh: async (socket) => {
			try {
				const client = await Indexer.getClient();
				const indexName = await Indexer.getIndexName();
				if (!client || !indexName) return;

				await client.indices.refresh({ index: indexName });
				return { message: 'Index refreshed' };
			} catch (err) {
				winston.error(err);
				throw err;
			}
		},

		delete: async (socket) => {
			try {
				const client = await Indexer.getClient();
				const indexName = await Indexer.getIndexName();
				if (!client || !indexName) return;

				await client.indices.delete({ index: indexName });
				return { message: 'Index deleted' };
			} catch (err) {
				winston.error(err);
				throw err;
			}
		},

		dump: async (socket) => {
			try {
				const client = await Indexer.getClient();
				const indexName = await Indexer.getIndexName();
				if (!client || !indexName) return { error: 'Not configured' };

				const { body: response } = await client.search({
					index: indexName,
					size: 10000, // Limit to 10k for simple dump
					body: {
						query: {
							match_all: {}
						}
					}
				});

				const documents = response.hits.hits.map(hit => hit._source);
				return { documents };
			} catch (err) {
				winston.error(err);
				throw err;
			}
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

// Hook Implementations
plugin.onPostSave = async (data) => {
	await Indexer.indexPost(data.post);
};

plugin.onPostEdit = async (data) => {
	await Indexer.indexPost(data.post);
};

plugin.onPostDelete = async (data) => {
	await Indexer.deletePost(data.post.pid);
};

plugin.onPostRestore = async (data) => {
	await Indexer.indexPost(data.post);
};

plugin.onTopicSave = async (data) => {
	await Indexer.indexTopic(data.topic);
};

plugin.onTopicEdit = async (data) => {
	// data.topic might only contain changed fields, fetch full topic?
	// Indexer.indexTopic expects full object usually, but let's see. 
	// For now pass what we have, if transformation fails validation it's fine.
	// Better: re-fetch inside indexer or pass ID.
	// NodeBB hooks pass the object.
	await Indexer.indexTopic(data.topic);
};

plugin.onTopicDelete = async (data) => {
	// data.topic might be available
	await Indexer.deleteTopic(data.topic.tid);
};

plugin.onTopicRestore = async (data) => {
	await Indexer.indexTopic(data.topic);
};

module.exports = plugin;