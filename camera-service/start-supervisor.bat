@echo off
REM Inicia el supervisor del servicio de camaras (puerto 5002).
REM La app web lo usa para iniciar/detener "cargo run --release".
REM Para que arranque solo al iniciar sesion, crea un acceso directo a este
REM archivo en la carpeta shell:startup (Win+R -> shell:startup).
cd /d "%~dp0"
title Supervisor camaras
cargo run --release --bin camera-supervisor
pause
