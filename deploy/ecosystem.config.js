// PM2 Ecosystem Config - Tubarao Emprestimos
// Uso: pm2 start ecosystem.config.js

module.exports = {
    apps: [
        {
            name: 'tubarao-api',
            script: 'dist/server.js',
            cwd: '/home/opc/tubarao-backend',
            instances: 2, // 2 instancias (4 OCPU disponiveis)
            exec_mode: 'cluster',
            env: {
                NODE_ENV: 'production',
                PORT: 3001
            },
            // Restart policy
            max_memory_restart: '1G',
            restart_delay: 5000,
            max_restarts: 10,
            // Logs
            log_file: '/home/opc/tubarao-backend/logs/combined.log',
            out_file: '/home/opc/tubarao-backend/logs/out.log',
            error_file: '/home/opc/tubarao-backend/logs/error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
            // Watch (desativado em producao)
            watch: false,
            // Graceful shutdown
            kill_timeout: 5000,
            listen_timeout: 10000
        }
    ]
};
