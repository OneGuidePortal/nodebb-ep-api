<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<form role="form" class="ep-api-settings">
				<div class="mb-4">
					<h5 class="fw-bold tracking-tight settings-header">ElasticPress Configuration</h5>

					<div class="mb-3">
						<label class="form-label" for="host">ElasticPress Host</label>
						<input type="text" id="host" name="host" title="ElasticPress Host" class="form-control" placeholder="https://..." />
					</div>

					<div class="mb-3">
						<label class="form-label" for="subscription_id">Subscription ID</label>
						<input type="text" id="subscription_id" name="subscription_id" title="Subscription ID" class="form-control" />
					</div>

					<div class="mb-3">
						<label class="form-label" for="subscription_token">Subscription Token</label>
						<input type="password" id="subscription_token" name="subscription_token" title="Subscription Token" class="form-control" />
					</div>

					<div class="mb-3">
						<label class="form-label" for="wordpress_url">WordPress URL</label>
						<input type="text" id="wordpress_url" name="wordpress_url" title="WordPress URL" class="form-control" placeholder="example.com" />
					</div>

					<div class="mb-3">
						<label class="form-label" for="wordpress_site_id">WordPress Site ID</label>
						<input type="number" id="wordpress_site_id" name="wordpress_site_id" title="WordPress Site ID" class="form-control" placeholder="1" />
					</div>

					<hr />

					<div class="mb-3">
						<button type="button" id="run-setup" class="btn btn-warning">Run Setup (Create Index)</button>
						<p class="form-text">This will delete and recreate the <code>laureates</code> index on ElasticPress.io using the settings above.</p>
					</div>
				</div>
			</form>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>
