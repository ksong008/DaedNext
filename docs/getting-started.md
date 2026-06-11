# Quick Start Guide

> **Note:** `daed` now builds its backend API, control plane, datapath, and eBPF support from the Rust-native DaeNext workspace.

---

## ⚠️ Important Notice

> **Warning:** Network connectivity issues may occur if the system sleeps/hibernates or switches networks while the proxy is active.
>
> Always **stop the proxy** before:
>
> - Putting your computer to sleep or hibernate
> - Switching between Wi-Fi networks
> - Disconnecting from the network
>
> If you experience network issues, a system reboot may be required to restore connectivity.

---

## 📦 Installation

### Download Pre-built Binaries

Download the latest release for your platform:

**👉 [GitHub Releases](https://github.com/daeuniverse/daed/releases)**

> 💡 **Tip:** Want to try new features? Check out [PR Builds](https://github.com/daeuniverse/daed/actions/workflows/pr-build.yml) for the latest development builds. Note that these may be unstable.

### Quick Install (Manual)

```bash
# Make executable and install
sudo chmod +x ./daed
sudo install -Dm755 daed /usr/bin/

# Run daed
sudo daed run

# Show help
daed --help
```

---

## 🐧 Linux Distribution Packages

### Debian / Ubuntu

```bash
# Download the latest .deb package
wget -P /tmp https://github.com/daeuniverse/daed/releases/latest/download/installer-daed-linux-$(arch).deb

# Install
sudo dpkg -i /tmp/installer-daed-linux-$(arch).deb

# Start and enable service
sudo systemctl enable --now daed
```

### Fedora / Red Hat

#### Option 1: Fedora Copr (Recommended)

```bash
sudo dnf copr enable zhullyb/v2rayA
sudo dnf install daed
```

#### Option 2: RPM Package

```bash
# Download the latest .rpm package
wget -P /tmp https://github.com/daeuniverse/daed/releases/latest/download/installer-daed-linux-$(arch).rpm

# Install
sudo rpm -ivh /tmp/installer-daed-linux-$(arch).rpm

# Start and enable service
sudo systemctl enable --now daed
```

### openSUSE

```bash
# Download the latest .rpm package
wget -P /tmp https://github.com/daeuniverse/daed/releases/latest/download/installer-daed-linux-$(arch).rpm

# Install
sudo zypper install /tmp/installer-daed-linux-$(arch).rpm

# Start and enable service
sudo systemctl enable --now daed
```

### Arch Linux

#### AUR

| Package         | Description                       | Command                 |
| --------------- | --------------------------------- | ----------------------- |
| `daed`          | Latest release (x86-64 / aarch64) | `paru -S daed`          |
| `daed-avx2-bin` | Optimized for x86-64 v3 / AVX2    | `paru -S daed-avx2-bin` |
| `daed-git`      | Latest git version                | `paru -S daed-git`      |

#### archlinuxcn

```bash
# Standard version
sudo pacman -S daed

# AVX2 optimized version
sudo pacman -S daed-avx2-bin

# Git version
sudo pacman -S daed-git
```

---

## 🐳 Docker

Pre-built images are available at:

- `ghcr.io/daeuniverse/daed`
- `quay.io/daeuniverse/daed`
- `daeuniverse/daed`

### Docker Run

```bash
docker run -d \
    --privileged \
    --network=host \
    --pid=host \
    --restart=unless-stopped \
    -v /sys:/sys \
    -v /etc/daed:/etc/daed \
    --name=daed \
    ghcr.io/daeuniverse/daed:latest
```

### Docker Compose

```yaml
# docker-compose.yml
services:
  daed:
    image: ghcr.io/daeuniverse/daed:latest
    container_name: daed
    privileged: true
    network_mode: host
    pid: host
    restart: unless-stopped
    volumes:
      - /sys:/sys
      - /etc/daed:/etc/daed
```

```bash
docker compose up -d
```

### Build from Source

```bash
git clone https://github.com/daeuniverse/daed --recursive
docker build -t daed .
```

> **Note:** Docker support is currently available for i386, amd64, armv7, and arm64 architectures. See [discussion #291](https://github.com/daeuniverse/daed/discussions/291) for details.

---

## 🎉 Access the Dashboard

Once daed is running, open your browser and navigate to:

**👉 http://localhost:2023**

Happy Hacking! 🚀
