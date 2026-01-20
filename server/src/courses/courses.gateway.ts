import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*', // Allow all origins for development
    credentials: true,
  },
  namespace: '/courses',
})
export class CoursesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CoursesGateway.name);
  private connectedClients = 0;

  handleConnection(client: Socket) {
    this.connectedClients++;
    this.logger.log(
      `Client connected: ${client.id} (Total: ${this.connectedClients})`,
    );
  }

  handleDisconnect(client: Socket) {
    this.connectedClients--;
    this.logger.log(
      `Client disconnected: ${client.id} (Total: ${this.connectedClients})`,
    );
  }

  // Broadcast seat updates to all connected clients
  broadcastSeatUpdate(
    updates: {
      sectionId: string;
      courseCode: string;
      sectionNumber: string;
      enrolled: number;
      capacity: number;
      available: number;
      status: string;
    }[],
  ) {
    if (updates.length > 0 && this.server) {
      this.logger.log(
        `Broadcasting ${updates.length} seat updates to ${this.connectedClients} clients`,
      );
      this.server.emit('seatUpdates', {
        timestamp: new Date().toISOString(),
        updates,
      });
    }
  }

  // Broadcast full sync completion
  broadcastSyncComplete(stats: {
    totalSections: number;
    updatedSections: number;
  }) {
    if (this.server) {
      this.server.emit('syncComplete', {
        timestamp: new Date().toISOString(),
        ...stats,
      });
    }
  }
}
