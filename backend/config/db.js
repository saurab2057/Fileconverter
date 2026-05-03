import mongoose from 'mongoose';

/**
 * 🔌 Connect to MongoDB
 *
 * This function establishes a connection to the database using the
 * MONGO_URI environment variable. It sets sensible production‑oriented
 * options (pool size, timeouts, IPv4) and attaches error/disconnection
 * listeners for logging.
 *
 * ❗ No shutdown handlers are attached here.
 *    Graceful shutdown is managed centrally in index.js.
 */
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            maxPoolSize: 10,               // maintain up to 10 socket connections
            serverSelectionTimeoutMS: 5000, // keep trying for 5 seconds
            socketTimeoutMS: 45000,         // close idle sockets after 45s
            family: 4                       // use IPv4, skip IPv6
        });

        console.log(`\n✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📊 Database: ${conn.connection.name}\n`);

        // Log any runtime errors
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
        });

        // Log disconnections (the driver will auto‑reconnect)
        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB disconnected. Driver will attempt reconnection...');
        });

    } catch (error) {
        console.error(`\n❌ MongoDB Connection Error: ${error.message}`);
        console.error('💡 Check your MONGO_URI environment variable.\n');
        process.exit(1);   // fail fast if initial connection fails
    }
};

export default connectDB;