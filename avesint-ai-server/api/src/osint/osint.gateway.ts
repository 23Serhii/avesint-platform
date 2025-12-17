// api/src/osint/osint.gateway.ts
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable } from '@nestjs/common';
import type { OsintItemDto } from './dto/osint-ingest.dto';

@WebSocketGateway({
  namespace: '/osint',
  cors: {
    origin: ['http://localhost:5173'],
    credentials: false, // ✅ важливо, раз клієнт без cookies
  },
})
@Injectable()
export class OsintGateway {
  @WebSocketServer()
  server!: Server;

  broadcastNewItem(payload: {
    id: string;
    source: { id: string; name: string; category?: string };
    item: OsintItemDto;
  }) {
    this.server.emit('osint:item', payload);
  }
}
