<div align="center">
  <img src="apps/web/public/logo-rounded.png" alt="daed logo" width="120" />
  <h1>daed</h1>
  <p><strong>A modern web dashboard for dae</strong></p>

  <p>
    <a href="https://github.com/ksong008/DaedNext/actions/workflows/release-please.yml"><img src="https://img.shields.io/github/actions/workflow/status/ksong008/daednext/release-please.yml?style=for-the-badge" alt="Build Status" /></a>
    <a href="https://github.com/ksong008/DaedNext/releases"><img src="https://img.shields.io/github/v/release/ksong008/daednext?style=for-the-badge" alt="Release" /></a>
    <a href="https://github.com/ksong008/DaedNext/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ksong008/daednext?style=for-the-badge" alt="License" /></a>
    <a href="https://github.com/ksong008/DaedNext/pulls"><img src="https://img.shields.io/github/issues-pr-closed/ksong008/daednext?style=for-the-badge" alt="Pull Requests" /></a>
  </p>

  <p>
    <a href="#features">Features</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#development">Development</a> •
    <a href="#contributing">Contributing</a> •
    <a href="#license">License</a>
  </p>
</div>

---

## 📸 Screenshots

<details open>
<summary><b>Desktop Screenshots</b></summary>

|                                Setup                                |                                   Orchestrate                                   |
| :-----------------------------------------------------------------: | :-----------------------------------------------------------------------------: |
| <img src="docs/screenshots/pc/setup.png" alt="setup" width="400" /> | <img src="docs/screenshots/pc/orchestrate.png" alt="orchestrate" width="400" /> |

</details>

<details>
<summary><b>Mobile Screenshots</b></summary>

|                                  Setup                                  |                                     Orchestrate                                     |
| :---------------------------------------------------------------------: | :---------------------------------------------------------------------------------: |
| <img src="docs/screenshots/mobile/setup.png" alt="setup" width="200" /> | <img src="docs/screenshots/mobile/orchestrate.png" alt="orchestrate" width="200" /> |

</details>

---

## ✨ Features

- 🎨 **Beautiful UI** — Modern, intuitive interface with light/dark mode support
- ⌨️ **Keyboard First** — Built-in keyboard navigation and shortcuts for power users
- 📱 **Responsive** — Fully mobile-friendly design
- 🚀 **Fast** — Built with React and optimized for performance

## 🌐 Online Demo

Try daed directly in your browser without installation:

**🔗 [ksong008.github.io/DaedNext](https://ksong008.github.io/DaedNext)**

> ⚠️ **Important:** Since GitHub Pages uses HTTPS, your daed API endpoint must also be served over HTTPS. Browsers block mixed content (HTTPS page connecting to HTTP backend). Configure a reverse proxy with TLS or use a self-signed certificate for local development.

## 🚀 Getting Started

Please refer to the [Quick Start Guide](./docs/getting-started.md) to start using daed right away!

## 🐳 Docker Deployment

Pull the prebuilt image:

```bash
docker pull ghcr.io/ksong008/daednext
```

Run the container:

```bash
docker run -d \
    --privileged \
    --network=host \
    --pid=host \
    --restart=always \
    -v /sys:/sys \
    -v /etc/daed:/etc/daed \
    --name=daed \
    ghcr.io/ksong008/daednext:latest
```

Or use Docker Compose:

```yaml
# docker-compose.yml
services:
  daed:
    image: ghcr.io/ksong008/daednext
    container_name: daed
    privileged: true
    network_mode: host
    pid: host
    restart: always
    volumes:
      - /sys:/sys
      - /etc/daed:/etc/daed
```

```bash
docker compose up -d
```

Access the dashboard at `http://localhost:2023`.

## 💻 Development

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 9

### Setup

```bash
# Clone the repository
git clone https://github.com/ksong008/DaedNext.git
cd daed

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Available Scripts

| Command                 | Description                                        |
| ----------------------- | -------------------------------------------------- |
| `pnpm dev`              | Start development server                           |
| `pnpm build`            | Build for production                               |
| `pnpm test:integration` | Run the browser audit against an existing daed API |
| `pnpm lint`             | Lint and fix code                                  |

## 🤝 Contributing

Contributions are welcome! Whether it's bug reports, feature requests, or pull requests — all are appreciated.

Please read our [Contributing Guide](./CONTRIBUTING.md) before submitting a PR.

Special thanks to all [contributors](https://github.com/ksong008/DaedNext/graphs/contributors)! ❤️

<a href="https://github.com/ksong008/DaedNext/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=ksong008/daednext" alt="Contributors" />
</a>

## 📄 License

This project is licensed as follows:

- Frontend (daed): [MIT License](./LICENSE)
- Rust-native daemon workspace: [AGPL-3.0 License](https://github.com/ksong008/DaeNext)

---

<div align="center">
  Made with ❤️ by <a href="https://github.com/daeuniverse">@daeuniverse</a>
</div>
