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
function select_option(select, value, mounting) {
    for (let i = 0; i < select.options.length; i += 1) {
        const option = select.options[i];
        if (option.__value === value) {
            option.selected = true;
            return;
        }
    }
    if (!mounting || value !== undefined) {
        select.selectedIndex = -1; // no option should be selected
    }
}
function select_value(select) {
    const selected_option = select.querySelector(':checked');
    return selected_option && selected_option.__value;
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
	child_ctx[12] = list[i];
	return child_ctx;
}

// (145:6) {#each transactions as transaction}
function create_each_block(ctx) {
	let li;
	let span;

	let t0_value = (/*transaction*/ ctx[12].type === 'income'
	? 'Income'
	: 'Expense') + "";

	let t0;
	let t1;
	let t2_value = /*transaction*/ ctx[12].amount.toFixed(2) + "";
	let t2;
	let t3;
	let button;
	let t4;
	let t5;
	let mounted;
	let dispose;

	function click_handler() {
		return /*click_handler*/ ctx[11](/*transaction*/ ctx[12]);
	}

	return {
		c() {
			li = element("li");
			span = element("span");
			t0 = text(t0_value);
			t1 = text(": $");
			t2 = text(t2_value);
			t3 = space();
			button = element("button");
			t4 = text("Remove");
			t5 = space();
			this.h();
		},
		l(nodes) {
			li = claim_element(nodes, "LI", { class: true });
			var li_nodes = children(li);
			span = claim_element(li_nodes, "SPAN", {});
			var span_nodes = children(span);
			t0 = claim_text(span_nodes, t0_value);
			t1 = claim_text(span_nodes, ": $");
			t2 = claim_text(span_nodes, t2_value);
			span_nodes.forEach(detach);
			t3 = claim_space(li_nodes);
			button = claim_element(li_nodes, "BUTTON", { class: true });
			var button_nodes = children(button);
			t4 = claim_text(button_nodes, "Remove");
			button_nodes.forEach(detach);
			t5 = claim_space(li_nodes);
			li_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(button, "class", "svelte-1bhjeaq");
			attr(li, "class", "svelte-1bhjeaq");
		},
		m(target, anchor) {
			insert_hydration(target, li, anchor);
			append_hydration(li, span);
			append_hydration(span, t0);
			append_hydration(span, t1);
			append_hydration(span, t2);
			append_hydration(li, t3);
			append_hydration(li, button);
			append_hydration(button, t4);
			append_hydration(li, t5);

			if (!mounted) {
				dispose = listen(button, "click", click_handler);
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (dirty & /*transactions*/ 8 && t0_value !== (t0_value = (/*transaction*/ ctx[12].type === 'income'
			? 'Income'
			: 'Expense') + "")) set_data(t0, t0_value);

			if (dirty & /*transactions*/ 8 && t2_value !== (t2_value = /*transaction*/ ctx[12].amount.toFixed(2) + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) detach(li);
			mounted = false;
			dispose();
		}
	};
}

function create_fragment(ctx) {
	let div3;
	let h1;
	let t0;
	let t1;
	let div0;
	let p0;
	let t2;
	let span0;
	let t3;
	let t4_value = /*totalIncome*/ ctx[0].toFixed(2) + "";
	let t4;
	let t5;
	let p1;
	let t6;
	let span1;
	let t7;
	let t8_value = /*totalExpenses*/ ctx[1].toFixed(2) + "";
	let t8;
	let t9;
	let p2;
	let t10;
	let span2;
	let t11;
	let t12_value = /*remainingBudget*/ ctx[2].toFixed(2) + "";
	let t12;
	let t13;
	let div1;
	let label0;
	let t14;
	let t15;
	let select;
	let option0;
	let t16;
	let option1;
	let t17;
	let t18;
	let label1;
	let t19;
	let t20;
	let input;
	let t21;
	let button;
	let t22;
	let t23;
	let div2;
	let h2;
	let t24;
	let t25;
	let ul;
	let mounted;
	let dispose;
	let each_value = /*transactions*/ ctx[3];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	return {
		c() {
			div3 = element("div");
			h1 = element("h1");
			t0 = text("Budget Tracker");
			t1 = space();
			div0 = element("div");
			p0 = element("p");
			t2 = text("Total Income: ");
			span0 = element("span");
			t3 = text("$");
			t4 = text(t4_value);
			t5 = space();
			p1 = element("p");
			t6 = text("Total Expenses: ");
			span1 = element("span");
			t7 = text("$");
			t8 = text(t8_value);
			t9 = space();
			p2 = element("p");
			t10 = text("Remaining Budget: ");
			span2 = element("span");
			t11 = text("$");
			t12 = text(t12_value);
			t13 = space();
			div1 = element("div");
			label0 = element("label");
			t14 = text("Type:");
			t15 = space();
			select = element("select");
			option0 = element("option");
			t16 = text("Income");
			option1 = element("option");
			t17 = text("Expense");
			t18 = space();
			label1 = element("label");
			t19 = text("Amount:");
			t20 = space();
			input = element("input");
			t21 = space();
			button = element("button");
			t22 = text("Add");
			t23 = space();
			div2 = element("div");
			h2 = element("h2");
			t24 = text("Transactions");
			t25 = space();
			ul = element("ul");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			this.h();
		},
		l(nodes) {
			div3 = claim_element(nodes, "DIV", { class: true });
			var div3_nodes = children(div3);
			h1 = claim_element(div3_nodes, "H1", {});
			var h1_nodes = children(h1);
			t0 = claim_text(h1_nodes, "Budget Tracker");
			h1_nodes.forEach(detach);
			t1 = claim_space(div3_nodes);
			div0 = claim_element(div3_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			p0 = claim_element(div0_nodes, "P", { class: true });
			var p0_nodes = children(p0);
			t2 = claim_text(p0_nodes, "Total Income: ");
			span0 = claim_element(p0_nodes, "SPAN", {});
			var span0_nodes = children(span0);
			t3 = claim_text(span0_nodes, "$");
			t4 = claim_text(span0_nodes, t4_value);
			span0_nodes.forEach(detach);
			p0_nodes.forEach(detach);
			t5 = claim_space(div0_nodes);
			p1 = claim_element(div0_nodes, "P", { class: true });
			var p1_nodes = children(p1);
			t6 = claim_text(p1_nodes, "Total Expenses: ");
			span1 = claim_element(p1_nodes, "SPAN", {});
			var span1_nodes = children(span1);
			t7 = claim_text(span1_nodes, "$");
			t8 = claim_text(span1_nodes, t8_value);
			span1_nodes.forEach(detach);
			p1_nodes.forEach(detach);
			t9 = claim_space(div0_nodes);
			p2 = claim_element(div0_nodes, "P", { class: true });
			var p2_nodes = children(p2);
			t10 = claim_text(p2_nodes, "Remaining Budget: ");
			span2 = claim_element(p2_nodes, "SPAN", {});
			var span2_nodes = children(span2);
			t11 = claim_text(span2_nodes, "$");
			t12 = claim_text(span2_nodes, t12_value);
			span2_nodes.forEach(detach);
			p2_nodes.forEach(detach);
			div0_nodes.forEach(detach);
			t13 = claim_space(div3_nodes);
			div1 = claim_element(div3_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			label0 = claim_element(div1_nodes, "LABEL", { for: true, class: true });
			var label0_nodes = children(label0);
			t14 = claim_text(label0_nodes, "Type:");
			label0_nodes.forEach(detach);
			t15 = claim_space(div1_nodes);
			select = claim_element(div1_nodes, "SELECT", { class: true });
			var select_nodes = children(select);
			option0 = claim_element(select_nodes, "OPTION", {});
			var option0_nodes = children(option0);
			t16 = claim_text(option0_nodes, "Income");
			option0_nodes.forEach(detach);
			option1 = claim_element(select_nodes, "OPTION", {});
			var option1_nodes = children(option1);
			t17 = claim_text(option1_nodes, "Expense");
			option1_nodes.forEach(detach);
			select_nodes.forEach(detach);
			t18 = claim_space(div1_nodes);
			label1 = claim_element(div1_nodes, "LABEL", { for: true, class: true });
			var label1_nodes = children(label1);
			t19 = claim_text(label1_nodes, "Amount:");
			label1_nodes.forEach(detach);
			t20 = claim_space(div1_nodes);

			input = claim_element(div1_nodes, "INPUT", {
				type: true,
				placeholder: true,
				class: true
			});

			t21 = claim_space(div1_nodes);
			button = claim_element(div1_nodes, "BUTTON", { class: true });
			var button_nodes = children(button);
			t22 = claim_text(button_nodes, "Add");
			button_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			t23 = claim_space(div3_nodes);
			div2 = claim_element(div3_nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			h2 = claim_element(div2_nodes, "H2", {});
			var h2_nodes = children(h2);
			t24 = claim_text(h2_nodes, "Transactions");
			h2_nodes.forEach(detach);
			t25 = claim_space(div2_nodes);
			ul = claim_element(div2_nodes, "UL", { class: true });
			var ul_nodes = children(ul);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(ul_nodes);
			}

			ul_nodes.forEach(detach);
			div2_nodes.forEach(detach);
			div3_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(p0, "class", "svelte-1bhjeaq");
			attr(p1, "class", "svelte-1bhjeaq");
			attr(p2, "class", "svelte-1bhjeaq");
			attr(div0, "class", "budget-summary svelte-1bhjeaq");
			attr(label0, "for", "type");
			attr(label0, "class", "svelte-1bhjeaq");
			option0.__value = "income";
			option0.value = option0.__value;
			option1.__value = "expense";
			option1.value = option1.__value;
			attr(select, "class", "svelte-1bhjeaq");
			if (/*type*/ ctx[4] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[9].call(select));
			attr(label1, "for", "amount");
			attr(label1, "class", "svelte-1bhjeaq");
			attr(input, "type", "number");
			attr(input, "placeholder", "Enter amount");
			attr(input, "class", "svelte-1bhjeaq");
			attr(button, "class", "svelte-1bhjeaq");
			attr(div1, "class", "form svelte-1bhjeaq");
			attr(ul, "class", "svelte-1bhjeaq");
			attr(div2, "class", "transactions svelte-1bhjeaq");
			attr(div3, "class", "container svelte-1bhjeaq");
		},
		m(target, anchor) {
			insert_hydration(target, div3, anchor);
			append_hydration(div3, h1);
			append_hydration(h1, t0);
			append_hydration(div3, t1);
			append_hydration(div3, div0);
			append_hydration(div0, p0);
			append_hydration(p0, t2);
			append_hydration(p0, span0);
			append_hydration(span0, t3);
			append_hydration(span0, t4);
			append_hydration(div0, t5);
			append_hydration(div0, p1);
			append_hydration(p1, t6);
			append_hydration(p1, span1);
			append_hydration(span1, t7);
			append_hydration(span1, t8);
			append_hydration(div0, t9);
			append_hydration(div0, p2);
			append_hydration(p2, t10);
			append_hydration(p2, span2);
			append_hydration(span2, t11);
			append_hydration(span2, t12);
			append_hydration(div3, t13);
			append_hydration(div3, div1);
			append_hydration(div1, label0);
			append_hydration(label0, t14);
			append_hydration(div1, t15);
			append_hydration(div1, select);
			append_hydration(select, option0);
			append_hydration(option0, t16);
			append_hydration(select, option1);
			append_hydration(option1, t17);
			select_option(select, /*type*/ ctx[4], true);
			append_hydration(div1, t18);
			append_hydration(div1, label1);
			append_hydration(label1, t19);
			append_hydration(div1, t20);
			append_hydration(div1, input);
			set_input_value(input, /*amount*/ ctx[5]);
			append_hydration(div1, t21);
			append_hydration(div1, button);
			append_hydration(button, t22);
			append_hydration(div3, t23);
			append_hydration(div3, div2);
			append_hydration(div2, h2);
			append_hydration(h2, t24);
			append_hydration(div2, t25);
			append_hydration(div2, ul);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(ul, null);
				}
			}

			if (!mounted) {
				dispose = [
					listen(select, "change", /*select_change_handler*/ ctx[9]),
					listen(input, "input", /*input_input_handler*/ ctx[10]),
					listen(button, "click", /*addTransaction*/ ctx[6])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*totalIncome*/ 1 && t4_value !== (t4_value = /*totalIncome*/ ctx[0].toFixed(2) + "")) set_data(t4, t4_value);
			if (dirty & /*totalExpenses*/ 2 && t8_value !== (t8_value = /*totalExpenses*/ ctx[1].toFixed(2) + "")) set_data(t8, t8_value);
			if (dirty & /*remainingBudget*/ 4 && t12_value !== (t12_value = /*remainingBudget*/ ctx[2].toFixed(2) + "")) set_data(t12, t12_value);

			if (dirty & /*type*/ 16) {
				select_option(select, /*type*/ ctx[4]);
			}

			if (dirty & /*amount*/ 32 && to_number(input.value) !== /*amount*/ ctx[5]) {
				set_input_value(input, /*amount*/ ctx[5]);
			}

			if (dirty & /*removeTransaction, transactions*/ 136) {
				each_value = /*transactions*/ ctx[3];
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(ul, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div3);
			destroy_each(each_blocks, detaching);
			mounted = false;
			run_all(dispose);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { props } = $$props;
	let totalIncome = 0;
	let totalExpenses = 0;
	let remainingBudget = 0;
	let transactions = [];
	let type = 'income';
	let amount = 0;

	function addTransaction() {
		if (amount <= 0 || isNaN(amount)) {
			alert('Please enter a valid amount.');
			return;
		}

		if (type === 'income') {
			$$invalidate(0, totalIncome += amount);
		} else if (type === 'expense') {
			$$invalidate(1, totalExpenses += amount);
		}

		$$invalidate(2, remainingBudget = totalIncome - totalExpenses);
		$$invalidate(3, transactions = [...transactions, { type, amount, id: Date.now() }]);
		$$invalidate(5, amount = 0); // Reset input
	}

	function removeTransaction(id) {
		const transaction = transactions.find(t => t.id === id);

		if (transaction.type === 'income') {
			$$invalidate(0, totalIncome -= transaction.amount);
		} else if (transaction.type === 'expense') {
			$$invalidate(1, totalExpenses -= transaction.amount);
		}

		$$invalidate(2, remainingBudget = totalIncome - totalExpenses);
		$$invalidate(3, transactions = transactions.filter(t => t.id !== id));
	}

	function select_change_handler() {
		type = select_value(this);
		$$invalidate(4, type);
	}

	function input_input_handler() {
		amount = to_number(this.value);
		$$invalidate(5, amount);
	}

	const click_handler = transaction => removeTransaction(transaction.id);

	$$self.$$set = $$props => {
		if ('props' in $$props) $$invalidate(8, props = $$props.props);
	};

	return [
		totalIncome,
		totalExpenses,
		remainingBudget,
		transactions,
		type,
		amount,
		addTransaction,
		removeTransaction,
		props,
		select_change_handler,
		input_input_handler,
		click_handler
	];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, { props: 8 });
	}
}

export { Component as default };
