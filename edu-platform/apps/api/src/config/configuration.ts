export interface AppConfig {
  port: number;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
  };
  storage: {
    driver: "LOCAL" | "S3";
    publicBaseUrl: string;
  };
}

export default (): AppConfig => ({
  port: parseInt(process.env.API_PORT ?? "4000", 10),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? "dev-access-secret",
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret",
    accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
    refreshTtl: process.env.JWT_REFRESH_TTL ?? "7d",
  },
  storage: {
    driver: (process.env.STORAGE_DRIVER as "LOCAL" | "S3") ?? "LOCAL",
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL ?? "/uploads",
  },
});
