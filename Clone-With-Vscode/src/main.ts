const PORTAL_ROOT_SELECTOR = "#__primerPortalRoot__";
const PORTAL_ROOT_ID = "__primerPortalRoot__";
const LIST_SELECTOR = `${PORTAL_ROOT_SELECTOR} ul > div > ul`;
const BRANCH_SELECTOR = ".ref-selector-button-text-container span";
const ITEM_MARKER = "clone-with-vscode";
const REPOSITORY_URL_PATTERN =
  /^https:\/\/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)/;

const cloneIcon: IconOptions = {
  width: 16,
  height: 16,
  viewBox: "0 0 1024 1024",
  path: "M746.222933 102.239573l-359.799466 330.820267L185.347413 281.4976 102.2464 329.864533l198.20544 182.132054-198.20544 182.132053 83.101013 48.510293 201.076054-151.558826 359.799466 330.676906 175.527254-85.251413V187.4944z m0 217.57952v384.341334l-255.040853-192.177494z",
};

type IconOptions = {
  width: number;
  height: number;
  viewBox: string;
  path: string;
};

type ItemOptions = {
  name: string;
  url: string;
  icon: IconOptions;
  isNewTab?: boolean;
};

function getListNode(): HTMLUListElement | null {
  const list = document.querySelector(LIST_SELECTOR);
  return list instanceof HTMLUListElement ? list : null;
}

function getRepoInfo(): [string, string, string] {
  const branch =
    document.querySelector(BRANCH_SELECTOR)?.textContent?.trim() ?? "";
  const match = location.href.match(REPOSITORY_URL_PATTERN);
  if (!match) {
    throw new Error("Unable to determine the GitHub repository.");
  }
  return [match[1], match[2], branch];
}

function createListItem(): HTMLLIElement | null {
  const ul = getListNode();
  const firstItem = ul?.children.item(0);

  return firstItem instanceof HTMLLIElement
    ? (firstItem.cloneNode(true) as HTMLLIElement)
    : null;
}

function createAnchor(href: string): HTMLAnchorElement {
  const a = document.createElement("a");
  a.className =
    "d-flex flex-items-center color-fg-default text-bold no-underline";
  a.rel = "nofollow";
  a.href = href;

  return a;
}

function createIcon(options: IconOptions): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(options.width));
  svg.setAttribute("height", String(options.height));
  svg.setAttribute("viewBox", options.viewBox);
  svg.setAttribute("version", "1.1");
  svg.setAttribute("class", "octicon");
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("d", options.path);
  svg.appendChild(path);

  return svg;
}

function createText(text: string): Text {
  return document.createTextNode(text);
}

function createItem(options: ItemOptions): HTMLLIElement | null {
  const li = createListItem();
  if (!li) {
    return null;
  }
  const a = createAnchor(options.url);
  const svg = createIcon(options.icon);
  const text = createText(options.name);

  if (options.isNewTab) {
    a.target = "_blank";
  }

  li.querySelector("span svg")?.replaceWith(svg);
  li.querySelector("div span")?.replaceWith(text);

  li.addEventListener("click", () => {
    a.click();
  });

  return li;
}

function renderCloneVscode(): void {
  const [owner, repo, branch] = getRepoInfo();
  renderItem({
    name: "Clone in VSCode",
    url: `vscode://vscode.git/clone?url=${encodeURIComponent(`https://github.com/${owner}/${repo}.git`)}&ref=${encodeURIComponent(branch)}`,
    icon: cloneIcon,
  });
}

function renderItem(options: ItemOptions): void {
  const ul = getListNode();
  if (!ul || ul.querySelector(`[data-userscript="${ITEM_MARKER}"]`)) {
    return;
  }
  const li = createItem(options);
  if (!li) {
    return;
  }
  li.dataset.userscript = ITEM_MARKER;
  const ref =
    ul.querySelector("li[data-platforms]") ||
    ul.children[ul.children.length - 1];

  ul.insertBefore(li, ref);
}

function initialize(): void {
  if (document.querySelector(PORTAL_ROOT_SELECTOR)) {
    renderCloneVscode();
    observePortalRoot();
    return;
  }

  const primerPortalObserver = new MutationObserver((mutations) => {
    const portalAdded = mutations.some(({ addedNodes }) =>
      Array.from(addedNodes).some(
        (node) => node instanceof HTMLElement && node.id === PORTAL_ROOT_ID,
      ),
    );
    if (portalAdded) {
      renderCloneVscode();
      observePortalRoot();
      primerPortalObserver.disconnect();
    }
  });
  primerPortalObserver.observe(document.body, { childList: true, subtree: true });
}

function observePortalRoot(): void {
  const portalRoot = document.querySelector(PORTAL_ROOT_SELECTOR);
  if (!portalRoot) {
    return;
  }
  new MutationObserver(([mutation]) => {
    if (mutation.addedNodes.length > 0) {
      renderCloneVscode();
    }
  }).observe(portalRoot, {
    childList: true,
  });
}

initialize();
