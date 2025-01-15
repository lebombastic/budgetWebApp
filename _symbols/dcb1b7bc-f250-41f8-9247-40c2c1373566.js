// New Block - Updated January 15, 2025
function noop() { }
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}

// Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
// at the end of hydration without touching the remaining nodes.
let is_hydrating = false;
function start_hydrating() {
    is_hydrating = true;
}
function end_hydrating() {
    is_hydrating = false;
}
function upper_bound(low, high, key, value) {
    // Return first index of value larger than input value in the range [low, high)
    while (low < high) {
        const mid = low + ((high - low) >> 1);
        if (key(mid) <= value) {
            low = mid + 1;
        }
        else {
            high = mid;
        }
    }
    return low;
}
function init_hydrate(target) {
    if (target.hydrate_init)
        return;
    target.hydrate_init = true;
    // We know that all children have claim_order values since the unclaimed have been detached if target is not <head>
    let children = target.childNodes;
    // If target is <head>, there may be children without claim_order
    if (target.nodeName === 'HEAD') {
        const myChildren = [];
        for (let i = 0; i < children.length; i++) {
            const node = children[i];
            if (node.claim_order !== undefined) {
                myChildren.push(node);
            }
        }
        children = myChildren;
    }
    /*
    * Reorder claimed children optimally.
    * We can reorder claimed children optimally by finding the longest subsequence of
    * nodes that are already claimed in order and only moving the rest. The longest
    * subsequence of nodes that are claimed in order can be found by
    * computing the longest increasing subsequence of .claim_order values.
    *
    * This algorithm is optimal in generating the least amount of reorder operations
    * possible.
    *
    * Proof:
    * We know that, given a set of reordering operations, the nodes that do not move
    * always form an increasing subsequence, since they do not move among each other
    * meaning that they must be already ordered among each other. Thus, the maximal
    * set of nodes that do not move form a longest increasing subsequence.
    */
    // Compute longest increasing subsequence
    // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
    const m = new Int32Array(children.length + 1);
    // Predecessor indices + 1
    const p = new Int32Array(children.length);
    m[0] = -1;
    let longest = 0;
    for (let i = 0; i < children.length; i++) {
        const current = children[i].claim_order;
        // Find the largest subsequence length such that it ends in a value less than our current value
        // upper_bound returns first greater value, so we subtract one
        // with fast path for when we are on the current longest subsequence
        const seqLen = ((longest > 0 && children[m[longest]].claim_order <= current) ? longest + 1 : upper_bound(1, longest, idx => children[m[idx]].claim_order, current)) - 1;
        p[i] = m[seqLen] + 1;
        const newLen = seqLen + 1;
        // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
        m[newLen] = i;
        longest = Math.max(newLen, longest);
    }
    // The longest increasing subsequence of nodes (initially reversed)
    const lis = [];
    // The rest of the nodes, nodes that will be moved
    const toMove = [];
    let last = children.length - 1;
    for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
        lis.push(children[cur - 1]);
        for (; last >= cur; last--) {
            toMove.push(children[last]);
        }
        last--;
    }
    for (; last >= 0; last--) {
        toMove.push(children[last]);
    }
    lis.reverse();
    // We sort the nodes being moved to guarantee that their insertion order matches the claim order
    toMove.sort((a, b) => a.claim_order - b.claim_order);
    // Finally, we move the nodes
    for (let i = 0, j = 0; i < toMove.length; i++) {
        while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
            j++;
        }
        const anchor = j < lis.length ? lis[j] : null;
        target.insertBefore(toMove[i], anchor);
    }
}
function append_hydration(target, node) {
    if (is_hydrating) {
        init_hydrate(target);
        if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentNode !== target))) {
            target.actual_end_child = target.firstChild;
        }
        // Skip nodes of undefined ordering
        while ((target.actual_end_child !== null) && (target.actual_end_child.claim_order === undefined)) {
            target.actual_end_child = target.actual_end_child.nextSibling;
        }
        if (node !== target.actual_end_child) {
            // We only insert if the ordering of this node should be modified or the parent node is not target
            if (node.claim_order !== undefined || node.parentNode !== target) {
                target.insertBefore(node, target.actual_end_child);
            }
        }
        else {
            target.actual_end_child = node.nextSibling;
        }
    }
    else if (node.parentNode !== target || node.nextSibling !== null) {
        target.appendChild(node);
    }
}
function insert_hydration(target, node, anchor) {
    if (is_hydrating && !anchor) {
        append_hydration(target, node);
    }
    else if (node.parentNode !== target || node.nextSibling != anchor) {
        target.insertBefore(node, anchor || null);
    }
}
function detach(node) {
    if (node.parentNode) {
        node.parentNode.removeChild(node);
    }
}
function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
        if (iterations[i])
            iterations[i].d(detaching);
    }
}
function element(name) {
    return document.createElement(name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function to_number(value) {
    return value === '' ? null : +value;
}
function children(element) {
    return Array.from(element.childNodes);
}
function init_claim_info(nodes) {
    if (nodes.claim_info === undefined) {
        nodes.claim_info = { last_index: 0, total_claimed: 0 };
    }
}
function claim_node(nodes, predicate, processNode, createNode, dontUpdateLastIndex = false) {
    // Try to find nodes in an order such that we lengthen the longest increasing subsequence
    init_claim_info(nodes);
    const resultNode = (() => {
        // We first try to find an element after the previous one
        for (let i = nodes.claim_info.last_index; i < nodes.length; i++) {
            const node = nodes[i];
            if (predicate(node)) {
                const replacement = processNode(node);
                if (replacement === undefined) {
                    nodes.splice(i, 1);
                }
                else {
                    nodes[i] = replacement;
                }
                if (!dontUpdateLastIndex) {
                    nodes.claim_info.last_index = i;
                }
                return node;
            }
        }
        // Otherwise, we try to find one before
        // We iterate in reverse so that we don't go too far back
        for (let i = nodes.claim_info.last_index - 1; i >= 0; i--) {
            const node = nodes[i];
            if (predicate(node)) {
                const replacement = processNode(node);
                if (replacement === undefined) {
                    nodes.splice(i, 1);
                }
                else {
                    nodes[i] = replacement;
                }
                if (!dontUpdateLastIndex) {
                    nodes.claim_info.last_index = i;
                }
                else if (replacement === undefined) {
                    // Since we spliced before the last_index, we decrease it
                    nodes.claim_info.last_index--;
                }
                return node;
            }
        }
        // If we can't find any matching node, we create a new one
        return createNode();
    })();
    resultNode.claim_order = nodes.claim_info.total_claimed;
    nodes.claim_info.total_claimed += 1;
    return resultNode;
}
function claim_element_base(nodes, name, attributes, create_element) {
    return claim_node(nodes, (node) => node.nodeName === name, (node) => {
        const remove = [];
        for (let j = 0; j < node.attributes.length; j++) {
            const attribute = node.attributes[j];
            if (!attributes[attribute.name]) {
                remove.push(attribute.name);
            }
        }
        remove.forEach(v => node.removeAttribute(v));
        return undefined;
    }, () => create_element(name));
}
function claim_element(nodes, name, attributes) {
    return claim_element_base(nodes, name, attributes, element);
}
function claim_text(nodes, data) {
    return claim_node(nodes, (node) => node.nodeType === 3, (node) => {
        const dataStr = '' + data;
        if (node.data.startsWith(dataStr)) {
            if (node.data.length !== dataStr.length) {
                return node.splitText(dataStr.length);
            }
        }
        else {
            node.data = dataStr;
        }
    }, () => text(data), true // Text nodes should not update last index since it is likely not worth it to eliminate an increasing subsequence of actual elements
    );
}
function claim_space(nodes) {
    return claim_text(nodes, ' ');
}
function set_data(text, data) {
    data = '' + data;
    if (text.data === data)
        return;
    text.data = data;
}
function set_input_value(input, value) {
    input.value = value == null ? '' : value;
}

let current_component;
function set_current_component(component) {
    current_component = component;
}

const dirty_components = [];
const binding_callbacks = [];
let render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = /* @__PURE__ */ Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
// flush() calls callbacks in this order:
// 1. All beforeUpdate callbacks, in order: parents before children
// 2. All bind:this callbacks, in reverse order: children before parents.
// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
//    for afterUpdates called during the initial onMount, which are called in
//    reverse order: children before parents.
// Since callbacks might update component values, which could trigger another
// call to flush(), the following steps guard against this:
// 1. During beforeUpdate, any updated components will be added to the
//    dirty_components array and will cause a reentrant call to flush(). Because
//    the flush index is kept outside the function, the reentrant call will pick
//    up where the earlier call left off and go through all dirty components. The
//    current_component value is saved and restored so that the reentrant call will
//    not interfere with the "parent" flush() call.
// 2. bind:this callbacks cannot trigger new flush() calls.
// 3. During afterUpdate, any updated components will NOT have their afterUpdate
//    callback called a second time; the seen_callbacks set, outside the flush()
//    function, guarantees this behavior.
const seen_callbacks = new Set();
let flushidx = 0; // Do *not* move this inside the flush() function
function flush() {
    // Do not reenter flush while dirty components are updated, as this can
    // result in an infinite loop. Instead, let the inner flush handle it.
    // Reentrancy is ok afterwards for bindings etc.
    if (flushidx !== 0) {
        return;
    }
    const saved_component = current_component;
    do {
        // first, call beforeUpdate functions
        // and update components
        try {
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
        }
        catch (e) {
            // reset dirty state to not end up in a deadlocked state and then rethrow
            dirty_components.length = 0;
            flushidx = 0;
            throw e;
        }
        set_current_component(null);
        dirty_components.length = 0;
        flushidx = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    seen_callbacks.clear();
    set_current_component(saved_component);
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}
/**
 * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
 */
function flush_render_callbacks(fns) {
    const filtered = [];
    const targets = [];
    render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
    targets.forEach((c) => c());
    render_callbacks = filtered;
}
const outroing = new Set();
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function mount_component(component, target, anchor, customElement) {
    const { fragment, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
            // if the component was destroyed immediately
            // it will update the `$$.on_destroy` reference to `null`.
            // the destructured on_destroy may still reference to the old array
            if (component.$$.on_destroy) {
                component.$$.on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
    }
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        flush_render_callbacks($$.after_update);
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: [],
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false,
        root: options.target || parent_component.$$.root
    };
    append_styles && append_styles($$.root);
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            start_hydrating();
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor, options.customElement);
        end_hydrating();
        flush();
    }
    set_current_component(parent_component);
}
/**
 * Base class for Svelte components. Used when dev=false.
 */
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        if (!is_function(callback)) {
            return noop;
        }
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set($$props) {
        if (this.$$set && !is_empty($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

/* generated by Svelte v3.59.1 */

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[13] = list[i];
	return child_ctx;
}

// (117:6) {#each expenses as expense}
function create_each_block(ctx) {
	let tr;
	let td0;
	let t0_value = /*expense*/ ctx[13].description + "";
	let t0;
	let t1;
	let td1;
	let t2;
	let t3_value = /*expense*/ ctx[13].amount.toFixed(2) + "";
	let t3;
	let t4;

	return {
		c() {
			tr = element("tr");
			td0 = element("td");
			t0 = text(t0_value);
			t1 = space();
			td1 = element("td");
			t2 = text("$");
			t3 = text(t3_value);
			t4 = space();
			this.h();
		},
		l(nodes) {
			tr = claim_element(nodes, "TR", {});
			var tr_nodes = children(tr);
			td0 = claim_element(tr_nodes, "TD", { class: true });
			var td0_nodes = children(td0);
			t0 = claim_text(td0_nodes, t0_value);
			td0_nodes.forEach(detach);
			t1 = claim_space(tr_nodes);
			td1 = claim_element(tr_nodes, "TD", { class: true });
			var td1_nodes = children(td1);
			t2 = claim_text(td1_nodes, "$");
			t3 = claim_text(td1_nodes, t3_value);
			td1_nodes.forEach(detach);
			t4 = claim_space(tr_nodes);
			tr_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(td0, "class", "svelte-br3jd");
			attr(td1, "class", "svelte-br3jd");
		},
		m(target, anchor) {
			insert_hydration(target, tr, anchor);
			append_hydration(tr, td0);
			append_hydration(td0, t0);
			append_hydration(tr, t1);
			append_hydration(tr, td1);
			append_hydration(td1, t2);
			append_hydration(td1, t3);
			append_hydration(tr, t4);
		},
		p(ctx, dirty) {
			if (dirty & /*expenses*/ 4 && t0_value !== (t0_value = /*expense*/ ctx[13].description + "")) set_data(t0, t0_value);
			if (dirty & /*expenses*/ 4 && t3_value !== (t3_value = /*expense*/ ctx[13].amount.toFixed(2) + "")) set_data(t3, t3_value);
		},
		d(detaching) {
			if (detaching) detach(tr);
		}
	};
}

function create_fragment(ctx) {
	let div4;
	let h1;
	let t0;
	let t1;
	let div0;
	let label0;
	let t2;
	let t3;
	let input0;
	let t4;
	let div1;
	let label1;
	let t5;
	let t6;
	let input1;
	let t7;
	let div2;
	let label2;
	let t8;
	let t9;
	let input2;
	let t10;
	let button;
	let t11;
	let t12;
	let table;
	let thead;
	let tr;
	let th0;
	let t13;
	let t14;
	let th1;
	let t15;
	let t16;
	let tbody;
	let t17;
	let div3;
	let p0;
	let strong0;
	let t18;
	let t19;
	let t20_value = /*income*/ ctx[0].toFixed(2) + "";
	let t20;
	let t21;
	let p1;
	let strong1;
	let t22;
	let t23;
	let t24_value = /*totalExpenses*/ ctx[1].toFixed(2) + "";
	let t24;
	let t25;
	let p2;
	let strong2;
	let t26;
	let t27;
	let t28_value = /*difference*/ ctx[5].toFixed(2) + "";
	let t28;
	let mounted;
	let dispose;
	let each_value = /*expenses*/ ctx[2];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	return {
		c() {
			div4 = element("div");
			h1 = element("h1");
			t0 = text("Budget Tracker");
			t1 = space();
			div0 = element("div");
			label0 = element("label");
			t2 = text("Monthly Income:");
			t3 = space();
			input0 = element("input");
			t4 = space();
			div1 = element("div");
			label1 = element("label");
			t5 = text("Expense Description:");
			t6 = space();
			input1 = element("input");
			t7 = space();
			div2 = element("div");
			label2 = element("label");
			t8 = text("Expense Amount:");
			t9 = space();
			input2 = element("input");
			t10 = space();
			button = element("button");
			t11 = text("Add Expense");
			t12 = space();
			table = element("table");
			thead = element("thead");
			tr = element("tr");
			th0 = element("th");
			t13 = text("Description");
			t14 = space();
			th1 = element("th");
			t15 = text("Amount");
			t16 = space();
			tbody = element("tbody");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t17 = space();
			div3 = element("div");
			p0 = element("p");
			strong0 = element("strong");
			t18 = text("Total Income:");
			t19 = text(" $");
			t20 = text(t20_value);
			t21 = space();
			p1 = element("p");
			strong1 = element("strong");
			t22 = text("Total Expenses:");
			t23 = text(" $");
			t24 = text(t24_value);
			t25 = space();
			p2 = element("p");
			strong2 = element("strong");
			t26 = text("Difference:");
			t27 = text(" $");
			t28 = text(t28_value);
			this.h();
		},
		l(nodes) {
			div4 = claim_element(nodes, "DIV", { class: true });
			var div4_nodes = children(div4);
			h1 = claim_element(div4_nodes, "H1", { class: true });
			var h1_nodes = children(h1);
			t0 = claim_text(h1_nodes, "Budget Tracker");
			h1_nodes.forEach(detach);
			t1 = claim_space(div4_nodes);
			div0 = claim_element(div4_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			label0 = claim_element(div0_nodes, "LABEL", { for: true, class: true });
			var label0_nodes = children(label0);
			t2 = claim_text(label0_nodes, "Monthly Income:");
			label0_nodes.forEach(detach);
			t3 = claim_space(div0_nodes);

			input0 = claim_element(div0_nodes, "INPUT", {
				id: true,
				type: true,
				min: true,
				placeholder: true,
				class: true
			});

			div0_nodes.forEach(detach);
			t4 = claim_space(div4_nodes);
			div1 = claim_element(div4_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			label1 = claim_element(div1_nodes, "LABEL", { for: true, class: true });
			var label1_nodes = children(label1);
			t5 = claim_text(label1_nodes, "Expense Description:");
			label1_nodes.forEach(detach);
			t6 = claim_space(div1_nodes);

			input1 = claim_element(div1_nodes, "INPUT", {
				id: true,
				type: true,
				placeholder: true,
				class: true
			});

			div1_nodes.forEach(detach);
			t7 = claim_space(div4_nodes);
			div2 = claim_element(div4_nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			label2 = claim_element(div2_nodes, "LABEL", { for: true, class: true });
			var label2_nodes = children(label2);
			t8 = claim_text(label2_nodes, "Expense Amount:");
			label2_nodes.forEach(detach);
			t9 = claim_space(div2_nodes);

			input2 = claim_element(div2_nodes, "INPUT", {
				id: true,
				type: true,
				min: true,
				placeholder: true,
				class: true
			});

			div2_nodes.forEach(detach);
			t10 = claim_space(div4_nodes);
			button = claim_element(div4_nodes, "BUTTON", { class: true });
			var button_nodes = children(button);
			t11 = claim_text(button_nodes, "Add Expense");
			button_nodes.forEach(detach);
			t12 = claim_space(div4_nodes);
			table = claim_element(div4_nodes, "TABLE", { class: true });
			var table_nodes = children(table);
			thead = claim_element(table_nodes, "THEAD", {});
			var thead_nodes = children(thead);
			tr = claim_element(thead_nodes, "TR", {});
			var tr_nodes = children(tr);
			th0 = claim_element(tr_nodes, "TH", { class: true });
			var th0_nodes = children(th0);
			t13 = claim_text(th0_nodes, "Description");
			th0_nodes.forEach(detach);
			t14 = claim_space(tr_nodes);
			th1 = claim_element(tr_nodes, "TH", { class: true });
			var th1_nodes = children(th1);
			t15 = claim_text(th1_nodes, "Amount");
			th1_nodes.forEach(detach);
			tr_nodes.forEach(detach);
			thead_nodes.forEach(detach);
			t16 = claim_space(table_nodes);
			tbody = claim_element(table_nodes, "TBODY", {});
			var tbody_nodes = children(tbody);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(tbody_nodes);
			}

			tbody_nodes.forEach(detach);
			table_nodes.forEach(detach);
			t17 = claim_space(div4_nodes);
			div3 = claim_element(div4_nodes, "DIV", { class: true });
			var div3_nodes = children(div3);
			p0 = claim_element(div3_nodes, "P", {});
			var p0_nodes = children(p0);
			strong0 = claim_element(p0_nodes, "STRONG", {});
			var strong0_nodes = children(strong0);
			t18 = claim_text(strong0_nodes, "Total Income:");
			strong0_nodes.forEach(detach);
			t19 = claim_text(p0_nodes, " $");
			t20 = claim_text(p0_nodes, t20_value);
			p0_nodes.forEach(detach);
			t21 = claim_space(div3_nodes);
			p1 = claim_element(div3_nodes, "P", {});
			var p1_nodes = children(p1);
			strong1 = claim_element(p1_nodes, "STRONG", {});
			var strong1_nodes = children(strong1);
			t22 = claim_text(strong1_nodes, "Total Expenses:");
			strong1_nodes.forEach(detach);
			t23 = claim_text(p1_nodes, " $");
			t24 = claim_text(p1_nodes, t24_value);
			p1_nodes.forEach(detach);
			t25 = claim_space(div3_nodes);
			p2 = claim_element(div3_nodes, "P", {});
			var p2_nodes = children(p2);
			strong2 = claim_element(p2_nodes, "STRONG", {});
			var strong2_nodes = children(strong2);
			t26 = claim_text(strong2_nodes, "Difference:");
			strong2_nodes.forEach(detach);
			t27 = claim_text(p2_nodes, " $");
			t28 = claim_text(p2_nodes, t28_value);
			p2_nodes.forEach(detach);
			div3_nodes.forEach(detach);
			div4_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(h1, "class", "svelte-br3jd");
			attr(label0, "for", "income");
			attr(label0, "class", "svelte-br3jd");
			attr(input0, "id", "income");
			attr(input0, "type", "number");
			attr(input0, "min", "0");
			attr(input0, "placeholder", "Enter your income");
			attr(input0, "class", "svelte-br3jd");
			attr(div0, "class", "input-group svelte-br3jd");
			attr(label1, "for", "expenseDesc");
			attr(label1, "class", "svelte-br3jd");
			attr(input1, "id", "expenseDesc");
			attr(input1, "type", "text");
			attr(input1, "placeholder", "E.g., Rent, Groceries");
			attr(input1, "class", "svelte-br3jd");
			attr(div1, "class", "input-group svelte-br3jd");
			attr(label2, "for", "expenseAmt");
			attr(label2, "class", "svelte-br3jd");
			attr(input2, "id", "expenseAmt");
			attr(input2, "type", "number");
			attr(input2, "min", "0");
			attr(input2, "placeholder", "Enter expense amount");
			attr(input2, "class", "svelte-br3jd");
			attr(div2, "class", "input-group svelte-br3jd");
			attr(button, "class", "svelte-br3jd");
			attr(th0, "class", "svelte-br3jd");
			attr(th1, "class", "svelte-br3jd");
			attr(table, "class", "svelte-br3jd");
			attr(div3, "class", "summary svelte-br3jd");
			attr(div4, "class", "container svelte-br3jd");
		},
		m(target, anchor) {
			insert_hydration(target, div4, anchor);
			append_hydration(div4, h1);
			append_hydration(h1, t0);
			append_hydration(div4, t1);
			append_hydration(div4, div0);
			append_hydration(div0, label0);
			append_hydration(label0, t2);
			append_hydration(div0, t3);
			append_hydration(div0, input0);
			set_input_value(input0, /*income*/ ctx[0]);
			append_hydration(div4, t4);
			append_hydration(div4, div1);
			append_hydration(div1, label1);
			append_hydration(label1, t5);
			append_hydration(div1, t6);
			append_hydration(div1, input1);
			/*input1_binding*/ ctx[9](input1);
			append_hydration(div4, t7);
			append_hydration(div4, div2);
			append_hydration(div2, label2);
			append_hydration(label2, t8);
			append_hydration(div2, t9);
			append_hydration(div2, input2);
			/*input2_binding*/ ctx[10](input2);
			append_hydration(div4, t10);
			append_hydration(div4, button);
			append_hydration(button, t11);
			append_hydration(div4, t12);
			append_hydration(div4, table);
			append_hydration(table, thead);
			append_hydration(thead, tr);
			append_hydration(tr, th0);
			append_hydration(th0, t13);
			append_hydration(tr, t14);
			append_hydration(tr, th1);
			append_hydration(th1, t15);
			append_hydration(table, t16);
			append_hydration(table, tbody);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(tbody, null);
				}
			}

			append_hydration(div4, t17);
			append_hydration(div4, div3);
			append_hydration(div3, p0);
			append_hydration(p0, strong0);
			append_hydration(strong0, t18);
			append_hydration(p0, t19);
			append_hydration(p0, t20);
			append_hydration(div3, t21);
			append_hydration(div3, p1);
			append_hydration(p1, strong1);
			append_hydration(strong1, t22);
			append_hydration(p1, t23);
			append_hydration(p1, t24);
			append_hydration(div3, t25);
			append_hydration(div3, p2);
			append_hydration(p2, strong2);
			append_hydration(strong2, t26);
			append_hydration(p2, t27);
			append_hydration(p2, t28);

			if (!mounted) {
				dispose = [
					listen(input0, "input", /*input0_input_handler*/ ctx[8]),
					listen(button, "click", /*click_handler*/ ctx[11])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*income*/ 1 && to_number(input0.value) !== /*income*/ ctx[0]) {
				set_input_value(input0, /*income*/ ctx[0]);
			}

			if (dirty & /*expenses*/ 4) {
				each_value = /*expenses*/ ctx[2];
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(tbody, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}

			if (dirty & /*income*/ 1 && t20_value !== (t20_value = /*income*/ ctx[0].toFixed(2) + "")) set_data(t20, t20_value);
			if (dirty & /*totalExpenses*/ 2 && t24_value !== (t24_value = /*totalExpenses*/ ctx[1].toFixed(2) + "")) set_data(t24, t24_value);
			if (dirty & /*difference*/ 32 && t28_value !== (t28_value = /*difference*/ ctx[5].toFixed(2) + "")) set_data(t28, t28_value);
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div4);
			/*input1_binding*/ ctx[9](null);
			/*input2_binding*/ ctx[10](null);
			destroy_each(each_blocks, detaching);
			mounted = false;
			run_all(dispose);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let totalExpenses;
	let difference;
	let { props } = $$props;
	let income = 0;
	let expenses = [];
	let descriptionInput = "";
	let amountInput = "";

	function addExpense(description, amount) {
		if (description && amount > 0) {
			$$invalidate(2, expenses = [...expenses, { description, amount: parseFloat(amount) }]);
		}
	}

	function calculateTotalExpenses() {
		return expenses.reduce((total, expense) => total + expense.amount, 0);
	}

	function input0_input_handler() {
		income = to_number(this.value);
		$$invalidate(0, income);
	}

	function input1_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			descriptionInput = $$value;
			$$invalidate(3, descriptionInput);
		});
	}

	function input2_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			amountInput = $$value;
			$$invalidate(4, amountInput);
		});
	}

	const click_handler = () => addExpense(descriptionInput.value, amountInput.value);

	$$self.$$set = $$props => {
		if ('props' in $$props) $$invalidate(7, props = $$props.props);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*income, totalExpenses*/ 3) {
			$$invalidate(5, difference = income - totalExpenses);
		}
	};

	$$invalidate(1, totalExpenses = calculateTotalExpenses());

	return [
		income,
		totalExpenses,
		expenses,
		descriptionInput,
		amountInput,
		difference,
		addExpense,
		props,
		input0_input_handler,
		input1_binding,
		input2_binding,
		click_handler
	];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, { props: 7 });
	}
}

export { Component as default };
