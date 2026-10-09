const nextConfig = {
  output: 'standalone',
  async rewrites() {
    const backend = process.env.BACKEND_URL ?? 'http://127.0.0.1:5000';
    const cameraService = process.env.CAMERA_SERVICE_URL ?? 'http://127.0.0.1:5001';
    return [
      { source: '/api/:path*', destination: `${backend}/api/:path*` },
      { source: '/socket.io/:path*', destination: `${backend}/socket.io/:path*` },
      { source: '/camera-service/:path*', destination: `${cameraService}/:path*` },
    ];
  },
};

export default nextConfig;
