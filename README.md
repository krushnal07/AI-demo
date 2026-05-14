vmukti@wbfsv2026-arcis:~/wbfsv2026-Election-Portal$ cat /etc/systemd/system/wbfsv2026-
wbfsv2026-backend.service   wbfsv2026-camera.service    wbfsv2026-frontend.service  wbfsv2026-gpsdata.service   
vmukti@wbfsv2026-arcis:~/wbfsv2026-Election-Portal$ cat /etc/systemd/system/wbfsv2026-*
[Unit]
Description=WBFSV2026 Backend Service
After=network.target

[Service]
WorkingDirectory=/home/vmukti/wbfsv2026-Election-Portal/arcis_backend_R-D
ExecStart=/usr/bin/npm start
Restart=always
User=vmukti
Group=vmukti
RestartSec=10
TimeoutSec=30

[Install]
WantedBy=multi-user.target


[Unit]
Description=WBFSV2026 Camera Status Service
After=network.target

[Service]
ExecStart=/usr/bin/node /home/vmukti/wbfsv2026-Cam-Servicejs/service.js
Restart=always
User=vmukti
Group=vmukti
WorkingDirectory=/home/vmukti/wbfsv2026-Cam-Servicejs

[Install]
WantedBy=multi-user.target

[Unit]
Description=WBFSV2026 Frontend React App
After=network.target

[Service]
WorkingDirectory=/home/vmukti/wbfsv2026-Election-Portal/arcis_frontend_R-D
ExecStart=/usr/local/bin/serve -s build -l 3002
Restart=always
RestartSec=10
User=vmukti
Environment=PATH=/usr/bin:/usr/local/bin
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target


[Unit]
Description=WBFSV2026 GPS Data Node.js Service
After=network.target

[Service]
Type=simple
User=vmukti
WorkingDirectory=/home/vmukti/wbfsv2026-Gpsdata/backend
ExecStart=/usr/bin/node app.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
