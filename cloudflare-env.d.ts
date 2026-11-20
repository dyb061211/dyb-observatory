declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    STATION_OWNER_EMAIL?: string;
    BUCKET?: R2Bucket;
  }
}
