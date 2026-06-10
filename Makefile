OUTPUT ?= daed
APPNAME ?= daed
VERSION ?= 0.0.0.unknown

.PHONY: submodules submodule dist daed daed-rust-native daed-go-rollback

all: clean daed

clean:
	rm -rf dist && rm -rf apps/web/dist && rm -f daed

## Begin Git Submodules
.gitmodules.d.mk: .gitmodules Makefile
	@set -e && \
	submodules=$$(grep '\[submodule "' .gitmodules | cut -d'"' -f2 | tr '\n' ' ' | tr ' \n' '\n' | sed 's/$$/\/.git/g') && \
	echo "submodule_ready=$${submodules}" > $@

-include .gitmodules.d.mk

$(submodule_ready): .gitmodules.d.mk
ifdef SKIP_SUBMODULES
	@echo "Skipping submodule update"
else
	git submodule update --init --recursive -- "$$(dirname $@)" && \
	touch $@
endif

submodule submodules: $(submodule_ready)
	@if [ -z "$(submodule_ready)" ]; then \
		rm -f .gitmodules.d.mk; \
		echo "Failed to generate submodules list. Please try again."; \
		exit 1; \
	fi
## End Git Submodules

## Begin Web
PFLAGS ?=
DAED_SKIP_WEB_BUILD ?=
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
DAE_WING_READY=wing/dae-core/control/bpf_bpfeb.o
DAE_CORE_BPF_OBJECT=wing/dae-core/control/bpf_bpfel.o
RUST_DAED_MANIFEST ?= wing/dae-core/rust/Cargo.toml
RUST_DAED_TARGET_DIR ?= wing/dae-core/rust/target
RUST_DAED_TARGET ?=
RUST_DAED_FEATURES ?= native-ebpf
RUST_DAED_BIN_DIR = $(if $(RUST_DAED_TARGET),$(RUST_DAED_TARGET_DIR)/$(RUST_DAED_TARGET)/release,$(RUST_DAED_TARGET_DIR)/release)
RUST_DAED_BIN = $(RUST_DAED_BIN_DIR)/daed
RUST_DAED_DAED_COMMIT = $(shell git rev-parse --short=12 HEAD 2>/dev/null || echo unknown)
RUST_DAED_WING_COMMIT = $(shell git -C wing rev-parse --short=12 HEAD 2>/dev/null || echo unknown)
RUST_DAED_CORE_COMMIT = $(shell git -C wing/dae-core rev-parse --short=12 HEAD 2>/dev/null || echo unknown)
RUST_DAED_DAED_DIRTY = $(shell test -n "$$(git status --porcelain --untracked-files=no 2>/dev/null)" && echo +dirty)
RUST_DAED_WING_DIRTY = $(shell test -n "$$(git -C wing status --porcelain --untracked-files=no 2>/dev/null)" && echo +dirty)
RUST_DAED_CORE_DIRTY = $(shell test -n "$$(git -C wing/dae-core status --porcelain --untracked-files=no 2>/dev/null)" && echo +dirty)
RUST_DAED_VERSION ?= daed rust-native product daed=$(RUST_DAED_DAED_COMMIT)$(RUST_DAED_DAED_DIRTY) wing=$(RUST_DAED_WING_COMMIT)$(RUST_DAED_WING_DIRTY) dae-core=$(RUST_DAED_CORE_COMMIT)$(RUST_DAED_CORE_DIRTY) features=$(RUST_DAED_FEATURES)
RUST_DAED_BUILD_ARGS = --manifest-path $(RUST_DAED_MANIFEST) -p dae-daemon --bin daed --release
ifneq ($(strip $(RUST_DAED_TARGET)),)
RUST_DAED_BUILD_ARGS += --target $(RUST_DAED_TARGET)
endif
ifneq ($(strip $(RUST_DAED_FEATURES)),)
RUST_DAED_BUILD_ARGS += --features $(RUST_DAED_FEATURES)
endif

$(DAE_WING_READY): wing
	cd wing && \
	$(MAKE) deps && \
	cd .. && \
	touch $@

$(DAE_CORE_BPF_OBJECT): wing
	cd wing/dae-core && \
	$(MAKE) ebpf

daed: daed-rust-native

daed-rust-native: submodule dist
	DAE_DAEMON_VERSION="$(RUST_DAED_VERSION)" cargo build $(RUST_DAED_BUILD_ARGS)
	cp "$(RUST_DAED_BIN)" "$(OUTPUT)"
	strip "$(OUTPUT)" 2>/dev/null || true

daed-go-rollback: submodule $(DAE_WING_READY) dist
	cd wing && \
	$(MAKE) OUTPUT=../$(OUTPUT) APPNAME=$(APPNAME) WEB_DIST=../dist VERSION=$(VERSION) bundle
## End Bundle
