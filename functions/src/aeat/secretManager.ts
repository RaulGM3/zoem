import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();
const PROJECT_ID = process.env['GCLOUD_PROJECT'] ?? '';

export function certSecretName(companyId: string): string {
  return `projects/${PROJECT_ID}/secrets/aeat-cert-${companyId}`;
}

export async function storeSecret(name: string, payload: Buffer): Promise<void> {
  // Crear el secret si no existe, luego añadir versión
  try {
    await client.createSecret({
      parent: `projects/${PROJECT_ID}`,
      secretId: name.split('/').pop()!,
      secret: { replication: { automatic: {} } },
    });
  } catch {
    // El secret ya existe — ignoramos el error
  }
  await client.addSecretVersion({ parent: name, payload: { data: payload } });
}

export async function getSecret(name: string): Promise<Buffer> {
  const versionName = `${name}/versions/latest`;
  console.log(`[SecretManager] accessSecretVersion: ${versionName}`);
  const [version] = await client.accessSecretVersion({ name: versionName });
  const data = version.payload?.data;
  if (!data) throw new Error(`Secret vacío: ${name}`);
  return Buffer.from(data as Uint8Array);
}
