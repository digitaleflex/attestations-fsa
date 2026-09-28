import { vi, describe, it, expect, beforeEach } from "vitest";

const presign = vi.hoisted(() => ({ getSignedUrl: vi.fn(async () => "https://signed.test/url") }));
const commands = vi.hoisted(() => ({ sent: [] as unknown[] }));

vi.mock("@aws-sdk/client-s3", () => {
  class FakeCommand {
    constructor(public readonly input: Record<string, unknown>) {}
  }
  return {
    S3Client: class {
      send(command: unknown) {
        commands.sent.push(command);
        return Promise.resolve({});
      }
    },
    PutObjectCommand: FakeCommand,
    GetObjectCommand: FakeCommand,
    DeleteObjectCommand: FakeCommand,
    HeadObjectCommand: FakeCommand,
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: presign.getSignedUrl }));

import { S3StorageDriver } from "./s3-driver";

function makeDriver(overrides: Record<string, unknown> = {}) {
  return new S3StorageDriver({
    bucket: "fsa-private",
    region: "auto",
    accessKeyId: "key",
    secretAccessKey: "secret",
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  commands.sent.length = 0;
  presign.getSignedUrl.mockResolvedValue("https://signed.test/url" as never);
});

describe("bucket privé (#260)", () => {
  it("signe systématiquement sans option publique", async () => {
    const url = await makeDriver({ publicBaseUrl: "https://cdn.test" }).getSignedUrl("cv/a.pdf");
    expect(url).toBe("https://signed.test/url");
    expect(presign.getSignedUrl).toHaveBeenCalled();
  });

  it("n'utilise l'URL publique que pour un objet explicitement public", async () => {
    const driver = makeDriver({ publicBaseUrl: "https://cdn.test" });
    const url = await driver.getSignedUrl("temporary/logo.png", 60, { allowPublicBaseUrl: true });
    expect(url).toBe("https://cdn.test/temporary/logo.png");
    expect(presign.getSignedUrl).not.toHaveBeenCalled();
  });

  it("borne l'expiration des URL signées à 300 s", async () => {
    await makeDriver().getSignedUrl("cv/a.pdf", 7 * 24 * 60 * 60);
    expect(presign.getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 300 },
    );
  });

  it("utilise 60 s par défaut et rejette les valeurs invalides", async () => {
    const driver = makeDriver();
    await driver.getSignedUrl("cv/a.pdf");
    expect(presign.getSignedUrl).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), {
      expiresIn: 60,
    });
    await driver.getSignedUrl("cv/a.pdf", 0);
    expect(presign.getSignedUrl).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), {
      expiresIn: 60,
    });
  });

  it("respecte une configuration d'expiration courte", async () => {
    await makeDriver({ signedUrlTtlSeconds: 45 }).getSignedUrl("cv/a.pdf");
    expect(presign.getSignedUrl).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), {
      expiresIn: 45,
    });
  });

  it("refuse une clé dangereuse", async () => {
    await expect(makeDriver().getSignedUrl("../cv/a.pdf")).rejects.toThrow(/Clé de stockage invalide/);
    await expect(makeDriver().put("../cv/a.pdf", Buffer.from("x"), "application/pdf")).rejects.toThrow(
      /Clé de stockage invalide/,
    );
  });
});
