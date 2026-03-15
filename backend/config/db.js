import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            // ✅ Production optimization options
            maxPoolSize: 10, // Maintain up to 10 socket connections
            serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
            socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
            family: 4 // Use IPv4, skip trying IPv6
        });

        console.log(`\n✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📊 Database: ${conn.connection.name}\n`);

        // Connection event listeners
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
        });

        // Graceful shutdown on app termination
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            console.log('✅ MongoDB connection closed through app termination.');
        });

    } catch (error) {
        console.error(`\n❌ MongoDB Connection Error: ${error.message}`);
        console.error('💡 Check your MONGO_URI environment variable.\n');
        process.exit(1);
    }
};

export default connectDB;