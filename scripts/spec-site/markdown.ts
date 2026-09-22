/**
 * Renders specification MDX and proposal Markdown to HTML fragments.
 *
 * This module is pure: no filesystem, no browser. Everything environmental is
 * passed in (link resolution) or handed back for a later stage (diagrams,
 * which need a browser to render), so it can be unit-tested directly.
 */

import { createHash } from "node:crypto";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkGfm from "remark-gfm";
import remarkRehype, {
  defaultHandlers,
  type Options as RemarkRehypeOptions,
} from "remark-rehype";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";
import { parse as parseYaml } from "yaml";
import type {
  Element,
  ElementContent,
  Properties,
  Root,
  RootContent,
} from "hast";
import type { Code } from "mdast";
import type { MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import { Slugger, headingAliases } from "./slug";

type Handlers = NonNullable<RemarkRehypeOptions["handlers"]>;
type State = Parameters<NonNullable<Handlers["code"]>>[0];

export interface RenderOptions {
  /** "mdx" for specification pages, "md" for proposals (plain Markdown, raw HTML allowed). */
  format: "mdx" | "md";
  /** Prefix applied to every id and in-page fragment link, keeping ids unique when pages are combined. */
  idPrefix?: string;
  /** Added to every heading level (capped at h6), so a page nests under its section heading. */
  headingOffset?: number;
  /** Drop the first h1; used when the template renders the title itself. */
  dropFirstH1?: boolean;
  /** Maps every non-fragment href to its published location. */
  resolveLink?: (href: string) => string;
  /** Maps every image src to its published location. */
  resolveAsset?: (src: string) => string;
}

export interface Heading {
  /** Level as written in the source, before headingOffset. */
  depth: number;
  /** Final id, including idPrefix. */
  id: string;
  text: string;
}

export interface Diagram {
  hash: string;
  code: string;
}

export interface Rendered {
  frontmatter: Record<string, unknown>;
  html: string;
  headings: Heading[];
  diagrams: Diagram[];
  warnings: string[];
}

const CALLOUTS: Record<string, string> = {
  Note: "Note",
  Info: "Info",
  Tip: "Tip",
  Warning: "Warning",
  Check: "Check",
};

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function splitFrontmatter(source: string): {
  data: Record<string, unknown>;
  body: string;
} {
  const match = FRONTMATTER.exec(source);
  if (!match) return { data: {}, body: source };
  const data = parseYaml(match[1]) as unknown;
  return {
    data:
      data && typeof data === "object" ? (data as Record<string, unknown>) : {},
    body: source.slice(match[0].length),
  };
}

/** The exact markup a mermaid block becomes, to be swapped for the rendered diagram later. */
export function diagramPlaceholder(hash: string): string {
  return `<div class="mermaid-diagram" data-mermaid-hash="${hash}"></div>`;
}

export function diagramHash(code: string): string {
  return createHash("sha256").update(code).digest("hex").slice(0, 16);
}

export function renderMarkdown(
  source: string,
  options: RenderOptions,
): Rendered {
  const { data, body } = splitFrontmatter(source);
  const diagrams: Diagram[] = [];
  const warnings: string[] = [];
  const headings: Heading[] = [];
  const prefixed = (id: string) =>
    options.idPrefix ? `${options.idPrefix}--${id}` : id;

  const expression = (value: string): undefined => {
    if (!/^\s*\/\*[\s\S]*\*\/\s*$/.test(value)) {
      warnings.push(`dropped MDX expression {${value.trim().slice(0, 40)}}`);
    }
    return undefined;
  };

  const jsx = (state: State, node: MdxJsxFlowElement | MdxJsxTextElement) => {
    const children = state.all(node);
    if (!node.name) return children;
    if (/^[a-z]/.test(node.name))
      return element(node.name, attributes(node), children);

    const label = CALLOUTS[node.name];
    if (label) {
      return element(
        "aside",
        { className: ["callout", `callout-${label.toLowerCase()}`] },
        [
          element("p", { className: ["callout-label"] }, [text(label)]),
          ...children,
        ],
      );
    }
    if (node.name === "CardGroup")
      return element("div", { className: ["card-group"] }, children);
    if (node.name === "Card") {
      const { title, href } = attributes(node);
      const heading =
        typeof href === "string"
          ? [element("a", { href }, [text(String(title ?? ""))])]
          : [text(String(title ?? ""))];
      return element("div", { className: ["card"] }, [
        element("p", { className: ["card-title"] }, heading),
        ...children,
      ]);
    }
    warnings.push(
      `unsupported component <${node.name}> rendered as a plain container`,
    );
    return element(
      "div",
      { className: ["component", `component-${node.name.toLowerCase()}`] },
      children,
    );
  };

  const handlers: Handlers = {
    mdxjsEsm: () => undefined,
    mdxFlowExpression: (_state, node) => expression(node.value),
    mdxTextExpression: (_state, node) => expression(node.value),
    mdxJsxFlowElement: jsx,
    mdxJsxTextElement: jsx,
    code(state, node: Code) {
      if (node.lang === "mermaid") {
        const hash = diagramHash(node.value);
        diagrams.push({ hash, code: node.value });
        return element(
          "div",
          { className: ["mermaid-diagram"], dataMermaidHash: hash },
          [],
        );
      }
      return defaultHandlers.code(state, node);
    },
  };

  const rewrite = () => (tree: Root) => {
    const slugger = new Slugger();
    let droppedTitle = false;
    const ids = new Set<string>();
    const aliasable: { heading: Element; slug: string; text: string }[] = [];

    const visit = (parent: Root | Element) => {
      const kept: RootContent[] = [];
      for (const child of parent.children) {
        if (child.type !== "element") {
          kept.push(child);
          continue;
        }
        // typedoc permalink icons reference an icon sprite that is not published.
        if (hasClass(child, "tsd-anchor-icon")) continue;

        const depth = headingDepth(child);
        if (depth && options.dropFirstH1 && depth === 1 && !droppedTitle) {
          droppedTitle = true;
          continue;
        }
        if (depth) {
          const content = textContent(child).trim();
          const own = child.properties.id;
          const slug = typeof own === "string" ? own : slugger.slug(content);
          const id = prefixed(slug);
          child.properties.id = id;
          child.tagName = `h${Math.min(6, depth + (options.headingOffset ?? 0))}`;
          headings.push({ depth, id, text: content });
          aliasable.push({ heading: child, slug, text: content });
        } else if (typeof child.properties.id === "string") {
          child.properties.id = prefixed(child.properties.id);
        }
        if (typeof child.properties.id === "string")
          ids.add(child.properties.id);

        if (
          child.tagName === "a" &&
          typeof child.properties.href === "string"
        ) {
          const href = child.properties.href;
          if (href.startsWith("#")) {
            child.properties.href =
              href.length > 1 ? `#${prefixed(href.slice(1))}` : href;
          } else if (options.resolveLink) {
            child.properties.href = options.resolveLink(href);
          }
        }

        if (
          child.tagName === "img" &&
          typeof child.properties.src === "string" &&
          options.resolveAsset
        ) {
          child.properties.src = options.resolveAsset(child.properties.src);
        }

        visit(child);
        kept.push(child);
      }
      parent.children = kept as typeof parent.children;
    };
    visit(tree);

    // Aliases go in only once every real id is known, so they can never shadow one.
    for (const { heading, slug, text: content } of aliasable) {
      const aliases = headingAliases(slug, content)
        .map(prefixed)
        .filter((alias) => !ids.has(alias));
      for (const alias of aliases) ids.add(alias);
      heading.children.unshift(
        ...aliases.map((alias) =>
          element("span", { id: alias, className: ["anchor-alias"] }, []),
        ),
      );
    }
  };

  const raw = options.format === "md";
  const file = unified()
    .use(remarkParse)
    .use(options.format === "mdx" ? [remarkMdx] : [])
    .use(remarkGfm)
    .use(remarkRehype, { handlers, allowDangerousHtml: raw })
    .use(rewrite)
    .use(rehypeHighlight, {
      plainText: ["text", "http"],
      aliases: { json: ["jsonc", "json5", "jsonl"], markdown: ["mdx"] },
    })
    .use(rehypeStringify, { allowDangerousHtml: raw })
    .processSync(body);

  for (const message of file.messages) warnings.push(message.reason);

  return {
    frontmatter: data,
    html: String(file),
    headings,
    diagrams,
    warnings,
  };
}

function element(
  tagName: string,
  properties: Properties,
  children: ElementContent[],
): Element {
  return { type: "element", tagName, properties, children };
}

function text(value: string): ElementContent {
  return { type: "text", value };
}

function attributes(node: MdxJsxFlowElement | MdxJsxTextElement): Properties {
  const properties: Properties = {};
  for (const attribute of node.attributes) {
    if (attribute.type !== "mdxJsxAttribute") continue; // spread expressions carry no static value
    const raw = attribute.value;
    const value =
      raw === null || raw === undefined
        ? true
        : typeof raw === "string"
          ? raw
          : raw.value;
    if (attribute.name === "class" || attribute.name === "className") {
      properties.className = String(value).split(/\s+/).filter(Boolean);
    } else {
      properties[attribute.name] = value;
    }
  }
  return properties;
}

function hasClass(node: Element, name: string): boolean {
  const classes = node.properties.className;
  return Array.isArray(classes) && classes.includes(name);
}

function headingDepth(node: Element): number {
  const match = /^h([1-6])$/.exec(node.tagName);
  return match ? Number(match[1]) : 0;
}

function textContent(node: Element | ElementContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(textContent).join("");
  return "";
}
