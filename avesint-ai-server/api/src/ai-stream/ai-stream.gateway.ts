// avesint-ai-server/api/src/ai-stream/ai-stream.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/ai-stream',
  cors: {
    origin: '*',
  },
})
export class AiStreamGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AiStreamGateway.name);

  afterInit() {
    this.logger.log('AiStreamGateway ініціалізовано (namespace /ai-stream)');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Клієнт підʼєднався: ${client.id}`);
    // При підключенні можемо відправити вітальне повідомлення / останні події
    client.emit('ai_stream_event', {
      id: 'welcome',
      type: 'info',
      title: 'Підключено до AI‑потоку',
      ts: new Date().toISOString(),
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Клієнт відʼєднався: ${client.id}`);
  }

  // Приклад методу, який можна викликати з сервісів:
  // this.aiStreamGateway.broadcastEvent({...})
  broadcastEvent(payload: unknown) {
    this.server.emit('ai_stream_event', payload);
  }
}
