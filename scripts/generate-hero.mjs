#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const scriptDirectory = fileURLToPath(new URL(".", import.meta.url));
const outputDirectory = resolve(scriptDirectory, "../assets/hero");
const featuredProjectsPath = resolve(scriptDirectory, "../data/featured-projects.json");
const imagePath = resolve(scriptDirectory, "../Umam07.png");

function decodePNG(buffer) {
  let offset = 8;
  let width, height, colorType;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data.readUInt8(9);
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  const decompressed = inflateSync(Buffer.concat(idatChunks));
  const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const stride = width * bytesPerPixel;
  const pixels = Buffer.alloc(width * height * bytesPerPixel);

  let srcOffset = 0;
  for (let y = 0; y < height; y++) {
    const filterType = decompressed[srcOffset++];
    for (let x = 0; x < stride; x++) {
      const raw = decompressed[srcOffset++];
      let val = raw;
      const left = x >= bytesPerPixel ? pixels[y * stride + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? pixels[(y - 1) * stride + x - bytesPerPixel] : 0;

      if (filterType === 1) val = (raw + left) & 0xff;
      else if (filterType === 2) val = (raw + up) & 0xff;
      else if (filterType === 3) val = (raw + Math.floor((left + up) / 2)) & 0xff;
      else if (filterType === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
        val = (raw + (pb < pa && pb < pc ? up : pc < pa ? upLeft : left)) & 0xff;
      }
      pixels[y * stride + x] = val;
    }
  }
  return { width, height, bytesPerPixel, pixels };
}

function sampleProportional(decoded, columns, rows, charAspect) {
  const { width, height, bytesPerPixel, pixels } = decoded;
  const renderedAspect = (columns / rows) * charAspect;
  const chars = " .:-=+*#%@";
  const rowsOut = [];

  for (let r = 0; r < rows; r++) {
    let line = "";
    const ny = (r / (rows - 1)) * 2 - 1;

    for (let c = 0; c < columns; c++) {
      const nx = ((c / (columns - 1)) * 2 - 1) * renderedAspect;
      const margin = 1.04;

      if (Math.abs(nx) <= margin && Math.abs(ny) <= margin) {
        const imgX = Math.round(((nx / margin + 1) / 2) * (width - 1));
        const imgY = Math.round(((ny / margin + 1) / 2) * (height - 1));

        if (imgX >= 0 && imgX < width && imgY >= 0 && imgY < height) {
          const idx = (imgY * width + imgX) * bytesPerPixel;
          const red = pixels[idx], green = pixels[idx + 1], blue = pixels[idx + 2];
          const lum = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

          if (lum < 0.12) {
            line += " ";
          } else {
            const charIdx = Math.min(chars.length - 1, Math.max(1, Math.floor(lum * chars.length)));
            line += chars[charIdx];
          }
        } else {
          line += " ";
        }
      } else {
        line += " ";
      }
    }
    rowsOut.push(line);
  }
  return rowsOut;
}

function createAsciiTspans(rows, placement) {
  return rows
    .map((line, row) =>
      `<tspan x="${placement.x}" y="${(placement.y + row * placement.lineHeight).toFixed(2)}" xml:space="preserve">${escapeXml(line)}</tspan>`
    )
    .join("\n");
}

function buildProfileLines(projects) {
  return [
    { type: "header", value: "umam@frontend" },
    { type: "row", key: "Name", value: "Muhammad Syafi'ul Umam" },
    { type: "row", key: "Role", value: "Frontend & UI Developer" },
    { type: "row", key: "Based", value: "Indonesia" },
    { type: "row", key: "Focus", value: "React / Flutter / Modern UI" },
    { type: "blank" },
    { type: "section", value: "BUILD.FOCUS" },
    { type: "row", key: "Frontend", value: "Next.js, React, Tailwind CSS" },
    { type: "row", key: "Mobile", value: "Flutter & Cross-Platform" },
    { type: "row", key: "Tools", value: "Automation & CLI Utilities" },
    { type: "row", key: "UI/UX", value: "Figma to Pixel-Perfect Code" },
    { type: "blank" },
    { type: "section", value: "SELECTED.WORK" },
    ...projects.map((project) => ({
      type: "row",
      key: project.name,
      value: project.focus
    })),
    { type: "blank" },
    { type: "footer", value: "CRAFTING INTUITIVE & DELIGHTFUL EXPERIENCES" }
  ];
}

const palettes = {
  dark: {
    backgroundStart: "#0D1117",
    backgroundEnd: "#161B22",
    panel: "#161B22",
    primary: "#F0F6FC",
    muted: "#8B949E",
    cyan: "#58A6FF",
    blue: "#C9D1D9",
    violet: "#A78BFA",
    green: "#34D399",
    red: "#58A6FF",
    portraitStart: "#58A6FF",
    portraitEnd: "#38BDF8",
    scanBlend: "screen"
  },
  light: {
    backgroundStart: "#F7F1E8",
    backgroundEnd: "#EEE2D4",
    panel: "#FFF9F1",
    primary: "#211A16",
    muted: "#75675C",
    cyan: "#A9431F",
    blue: "#C66B43",
    violet: "#8A6848",
    green: "#56715A",
    red: "#A9431F",
    portraitStart: "#A9431F",
    portraitEnd: "#8A6848",
    scanBlend: "multiply"
  }
};

const layouts = {
  desktop: {
    width: 1180,
    height: 610,
    outerRadius: 18,
    titlebar: { x: 3, y: 3, width: 1174, height: 34, radius: 16 },
    visualPanel: { x: 14, y: 64, width: 488, height: 468, radius: 14 },
    infoPanel: { x: 508, y: 48, width: 655, height: 500, radius: 14 },
    visualTitle: { x: 30, y: 62 },
    infoTitle: { x: 524, y: 62 },
    portrait: { columns: 96, rows: 56, x: 56, y: 104, lineHeight: 7.0, fontSize: 6.6, charAspect: 0.586 },
    portraitClip: { x: 24, y: 82, width: 470, height: 438, radius: 12 },
    system: { x: 528, y: 82, width: 620, lineHeight: 21.5, fontSize: 14 },
    footerY: 585
  },
  mobile: {
    width: 720,
    height: 1080,
    outerRadius: 22,
    titlebar: { x: 20, y: 20, width: 680, height: 42, radius: 14 },
    visualPanel: { x: 48, y: 94, width: 624, height: 350, radius: 14 },
    infoPanel: { x: 48, y: 470, width: 624, height: 526, radius: 14 },
    visualTitle: { x: 66, y: 116 },
    infoTitle: { x: 66, y: 492 },
    portrait: { columns: 86, rows: 48, x: 86, y: 134, lineHeight: 6.1, fontSize: 6.7, charAspect: 0.586 },
    portraitClip: { x: 58, y: 122, width: 604, height: 312, radius: 12 },
    system: { x: 72, y: 520, width: 574, lineHeight: 21, fontSize: 13 },
    footerY: 1045
  }
};

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildAmbientPortraitLayer(layout, colors, size) {
  const clip = layout.portraitClip;
  const isDesktop = size === "desktop";
  const centerX = clip.x + clip.width * 0.5;
  const centerY = clip.y + clip.height * (isDesktop ? 0.48 : 0.45);
  const orbitWidth = clip.width * (isDesktop ? 0.88 : 0.82);
  const orbitHeight = clip.height * (isDesktop ? 0.58 : 0.62);
  const left = clip.x + (isDesktop ? 28 : 34);
  const right = clip.x + clip.width - (isDesktop ? 28 : 34);
  const top = clip.y + (isDesktop ? 46 : 38);
  const bottom = clip.y + clip.height - (isDesktop ? 42 : 30);

  return `<g clip-path="url(#portrait-clip)" class="ambient-map" aria-hidden="true">
  <rect x="${clip.x}" y="${clip.y}" width="${clip.width}" height="${clip.height}" fill="url(#portrait-grid)"/>
  <ellipse cx="${centerX.toFixed(1)}" cy="${centerY.toFixed(1)}" rx="${(orbitWidth * 0.54).toFixed(1)}" ry="${(orbitHeight * 0.54).toFixed(1)}" fill="url(#portrait-halo)"/>
  <ellipse class="motion-orbit motion-orbit--forward" style="transform-origin:${centerX.toFixed(1)}px ${centerY.toFixed(1)}px" cx="${centerX.toFixed(1)}" cy="${centerY.toFixed(1)}" rx="${(orbitWidth * 0.5).toFixed(1)}" ry="${(orbitHeight * 0.5).toFixed(1)}" fill="none" stroke="${colors.cyan}" stroke-width="1" stroke-dasharray="3 14" opacity="0.25"/>
  <ellipse class="motion-orbit motion-orbit--backward" style="transform-origin:${centerX.toFixed(1)}px ${centerY.toFixed(1)}px" cx="${centerX.toFixed(1)}" cy="${centerY.toFixed(1)}" rx="${(orbitWidth * 0.4).toFixed(1)}" ry="${(orbitHeight * 0.38).toFixed(1)}" fill="none" stroke="${colors.violet}" stroke-width="1" stroke-dasharray="28 24" opacity="0.18"/>
  <path d="M ${left} ${top} H ${left + (isDesktop ? 42 : 62)} M ${left} ${top} V ${top + (isDesktop ? 42 : 54)} M ${right} ${bottom} H ${right - (isDesktop ? 42 : 62)} M ${right} ${bottom} V ${bottom - (isDesktop ? 42 : 54)}" fill="none" stroke="${colors.cyan}" stroke-width="1.2" opacity="0.3"/>
  <g fill="${colors.cyan}">
    <circle cx="${left}" cy="${top}" r="2.2" opacity="0.55"/>
    <circle cx="${right}" cy="${bottom}" r="2.2" opacity="0.55"/>
  </g>
</g>`;
}

function buildSystemLayer({ x, y, lineHeight, fontSize }, colors, profileLines) {
  const rows = [];

  profileLines.forEach((line, index) => {
    if (line.type === "blank") return;

    const lineY = y + index * lineHeight;

    if (line.type === "header") {
      rows.push(`<text x="${x}" y="${lineY}" class="system-head"><tspan fill="${colors.violet}">${escapeXml(line.value)}</tspan><tspan fill="${colors.muted}"> ------------------------------------------</tspan></text>`);
      return;
    }

    if (line.type === "section") {
      rows.push(`<text x="${x}" y="${lineY}" class="system-section" fill="${colors.green}">- ${escapeXml(line.value)} -----------------------------------</text>`);
      return;
    }

    if (line.type === "footer") {
      rows.push(`<text x="${x}" y="${lineY}" class="system-footer" fill="${colors.blue}">${escapeXml(line.value)}</text>`);
      return;
    }

    const dots = ".".repeat(Math.max(3, 14 - line.key.length));
    rows.push(
      `<text x="${x}" y="${lineY}" class="system-row"><tspan fill="${colors.muted}">. </tspan><tspan class="system-key" fill="${colors.cyan}">${escapeXml(line.key)}</tspan><tspan fill="${colors.muted}">: ${dots} </tspan><tspan fill="${colors.primary}">${escapeXml(line.value)}</tspan></text>`
    );
  });

  return rows.join("\n");
}

function createHeroSvg(mode, size, asciiRows, profileLines) {
  const colors = palettes[mode];
  const layout = layouts[size];
  const titlebar = layout.titlebar;
  const visual = layout.visualPanel;
  const info = layout.infoPanel;
  const clip = layout.portraitClip;
  const ascii = createAsciiTspans(asciiRows, layout.portrait);
  const ambientPortrait = buildAmbientPortraitLayer(layout, colors, size);
  const system = buildSystemLayer(layout.system, colors, profileLines);
  const isDesktop = size === "desktop";
  const titleCenter = titlebar.x + titlebar.width / 2;
  const liveX = titlebar.x + titlebar.width - (isDesktop ? 138 : 94);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-labelledby="title description">
<title id="title">Muhammad Syafi'ul Umam - Frontend Developer</title>
<desc id="description">A developer profile card with Umam's ASCII avatar, tech focus, and selected projects.</desc>
<defs>
  <linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colors.backgroundStart}"/><stop offset="1" stop-color="${colors.backgroundEnd}"/></linearGradient>
  <linearGradient id="ascii-signal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colors.portraitStart}"/><stop offset="1" stop-color="${colors.portraitEnd}"/></linearGradient>
  <linearGradient id="border" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${colors.violet}"/><stop offset="0.48" stop-color="${colors.cyan}"/><stop offset="1" stop-color="${colors.green}"/></linearGradient>
  <linearGradient id="scan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${colors.cyan}" stop-opacity="0"/><stop offset="0.5" stop-color="${colors.cyan}" stop-opacity="0.46"/><stop offset="1" stop-color="${colors.violet}" stop-opacity="0"/></linearGradient>
  <radialGradient id="portrait-halo"><stop offset="0" stop-color="${colors.cyan}" stop-opacity="0.18"/><stop offset="0.48" stop-color="${colors.blue}" stop-opacity="0.06"/><stop offset="1" stop-color="${colors.violet}" stop-opacity="0"/></radialGradient>
  <pattern id="scanlines" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="${colors.cyan}" opacity="0.04"/></pattern>
  <pattern id="portrait-grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M 44 0 H 0 V 44" fill="none" stroke="${colors.blue}" stroke-width="0.65" opacity="0.085"/><circle cx="0" cy="0" r="1.2" fill="${colors.cyan}" opacity="0.13"/></pattern>
  <clipPath id="portrait-clip"><rect x="${clip.x}" y="${clip.y}" width="${clip.width}" height="${clip.height}" rx="${clip.radius}"/></clipPath>
  <style>
    .mono { font-family: 'Courier New', Consolas, monospace; }
    .ascii { font-family: 'Courier New', Consolas, monospace; font-size: ${layout.portrait.fontSize}px; letter-spacing: -0.15px; fill: url(#ascii-signal); }
    .panel-title { font-family: 'Courier New', Consolas, monospace; font-size: ${isDesktop ? 11 : 12}px; letter-spacing: 2px; fill: ${colors.blue}; opacity: 0.78; }
    .terminal-label { font-family: 'Courier New', Consolas, monospace; font-size: ${isDesktop ? 12 : 11}px; letter-spacing: 0.5px; fill: ${colors.muted}; }
    .live-label { font-family: 'Courier New', Consolas, monospace; font-size: ${isDesktop ? 10 : 9}px; letter-spacing: 1px; fill: ${colors.green}; }
    .system-head { font-family: 'Courier New', Consolas, monospace; font-size: ${layout.system.fontSize + 2}px; font-weight: 700; }
    .system-section, .system-footer, .system-row { font-family: 'Courier New', Consolas, monospace; font-size: ${layout.system.fontSize}px; }
    .system-section, .system-key { font-weight: 700; }
    text, tspan { white-space: pre; }
    .motion-orbit { transform-box: view-box; }
    @keyframes orbit-forward { to { transform: rotate(360deg); } }
    @keyframes orbit-backward { to { transform: rotate(-360deg); } }
    @keyframes scan-sweep { from { transform: translateY(0); } to { transform: translateY(${layout.height + 140}px); } }
    @media (prefers-reduced-motion: no-preference) {
      .motion-orbit--forward { animation: orbit-forward 42s linear infinite; }
      .motion-orbit--backward { animation: orbit-backward 34s linear infinite; }
      .motion-scan { animation: scan-sweep 8s linear infinite; }
    }
    @media (prefers-reduced-motion: reduce) {
      .motion-scan { display: none; }
    }
  </style>
</defs>
<rect width="${layout.width}" height="${layout.height}" rx="${layout.outerRadius}" fill="url(#background)"/>
<rect width="${layout.width}" height="${layout.height}" rx="${layout.outerRadius}" fill="url(#scanlines)"/>
<rect x="${titlebar.x}" y="${titlebar.y}" width="${titlebar.width}" height="${titlebar.height}" rx="${titlebar.radius}" fill="${colors.panel}" fill-opacity="0.84"/>
<circle cx="${titlebar.x + 21}" cy="${titlebar.y + titlebar.height / 2}" r="5" fill="#FF5F56" opacity="0.88"/>
<circle cx="${titlebar.x + 39}" cy="${titlebar.y + titlebar.height / 2}" r="5" fill="#FFBD2E" opacity="0.88"/>
<circle cx="${titlebar.x + 57}" cy="${titlebar.y + titlebar.height / 2}" r="5" fill="#27C93F" opacity="0.88"/>
<text x="${titleCenter}" y="${titlebar.y + titlebar.height / 2 + 5}" text-anchor="middle" class="terminal-label">umam@dev ~ % ./profile</text>
${isDesktop ? `<circle cx="${liveX}" cy="${titlebar.y + titlebar.height / 2}" r="4" fill="${colors.green}"/><text x="${liveX + 10}" y="${titlebar.y + titlebar.height / 2 + 4}" class="live-label">ONLINE</text>` : ""}
<rect x="${visual.x}" y="${visual.y}" width="${visual.width}" height="${visual.height}" rx="${visual.radius}" fill="${colors.panel}" fill-opacity="0.38" stroke="url(#border)" stroke-opacity="0.42"/>
<rect x="${info.x}" y="${info.y}" width="${info.width}" height="${info.height}" rx="${info.radius}" fill="${colors.panel}" fill-opacity="0.42" stroke="url(#border)" stroke-opacity="0.42"/>
<text x="${layout.visualTitle.x}" y="${layout.visualTitle.y}" class="panel-title">AVATAR / UMAM</text>
<text x="${layout.infoTitle.x}" y="${layout.infoTitle.y}" class="panel-title">PROFILE / DEV</text>
${ambientPortrait}
<g clip-path="url(#portrait-clip)">
  <text class="ascii" fill="${colors.cyan}">${ascii}</text>
</g>
${system}
<text x="${layout.width / 2}" y="${layout.footerY}" text-anchor="middle" class="mono" font-size="10" letter-spacing="1.5" fill="${colors.muted}">FRONTEND ENGINEERING / REACT / FLUTTER / UI/UX / AUTOMATION</text>
<rect class="motion-scan" x="0" y="-70" width="${layout.width}" height="70" fill="url(#scan)" opacity="0.35" style="mix-blend-mode:${colors.scanBlend}"/>
<rect x="3" y="3" width="${layout.width - 6}" height="${layout.height - 6}" rx="${layout.outerRadius - 2}" fill="none" stroke="url(#border)" stroke-width="2" opacity="0.76"/>
</svg>`;
}

const outputs = [
  { filename: "builder-profile-v2-dark.svg", mode: "dark", size: "desktop" },
  { filename: "builder-profile-v2-light.svg", mode: "light", size: "desktop" },
  { filename: "builder-profile-v2-mobile-dark.svg", mode: "dark", size: "mobile" },
  { filename: "builder-profile-v2-mobile-light.svg", mode: "light", size: "mobile" }
];

async function main() {
  const projects = JSON.parse(await readFile(featuredProjectsPath, "utf8"));
  const imageBuffer = await readFile(imagePath);
  const decoded = decodePNG(imageBuffer);

  const profileLines = buildProfileLines(projects);

  await mkdir(outputDirectory, { recursive: true });

  for (const output of outputs) {
    const layout = layouts[output.size];
    const asciiRows = sampleProportional(
      decoded,
      layout.portrait.columns,
      layout.portrait.rows,
      layout.portrait.charAspect
    );
    const svgContent = createHeroSvg(output.mode, output.size, asciiRows, profileLines);
    await writeFile(resolve(outputDirectory, output.filename), `${svgContent.trimEnd()}\n`);
  }

  console.log("Successfully generated proportional non-gepeng ASCII cat avatar hero assets!");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
