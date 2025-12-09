// api/src/osint/osint.gateway.ts
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable } from '@nestjs/common';
import type { OsintItemDto } from './dto/osint-ingest.dto';

@WebSocketGateway({
  namespace: '/osint', // клієнт буде конектитись до /osint
  cors: { origin: '*' }, // для dev, у prod звузиш
})
@Injectable()
export class OsintGateway {
  @WebSocketServer()
  server!: Server;

  // Викликаємо з сервісу, коли зʼявився новий OsintItem
  broadcastNewItem(payload: {
    id: string;
    source: { id: string; name: string; category?: string };
    item: OsintItemDto;
  }) {
    // ось тут відправляється подія всім підписаним клієнтам
    this.server.emit('osint:item', payload);
  }
}
