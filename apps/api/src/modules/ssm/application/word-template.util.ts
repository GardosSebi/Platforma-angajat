import JSZip from "jszip";

export function isWordMimeOrName(mimeType?: string | null, fileName?: string | null): boolean {
  const mime = (mimeType ?? "").toLowerCase();
  const name = (fileName ?? "").toLowerCase();
  return (
    mime.includes("word") ||
    mime.includes("officedocument.wordprocessingml") ||
    name.endsWith(".docx") ||
    name.endsWith(".doc")
  );
}

export function sanitizeTemplateHtml(input: string): string {
  const raw = input?.trim() ? input : "<p></p>";
  return raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    .slice(0, 200_000);
}

export function defaultTemplateHtml(title: string, checklistItems: string[] = []): string {
  const checks = checklistItems.length
    ? `<h2>Listă de verificare</h2><ul>${checklistItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";
  return [
    `<h1>${escapeHtml(title)}</h1>`,
    `<p><strong>Entitate:</strong> {{entitate}} &nbsp; <strong>Punct de lucru:</strong> {{punctLucru}}</p>`,
    `<p><strong>Post / departament:</strong> {{post}} / {{departament}} &nbsp; <strong>Data:</strong> {{data}}</p>`,
    `<h2>1. Scop</h2>`,
    `<p>Prezentul document stabilește regulile aplicabile pentru ${escapeHtml(title)}.</p>`,
    `<h2>2. Domeniu de aplicare</h2>`,
    `<p>Se aplică angajatului {{angajat}} și personalului din zona de lucru asociată.</p>`,
    `<h2>3. Responsabilități</h2>`,
    `<ul><li>Angajatul respectă măsurile din document.</li><li>Responsabilul SSM actualizează versiunea activă.</li></ul>`,
    `<h2>4. Măsuri</h2>`,
    `<p>Completează aici măsurile, instrucțiunile sau tematica specifică.</p>`,
    checks
  ].join("");
}

export async function htmlToDocxBuffer(html: string, title: string): Promise<Buffer> {
  const zip = new JSZip();
  const safeTitle = escapeXml(title || "Șablon SSM");
  const body = htmlToWordBody(sanitizeTemplateHtml(html));
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>
  </w:body>
</w:document>`
  );
  zip.file(
    "docProps/core.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>${safeTitle}</dc:title>
  <dc:creator>Platforma Employee</dc:creator>
</cp:coreProperties>`
  );
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return Buffer.from(buffer);
}

export async function docxBufferToHtml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) {
    return "<p></p>";
  }
  return sanitizeTemplateHtml(wordXmlToHtml(documentXml));
}

function htmlToWordBody(html: string): string {
  const wrapped = `<div>${html}</div>`;
  const blocks = splitBlocks(wrapped);
  if (!blocks.length) {
    return `<w:p><w:r><w:t></w:t></w:r></w:p>`;
  }
  return blocks.map((block) => blockToParagraph(block)).join("");
}

function splitBlocks(html: string): Array<{ tag: string; html: string }> {
  const matches = [...html.matchAll(/<(h1|h2|h3|p|li|ul|ol)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi)];
  if (!matches.length) {
    const text = stripTags(html).trim();
    return text ? [{ tag: "p", html: text }] : [];
  }
  const blocks: Array<{ tag: string; html: string }> = [];
  for (const match of matches) {
    const tag = match[1].toLowerCase();
    if (tag === "ul" || tag === "ol") {
      const items = [...match[3].matchAll(/<li(\s[^>]*)?>([\s\S]*?)<\/li>/gi)];
      for (const item of items) {
        blocks.push({ tag: "li", html: item[2] });
      }
      continue;
    }
    blocks.push({ tag, html: match[3] });
  }
  return blocks;
}

function blockToParagraph(block: { tag: string; html: string }): string {
  const style =
    block.tag === "h1"
      ? `<w:pPr><w:pStyle w:val="Heading1"/><w:spacing w:after="200"/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:pPr>`
      : block.tag === "h2"
        ? `<w:pPr><w:pStyle w:val="Heading2"/><w:spacing w:after="160"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:pPr>`
        : block.tag === "h3"
          ? `<w:pPr><w:pStyle w:val="Heading3"/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:pPr>`
          : block.tag === "li"
            ? `<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>`
            : `<w:pPr><w:spacing w:after="120"/></w:pPr>`;
  return `<w:p>${style}${inlineToRuns(block.html)}</w:p>`;
}

function inlineToRuns(html: string): string {
  const tokens = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&nbsp;/gi, " ");
  const parts: string[] = [];
  const regex = /<\/?(strong|b|em|i|u|span)(\s[^>]*)?>|[^<]+/gi;
  let bold = false;
  let italic = false;
  let underline = false;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(tokens))) {
    const token = match[0];
    const open = token.match(/^<(strong|b|em|i|u|span)(\s[^>]*)?>$/i);
    const close = token.match(/^<\/(strong|b|em|i|u|span)>$/i);
    if (open) {
      const tag = open[1].toLowerCase();
      if (tag === "strong" || tag === "b") bold = true;
      if (tag === "em" || tag === "i") italic = true;
      if (tag === "u") underline = true;
      continue;
    }
    if (close) {
      const tag = close[1].toLowerCase();
      if (tag === "strong" || tag === "b") bold = false;
      if (tag === "em" || tag === "i") italic = false;
      if (tag === "u") underline = false;
      continue;
    }
    const text = decodeEntities(stripTags(token)).replace(/\u00a0/g, " ");
    if (!text) continue;
    const rPr = [
      bold ? "<w:b/>" : "",
      italic ? "<w:i/>" : "",
      underline ? '<w:u w:val="single"/>' : ""
    ].join("");
    const chunks = text.split("\n");
    chunks.forEach((chunk, index) => {
      if (chunk) {
        parts.push(
          `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:t xml:space="preserve">${escapeXml(chunk)}</w:t></w:r>`
        );
      }
      if (index < chunks.length - 1) {
        parts.push(`<w:r><w:br/></w:r>`);
      }
    });
  }
  return parts.join("") || `<w:r><w:t></w:t></w:r>`;
}

function wordXmlToHtml(xml: string): string {
  const paragraphs = [...xml.matchAll(/<w:p[\s\S]*?<\/w:p>/g)];
  if (!paragraphs.length) {
    return `<p>${escapeHtml(extractText(xml))}</p>`;
  }
  const html: string[] = [];
  for (const paragraph of paragraphs) {
    const pxml = paragraph[0];
    const text = extractText(pxml);
    if (!text.trim()) continue;
    const isH1 = /w:val="Heading1"|<w:sz w:val="3[6-9]"/.test(pxml);
    const isH2 = /w:val="Heading2"|<w:sz w:val="2[8-9]"/.test(pxml);
    const isH3 = /w:val="Heading3"|<w:sz w:val="2[4-6]"/.test(pxml);
    const isList = /<w:numPr>/.test(pxml);
    const formatted = formatRuns(pxml) || escapeHtml(text);
    if (isH1) html.push(`<h1>${formatted}</h1>`);
    else if (isH2) html.push(`<h2>${formatted}</h2>`);
    else if (isH3) html.push(`<h3>${formatted}</h3>`);
    else if (isList) html.push(`<ul><li>${formatted}</li></ul>`);
    else html.push(`<p>${formatted}</p>`);
  }
  return html.join("") || "<p></p>";
}

function formatRuns(pxml: string): string {
  const runs = [...pxml.matchAll(/<w:r[\s\S]*?<\/w:r>/g)];
  if (!runs.length) return "";
  return runs
    .map((run) => {
      const xml = run[0];
      const text = extractText(xml);
      if (!text) return xml.includes("<w:br") ? "<br/>" : "";
      let inner = escapeHtml(text);
      if (/<w:b\b/.test(xml)) inner = `<strong>${inner}</strong>`;
      if (/<w:i\b/.test(xml)) inner = `<em>${inner}</em>`;
      if (/<w:u\b/.test(xml)) inner = `<u>${inner}</u>`;
      return inner;
    })
    .join("");
}

function extractText(xml: string): string {
  return [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeEntities(match[1]))
    .join("");
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeXml(value: string): string {
  return escapeHtml(value);
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
