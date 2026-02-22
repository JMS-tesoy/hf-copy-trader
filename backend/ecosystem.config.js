module.exports = {
  apps: [
    {
      name: "broker-api",
      script: "./broker-api.js",
      instances: 1,
      exec_mode: "fork",
      node_args: "--max-old-space-size=512",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
        TOTAL_SHARDS: 3
      }
    },
    {
      name: "worker-0",
      script: "./worker-server.js",
      instances: 1,
      exec_mode: "fork",
      node_args: "--max-old-space-size=1024",
      env: {
        NODE_ENV: "production",
        PORT: 8081,
        SHARD_ID: "0",
        TOTAL_SHARDS: "3"
      }
    },
    {
      name: "worker-1",
      script: "./worker-server.js",
      instances: 1,
      exec_mode: "fork",
      node_args: "--max-old-space-size=1024",
      env: {
        NODE_ENV: "production",
        PORT: 8082,
        SHARD_ID: "1",
        TOTAL_SHARDS: "3"
      }
    },
    {
      name: "worker-2",
      script: "./worker-server.js",
      instances: 1,
      exec_mode: "fork",
      node_args: "--max-old-space-size=1024",
      env: {
        NODE_ENV: "production",
        PORT: 8083,
        SHARD_ID: "2",
        TOTAL_SHARDS: "3"
      }
    }
  ]
};
