import { parse as parseYaml } from "yaml";
import { DocAdapter, DocModel, ParamModel } from "../types";

interface OpenApiParameter {
  name: string;
  required?: boolean;
  schema?: { type?: string };
}

interface OpenApiOperation {
  "x-docsync-ref"?: string;
  summary?: string;
  parameters?: OpenApiParameter[];
  responses?: Record<string, { description?: string }>;
}

interface OpenApiDocument {
  paths?: Record<string, Record<string, OpenApiOperation>>;
}

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];

/**
 * Parses an OpenAPI 3.x YAML/JSON document and emits one DocModel per operation that carries the
 * `x-docsync-ref` vendor extension (the OpenAPI linkage convention from the design review).
 */
export const OpenApiAdapter: DocAdapter = {
  docType: "openapi",
  parse(content: string, location: string): DocModel[] {
    const doc = parseYaml(content) as OpenApiDocument;
    const models: DocModel[] = [];

    for (const [path, methods] of Object.entries(doc.paths ?? {})) {
      for (const method of HTTP_METHODS) {
        const operation = methods[method];
        if (!operation || !operation["x-docsync-ref"]) continue;

        const params: ParamModel[] = (operation.parameters ?? []).map((p) => ({
          name: p.name,
          type: p.schema?.type,
          optional: !p.required
        }));
        const successResponse = operation.responses?.["200"] ?? operation.responses?.["201"];

        models.push({
          docType: "openapi",
          location: `${location}#${path}:${method}`,
          symbolId: operation["x-docsync-ref"],
          documentedParams: params,
          description: operation.summary ?? successResponse?.description,
          rawContent: JSON.stringify(operation, null, 2)
        });
      }
    }

    return models;
  },
  render(model: DocModel): string {
    const paramsYaml = (model.documentedParams ?? [])
      .map((p) => `        - name: ${p.name}\n          in: path\n          required: ${!p.optional}\n          schema:\n            type: ${p.type ?? "string"}`)
      .join("\n");
    return [
      `      x-docsync-ref: "${model.symbolId}"`,
      `      summary: ${model.description ?? ""}`,
      "      parameters:",
      paramsYaml
    ].join("\n");
  }
};
