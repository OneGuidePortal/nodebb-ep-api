'use strict';

/**
 * Defines the Elasticsearch mapping for data.
 *
 * This mapping defines field types and properties for indexing
 * with support for faceted search by category, year, gender, and countries.
 *
 * Field types used:
 * - text: Full-text searchable fields (name, motivation)
 * - keyword: Exact match fields for filtering and aggregations (category, gender, country)
 * - integer: Numeric fields (year, share, birth year)
 * - date: Date fields with format specification
 *
 * @see https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping-types.html
 */

const getMapping = () => {
  return {
    properties: {
    },
  };
};

/**
 * Get index settings for the index.
 *
 * These settings configure the index behavior including:
 * - Number of shards and replicas
 * - Analysis settings for text processing
 *
 * @returns {object} Index settings
 */
const getSettings = () => {
  return {
    number_of_shards: 1,
    number_of_replicas: 1,
    analysis: {
      analyzer: {
        default: {
          type: 'standard',
          stopwords: '_english_',
        },
      },
    },
  };
};

/**
 * Get the complete index configuration (settings + mappings).
 *
 * @returns {object} Complete index configuration
 */
const getIndexConfiguration = () => {
  return {
    settings: getSettings(),
    mappings: getMapping(),
  };
};

module.exports = {
  getMapping,
  getSettings,
  getIndexConfiguration,
};
