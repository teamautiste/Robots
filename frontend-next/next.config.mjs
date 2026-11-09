/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // para push
  async rewrites() {
    const backend = process.env.BACKEND_URL ?? 'http://127.0.0.1:5000';
    const cameraService = process.env.CAMERA_SERVICE_URL ?? 'http://127.0.0.1:5001';
    const cameraSupervisor = process.env.CAMERA_SUPERVISOR_URL ?? 'http://127.0.0.1:5002';
    console.log(`[next.config] Proxying /api        -> ${backend}`);
    console.log(`[next.config] Proxying /camera-service -> ${cameraService}`);
    console.log(`[next.config] Proxying /camera-supervisor -> ${cameraSupervisor}`);
    return [
      { source: '/api/:path*', destination: `${backend}/api/:path*` },
      { source: '/socket.io/:path*', destination: `${backend}/socket.io/:path*` },
      { source: '/camera-service/:path*', destination: `${cameraService}/:path*` },
      { source: '/camera-supervisor/:path*', destination: `${cameraSupervisor}/:path*` },
    ];
  },
};

export default nextConfig;
