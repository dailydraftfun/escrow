import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const EXPECTED_FILES = {
  "dailydraft_escrow.json":
    "dbd27bbc7b3c5b52b5d7a839c7c53daef09eb7228be99525873ffe2b4d6058d8",
  "build-manifest.json":
    "39a8232c65a5c2c3eca80b4138e2e93d556ef217f3cf20f87a06a0b6d9886ed3",
} as const;

describe("checked IDL provenance", () => {
  test("matches the verified workflow artifact", async () => {
    const [checksums, manifestBytes, provenanceBytes] = await Promise.all([
      readFile(new URL("../idl/SHA256SUMS", import.meta.url), "utf8"),
      readFile(new URL("../idl/build-manifest.json", import.meta.url)),
      readFile(new URL("../idl/provenance.json", import.meta.url)),
    ]);
    const manifest = JSON.parse(manifestBytes.toString());
    const provenance = JSON.parse(provenanceBytes.toString());

    for (const [file, expectedHash] of Object.entries(EXPECTED_FILES)) {
      const bytes = await readFile(new URL(`../idl/${file}`, import.meta.url));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        expectedHash,
      );
      expect(checksums).toContain(`${expectedHash}  ${file}`);
      expect(provenance.files[file]).toBe(expectedHash);
    }
    expect(manifest.sourceSha).toBe(provenance.sourceSha);
    expect(manifest.idl.sha256).toBe(EXPECTED_FILES["dailydraft_escrow.json"]);
    expect(provenance.workflowRunId).toBe(30179550427);
    expect(provenance.artifactSha256SumsFileSha256).toBe(
      "15432d424c491dbed581fe359acf991efb3080927e397ef924bb3586c3ba48d7",
    );
  });

  // The program name reaches consumers through four independent records: the
  // artifact filenames, the IDL metadata, the build manifest, and the
  // provenance file. Checking whichever field came to mind is how a stale copy
  // survives a rename, so the whole text of each record is asserted first and
  // the individual names after.
  test("publishes one program name, with no trace of the retired brand", async () => {
    const [manifestText, provenanceText, idlText] = await Promise.all([
      readFile(new URL("../idl/build-manifest.json", import.meta.url), "utf8"),
      readFile(new URL("../idl/provenance.json", import.meta.url), "utf8"),
      readFile(
        new URL("../idl/dailydraft_escrow.json", import.meta.url),
        "utf8",
      ),
    ]);

    for (const record of [manifestText, provenanceText, idlText]) {
      expect(record.toLowerCase()).not.toContain("openpacksduel");
    }

    const manifest = JSON.parse(manifestText);
    const provenance = JSON.parse(provenanceText);
    const idl = JSON.parse(idlText);

    expect(manifest.programName).toBe("dailydraft_escrow");
    expect(manifest.artifact.file).toBe("dailydraft_escrow.so");
    expect(manifest.idl.file).toBe("dailydraft_escrow.json");
    expect(idl.metadata.name).toBe("dailydraft_escrow");
    expect(provenance.artifactName).toBe(
      `dailydraft-escrow-${manifest.sourceSha}`,
    );
    expect(provenance.repository).toBe(
      "https://github.com/dailydraftfun/escrow",
    );
    expect(idl.address).toBe(manifest.programId);
  });
});
