// ==UserScript==
// @name         Clone with VSCode
// @description  Open github repo in vscode
// @namespace    https://github.com/Johannes7k75
// @version      1.0.1
// @match        https://github.com/*/*
// @updateURL    https://raw.githubusercontent.com/Johannes7k75/tapermonkey-user-scripts/refs/heads/main/CloneWithVSCode.js
// @downloadURL    https://raw.githubusercontent.com/Johannes7k75/tapermonkey-user-scripts/refs/heads/main/CloneWithVSCode.js
// ==/UserScript==

(function () {
	"use strict";

	function renderCloneVScode() {
		const [owner, repo, branch] = getRepoInfo();
		renderItem({
			name: "Clone in VSCode",
			url: `vscode://vscode.git/clone?url=${encodeURIComponent(`https://github.com/${owner}/${repo}.git`)}&ref=${encodeURIComponent(branch)}`,
			icon: {
				width: 16,
				height: 16,
				viewBox: "0 0 1024 1024",
				path: "M746.222933 102.239573l-359.799466 330.820267L185.347413 281.4976 102.2464 329.864533l198.20544 182.132054-198.20544 182.132053 83.101013 48.510293 201.076054-151.558826 359.799466 330.676906 175.527254-85.251413V187.4944z m0 217.57952v384.341334l-255.040853-192.177494z",
			},
		});
	}

	function render() {
		renderCloneVScode();
	}

	function getListNode() {
		return document.querySelector("#__primerPortalRoot__ ul > div > ul");
	}

	function getRepoInfo() {
		const branch = document
			.querySelector(".ref-selector-button-text-container span")
			.textContent.trim();
		const [_, owner, repo] = location.href.match(
			/^https:\/\/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)/,
		);
		return [owner, repo, branch];
	}

	function createListItem() {
		const ul = getListNode();
		var li = ul.children.item(0).cloneNode(true);

		return li;
	}

	function createAnchor(href) {
		var a = document.createElement("a");
		a.className =
			"d-flex flex-items-center color-fg-default text-bold no-underline";
		a.rel = "nofollow";
		a.href = href;

		return a;
	}

	function createIcon(options) {
		var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("width", options.width);
		svg.setAttribute("height", options.height);
		svg.setAttribute("viewBox", options.viewBox);
		svg.setAttribute("version", "1.1");
		svg.setAttribute("class", "octicon");
		svg.setAttribute("aria-hidden", "true");

		var path = document.createElementNS(svg.namespaceURI, "path");
		path.setAttribute("d", options.path);
		svg.appendChild(path);

		return svg;
	}

	function createText(text) {
		return document.createTextNode(text);
	}

	function createItem(options) {
		var li = createListItem();
		var a = createAnchor(options.url);
		var svg = createIcon(options.icon);
		var text = createText(options.name);

		if (options.isNewTab) {
			a.target = "_blank";
		}

		li.querySelector("span svg").replaceWith(svg);
		li.querySelector("div span").replaceWith(text);

		li.addEventListener("click", () => {
			a.click();
		});

		return li;
	}

	function renderItem(options) {
		var ul = getListNode();
		if (!ul) {
			return;
		}
		var li = createItem(options);
		var ref =
			ul.querySelector("li[data-platforms]") ||
			ul.children[ul.children.length - 1];

		ul.insertBefore(li, ref);
	}

	const primerPortalObserver = new MutationObserver((mutations) => {
		if (mutations[0].addedNodes.item(0).id === "__primerPortalRoot__") {
			addPopUpListener(true);
			primerPortalObserver.disconnect();
		}
	});
	primerPortalObserver.observe(document.body, { childList: true });

	function addPopUpListener(first) {
		if (first) {
			render();
		}
		new MutationObserver(([mutation]) => {
			if (mutation.addedNodes.length > 0) {
				render();
			}
		}).observe(document.querySelector("#__primerPortalRoot__"), {
			childList: true,
		});
	}
})();
