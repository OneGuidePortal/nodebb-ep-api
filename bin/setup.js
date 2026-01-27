#!/usr/bin/env node

require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') });
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { Client } = require('@elastic/elasticsearch');

const argv = yargs(hideBin(process.argv)).argv;

async function main() {
  console.log('=== ElasticPress.io Setup ===');

  try {
    // 1. Load configuration
    console.log('1. Loading configuration...');
    const config = {
      elasticsearch: {
        host: process.env.ELASTICPRESS_HOST,
        subscription_id: process.env.ELASTICPRESS_SUBSCRIPTION_ID,
        subscription_token: process.env.ELASTICPRESS_SUBSCRIPTION_TOKEN,
      },
      index: {
        prefix: process.env.ELASTICPRESS_SUBSCRIPTION_ID ? `${process.env.ELASTICPRESS_SUBSCRIPTION_ID}-` : '',
      },
    };

    if (!config.elasticsearch.host || !config.elasticsearch.subscription_id || !config.elasticsearch.subscription_token) {
      throw new Error('Missing required configuration. Please copy .env.example to .env and fill in your ElasticPress.io credentials.');
    }
    console.log('   ✓ Configuration loaded successfully');
    console.log(`   Host: ${config.elasticsearch.host}`);

    // 2. Connecting to ElasticPress.io
    console.log('2. Connecting to ElasticPress.io...');
    const client = new Client({
      node: config.elasticsearch.host,
      auth: {
        username: config.elasticsearch.subscription_id,
        password: config.elasticsearch.subscription_token,
      },
    });
    console.log('   ✓ Connected successfully');

    // 3. Create index
    const indexName = `${config.index.prefix}laureates`;
    console.log(`3. Creating index '${indexName}'...`);

    const { body: indexExists } = await client.indices.exists({ index: indexName });

    if (indexExists) {
      console.log('   ! Index already exists');
      // In a real application, you would prompt the user for confirmation.
      // For this example, we'll just delete and recreate it.
      console.log('   Deleting existing index...');
      await client.indices.delete({ index: indexName });
      console.log('   ✓ Index deleted');
    }
    
    // Create index with mappings
    const { getSettings, getMapping } = require('../src/Mapping/Mapping.js');

    await client.indices.create({
      index: indexName,
      body: {
        settings: getSettings(),
        mappings: getMapping(),
      },
    });
    console.log('   ✓ Index created successfully');

    // 4. Listing indexes
    console.log('4. Listing indexes...');
    const { body: indices } = await client.indices.getAlias({ index: `${config.index.prefix}*` });
    for (const index in indices) {
      console.log(`   - ${index}`);
    }

    console.log('=== Setup Complete ===');
    console.log("Next step: Run 'node bin/index.js' to index the Nobel Prize data");

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
