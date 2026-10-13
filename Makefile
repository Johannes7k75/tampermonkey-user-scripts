SHELL := /bin/bash
CONFIGS := $(shell find . -name script.json -not -path './node_modules/*' -not -path '*/node_modules/*' -not -path '*/.old/*' | sort)

.PHONY: help install-deps typecheck list build install tag release

help:
	@echo "make list                         List configured userscripts"
	@echo "make install-deps                 Install all workspace dependencies"
	@echo "make typecheck                    Type-check repository tooling"
	@echo "make build                        Build all userscripts into dist/"
	@echo "make install SCRIPT=<id>          Build and install a userscript locally"
	@echo "make tag VERSION=x.y.z            Create the global release tag vVERSION"
	@echo "make release VERSION=x.y.z        Build, tag, and push a release"
	@echo ""
	@echo "Configured scripts:"
	@$(MAKE) --no-print-directory list

install-deps:
	bun install --frozen-lockfile

typecheck:
	bun run typecheck

list:
	@for config in $(CONFIGS); do jq -r '"\(.id)\t\(.name)"' "$$config"; done

build:
	bun run build:userscripts

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
