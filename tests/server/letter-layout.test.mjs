import { test } from "node:test";
import assert from "node:assert/strict";
import { mapLetterLayout } from "../../server/letter-layout.mjs";

test("PDF layout maps floating text, mixed formatting and continued paragraphs without changing page artwork", () => {
  const xml = `<pdf2xml><page number="1" width="595" height="842">
    <fontspec id="0" size="11" family="AAAAAA+Calibri" color="#111111"/>
    <text top="790" left="200" width="180" height="12" font="0">Kingsvale Homes</text>
    <text top="250" left="430" width="110" height="12" font="0">5 November 2026</text>
    <text top="150" left="50" width="100" height="12" font="0">Amy Example</text>
    <text top="320" left="50" width="200" height="12" font="0">Please quote <b>KV0114</b>.</text>
    <text top="700" left="50" width="160" height="12" font="0">This paragraph continues</text>
  </page><page number="2" width="595" height="842">
    <fontspec id="0" size="11" family="AAAAAA+Calibri" color="#111111"/>
    <text top="50" left="50" width="130" height="12" font="0">on the next page.</text>
    <text top="790" left="200" width="180" height="12" font="0">Kingsvale Homes</text>
  </page></pdf2xml>`;
  const paragraphs = [{ id: 1, text: "\nAmy Example" }, { id: 2, text: "5 November 2026" }, { id: 3, text: "Please quote KV0114." }, { id: 4, text: "This paragraph continues on the next page." }, { id: 5, text: "Kingsvale Homes" }];
  const layout = mapLetterLayout(xml, ["first-page-image", "second-page-image"], paragraphs);
  assert.equal(layout.pages[0].image, "first-page-image");
  assert.equal(layout.pages[1].image, "second-page-image");
  assert.equal(layout.blocks.length, paragraphs.length);
  assert.equal(layout.blocks.find((block) => block.id === 1).y, 150);
  assert.equal(layout.blocks.find((block) => block.id === 1).prefix, "\n");
  assert.equal(layout.blocks.find((block) => block.id === 2).x, 430);
  const mixed = layout.blocks.find((block) => block.id === 3);
  assert.equal(mixed.runs.map((run) => run.text).join(""), "Please quote KV0114.");
  assert.equal(mixed.runs.find((run) => run.text.includes("KV0114")).bold, true);
  assert.equal(mixed.runs[0].fontFamily, "Calibri");
  assert.equal(layout.blocks.find((block) => block.id === 4).fragments.length, 2);
});
