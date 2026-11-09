import { DocAdapter, DocType } from "../types";
import { ConfluenceAdapter } from "./confluenceAdapter";
import { DocstringAdapter } from "./docstringAdapter";
import { MarkdownAdapter } from "./markdownAdapter";
import { OpenApiAdapter } from "./openApiAdapter";

export const ADAPTERS: Record<DocType, DocAdapter> = {
  docstring: DocstringAdapter,
  markdown: MarkdownAdapter,
  openapi: OpenApiAdapter,
  confluence: ConfluenceAdapter
};

export { ConfluenceAdapter, DocstringAdapter, MarkdownAdapter, OpenApiAdapter };
