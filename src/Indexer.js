'use strict';

const winston = require.main.require('winston');
const { Client } = require('@elastic/elasticsearch');
const meta = require.main.require('./src/meta');
const topics = require.main.require('./src/topics');
const posts = require.main.require('./src/posts');
const batch = require.main.require('./src/batch');

class BulkIndexer {
	constructor() {
		this.client = null;
		this.batchSize = 500;
	}

	async getClient() {
		if (this.client) {
			return this.client;
		}

		const settings = await meta.settings.get('ep-api');
		if (!settings.host || !settings.subscription_id || !settings.subscription_token) {
			return null;
		}

		this.client = new Client({
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

		return this.client;
	}

	async getIndexName() {
		const settings = await meta.settings.get('ep-api');
		if (!settings.wordpress_url || !settings.wordpress_site_id) {
			return null;
		}

		let sanitizedUrl = settings.wordpress_url.replace(/(^\w+:|^)\/\//, '');
		sanitizedUrl = sanitizedUrl.replace(/[^a-zA-Z0-9]/g, '');

		return `${settings.subscription_id}-${sanitizedUrl}-forums-${settings.wordpress_site_id}`;
	}

	/**
	 * Mimics BulkIndexer.php indexDocuments
	 */
	async indexDocuments(indexName, documents, idField = 'id') {
		const client = await this.getClient();
		if (!client) return;

		winston.info(`[ep-api] Indexing ${documents.length} documents to '${indexName}'...`);

		const batches = [];
		for (let i = 0; i < documents.length; i += this.batchSize) {
			batches.push(documents.slice(i, i + this.batchSize));
		}

		let successful = 0;
		let failed = 0;

		for (const batchDocs of batches) {
			const ndjson = [];
			
			for (const doc of batchDocs) {
				const action = { index: {} };
				if (idField && doc[idField]) {
					action.index._id = doc[idField];
				}
				ndjson.push(JSON.stringify(action));
				ndjson.push(JSON.stringify(doc));
			}

			try {
				const { body: response } = await client.bulk({
					index: indexName,
					body: ndjson.join('\n') + '\n',
				});

				if (response.errors) {
					response.items.forEach((item) => {
						if (item.index && item.index.error) {
							failed++;
							winston.error(`[ep-api] Indexing error: ${JSON.stringify(item.index.error)}`);
						} else {
							successful++;
						}
					});
				} else {
					successful += batchDocs.length;
				}
			} catch (err) {
				winston.error(`[ep-api] Batch failed: ${err.message}`);
				failed += batchDocs.length;
			}
		}

		winston.info(`[ep-api] Indexing complete: ${successful} successful, ${failed} failed`);
		return { successful, failed };
	}

	async deleteDocuments(indexName, ids) {
		const client = await this.getClient();
		if (!client) return;

		const ndjson = ids.flatMap(id => [
			JSON.stringify({ delete: { _index: indexName, _id: id } })
		]);

		if (ndjson.length === 0) return;

		try {
			await client.bulk({
				index: indexName,
				body: ndjson.join('\n') + '\n',
			});
			winston.info(`[ep-api] Deleted ${ids.length} documents from ${indexName}`);
		} catch (err) {
			winston.error(`[ep-api] Delete failed: ${err.message}`);
		}
	}

	// Data Transformation
	async transformPost(postData) {
		// Fetch topic to get category and title context
		const topic = await topics.getTopicData(postData.tid);
		if (!topic) return null;

		return {
			id: `post-${postData.pid}`,
			type: 'post',
			pid: postData.pid,
			tid: postData.tid,
			content: postData.content,
			timestamp: postData.timestamp,
			uid: postData.uid,
			title: topic.title, // Include topic title for context
			category_id: topic.cid,
			url: `/post/${postData.pid}`
		};
	}

	async transformTopic(topicData) {
		return {
			id: `topic-${topicData.tid}`,
			type: 'topic',
			tid: topicData.tid,
			title: topicData.title,
			timestamp: topicData.timestamp,
			uid: topicData.uid,
			category_id: topicData.cid,
			view_count: topicData.viewcount,
			post_count: topicData.postcount,
			url: `/topic/${topicData.slug}`
		};
	}

	// Real-time Indexing Methods
	async indexPost(postData) {
		const indexName = await this.getIndexName();
		if (!indexName) return;

		const doc = await this.transformPost(postData);
		if (doc) {
			await this.indexDocuments(indexName, [doc]);
		}
	}

	async deletePost(pid) {
		const indexName = await this.getIndexName();
		if (!indexName) return;
		await this.deleteDocuments(indexName, [`post-${pid}`]);
	}

	async indexTopic(topicData) {
		const indexName = await this.getIndexName();
		if (!indexName) return;

		const doc = await this.transformTopic(topicData);
		if (doc) {
			await this.indexDocuments(indexName, [doc]);
		}
	}

	async deleteTopic(tid) {
		const indexName = await this.getIndexName();
		if (!indexName) return;
		await this.deleteDocuments(indexName, [`topic-${tid}`]);
	}

	async reindexAll() {
		const indexName = await this.getIndexName();
		if (!indexName) {
			throw new Error('Index name could not be generated. Check settings.');
		}

		winston.info('[ep-api] Starting full reindex...');

		// Index Topics
		winston.info('[ep-api] Indexing topics...');
		await batch.processSortedSet('topics:tid', async (tids) => {
			const topicData = await topics.getTopicsFields(tids, []);
			const documents = [];
			for (const topic of topicData) {
				if (topic) {
					documents.push(await this.transformTopic(topic));
				}
			}
			if (documents.length > 0) {
				await this.indexDocuments(indexName, documents);
			}
		}, { batch: this.batchSize });

		// Index Posts
		winston.info('[ep-api] Indexing posts...');
		await batch.processSortedSet('posts:pid', async (pids) => {
			const postData = await posts.getPostsFields(pids, []);
			const documents = [];
			for (const post of postData) {
				if (post) {
					const doc = await this.transformPost(post);
					if (doc) documents.push(doc);
				}
			}
			if (documents.length > 0) {
				await this.indexDocuments(indexName, documents);
			}
		}, { batch: this.batchSize });

		winston.info('[ep-api] Full reindex complete.');
	}
}

module.exports = new BulkIndexer();
