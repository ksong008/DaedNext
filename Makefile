OUTPUT ?= daed
APPNAME ?= daed
VERSION ?= 0.0.0.unknown
DAED_SKIP_WEB_BUILD ?=

.PHONY: dist daed daed-rust-native

ifneq ($(strip $(DAED_SKIP_WEB_BUILD)),)
all: daed
else
all: clean daed
endif

clean:
	rm -rf dist && rm -rf apps/web/dist && rm -f daed

## Begin Web
PFLAGS ?=
ifeq (,$(wildcard ./.git))
	PFLAGS += HUSKY=0
endif
dist: package.json pnpm-lock.yaml
ifneq ($(strip $(DAED_SKIP_WEB_BUILD)),)
	test -d dist
else
	$(PFLAGS) pnpm i
	VITE_MOCK_MODE= TURBO_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 pnpm build
	@if [ -d "apps/web/dist" ]; then \
		rm -rf dist; \
		cp -r apps/web/dist dist; \
	fi
endif
## End Web

## Begin Bundle
RUST_WORKSPACE ?= $(shell for dir in "$(CURDIR)/DaeNext" "$(CURDIR)/../DaeNext" "$(CURDIR)/../../DaeNext"; do if [ -f "$$dir/Cargo.toml" ]; then cd "$$dir" && pwd; exit; fi; done; printf "%s/DaeNext" "$(CURDIR)")
RUST_MANIFEST ?= $(RUST_WORKSPACE)/Cargo.toml
RUST_TARGET_DIR ?= $(RUST_WORKSPACE)/target
RUST_TARGET ?=
RUST_FEATURES ?= native-ebpf
CARGO_PROFILE_RELEASE_LTO ?= false
RUST_BIN_DIR = $(if $(RUST_TARGET),$(RUST_TARGET_DIR)/$(RUST_TARGET)/release,$(RUST_TARGET_DIR)/release)
RUST_BIN = $(RUST_BIN_DIR)/daed
DAED_UI_COMMIT = $(shell git rev-parse --short=12 HEAD 2>/dev/null || echo unknown)
RUST_WORKSPACE_COMMIT = $(shell git -C "$(RUST_WORKSPACE)" rev-parse --short=12 HEAD 2>/dev/null || echo unknown)
DAED_UI_DIRTY = $(shell test -n "$$(git status --porcelain --untracked-files=no 2>/dev/null)" && echo +dirty)
RUST_WORKSPACE_DIRTY = $(shell test -n "$$(git -C "$(RUST_WORKSPACE)" status --porcelain --untracked-files=no 2>/dev/null)" && echo +dirty)
DAED_PRODUCT_FEATURES ?= $(RUST_FEATURES)
ifneq ($(findstring native-ebpf,$(RUST_FEATURES)),)
ifeq ($(findstring bpf-btf,$(DAED_PRODUCT_FEATURES)),)
DAED_PRODUCT_FEATURES := $(DAED_PRODUCT_FEATURES),bpf-btf
endif
endif
DAED_PRODUCT_TARGET ?= $(if $(TARGET_OS),$(TARGET_OS)-$(TARGET_ARCH)$(if $(CPU_LEVEL),-$(CPU_LEVEL),),$(if $(RUST_TARGET),$(RUST_TARGET),host))
DAED_PRODUCT_VERSION ?= daed rust-native product version=$(VERSION) ui=$(DAED_UI_COMMIT)$(DAED_UI_DIRTY) core=$(RUST_WORKSPACE_COMMIT)$(RUST_WORKSPACE_DIRTY) target=$(DAED_PRODUCT_TARGET) features=$(DAED_PRODUCT_FEATURES)
RUST_BUILD_ARGS = --manifest-path $(RUST_MANIFEST) --locked -p dae-daemon --bin daed --release
ifneq ($(strip $(RUST_TARGET)),)
RUST_BUILD_ARGS += --target $(RUST_TARGET)
endif
ifneq ($(strip $(RUST_FEATURES)),)
RUST_BUILD_ARGS += --features $(RUST_FEATURES)
endif

daed: daed-rust-native

daed-rust-native: dist
	cd "$(RUST_WORKSPACE)" && DAE_DAEMON_VERSION="$(DAED_PRODUCT_VERSION)" CARGO_PROFILE_RELEASE_LTO="$(CARGO_PROFILE_RELEASE_LTO)" CARGO_TARGET_DIR="$(RUST_TARGET_DIR)" cargo build $(RUST_BUILD_ARGS)
	cp "$(RUST_BIN)" "$(OUTPUT)"
	strip "$(OUTPUT)" 2>/dev/null || true
## End Bundle
