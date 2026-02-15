module.exports = {
  apps: [
    {
      name: "worker-swarm",
      script: "./worker-server.js",
      instances: 1,         // ws library binds to a port — cluster mode causes port conflicts
      exec_mode: "fork"
    },
    {
      name: "broker-api",
      script: "./broker-api.js",
      instances: 1,         // Uses 1 CPU Core for API/Redis
      exec_mode: "fork"
    }
  ]
};