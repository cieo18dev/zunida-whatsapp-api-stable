# 🚀 Quick Start - EC2 Deployment

## 📋 Pre-requisitos en EC2

Solo necesitas **Docker** y **Docker Compose** instalados.

### Instalar Docker (solo la primera vez)

**Amazon Linux 2:**
```bash
sudo yum update -y
sudo yum install docker -y
sudo service docker start
sudo usermod -a -G docker ec2-user
```

**Ubuntu:**
```bash
sudo apt update
sudo apt install docker.io docker-compose -y
sudo systemctl start docker
sudo usermod -aG docker ubuntu
```

Luego **cierra y vuelve a conectar** al SSH para que tome efecto.

---

## 🚀 Deployment (3 comandos)

### 1. Clonar repo
```bash
git clone https://github.com/tu-usuario/tu-repo.git
cd tu-repo/auth_info_baileys
```

### 2. Crear directorio de sesiones
```bash
mkdir -p sessions
```

### 3. Levantar servicio
```bash
docker-compose up -d
```

**¡Listo!** 🎉

---

## ✅ Verificar

```bash
# Ver logs
docker-compose logs -f

# Health check
curl http://localhost:3006/api/health

# Ver desde navegador
http://TU-EC2-IP:3006/api-docs
```

---

## 🔄 Actualizar después

```bash
git pull
docker-compose down
docker-compose up -d --build
```

---

## 🛑 Detener

```bash
docker-compose down
```

---

## ⚠️ Importante

- **Security Groups**: Abre el puerto 3006 en AWS
- **Sesiones**: Se guardan en `./sessions/` (persisten entre reinicios)
