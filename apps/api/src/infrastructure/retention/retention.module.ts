import { Module } from "@nestjs/common";
import { RetentionService } from "./retention.service";
import { DsarService } from "./dsar.service";

@Module({
  providers: [RetentionService, DsarService],
  exports: [RetentionService, DsarService]
})
export class RetentionModule {}
