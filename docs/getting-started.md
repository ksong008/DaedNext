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

**👉 [GitHub Releases](https://github.com/ksong008/DaedNext/releases)**

> 💡 **Tip:** Want to try new features? Check out [PR Builds](https://github.com/ksong008/DaedNext/actions/workflows/pr-build.yml) for the latest development builds. Note that these may be unstable.

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

The native eBPF service configures the network through Linux kernel interfaces.
You can install and run it on a system without the `ip` and `tc` commands.
The development network fixtures and legacy command-backend diagnostics use
those tools when invoked.

### Debian / Ubuntu

```bash
# Download the latest .deb package
wget -P /tmp https://github.com/ksong008/DaedNext/releases/latest/download/installer-daed-linux-$(arch).deb

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
wget -P /tmp https://github.com/ksong008/DaedNext/releases/latest/download/installer-daed-linux-$(arch).rpm

# Install
sudo rpm -ivh /tmp/installer-daed-linux-$(arch).rpm

# Start and enable service
sudo systemctl enable --now daed
```

### openSUSE

```bash
# Download the latest .rpm package
wget -P /tmp https://github.com/ksong008/DaedNext/releases/latest/download/installer-daed-linux-$(arch).rpm

# Install
sudo zypper install /tmp/installer-daed-linux-$(arch).rpm

# Start and enable service
sudo systemctl enable --now daed
```

### Updating an Existing DEB or RPM Installation

Use the package manager's upgrade operation. For a local file, use
`sudo apt install ./installer-daed.deb` or
`sudo dnf upgrade ./installer-daed.rpm` as appropriate.

On a running systemd host, upgrades restart an active daemon and wait for
readiness. An inactive daemon stays inactive. If restart fails, the package hook
reports the failure and records it in `/var/lib/daed/package-restart-required`.
RPM can still record the new version as installed even when the scriptlet fails.
Check `systemctl status daed.service` and `journalctl -u daed.service`, then
restart the service once the reported error is resolved. A successful start
clears the marker. On Debian, retrying `sudo dpkg --configure daed` also retries
a pending restart.

Uninstall stops the service before removing packaged files. The package manager
preserves existing configurations and the state database in `/etc/daed`.

### Updating or Removing an OpenWrt Installation

An upgrade restarts an active daed service and waits for readiness. If the
restart fails, fix the service error and run `opkg configure daed` on an
IPK installation or `/etc/init.d/daed package_restart` on an APK installation.

APK 3.0.5 can remove package files even when its removal hook reports an error.
Run `/etc/init.d/daed package_remove && apk del daed` to make successful service
stop and DNS cleanup a condition of removing the package. On IPK installations,
`opkg remove daed` enforces this condition directly.

The default `/etc/daed/` state directory is included in OpenWrt firmware backups.
Add a custom state directory to `/etc/sysupgrade.conf`.

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

- `ghcr.io/ksong008/daednext`
- `quay.io/ksong008/daednext`
- `ksong008/daednext`

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
    ghcr.io/ksong008/daednext:latest
```

### Docker Compose

```yaml
# docker-compose.yml
services:
  daed:
    image: ghcr.io/ksong008/daednext:latest
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
git clone --branch work/boringssl https://github.com/ksong008/DaedNext
cd DaedNext
git clone --branch work/boringssl https://github.com/ksong008/DaeNext DaeNext
docker build -t daed .
```

> **Note:** Docker support is currently available for i386, amd64, armv7, and arm64 architectures. See [discussion #291](https://github.com/ksong008/DaedNext/discussions/291) for details.

---

## 🎉 Access the Dashboard

Once daed is running, open your browser and navigate to:

**👉 http://localhost:2023**

Happy Hacking! 🚀
