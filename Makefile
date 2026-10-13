SHELL := /bin/bash
CONFIGS := $(shell find . -name script.json -not -path './node_modules/*' -not -path '*/node_modules/*' | sort)

.PHONY: help list build install tag release

help:
	@echo "make list                         List configured userscripts"
	@echo "make build                        Build all compiled userscripts"
	@echo "make install SCRIPT=<id>          Build and install a userscript locally"
	@echo "make tag VERSION=x.y.z            Create the global release tag vVERSION"
	@echo "make release VERSION=x.y.z        Build, tag, and push a release"
	@echo ""
	@echo "Configured scripts:"
	@$(MAKE) --no-print-directory list

list:
	@for config in $(CONFIGS); do jq -r '"\(.id)\t\(.name)"' "$$config"; done

build:
	@for config in $(CONFIGS); do \
		if [[ "$$(jq -r '.type' "$$config")" == vite ]]; then \
			directory=$$(dirname "$$config"); \
			echo "Building $$(jq -r '.name' "$$config")"; \
			(cd "$$directory" && eval "$$(jq -r '.install' "$$(basename "$$config")")" && bun run build); \
		fi; \
	done

install:
	@test -n "$(SCRIPT)" || (echo "Usage: make install SCRIPT=<id>" >&2; exit 1)
	./scripts/install-local.sh "$(SCRIPT)"

tag:
	@test -n "$(VERSION)" || (echo "Usage: make tag VERSION=x.y.z" >&2; exit 1)
	@[[ "$(VERSION)" =~ ^[0-9]+\.[0-9]+\.[0-9]+$$ ]] || (echo "VERSION must use x.y.z format" >&2; exit 1)
	git tag "v$(VERSION)"

release: build
	@test -n "$(VERSION)" || (echo "Usage: make release VERSION=x.y.z" >&2; exit 1)
	@[[ "$(VERSION)" =~ ^[0-9]+\.[0-9]+\.[0-9]+$$ ]] || (echo "VERSION must use x.y.z format" >&2; exit 1)
	git tag "v$(VERSION)"
	git push origin "v$(VERSION)"
