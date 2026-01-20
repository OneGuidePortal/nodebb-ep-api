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

		$('#refresh-index').on('click', function () {
			socket.emit('admin.plugins.epApi.refresh', {}, function (err, data) {
				if (err) return alerts.error(err.message);
				alerts.success(data.message);
				loadStats();
			});
		});

		$('#delete-index').on('click', function () {
			bootbox.confirm({
				title: 'Delete Index',
				message: 'Are you sure you want to delete the index? This action cannot be undone.',
				callback: function (result) {
					if (result) {
						socket.emit('admin.plugins.epApi.delete', {}, function (err, data) {
							if (err) return alerts.error(err.message);
							alerts.success(data.message);
							loadStats();
						});
					}
				}
			});
		});

		$('#download-index').on('click', function () {
			socket.emit('admin.plugins.epApi.dump', {}, function (err, data) {
				if (err) return alerts.error(err.message);
				
				const json = JSON.stringify(data.documents, null, 2);
				const blob = new Blob([json], { type: 'application/json' });
				const url = window.URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = 'elasticsearch-dump.json';
				document.body.appendChild(a);
				a.click();
				window.URL.revokeObjectURL(url);
				document.body.removeChild(a);
				
				alerts.success('Download started');
			});
		});

		function loadStats() {
			socket.emit('admin.plugins.epApi.getStats', {}, function (err, stats) {
				if (err) return;
				const container = $('#index-stats');
				if (stats.error) {
					container.html('<div class="alert alert-warning">' + stats.error + '</div>');
				} else {
					container.html(`
						<table class="table table-bordered">
							<tr>
								<th>Index Name</th>
								<td>${stats.index}</td>
							</tr>
							<tr>
								<th>Document Count</th>
								<td>${stats.docs}</td>
							</tr>
							<tr>
								<th>Store Size</th>
								<td>${formatBytes(stats.store)}</td>
							</tr>
						</table>
					`);
				}
			});
		}

		function formatBytes(bytes, decimals = 2) {
			if (!+bytes) return '0 Bytes';
			const k = 1024;
			const dm = decimals < 0 ? 0 : decimals;
			const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
			const i = Math.floor(Math.log(bytes) / Math.log(k));
			return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
		}

		loadStats();
	};

	return ACP;
});