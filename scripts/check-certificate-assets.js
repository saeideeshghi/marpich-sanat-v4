import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { certificatePhoto } from "../build/certificate-assets.js";
import { preparePublicAssets } from "../build/public-assets.js";

const photo = '<image id="image0_13_720" width="2290" height="3342" xlink:href="data:image/png;base64,AA==" />';
const exported = '<svg><g filter="url(#filter0_d_13_720)"><rect/><path d="M0 0"/></g><defs>' + photo + "</defs></svg>";
const result = certificatePhoto(exported, "certificate-iso.svg");
assert(result.includes('viewBox="0 0 2290 3342"') && result.includes(photo));
assert(!result.includes("<g") && !result.includes("<filter") && !result.includes("<path"));
assert.equal(certificatePhoto(result, "certificate-iso.svg"), result, "Photo preparation is idempotent");
for (const custom of ["<svg><path/></svg>", '<svg><image href="new-photo.png"/></svg>'])
    assert.equal(certificatePhoto(custom, "certificate-iso.svg"), custom);
assert.equal(certificatePhoto(exported, "another-page.svg"), exported, "Other artwork is never transformed");
assert.equal(
    certificatePhoto(exported.replace('width="2290"', 'width="0"'), "certificate-iso.svg"),
    exported.replace('width="2290"', 'width="0"'),
);

const root = mkdtempSync(resolve(tmpdir(), "marpich-certificate-"));
try {
    const folder = resolve(root, "assets/images/about");
    mkdirSync(folder, { recursive: true });
    const source = resolve(folder, "certificate-iso.svg");
    writeFileSync(source, exported);
    const output = preparePublicAssets(root);
    assert.equal(readFileSync(source, "utf8"), exported, "The owner's source SVG must remain unchanged");
    assert.equal(readFileSync(resolve(output, "assets/images/about/certificate-iso.svg"), "utf8"), result);
    assert.equal(
        readFileSync(resolve(preparePublicAssets(root), "assets/images/about/certificate-iso.svg"), "utf8"),
        result,
    );
} finally {
    rmSync(root, { recursive: true, force: true });
}
console.log(
    "PASS: certificate photo without embedded shadow/caption, custom artwork preservation and source-safe repeat builds.",
);
