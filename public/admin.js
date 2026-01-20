'use strict';

define(['settings', 'alerts', 'bootbox'], function (settings, alerts, bootbox) {
	var ACP = {};

	ACP.init = function () {
		settings.load('ep-api', $('.ep-api-settings'));

		$('#save').on('click', function () {
			settings.save('ep-api', $('.ep-api-settings'), function () {
				alerts.success('Settings Saved');
			});
		});

		$('#run-setup').on('click', function () {
			bootbox.confirm({
				title: 'Run Setup',
				message: 'Are you sure you want to delete and recreate the index? All data in the laureates index will be lost.',
				callback: function (result) {
					if (result) {
						socket.emit('admin.plugins.epApi.setup', {}, function (err, data) {
							if (err) {
								return alerts.error(err.message);
							}
							alerts.success('Setup Complete! Created index: ' + data.indexName);
						});
					}
				}
			});
		});

		$('#run-reindex').on('click', function () {
			bootbox.confirm({
				title: 'Reindex All Content',
				message: 'This will index all topics and posts to Elasticsearch. This may take a while depending on the amount of content. Continue?',
				callback: function (result) {
					if (result) {
						socket.emit('admin.plugins.epApi.reindex', {}, function (err, data) {
							if (err) {
								return alerts.error(err.message);
							}
							alerts.success(data.message);
						});
					}
				}
			});
		});
	};

	return ACP;
});