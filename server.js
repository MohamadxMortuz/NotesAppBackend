require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
// Removed body-parser as express.json() is preferred
const projects = require("./routes/projects");
const auth = require("./routes/auth");

const app = express();

// Configure CORS - allow all origins for now
app.use(cors({
  origin: true,
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: "5mb" }));

// MongoDB connection with keep-alive and reconnection
const MONGO = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/cipherstudio";

mongoose.set('strictQuery', false);

const connectDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB...');
    console.log('Connection string:', MONGO.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@'));
    
    const conn = await mongoose.connect(MONGO, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    console.error('Full error:', error);
    setTimeout(connectDB, 10000);
  }
};

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected from MongoDB');
  console.log('Attempting to reconnect...');
  setTimeout(() => {
    if (mongoose.connection.readyState === 0) {
      connectDB();
    }
  }, 5000);
});

mongoose.connection.on('reconnected', () => {
  console.log('Mongoose reconnected to MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed.');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed.');
  process.exit(0);
});

connectDB();

// Health check and debug routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'CipherStudio Backend is running!', 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    env: process.env.NODE_ENV || 'development'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mongodb: mongoose.connection.readyState === 1,
    uptime: process.uptime()
  });
});

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.use("/api/projects", projects);
app.use("/api/auth", auth);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = parseInt(process.env.PORT, 10) || 4000;
const http = require('http');

const server = http.createServer(app);

server.listen(PORT, '0.0.0.0', () => console.log(`server listening on port ${PORT}`));

server.on('error', (err) => {
	if (err.code === 'EADDRINUSE') {
		console.error(`Port ${PORT} is already in use. Try setting a different PORT in your .env file or terminate the process using the port.`);
		console.error('On Windows you can run: netstat -ano | findstr :'+PORT);
		console.error('Then kill the process with: taskkill /PID <pid> /F');
		process.exit(1);
	} else {
		console.error('Server error:', err);
		process.exit(1);
	}
});
