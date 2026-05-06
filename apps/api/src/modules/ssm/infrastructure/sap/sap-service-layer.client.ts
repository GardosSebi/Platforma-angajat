import { HttpException, Injectable } from "@nestjs/common";
import axios, { AxiosInstance } from "axios";

@Injectable()
export class SapServiceLayerClient {
  private readonly http: AxiosInstance = axios.create({
    baseURL: process.env.SAP_SERVICE_LAYER_URL,
    timeout: 10_000
  });

  async sendTrainingAssignment(tenantId: string, payload: Record<string, unknown>) {
    try {
      await this.http.post("/b1s/v1/U_SSMTrainings", {
        U_TenantId: tenantId,
        ...payload
      });
    } catch {
      throw new HttpException("SAP Service Layer unavailable", 502);
    }
  }
}
