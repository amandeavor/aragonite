<!--
  A block drawn by a DOM view: builds the surface the view asked for, makes the element the view
  fills, and mounts the view into it. A throw in the view's `mount` or `update` reaches BlockHost's
  error boundary, as a Svelte block's does.
-->
<script lang="ts">
	import { getAllContexts, getContext, mount, unmount, untrack } from 'svelte';
	import { on } from 'svelte/events';
	import type { BlockComponent } from '../../block-component';
	import type { NodeView } from '../../core/node-views';
	import type {
		BlockViewContext,
		BlockViewHandle,
		BlockViewSpec,
		BlockViewState,
		ContainerSurface,
		LeafSurface,
		LeafViewHandle
	} from '../../schema/block-view';
	import { componentPluginEditor } from '../../schema/block-kind-plugin';
	import { tryGetBlockKindDescriptor } from '../../schema/block-kind-descriptor';
	import {
		EDITOR_DOC_KEY,
		EDITOR_POLICIES_KEY,
		EDITOR_SERVICES_KEY,
		type EditorDoc,
		type EditorPolicies,
		type EditorServices
	} from '../../editor-keys';
	import { assertInvariant } from '@voithos-labs/aragonite/dev-checks';
	import { VIEW_TEXT_ATTR, VIEW_TEXT_HOST_ATTR } from '../../caret/block-content-selector';
	import { checkAttachedLeaf, checkDomViewContent } from '../../invariants/dom-view-content';
	import { warnIfForeignRuntime } from '../../foreign-runtime';
	import { createEditableLeaf } from '../blocks/editable/editable-leaf';
	import { createContainerBlock } from '../../editor-actions/plugin/container';
	import BlockList from '../BlockList.svelte';
	import { bindLeafSurface } from './leaf-surface-binding.svelte';
	import { handBuiltRef } from './hand-built-ref';

	let {
		spec,
		node,
		index,
		myPath
	}: { spec: BlockViewSpec; node: NodeView; index: number; myPath: number[] } = $props();

	// Read once: DomBlockHost keys this component on its spec.
	const view = untrack(() => spec);
	const editorDoc = getContext<EditorDoc>(EDITOR_DOC_KEY);
	const policies = getContext<EditorPolicies>(EDITOR_POLICIES_KEY);
	const events = getContext<EditorServices | undefined>(EDITOR_SERVICES_KEY)?.events;

	let leafEl: HTMLElement | null = $state(null);
	let childBox: HTMLElement | undefined = $state();
	let handBuilt: BlockComponent | undefined = $state();
	let generation = $state(0);
	let handle: BlockViewHandle | null = null;
	let mountedTarget: HTMLElement | null = null;

	const blockDeps = { getNode: () => node, getIndex: () => index, getPath: () => myPath };
	const leaf =
		view.surface === 'leaf'
			? createEditableLeaf({
					...blockDeps,
					getEl: () => leafEl,
					mode: 'plain',
					singleLine: view.singleLine
				})
			: null;
	const container =
		view.surface === 'container'
			? createContainerBlock({ ...blockDeps, getBoxEl: () => childBox })
			: null;
	// Read after the container factory, which sets the children's windowing context.
	const contexts = getAllContexts();

	export function viewRef(): BlockComponent | undefined {
		return leaf?.blockApi ?? container?.containerApi ?? handBuilt;
	}

	function report(error: unknown): void {
		warnIfForeignRuntime(error, `block ${node.kind}`);
		events?.emit('error', { origin: 'render', error, context: { path: myPath } });
	}

	function currentState(): BlockViewState {
		return {
			node,
			path: myPath,
			presentationMode: editorDoc.reading.mode(),
			theme: policies.theme()
		};
	}

	function editorContext() {
		const editor = componentPluginEditor(editorDoc.pluginEditor, node.kind);
		if (!editor) {
			throw new Error(`a DOM block view reads \`editor\` only inside an Editor ("${node.kind}")`);
		}
		return editor;
	}

	// `editor` stays a getter, read when the view asks.
	function viewContext<T extends object>(surface: T): BlockViewContext & T {
		return Object.defineProperty({ state: currentState, ...surface }, 'editor', {
			enumerable: true,
			get: editorContext
		}) as BlockViewContext & T;
	}

	// ── Leaf surface ──────────────────────────────────────────────────────────

	if (leaf) {
		bindLeafSurface({
			getEl: () => leafEl,
			props: () => leaf.surfaceProps as unknown as Record<string | symbol, unknown>,
			afterInput: (el) => {
				const after = (handle as LeafViewHandle | null)?.afterInput;
				if (!after) return;
				try {
					after.call(handle, el.textContent ?? '');
				} catch (error) {
					report(error);
				}
			}
		});
	}

	const leafSurface: LeafSurface | null = leaf && {
		attach(el) {
			leafEl?.removeAttribute(VIEW_TEXT_ATTR);
			el?.setAttribute(VIEW_TEXT_ATTR, '');
			leafEl = el;
			assertInvariant('dom-view-content', () =>
				mountedTarget ? checkDomViewContent(mountedTarget, el) : checkAttachedLeaf(el)
			);
		},
		reveal: (offset) => leaf.reveal(offset),
		commitSource: (text) => leaf.commitSource(text)
	};

	// ── Container surface ─────────────────────────────────────────────────────

	let children: ReturnType<typeof mount> | null = null;
	let offChildKeys: (() => void) | null = null;

	function unmountChildren(): void {
		offChildKeys?.();
		offChildKeys = null;
		if (children) void unmount(children);
		children = null;
		childBox = undefined;
	}

	const containerSurface: ContainerSurface | null = container && {
		mountChildren(box) {
			unmountChildren();
			childBox = box;
			// Passed, never inherited: a view may mount its children from an event handler.
			children = mount(BlockList, {
				target: box,
				props: container.blockListProps,
				context: contexts
			});
			offChildKeys = on(box, 'keydown', container.handleKeydown);
		},
		updateOwnMetadata: (patch, options) => container.updateOwnMetadata(patch, options),
		moveFocusOut: (e) => container.moveFocusOut(e),
		captureScrollPosition: () => container.captureScrollPosition(),
		openDraft: (draft) => container.openDraft(draft)
	};

	// ── Mount, update, destroy ────────────────────────────────────────────────

	function mountSpec(target: HTMLElement): BlockViewHandle {
		if (view.surface === 'leaf') {
			target.setAttribute(VIEW_TEXT_HOST_ATTR, '');
			return view.mount(target, viewContext({ leaf: leafSurface! }));
		}
		if (view.surface === 'container') {
			return view.mount(target, viewContext({ container: containerSurface! }));
		}
		const mounted = view.mount(target, viewContext({}));
		handBuilt = handBuiltRef(
			mounted,
			() => tryGetBlockKindDescriptor(node.kind)?.editable ?? false
		);
		return mounted;
	}

	function mountView(target: HTMLElement): () => void {
		return untrack(() => {
			handle = mountSpec(target);
			mountedTarget = target;
			seen = watched();
			assertInvariant('dom-view-content', () => checkDomViewContent(target, leafEl));
			return () => {
				const ending = handle;
				handle = null;
				mountedTarget = null;
				unmountChildren();
				leafEl = null;
				handBuilt = undefined;
				try {
					ending?.destroy?.();
				} catch (error) {
					report(error);
				}
			};
		});
	}

	// What an `update` follows; a container's raw changes with every edit inside it.
	function watched(): unknown[] {
		return [
			node.raw,
			myPath.join(),
			editorDoc.reading.mode(),
			policies.theme(),
			view.watchDocument ? editorDoc.contentVersion() : 0
		];
	}

	let seen: unknown[] = [];
	$effect(() => {
		const now = watched();
		untrack(() => {
			if (!handle || now.every((value, i) => Object.is(value, seen[i]))) return;
			seen = now;
			if (handle.update?.(currentState()) === false) generation++;
		});
	});
</script>

{#key generation}
	<div {@attach mountView}></div>
{/key}
