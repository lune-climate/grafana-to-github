IMAGE:=luneclimate/grafana-to-github
VERSION:= $(shell grep '"version"' package.json | cut -d '"' -f 4 | head -n 1)

.PHONY: build-image
build-image:
	docker build -t ${IMAGE} .

.PHONY: publish
publish: build-image
	#test -z "$$(git status --porcelain)" || ( echo You have uncommited changes; exit 1; )
	docker tag ${IMAGE} ${IMAGE}:${VERSION}
	docker push ${IMAGE}:${VERSION}
