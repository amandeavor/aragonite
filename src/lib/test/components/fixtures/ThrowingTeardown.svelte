<script lang="ts">
	// Mounts cleanly and throws only as it is torn down.
	$effect(() => () => {
		throw new Error('teardown exploded');
	});
</script>

<span class="throwing-teardown">mounted</span>
