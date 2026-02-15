module.exports = {
  apps: [
    {
      name: "worker-server",
      script: "./worker-server.js",
      instances: 1,
      exec_mode: "fork",
      node_args: "--max-old-space-size=1024",
      env: {
        NODE_ENV: "production",
        UV_THREADPOOL_SIZE: 16          // Increase libuv thread pool for I/O
      }
    },
    {
      name: "broker-api",
      script: "./broker-api.js",
      instances: 3,
      exec_mode: "cluster",            // 3 cluster instances across 3 CPUs
      node_args: "--max-old-space-size=512",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
