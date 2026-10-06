import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { Button, Checkbox, Input, Select, Textarea } from ".";

test("native controls retain labels, error association, form behavior and disabled state", () => {
  const html = renderToStaticMarkup(<form><Input id="name" label="Name" error="Required" required /><Textarea id="request" label="Request" /><Select id="mode" label="Mode"><option value="t2i">Text</option></Select><Checkbox label="Remember" /><Button>Normal</Button><Button type="submit" disabled>Submit</Button></form>);
  expect(html).toContain('for="name"'); expect(html).toContain('aria-describedby="name-error"'); expect(html).toContain('aria-invalid="true"');
  expect(html).toContain('id="name-error"'); expect(html).toContain('role="alert"'); expect(html).toContain('for="request"'); expect(html).toContain('for="mode"');
  expect(html).toContain('type="button"'); expect(html).toContain('type="submit"'); expect(html).toContain('disabled=""'); expect(html).toContain('type="checkbox"');
});

test("both themes meet AA text and interactive boundary contrast", () => {
  const css = readFileSync(new URL("../styles/tokens.css", import.meta.url), "utf8");
  const sections = [css.split('html[data-appearance="dark"]')[0], css.split('html[data-appearance="dark"]')[1].split(':root, html[data-appearance]')[0]];
  const luminance = (hex: string) => {
    const c = hex.slice(1).match(/../g)!.map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
  };
  const contrast = (a: string, b: string) => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high + .05) / (low + .05);
  };
  for (const section of sections) {
    const colors = Object.fromEntries([...section.matchAll(/--sb-([\w-]+): (#[a-f0-9]{6});/g)].map(match => [match[1], match[2]]));
    for (const background of ["bg", "surface", "soft"]) {
      for (const text of ["text", "muted", "accent", "danger", "success"]) expect(contrast(colors[text], colors[background])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors["control-border"], colors[background])).toBeGreaterThanOrEqual(3);
    }
    expect(contrast(colors["on-accent"], colors.accent)).toBeGreaterThanOrEqual(4.5);
  }
});
