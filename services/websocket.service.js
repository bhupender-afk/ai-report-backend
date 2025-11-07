const { Server } = require('socket.io');
const authService = require('../auth/auth.service');

class WebSocketService {
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    global.io = this.io;

    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error'));
        }

        const decoded = authService.verifyJWT(token);
        socket.userId = decoded.userId;
        next();
      } catch (err) {
        next(new Error('Authentication error'));
      }
    });

    this.io.on('connection', (socket) => {
      console.log(`User ${socket.userId} connected`);

      socket.join(socket.userId);

      socket.on('subscribe-report', (reportId) => {
        socket.join(`report-${reportId}`);
        console.log(`User ${socket.userId} subscribed to report ${reportId}`);
      });

      socket.on('unsubscribe-report', (reportId) => {
        socket.leave(`report-${reportId}`);
        console.log(`User ${socket.userId} unsubscribed from report ${reportId}`);
      });

      socket.on('disconnect', () => {
        console.log(`User ${socket.userId} disconnected`);
      });
    });

    return this.io;
  }

  emitReportProgress(userId, reportId, progress, status) {
    if (this.io) {
      this.io.to(userId).emit('report-progress', {
        reportId,
        progress,
        status,
        timestamp: new Date()
      });

      this.io.to(`report-${reportId}`).emit('report-progress', {
        reportId,
        progress,
        status,
        timestamp: new Date()
      });
    }
  }

  emitReportComplete(userId, reportId) {
    if (this.io) {
      this.io.to(userId).emit('report-complete', {
        reportId,
        timestamp: new Date()
      });

      this.io.to(`report-${reportId}`).emit('report-complete', {
        reportId,
        timestamp: new Date()
      });
    }
  }

  emitReportError(userId, reportId, error) {
    if (this.io) {
      this.io.to(userId).emit('report-error', {
        reportId,
        error,
        timestamp: new Date()
      });

      this.io.to(`report-${reportId}`).emit('report-error', {
        reportId,
        error,
        timestamp: new Date()
      });
    }
  }
}

module.exports = new WebSocketService();