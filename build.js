/* Builds dist/mcl-single.html - the whole site inlined into one file.
   Netlify serves the folder as-is, so you only need this if you want a
   single portable file (or to publish the Claude artifact preview).

   Run:  node build.js
*/
const fs = require("fs");
const path = require("path");

const root = __dirname;
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "css", "style.css"), "utf8");

const scripts = ["scenery.js", "store.js", "media.js", "cloud.js", "router.js", "views.js", "app.js"]
  .map(f => fs.readFileSync(path.join(root, "js", f), "utf8"));

const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [, "Mucy's Challenge List"])[1];
const fonts = (html.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/) || [""])[0];
const body = (html.match(/<!-- APP:START -->([\s\S]*?)<!-- APP:END -->/) || [, ""])[1];

const out = [
  `<title>${title}</title>`,
  fonts,
  `<style>\n${css}\n</style>`,
  body.trim(),
  ...scripts.map(s => `<script>\n${s}\n</script>`)
].join("\n");

fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist", "mcl-single.html"), out);
console.log("wrote dist/mcl-single.html  (" + Math.round(out.length / 1024) + " KB)");
