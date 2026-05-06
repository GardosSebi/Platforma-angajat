import { Controller, Get, Module } from "@nestjs/common";

@Controller("chatbot")
class ChatbotController {
  @Get("health")
  health() {
    return { module: "chatbot", status: "ok" };
  }
}

@Module({
  controllers: [ChatbotController]
})
export class ChatbotModule {}
