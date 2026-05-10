import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface ArtifactStorage {
  upload(path: string, body: Buffer, contentType: string): Promise<void>;
  createSignedUrl(path: string, expiresInSeconds?: number): Promise<string>;
}

export class SupabaseArtifactStorage implements ArtifactStorage {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly bucket: string
  ) {}

  static fromEnv(params: {
    supabaseUrl: string;
    serviceRoleKey: string;
    bucket: string;
  }): SupabaseArtifactStorage {
    return new SupabaseArtifactStorage(
      createClient(params.supabaseUrl, params.serviceRoleKey, {
        auth: { persistSession: false }
      }),
      params.bucket
    );
  }

  async upload(path: string, body: Buffer, contentType: string): Promise<void> {
    const { error } = await this.supabase.storage.from(this.bucket).upload(path, body, {
      contentType,
      upsert: true
    });
    if (error) throw error;
  }

  async createSignedUrl(path: string, expiresInSeconds = 60 * 60 * 24 * 7): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error) throw error;
    return data.signedUrl;
  }
}
