import { describe, expect, test } from "bun:test";
import { parseQualityCheckContent } from "./imageQualityCheck";

describe("quality check parsing", () => {
  test("reads fenced JSON and normalizes unknown issue types", () => {
    const result = parseQualityCheckContent('```json\n{"passed": false, "score": "6", "issues": [{"type": "text", "detail": "标题少了「咖」字"}, {"type": "lighting", "detail": "偏暗"}], "suggestion": "把标题改为「山间咖啡」"}\n```');
    expect(result.passed).toBe(false);
    expect(result.score).toBe(6);
    expect(result.issues.map((issue) => issue.type)).toEqual(["text", "artifact"]);
    expect(result.suggestion).toBe("把标题改为「山间咖啡」");
  });

  test("defaults missing fields and rejects non-JSON replies", () => {
    expect(parseQualityCheckContent('结果：{"passed": true, "score": 9}')).toEqual({ passed: true, score: 9, issues: [], suggestion: "" });
    expect(() => parseQualityCheckContent("看起来不错")).toThrow();
  });
});
