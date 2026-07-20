export interface PushSubscribeRequest {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
}

export interface PushVapidPublicKeyResponse {
  publicKey: string | null;
  enabled: boolean;
}

export interface TenantSsoStatusResponse {
  azureEnabled: boolean;
  ldapEnabled: boolean;
  azureAuthorizeUrl?: string | null;
}

export interface LdapLoginRequest {
  username: string;
  password: string;
}
