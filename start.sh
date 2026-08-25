#!/usr/bin/env bash

# ==============================================================================
# A.R.I.A - Autonomous Reactive Intelligence Assistant
# Script de Inicio de Servicios Locales
# ==============================================================================

set -e

PROJECT_DIR="/home/astra/Projects/ARIA"
LOGS_DIR="$PROJECT_DIR/logs"

# Colores ANSI para terminal
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${PURPLE}${BOLD}"
echo "   ___     ____     ___     ___ "
echo "  / _ |   / __ \   |_ _|   / _ |"
echo " / __ |  / /_/ /    | |   / __ |"
echo "/_/ |_| /_/ \_\   |___|  /_/ |_|"
echo -e "${CYAN} Autonomous Reactive Intelligence Assistant${NC}"
echo -e "${CYAN} ==========================================${NC}\n"

if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Error: No se encontró el directorio del proyecto en $PROJECT_DIR${NC}"
    exit 1
fi

mkdir -p "$LOGS_DIR"
cd "$PROJECT_DIR" || exit 1

# 1. Detener instancias previas
echo -e "${YELLOW}🛑 Verificando y limpiando procesos anteriores...${NC}"
pkill -f "python.*server.py" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

# 2. Iniciar / Verificar Ollama (Modelos LLM & Embeddings)
echo -e "${BLUE}🦙 Verificando Motor Local de IA (Ollama)...${NC}"
if ! curl -s http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
    echo -e "   Iniciando servicio Ollama en segundo plano..."
    nohup ollama serve > "$LOGS_DIR/ollama.log" 2>&1 &
    OLLAMA_PID=$!
    
    # Esperar hasta 6 segundos a que responda
    for i in {1..6}; do
        if curl -s http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
            break
        fi
        sleep 1
    done
else
    OLLAMA_PID=$(pgrep -f "ollama serve" | head -n 1 || echo "Activo")
fi
echo -e "   ${GREEN}✓ Ollama activo en http://127.0.0.1:11434 (PID: $OLLAMA_PID)${NC}"

# 3. Iniciar Backend (FastAPI + ChromaDB + Watchdogs + RAG v2)
echo -e "${BLUE}🐍 Iniciando Backend (FastAPI, SQLite, Watchdogs & RAG Vectorial)...${NC}"
nohup "$PROJECT_DIR/venv/bin/python" server.py > "$LOGS_DIR/server.log" 2>&1 &
BACKEND_PID=$!

# Esperar a que el backend responda en puerto 8000
for i in {1..8}; do
    if curl -s http://127.0.0.1:8000/api/stats >/dev/null 2>&1; then
        break
    fi
    sleep 0.5
done
echo -e "   ${GREEN}✓ Backend activo en http://127.0.0.1:8000 (PID: $BACKEND_PID)${NC}"

# 4. Iniciar Frontend (Vite + React 19)
echo -e "${BLUE}⚛️  Iniciando Frontend (Vite + React 19)...${NC}"
nohup npm run dev -- --host > "$LOGS_DIR/vite.log" 2>&1 &
FRONTEND_PID=$!

# Esperar a que Vite responda en puerto 5173
for i in {1..8}; do
    if curl -s http://127.0.0.1:5173/ >/dev/null 2>&1; then
        break
    fi
    sleep 0.5
done
echo -e "   ${GREEN}✓ Frontend activo en http://localhost:5173 (PID: $FRONTEND_PID)${NC}"

# 5. Resumen de Estado
LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}' || ip addr show 2>/dev/null | grep -E "inet " | grep -v "127.0.0.1" | awk '{print $2}' | cut -d/ -f1 | head -n 1 || echo "")

echo -e "\n${GREEN}${BOLD}🚀 ¡Todos los servicios de A.R.I.A están operativos!${NC}"
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  🌐 ${BOLD}Dashboard Local:${NC}       ${CYAN}http://localhost:5173${NC}"
if [ -n "$LOCAL_IP" ]; then
echo -e "  📡 ${BOLD}Acceso en Red Local:${NC}   ${GREEN}http://${LOCAL_IP}:5173${NC}"
fi
echo -e "  🔌 ${BOLD}Backend API / Docs:${NC}     ${CYAN}http://127.0.0.1:8000/docs${NC}"
echo -e "  🧠 ${BOLD}Motor LLM (Ollama):${NC}     ${CYAN}http://127.0.0.1:11434${NC}"
echo -e "  📁 ${BOLD}Registro de Logs:${NC}       ${PROJECT_DIR}/logs/"
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}Comandos útiles:${NC}"
echo -e "  • Ver logs del backend:   ${BOLD}tail -f $PROJECT_DIR/logs/server.log${NC}"
echo -e "  • Ver logs del frontend:  ${BOLD}tail -f $PROJECT_DIR/logs/vite.log${NC}"
echo -e "  • Detener servicios:      ${BOLD}pkill -f 'python.*server.py' && pkill -f 'vite'${NC}\n"
